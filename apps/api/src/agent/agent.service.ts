import { Injectable, Logger } from "@nestjs/common";
import {
  PlanDocument,
  PlanDocumentSchema,
  applyPlanPatch,
  validatePlanGeometry,
} from "@just-plan/plan-schema";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { EventsGateway } from "../events/events.gateway";

type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly mlUrl = process.env.ML_URL ?? "http://localhost:8000";

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly events: EventsGateway,
  ) {}

  async history(projectId: string, ownerId: string) {
    await this.projects.getOwned(projectId, ownerId);
    return this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  async chat(projectId: string, ownerId: string, message: string) {
    await this.projects.getOwned(projectId, ownerId);
    const { plan } = await this.projects.getCurrentPlan(projectId, ownerId);

    await this.prisma.chatMessage.create({
      data: {
        projectId,
        role: "user",
        content: message,
      },
    });

    this.events.emitAgent(projectId, {
      type: "status",
      status: "thinking",
    });

    let reply: string;
    let nextPlan = plan;
    let toolsUsed: string[] = [];

    try {
      const mlRes = await fetch(`${this.mlUrl}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, plan }),
        signal: AbortSignal.timeout(90_000),
      });
      if (mlRes.ok) {
        const data = (await mlRes.json()) as {
          reply: string;
          tool_calls?: ToolCall[];
          plan?: PlanDocument;
        };
        reply = data.reply;
        if (data.plan) {
          nextPlan = PlanDocumentSchema.parse(data.plan);
          toolsUsed = (data.tool_calls ?? [])
            .map((c) => c.name)
            .filter((n) => n !== "get_plan");
        } else if (data.tool_calls?.length) {
          const applied = this.applyTools(
            plan,
            data.tool_calls.filter((c) => c.name !== "get_plan"),
          );
          nextPlan = applied.plan;
          toolsUsed = applied.tools;
          reply = data.reply || applied.summary;
        }
      } else {
        const local = this.localAgent(plan, message);
        nextPlan = local.plan;
        reply = local.reply;
        toolsUsed = local.tools;
      }
    } catch (err) {
      this.logger.warn(
        `ML agent unavailable: ${err instanceof Error ? err.message : err}`,
      );
      const local = this.localAgent(plan, message);
      nextPlan = local.plan;
      reply = local.reply;
      toolsUsed = local.tools;
    }

    const issues = validatePlanGeometry(nextPlan);
    if (issues.length) {
      reply += `\n\nПредупреждение: геометрия содержит проблемы (${issues
        .map((i) => i.code)
        .join(", ")}). Изменения не применены.`;
    } else if (JSON.stringify(nextPlan) !== JSON.stringify(plan)) {
      const committed = await this.projects.commitPlan(
        projectId,
        ownerId,
        nextPlan,
        "agent",
      );
      nextPlan = committed.plan;
      this.events.emitPlan(projectId, {
        plan: nextPlan,
        revision: committed.revision,
      });
    }

    const assistant = await this.prisma.chatMessage.create({
      data: {
        projectId,
        role: "assistant",
        content: reply,
        meta: JSON.stringify({ toolsUsed }),
      },
    });

    this.events.emitAgent(projectId, {
      type: "message",
      message: assistant,
      plan: nextPlan,
    });

    return { message: assistant, plan: nextPlan, toolsUsed };
  }

  private applyTools(plan: PlanDocument, calls: ToolCall[]) {
    let current = plan;
    const tools: string[] = [];
    const notes: string[] = [];

    for (const call of calls) {
      tools.push(call.name);
      if (call.name === "add_wall") {
        const a = call.arguments.a as [number, number];
        const b = call.arguments.b as [number, number];
        const id = String(call.arguments.id ?? `w_${Date.now()}`);
        current = applyPlanPatch(current, {
          walls: [
            ...current.walls,
            {
              id,
              a,
              b,
              thickness: Number(call.arguments.thickness ?? 200),
              kind: (call.arguments.kind as "interior") ?? "interior",
            },
          ],
        });
        notes.push(`Добавлена стена ${id}`);
      } else if (call.name === "move_wall") {
        const id = String(call.arguments.id);
        const walls = current.walls.map((w) =>
          w.id === id
            ? {
                ...w,
                a: (call.arguments.a as [number, number]) ?? w.a,
                b: (call.arguments.b as [number, number]) ?? w.b,
              }
            : w,
        );
        current = applyPlanPatch(current, { walls });
        notes.push(`Сдвинута стена ${id}`);
      } else if (call.name === "add_opening") {
        const opening = {
          id: String(call.arguments.id ?? `o_${Date.now()}`),
          wallId: String(call.arguments.wallId),
          offset: Number(call.arguments.offset ?? 0),
          width: Number(call.arguments.width ?? 900),
          type: (call.arguments.type as "door" | "window" | "opening") ?? "door",
        };
        current = applyPlanPatch(current, {
          openings: [...current.openings, opening],
        });
        notes.push(`Добавлен проём ${opening.id}`);
      } else if (call.name === "set_room_label") {
        const id = String(call.arguments.id);
        const name = String(call.arguments.name ?? "");
        const rooms = current.rooms.map((r) =>
          r.id === id ? { ...r, name } : r,
        );
        current = applyPlanPatch(current, { rooms });
        notes.push(`Комната ${id} → «${name}»`);
      } else if (call.name === "remove_entity") {
        const id = String(call.arguments.id);
        current = applyPlanPatch(current, {
          walls: current.walls.filter((w) => w.id !== id),
          openings: current.openings.filter((o) => o.id !== id),
          rooms: current.rooms.filter((r) => r.id !== id),
          furniture: current.furniture.filter((f) => f.id !== id),
        });
        notes.push(`Удалена сущность ${id}`);
      } else if (call.name === "propose_layout_diff") {
        if (call.arguments.plan) {
          current = PlanDocumentSchema.parse(call.arguments.plan);
          notes.push("Применён полный diff планировки");
        }
      }
    }

    return {
      plan: current,
      tools,
      summary: notes.join(". ") || "План обновлён.",
    };
  }

  private ensureShell(plan: PlanDocument): PlanDocument {
    if (plan.walls.length > 0) return plan;
    return applyPlanPatch(plan, {
      walls: [
        { id: "w1", a: [0, 0], b: [8000, 0], thickness: 200, kind: "exterior" },
        { id: "w2", a: [8000, 0], b: [8000, 6000], thickness: 200, kind: "exterior" },
        { id: "w3", a: [8000, 6000], b: [0, 6000], thickness: 200, kind: "exterior" },
        { id: "w4", a: [0, 6000], b: [0, 0], thickness: 200, kind: "exterior" },
        { id: "w5", a: [4000, 0], b: [4000, 6000], thickness: 120, kind: "interior" },
      ],
      rooms: [
        {
          id: "r1",
          name: "комната 1",
          polygon: [
            [0, 0],
            [4000, 0],
            [4000, 6000],
            [0, 6000],
          ],
          tags: [],
        },
        {
          id: "r2",
          name: "комната 2",
          polygon: [
            [4000, 0],
            [8000, 0],
            [8000, 6000],
            [4000, 6000],
          ],
          tags: [],
        },
      ],
    });
  }

  /** Offline heuristic agent for MVP without LLM keys. */
  private localAgent(plan: PlanDocument, message: string) {
    const lower = message.toLowerCase();
    const tools: string[] = [];
    const actionable =
      lower.includes("open-space") ||
      lower.includes("open space") ||
      lower.includes("убери стен") ||
      lower.includes("кухн") ||
      lower.includes("kitchen") ||
      lower.includes("двер") ||
      lower.includes("door") ||
      lower.includes("стен") ||
      lower.includes("wall");
    if (actionable) {
      plan = this.ensureShell(plan);
    }

    if (lower.includes("open-space") || lower.includes("open space") || lower.includes("убери стен")) {
      const interior = plan.walls.find((w) => w.kind === "interior");
      if (interior) {
        tools.push("remove_entity");
        const next = applyPlanPatch(plan, {
          walls: plan.walls.filter((w) => w.id !== interior.id),
          openings: plan.openings.filter((o) => o.wallId !== interior.id),
        });
        return {
          plan: next,
          tools,
          reply: `Убрал внутреннюю стену ${interior.id} для open-space.`,
        };
      }
    }

    if (lower.includes("кухн") || lower.includes("kitchen")) {
      const room = plan.rooms[0];
      if (room) {
        tools.push("set_room_label");
        const rooms = plan.rooms.map((r, idx) =>
          idx === 0 ? { ...r, name: "кухня", tags: ["kitchen"] } : r,
        );
        return {
          plan: applyPlanPatch(plan, { rooms }),
          tools,
          reply: `Пометил комнату ${room.id} как «кухня».`,
        };
      }
    }

    if (lower.includes("двер") || lower.includes("door")) {
      const wall = plan.walls.find((w) => w.kind === "interior") ?? plan.walls[0];
      if (wall) {
        tools.push("add_opening");
        const opening = {
          id: `d_${Date.now()}`,
          wallId: wall.id,
          offset: 1000,
          width: 900,
          type: "door" as const,
        };
        return {
          plan: applyPlanPatch(plan, {
            openings: [...plan.openings, opening],
          }),
          tools,
          reply: `Добавил дверь ${opening.id} на стену ${wall.id}.`,
        };
      }
    }

    if (lower.includes("стен") || lower.includes("wall")) {
      tools.push("add_wall");
      const id = `w_${Date.now()}`;
      return {
        plan: applyPlanPatch(plan, {
          walls: [
            ...plan.walls,
            {
              id,
              a: [2000, 0],
              b: [2000, 6000],
              thickness: 120,
              kind: "interior",
            },
          ],
        }),
        tools,
        reply: `Добавил внутреннюю стену ${id}.`,
      };
    }

    return {
      plan,
      tools: ["get_plan"],
      reply:
        "Понял запрос. Сейчас доступны команды: open-space / убери стену, кухня, дверь, стена. Подключите ML_URL и OPENAI_API_KEY для полноценного LLM-агента.",
    };
  }
}

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { emptyPlan, PlanDocumentSchema } from "@just-plan/plan-schema";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "../projects/projects.service";
import { EventsGateway } from "../events/events.gateway";
import { logError, logInfo } from "../common/logger";

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);
  private readonly mlUrl = process.env.ML_URL ?? "http://localhost:8000";

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly events: EventsGateway,
  ) {}

  onModuleInit() {
    // Process queued jobs periodically (no Redis required for local MVP).
    setInterval(() => {
      void this.processNext();
    }, 2000);
  }

  async enqueueVectorize(input: {
    projectId: string;
    ownerId: string;
    assetId: string;
    assetKey: string;
    assetUrl: string;
    pixelsPerMeter?: number | null;
  }) {
    await this.projects.getOwned(input.projectId, input.ownerId);
    const job = await this.prisma.job.create({
      data: {
        projectId: input.projectId,
        type: "vectorize",
        status: "queued",
        progress: 0,
        payload: JSON.stringify({
          assetId: input.assetId,
          assetKey: input.assetKey,
          assetUrl: input.assetUrl,
          pixelsPerMeter: input.pixelsPerMeter ?? null,
          ownerId: input.ownerId,
        }),
      },
    });
    logInfo("job.enqueued", { jobId: job.id, type: job.type, projectId: input.projectId });
    this.events.emitJob(input.projectId, job);
    return job;
  }

  async get(jobId: string) {
    return this.prisma.job.findUnique({ where: { id: jobId } });
  }

  async listForProject(projectId: string, ownerId: string) {
    await this.projects.getOwned(projectId, ownerId);
    return this.prisma.job.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  private async processNext() {
    const job = await this.prisma.job.findFirst({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
    });
    if (!job) return;

    await this.updateJob(job.id, job.projectId, {
      status: "running",
      progress: 10,
    });

    try {
      if (job.type === "vectorize") {
        await this.runVectorize(job.id, job.projectId, job.payload);
      } else {
        throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${job.id} failed: ${message}`);
      logError("job.failed", { jobId: job.id, error: message });
      // Simple retry: re-queue once if never retried.
      const payload = JSON.parse(job.payload || "{}") as { retries?: number };
      if ((payload.retries ?? 0) < 1) {
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: "queued",
            progress: 0,
            error: null,
            payload: JSON.stringify({ ...payload, retries: 1 }),
          },
        });
        logInfo("job.retry", { jobId: job.id });
        return;
      }
      await this.updateJob(job.id, job.projectId, {
        status: "failed",
        progress: 100,
        error: message,
      });
    }
  }

  private async runVectorize(
    jobId: string,
    projectId: string,
    payloadRaw: string,
  ) {
    const payload = JSON.parse(payloadRaw) as {
      assetId: string;
      assetKey: string;
      assetUrl: string;
      pixelsPerMeter: number | null;
      ownerId: string;
    };

    await this.updateJob(jobId, projectId, { progress: 30 });

    let plan = emptyPlan({
      meta: {
        sourceImageId: payload.assetId,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      scale: { pixelsPerMeter: payload.pixelsPerMeter },
    });

    try {
      const apiBase = process.env.API_URL ?? "http://localhost:4000";
      const imageUrl = payload.assetUrl.startsWith("http")
        ? payload.assetUrl
        : `${apiBase}${payload.assetUrl}`;

      const res = await fetch(`${this.mlUrl}/vectorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          pixels_per_meter: payload.pixelsPerMeter,
          source_image_id: payload.assetId,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (res.ok) {
        const data = (await res.json()) as { plan: unknown };
        plan = PlanDocumentSchema.parse(data.plan);
      } else {
        this.logger.warn(
          `ML vectorize HTTP ${res.status}, using local fallback`,
        );
        plan = this.fallbackPlan(payload.assetId, payload.pixelsPerMeter);
      }
    } catch (err) {
      this.logger.warn(
        `ML unavailable (${err instanceof Error ? err.message : err}), using fallback geometry`,
      );
      plan = this.fallbackPlan(payload.assetId, payload.pixelsPerMeter);
    }

    await this.updateJob(jobId, projectId, { progress: 80 });
    const committed = await this.projects.commitPlan(
      projectId,
      payload.ownerId,
      plan,
      "vectorize",
    );

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        thumbnailUrl: payload.assetUrl,
      },
    });

    await this.updateJob(jobId, projectId, {
      status: "completed",
      progress: 100,
      result: JSON.stringify({
        revisionId: committed.revision.id,
        version: committed.plan.meta.version,
      }),
    });
  }

  private fallbackPlan(
    sourceImageId: string,
    pixelsPerMeter: number | null,
  ) {
    // Deterministic rectangular outline so the canvas works offline.
    return PlanDocumentSchema.parse({
      units: "mm",
      scale: { pixelsPerMeter },
      walls: [
        { id: "w1", a: [0, 0], b: [8000, 0], thickness: 200, kind: "exterior" },
        {
          id: "w2",
          a: [8000, 0],
          b: [8000, 6000],
          thickness: 200,
          kind: "exterior",
        },
        {
          id: "w3",
          a: [8000, 6000],
          b: [0, 6000],
          thickness: 200,
          kind: "exterior",
        },
        {
          id: "w4",
          a: [0, 6000],
          b: [0, 0],
          thickness: 200,
          kind: "exterior",
        },
        {
          id: "w5",
          a: [4000, 0],
          b: [4000, 6000],
          thickness: 120,
          kind: "interior",
        },
      ],
      openings: [
        {
          id: "d1",
          wallId: "w5",
          offset: 2500,
          width: 900,
          type: "door",
        },
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
      furniture: [],
      meta: {
        sourceImageId,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  private async updateJob(
    id: string,
    projectId: string,
    data: {
      status?: string;
      progress?: number;
      result?: string;
      error?: string;
    },
  ) {
    const job = await this.prisma.job.update({ where: { id }, data });
    this.events.emitJob(projectId, job);
    return job;
  }
}

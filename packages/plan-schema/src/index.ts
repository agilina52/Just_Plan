import { z } from "zod";

export const PointSchema = z.tuple([z.number(), z.number()]);
export type Point = z.infer<typeof PointSchema>;

export const WallSchema = z.object({
  id: z.string(),
  a: PointSchema,
  b: PointSchema,
  thickness: z.number().positive().default(200),
  kind: z.enum(["exterior", "interior", "unknown"]).default("unknown"),
});
export type Wall = z.infer<typeof WallSchema>;

export const OpeningSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  offset: z.number().nonnegative(),
  width: z.number().positive(),
  type: z.enum(["door", "window", "opening"]),
});
export type Opening = z.infer<typeof OpeningSchema>;

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  polygon: z.array(PointSchema).min(3),
  tags: z.array(z.string()).default([]),
});
export type Room = z.infer<typeof RoomSchema>;

export const FurnitureSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: PointSchema,
  rotation: z.number().default(0),
  size: z.tuple([z.number(), z.number()]).optional(),
});
export type Furniture = z.infer<typeof FurnitureSchema>;

export const PlanScaleSchema = z.object({
  pixelsPerMeter: z.number().positive().nullable().default(null),
});

export const PlanMetaSchema = z.object({
  sourceImageId: z.string().nullable().default(null),
  version: z.number().int().nonnegative().default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const PlanDocumentSchema = z.object({
  units: z.enum(["mm", "cm", "m"]).default("mm"),
  scale: PlanScaleSchema.default({ pixelsPerMeter: null }),
  walls: z.array(WallSchema).default([]),
  openings: z.array(OpeningSchema).default([]),
  rooms: z.array(RoomSchema).default([]),
  furniture: z.array(FurnitureSchema).default([]),
  meta: PlanMetaSchema.default({
    sourceImageId: null,
    version: 1,
  }),
});
export type PlanDocument = z.infer<typeof PlanDocumentSchema>;

export function emptyPlan(partial?: Partial<PlanDocument>): PlanDocument {
  return PlanDocumentSchema.parse({
    units: "mm",
    scale: { pixelsPerMeter: null },
    walls: [],
    openings: [],
    rooms: [],
    furniture: [],
    meta: {
      sourceImageId: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ...partial,
  });
}

export type GeometryIssue = {
  code: string;
  message: string;
  entityId?: string;
};

export function validatePlanGeometry(plan: PlanDocument): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  const wallIds = new Set(plan.walls.map((w) => w.id));

  for (const wall of plan.walls) {
    const [x1, y1] = wall.a;
    const [x2, y2] = wall.b;
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 1) {
      issues.push({
        code: "WALL_ZERO_LENGTH",
        message: `Wall ${wall.id} has near-zero length`,
        entityId: wall.id,
      });
    }
    if (wall.thickness <= 0) {
      issues.push({
        code: "WALL_THICKNESS",
        message: `Wall ${wall.id} has invalid thickness`,
        entityId: wall.id,
      });
    }
  }

  for (const opening of plan.openings) {
    if (!wallIds.has(opening.wallId)) {
      issues.push({
        code: "OPENING_MISSING_WALL",
        message: `Opening ${opening.id} references missing wall ${opening.wallId}`,
        entityId: opening.id,
      });
    }
    if (opening.width <= 0) {
      issues.push({
        code: "OPENING_WIDTH",
        message: `Opening ${opening.id} has invalid width`,
        entityId: opening.id,
      });
    }
  }

  for (const room of plan.rooms) {
    if (room.polygon.length < 3) {
      issues.push({
        code: "ROOM_POLYGON",
        message: `Room ${room.id} needs at least 3 points`,
        entityId: room.id,
      });
    }
  }

  return issues;
}

export function applyPlanPatch(
  plan: PlanDocument,
  patch: Partial<PlanDocument>,
): PlanDocument {
  const next = PlanDocumentSchema.parse({
    ...plan,
    ...patch,
    scale: patch.scale ?? plan.scale,
    meta: {
      ...plan.meta,
      ...(patch.meta ?? {}),
      version: plan.meta.version + 1,
      updatedAt: new Date().toISOString(),
    },
  });
  const issues = validatePlanGeometry(next);
  if (issues.length > 0) {
    const err = new Error(
      `Invalid plan geometry: ${issues.map((i) => i.code).join(", ")}`,
    );
    (err as Error & { issues: GeometryIssue[] }).issues = issues;
    throw err;
  }
  return next;
}

export const AgentToolNames = [
  "get_plan",
  "add_wall",
  "move_wall",
  "add_opening",
  "set_room_label",
  "remove_entity",
  "propose_layout_diff",
] as const;

export type AgentToolName = (typeof AgentToolNames)[number];

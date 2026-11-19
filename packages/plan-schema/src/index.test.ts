import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyPlan,
  validatePlanGeometry,
  applyPlanPatch,
  PlanDocumentSchema,
} from "./index";

test("emptyPlan creates a valid document", () => {
  const plan = emptyPlan();
  assert.equal(plan.walls.length, 0);
  assert.equal(plan.meta.version, 1);
  assert.doesNotThrow(() => PlanDocumentSchema.parse(plan));
});

test("validatePlanGeometry catches zero-length walls", () => {
  const plan = emptyPlan({
    walls: [{ id: "w1", a: [0, 0], b: [0, 0], thickness: 200, kind: "unknown" }],
  });
  const issues = validatePlanGeometry(plan);
  assert.ok(issues.some((i) => i.code === "WALL_ZERO_LENGTH"));
});

test("applyPlanPatch bumps version", () => {
  const plan = emptyPlan();
  const next = applyPlanPatch(plan, {
    walls: [{ id: "w1", a: [0, 0], b: [4000, 0], thickness: 200, kind: "exterior" }],
  });
  assert.equal(next.meta.version, 2);
  assert.equal(next.walls.length, 1);
});

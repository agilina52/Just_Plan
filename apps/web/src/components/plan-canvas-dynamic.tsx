"use client";

import dynamic from "next/dynamic";
import type { PlanDocument } from "@just-plan/plan-schema";

export const PlanCanvasDynamic = dynamic(
  () => import("./plan-canvas").then((m) => m.PlanCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#efe9dc] text-sm text-ink/50">
        Загрузка canvas…
      </div>
    ),
  },
) as React.ComponentType<{
  plan: PlanDocument;
  underlayUrl?: string | null;
  onPlanChange?: (plan: PlanDocument) => void;
}>;

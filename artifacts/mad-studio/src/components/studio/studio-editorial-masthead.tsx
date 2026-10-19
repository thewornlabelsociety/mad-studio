"use client"

import {
  STUDIO_WIZARD_STEPS,
  WORKBENCH_STEP_MEDIA,
  WORKBENCH_STEP_INTENT,
  WORKBENCH_STEP_CANVAS,
  WORKBENCH_STEP_COPY,
  WORKBENCH_STEP_CHANNELS,
  type WorkbenchFlowStep,
} from "@/lib/studio/workbench-steps"
import { cn } from "@/lib/utils"

const STEP_DECK: Partial<Record<WorkbenchFlowStep, string>> = {
  [WORKBENCH_STEP_MEDIA]: "Source photography and motion for this drop.",
  [WORKBENCH_STEP_INTENT]: "Set audience, hook, and strategic intent.",
  [WORKBENCH_STEP_CANVAS]: "Compose type, crop, and on-screen story.",
  [WORKBENCH_STEP_COPY]: "Refine caption, tags, and conversion copy.",
  [WORKBENCH_STEP_CHANNELS]: "Schedule channels and publish or arm.",
}

type Props = {
  brandName: string
  step: WorkbenchFlowStep
  className?: string
}

export function StudioEditorialMasthead({
  brandName,
  step,
  className,
}: Props) {
  const stepRow = STUDIO_WIZARD_STEPS.find((row) => row.id === step)
  const stepIndex =
    STUDIO_WIZARD_STEPS.findIndex((row) => row.id === step) + 1
  const stepLabel = stepRow?.label ?? "Create"
  const deck = STEP_DECK[step as keyof typeof STEP_DECK]

  return (
    <header
      className={cn(
        "px-4 py-3 md:px-6 md:py-3.5",
        className
      )}
    >
      <p className="text-[11px] font-medium tracking-[0.22em] text-neutral-500 uppercase">
        Create · {brandName}
      </p>
      <div className="mt-1.5 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
        <div className="min-w-0 max-w-3xl">
          <h1 className="brand-typewriter text-[clamp(1.35rem,3vw,2rem)] leading-tight text-mad-black">
            {stepLabel}
          </h1>
          {deck ? (
            <p className="mt-1 max-w-xl text-xs leading-snug text-neutral-600 md:text-sm">
              {deck}
            </p>
          ) : null}
        </div>
        <p
          className="shrink-0 font-serif text-sm tracking-wide text-neutral-400 tabular-nums"
          aria-hidden
        >
          {String(stepIndex).padStart(2, "0")} /{" "}
          {String(STUDIO_WIZARD_STEPS.length).padStart(2, "0")}
        </p>
      </div>
    </header>
  )
}

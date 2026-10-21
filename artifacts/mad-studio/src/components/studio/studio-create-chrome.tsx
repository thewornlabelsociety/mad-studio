"use client"

import {
  STUDIO_WIZARD_STEPS,
  type WorkbenchFlowStep,
} from "@/lib/studio/workbench-steps"
import { studioWizardSopForStep } from "@/lib/studio/studio-wizard-sop"
import { StudioWizardSopHover } from "@/components/studio/studio-wizard-sop-tooltip"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = {
  brandName: string
  step: WorkbenchFlowStep
  onStepChange?: (step: WorkbenchFlowStep) => void
}

/** One thin step rail — no large brand/step title block. */
export function StudioCreateChrome({
  brandName,
  step,
  onStepChange,
}: Props) {
  const stepRow = STUDIO_WIZARD_STEPS.find((row) => row.id === step)
  const stepLabel = stepRow?.label ?? "Create"

  return (
    <TooltipProvider delayDuration={250}>
      <div className="w-full shrink-0 border-b border-neutral-200 bg-white px-2 py-1 sm:px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className="hidden min-w-0 shrink truncate text-[10px] font-medium tracking-wide text-neutral-500 uppercase sm:block sm:max-w-[7rem]"
            title={`${brandName} · ${stepLabel}`}
          >
            <span className="text-mad-black">{stepLabel}</span>
          </p>

          <nav
            aria-label="Studio steps"
            className="min-w-0 flex-1 overflow-hidden"
          >
            <ol className="flex w-full items-center gap-0.5">
              {STUDIO_WIZARD_STEPS.map((item, index) => {
                const active = step === item.id
                const complete = step > item.id
                const itemSop = studioWizardSopForStep(item.id)
                const tab = (
                  <button
                    type="button"
                    disabled={!onStepChange}
                    onClick={() => {
                      onStepChange?.(item.id)
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }}
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-center gap-1 rounded px-0.5 py-0.5 transition-colors",
                      !onStepChange && "cursor-default",
                      active
                        ? "text-mad-black"
                        : "text-neutral-400 hover:text-neutral-700"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                        active
                          ? "bg-mad-black text-white"
                          : complete
                            ? "bg-neutral-200 text-neutral-700"
                            : "bg-neutral-100 text-neutral-400"
                      )}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[11px] font-medium",
                        active ? "inline" : "hidden xl:inline"
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                )
                return (
                  <li key={item.id} className="flex min-w-0 flex-1">
                    {itemSop ? (
                      <StudioWizardSopHover sop={itemSop} side="bottom">
                        {tab}
                      </StudioWizardSopHover>
                    ) : (
                      tab
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>
      </div>
    </TooltipProvider>
  )
}

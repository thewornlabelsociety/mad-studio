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

export function StudioCreateChrome({
  brandName,
  step,
  onStepChange,
}: Props) {
  const stepRow = STUDIO_WIZARD_STEPS.find((row) => row.id === step)
  const stepIndex =
    STUDIO_WIZARD_STEPS.findIndex((row) => row.id === step) + 1
  const stepLabel = stepRow?.label ?? "Create"

  return (
    <TooltipProvider delayDuration={250}>
      <div className="relative w-full shrink-0 border-b border-neutral-200 bg-white px-2.5 py-1 sm:px-3 lg:px-3 lg:py-1.5">
        <p
          className="absolute right-2.5 top-1.5 font-serif text-xs tabular-nums text-neutral-400 sm:right-3 lg:right-3"
          aria-label={`Step ${stepIndex} of ${STUDIO_WIZARD_STEPS.length}`}
        >
          {String(stepIndex).padStart(2, "0")} /{" "}
          {String(STUDIO_WIZARD_STEPS.length).padStart(2, "0")}
        </p>

        <div className="flex flex-col gap-1 pr-12 sm:flex-row sm:items-center sm:gap-3 lg:gap-4 lg:pr-14">
          <div className="min-w-0 shrink-0 sm:max-w-[8rem] lg:max-w-[10rem]">
            <p className="truncate text-[10.5px] font-medium tracking-[0.16em] text-neutral-500 uppercase">
              {brandName}
            </p>
            <h1 className="brand-typewriter truncate text-base leading-tight text-mad-black lg:text-lg">
              {stepLabel}
            </h1>
          </div>

          <nav
            aria-label="Studio steps"
            className="min-w-0 w-full flex-1 overflow-hidden"
          >
            <ol className="flex w-full items-center justify-between gap-0.5 sm:gap-1">
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
                      "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-0.5 py-1 transition-colors sm:px-1",
                      !onStepChange && "cursor-default",
                      active
                        ? "text-mad-black"
                        : "text-neutral-400 hover:text-neutral-700"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums sm:size-7 sm:text-[12px]",
                        active
                          ? "bg-mad-black text-white"
                          : complete
                            ? "bg-neutral-200 text-neutral-700"
                            : "bg-neutral-100 text-neutral-400"
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="hidden truncate text-[12px] font-medium lg:inline xl:text-xs">
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

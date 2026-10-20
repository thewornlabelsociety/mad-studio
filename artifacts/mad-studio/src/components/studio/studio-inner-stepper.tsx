"use client"

import { CircleHelp } from "lucide-react"

import {
  STUDIO_WIZARD_STEPS,
  type WorkbenchFlowStep,
} from "@/lib/studio/workbench-steps"
import { studioWizardSopForStep } from "@/lib/studio/studio-wizard-sop"
import { StudioWizardSopHover } from "@/components/studio/studio-wizard-sop-tooltip"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = {
  step: WorkbenchFlowStep
  onStepChange?: (step: WorkbenchFlowStep) => void
  className?: string
}

export function StudioInnerStepper({ step, onStepChange, className }: Props) {
  const stepLabel =
    STUDIO_WIZARD_STEPS.find((row) => row.id === step)?.label ?? "Media"
  const activeSop = studioWizardSopForStep(step)

  return (
    <TooltipProvider delayDuration={250}>
      <nav
        aria-label="Studio steps"
        className={cn(
          "px-4 md:px-6",
          className
        )}
      >
        <ol className="flex gap-0.5 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] md:gap-1 [&::-webkit-scrollbar]:hidden">
          {STUDIO_WIZARD_STEPS.map((item, index) => {
            const active = step === item.id
            const complete = step > item.id
            const itemSop = studioWizardSopForStep(item.id)
            const tabButton = (
              <button
                type="button"
                disabled={!onStepChange}
                onClick={() => {
                  onStepChange?.(item.id)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className={cn(
                  "group relative shrink-0 px-2.5 py-2 text-left transition-colors disabled:cursor-default",
                  active ? "text-mad-black" : "text-neutral-400 hover:text-neutral-700"
                )}
              >
                <span className="block font-serif text-[11.5px] tracking-[0.16em] uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-sm font-medium tracking-wide",
                    active && "font-semibold"
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-px origin-left scale-x-0 bg-mad-black transition-transform",
                    active && "scale-x-100",
                    complete && !active && "scale-x-100 bg-neutral-300"
                  )}
                  aria-hidden
                />
              </button>
            )

            return (
              <li key={item.id} className="flex min-w-0">
                {itemSop ? (
                  <StudioWizardSopHover sop={itemSop} side="bottom">
                    {tabButton}
                  </StudioWizardSopHover>
                ) : (
                  tabButton
                )}
              </li>
            )
          })}
        </ol>

        {activeSop ? (
          <div className="flex items-start gap-2 border-t border-neutral-200/70 py-2">
            <p className="min-w-0 flex-1 text-xs leading-snug text-neutral-600">
              <span className="mr-2 font-serif text-[12px] tracking-[0.14em] text-neutral-400 uppercase">
                Note
              </span>
              {activeSop.hint}
            </p>
            <StudioWizardSopHover sop={activeSop} side="left">
              <button
                type="button"
                className="mt-0.5 shrink-0 rounded-full border border-neutral-200 bg-white p-1.5 text-neutral-500 hover:border-neutral-300 hover:text-mad-black md:hidden"
                aria-label={`${stepLabel} step checklist`}
              >
                <CircleHelp className="size-4" aria-hidden />
              </button>
            </StudioWizardSopHover>
          </div>
        ) : null}
      </nav>
    </TooltipProvider>
  )
}

"use client"

import { Check, CircleHelp } from "lucide-react"

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

function studioWizardIndex(step: WorkbenchFlowStep): number {
  const idx = STUDIO_WIZARD_STEPS.findIndex((row) => row.id === step)
  return idx >= 0 ? idx + 1 : 1
}

export function StudioInnerStepper({ step, onStepChange, className }: Props) {
  const currentStep = studioWizardIndex(step)
  const totalSteps = STUDIO_WIZARD_STEPS.length
  const stepLabel =
    STUDIO_WIZARD_STEPS.find((row) => row.id === step)?.label ?? "Media"
  const activeSop = studioWizardSopForStep(step)

  return (
    <TooltipProvider delayDuration={250}>
    <nav aria-label="Studio steps" className={cn(className)}>
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 md:hidden">
        <span className="font-mono text-xs font-bold tracking-wider text-neutral-900 uppercase">
          Step {currentStep} of {totalSteps}: {stepLabel}
        </span>
        <div className="flex items-center gap-1.5" aria-hidden>
          {STUDIO_WIZARD_STEPS.map((item, index) => {
            const active = step === item.id
            const complete = step > item.id
            return (
              <span
                key={item.id}
                className={cn(
                  "h-2 rounded-full transition-all",
                  active
                    ? "w-6 border border-mad-black bg-mad-lime"
                    : complete
                      ? "w-2 bg-mad-black"
                      : "w-2 bg-neutral-300"
                )}
              />
            )
          })}
        </div>
      </div>

      <ol className="hidden border-b border-mad-black/15 md:flex md:gap-0">
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
                "flex w-full items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-center transition",
                active
                  ? "border-mad-black text-mad-black"
                  : complete
                    ? "border-mad-lime text-mad-black"
                    : "border-transparent text-neutral-400 hover:text-mad-black"
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center font-typewriter text-[0.65rem] font-bold",
                  active
                    ? "bg-mad-black text-mad-white"
                    : complete
                      ? "bg-mad-lime text-mad-black"
                      : "bg-neutral-100 text-neutral-500"
                )}
              >
                {complete ? <Check className="size-3 stroke-[3]" /> : index + 1}
              </span>
              <span className="truncate font-typewriter text-[0.65rem] font-bold tracking-wider uppercase">
                {item.label}
              </span>
            </button>
          )

          return (
            <li key={item.id} className="flex min-w-0 flex-1">
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
        <div className="flex items-start gap-2 border-b border-mad-black/10 bg-mad-lime/15 px-3 py-2 md:px-4">
          <p className="min-w-0 flex-1 text-xs leading-snug text-neutral-700">
            <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-vermillion uppercase">
              SOP ·{" "}
            </span>
            {activeSop.hint}
          </p>
          <StudioWizardSopHover sop={activeSop} side="left">
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded-none border border-mad-black/40 bg-mad-white p-1 text-neutral-600 hover:bg-mad-white hover:text-mad-black md:hidden"
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

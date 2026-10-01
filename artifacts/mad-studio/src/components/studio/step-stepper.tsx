"use client"

import { Link } from "wouter"
import { Check } from "lucide-react"

import {
  WORKBENCH_STEP_CANVAS,
  WORKBENCH_STEP_CHANNELS,
  WORKBENCH_STEP_COPY,
  WORKBENCH_STEP_INTENT,
  WORKBENCH_STEP_MEDIA,
  WORKBENCH_STEP_TODAY,
  type WorkbenchFlowStep,
} from "@/lib/studio/workbench-steps"
import { cn } from "@/lib/utils"

export const WORKBENCH_STEPS = [
  {
    id: WORKBENCH_STEP_TODAY,
    key: "today",
    label: "Today",
    short: "Today",
    cue: "Intake queue",
  },
  {
    id: WORKBENCH_STEP_MEDIA,
    key: "media",
    label: "Media",
    short: "Media",
    cue: "Upload & external edits",
  },
  {
    id: WORKBENCH_STEP_INTENT,
    key: "intent",
    label: "Intent",
    short: "Intent",
    cue: "DNA & audience",
  },
  {
    id: WORKBENCH_STEP_CANVAS,
    key: "canvas",
    label: "Canvas",
    short: "Canvas",
    cue: "On-image text",
  },
  {
    id: WORKBENCH_STEP_COPY,
    key: "copy",
    label: "Copy",
    short: "Copy",
    cue: "Hooks & captions",
  },
  {
    id: WORKBENCH_STEP_CHANNELS,
    key: "channels",
    label: "Schedule",
    short: "Schedule",
    cue: "Preview & publish",
  },
] as const

export type WorkbenchStepId = WorkbenchFlowStep

type StepStepperProps = {
  step: WorkbenchStepId
  onStepChange?: (step: WorkbenchStepId) => void
  todayHref?: string | null
  className?: string
}

export function StepStepper({
  step,
  onStepChange,
  todayHref = null,
  className,
}: StepStepperProps) {
  return (
    <nav
      aria-label="Workbench progress"
      className={cn("border-b border-mad-black/15", className)}
    >
      <ol className="flex gap-0">
        {WORKBENCH_STEPS.map((item) => {
          const active = step === item.id
          const complete = step > item.id
          const isToday = item.id === WORKBENCH_STEP_TODAY

          const inner = (
            <>
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
                {complete ? <Check className="size-3 stroke-[3]" /> : item.id}
              </span>
              <span className="truncate font-typewriter text-[0.65rem] font-bold tracking-wider uppercase">
                {item.label}
              </span>
            </>
          )

          return (
            <li key={item.id} className="flex min-w-0 flex-1">
              {isToday && todayHref ? (
                <Link
                  href={todayHref}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-center transition",
                    active
                      ? "border-mad-black text-mad-black"
                      : complete
                        ? "border-mad-lime text-mad-black"
                        : "border-transparent text-neutral-400 hover:text-mad-black"
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (isToday && todayHref) return
                    onStepChange?.(item.id)
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                  disabled={isToday && !todayHref}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-center transition",
                    active
                      ? "border-mad-black text-mad-black"
                      : complete
                        ? "border-mad-lime text-mad-black"
                        : "border-transparent text-neutral-400 hover:text-mad-black",
                    isToday && !todayHref && "cursor-default opacity-60"
                  )}
                >
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

type StepDockProps = {
  step: WorkbenchStepId
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextBusy?: boolean
  onSaveDraft?: () => void
  saveDraftBusy?: boolean
  showScheduleActions?: boolean
  onConfirmArm?: () => void
  confirmArmBusy?: boolean
  confirmArmDisabled?: boolean
  className?: string
}

export function StepDock({
  step,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextBusy = false,
  onSaveDraft,
  saveDraftBusy = false,
  showScheduleActions = false,
  onConfirmArm,
  confirmArmBusy = false,
  confirmArmDisabled = false,
  className,
}: StepDockProps) {
  const primary =
    nextLabel ??
    (step === WORKBENCH_STEP_CHANNELS ? "Confirm & publish" : "Continue")

  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 border-t border-mad-black/20 bg-mad-white/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex w-full items-center justify-between gap-3 py-2">

        <button
          type="button"
          onClick={() => {
            onBack()
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
          disabled={step <= WORKBENCH_STEP_MEDIA}
          className="border border-mad-black/30 bg-mad-white px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase hover:border-mad-black hover:bg-mad-lime/40 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Back
        </button>
        {showScheduleActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onSaveDraft?.()}
              disabled={saveDraftBusy || confirmArmBusy}
              className="border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase hover:bg-mad-lime disabled:opacity-40"
            >
              {saveDraftBusy ? "Saving…" : "💾 Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => onConfirmArm?.()}
              disabled={confirmArmDisabled || confirmArmBusy || saveDraftBusy}
              className="inline-flex min-w-[10rem] items-center justify-center border-2 border-mad-black bg-mad-black px-4 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
            >
              {confirmArmBusy ? "Arming…" : "🚀 Confirm & Publish / Arm"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onNext()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            disabled={nextDisabled || nextBusy}
            className="inline-flex min-w-[8.5rem] items-center justify-center border-2 border-mad-black bg-mad-black px-4 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
          >
            {nextBusy ? "Working…" : primary}
          </button>
        )}
      </div>
    </div>
  )
}

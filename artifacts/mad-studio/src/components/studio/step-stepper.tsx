"use client"

import { Link } from "wouter"
import { ArrowRight, Check } from "lucide-react"

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
    id: WORKBENCH_STEP_CANVAS,
    key: "canvas",
    label: "Canvas",
    short: "Canvas",
    cue: "On-image text",
  },
  {
    id: WORKBENCH_STEP_INTENT,
    key: "intent",
    label: "Intent",
    short: "Intent",
    cue: "DNA & audience",
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
                  "flex size-5 shrink-0 items-center justify-center font-typewriter text-[0.75rem] font-bold",
                  active
                    ? "bg-mad-black text-mad-white"
                    : complete
                      ? "bg-mad-lime text-mad-black"
                      : "bg-neutral-100 text-neutral-500"
                )}
              >
                {complete ? <Check className="size-3 stroke-[3]" /> : item.id}
              </span>
              <span className="truncate font-typewriter text-[0.75rem] font-bold tracking-wider uppercase">
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
  previewDrawerOpen?: boolean
  onTogglePreviewDrawer?: () => void
  /** Hide Preview toggle when inline live preview is shown (lg+). */
  hidePreviewToggleOnWide?: boolean
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
  previewDrawerOpen = false,
  onTogglePreviewDrawer,
  hidePreviewToggleOnWide = false,
  className,
}: StepDockProps) {
  const primary =
    nextLabel ??
    (step === WORKBENCH_STEP_CHANNELS ? "Confirm & publish" : "Continue")

  return (
    <div className={cn("w-full", className)}>
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onBack()
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
            disabled={step <= WORKBENCH_STEP_MEDIA}
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-mad-black hover:underline disabled:cursor-not-allowed disabled:opacity-30"
          >
            Back
          </button>
          {onTogglePreviewDrawer ? (
            <button
              type="button"
              onClick={onTogglePreviewDrawer}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide",
                hidePreviewToggleOnWide && "lg:hidden",
                previewDrawerOpen
                  ? "border-mad-black bg-mad-black text-white"
                  : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
              )}
              aria-pressed={previewDrawerOpen}
            >
              {previewDrawerOpen ? "Preview open" : "Preview"}
            </button>
          ) : null}
        </div>
        {showScheduleActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onSaveDraft?.()}
              disabled={saveDraftBusy || confirmArmBusy}
              className="rounded-sm border border-neutral-300 bg-white px-4 py-2.5 text-xs font-medium tracking-wide text-mad-black uppercase hover:bg-neutral-50 disabled:opacity-40"
            >
              {saveDraftBusy ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => onConfirmArm?.()}
              disabled={confirmArmDisabled || confirmArmBusy || saveDraftBusy}
              className="inline-flex min-w-[10rem] items-center justify-center rounded-sm bg-mad-black px-5 py-2.5 text-xs font-medium tracking-wide text-white uppercase hover:bg-neutral-800 disabled:opacity-40"
            >
              {confirmArmBusy ? "Arming…" : "Review & schedule"}
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
            className="inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-sm bg-mad-black px-6 py-2.5 text-xs font-medium tracking-[0.12em] text-white uppercase hover:bg-neutral-800 disabled:opacity-40"
          >
            {nextBusy ? "Working…" : primary}
            {!nextBusy && step !== WORKBENCH_STEP_CHANNELS ? (
              <ArrowRight className="size-3.5" aria-hidden />
            ) : null}
          </button>
        )}
      </div>
    </div>
  )
}

"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export const WORKBENCH_STEPS = [
  {
    id: 1,
    key: "media",
    label: "Media",
    short: "Media",
    cue: "Cutout, captions & tags",
  },
  {
    id: 2,
    key: "review",
    label: "Review",
    short: "Review",
    cue: "Check the preview",
  },
  {
    id: 3,
    key: "dispatch",
    label: "Schedule",
    short: "Schedule",
    cue: "Publish or schedule",
  },
] as const

export type WorkbenchStepId = (typeof WORKBENCH_STEPS)[number]["id"]

type StepStepperProps = {
  step: WorkbenchStepId
  onStepChange?: (step: WorkbenchStepId) => void
  className?: string
}

export function StepStepper({
  step,
  onStepChange,
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
          return (
            <li key={item.id} className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  onStepChange?.(item.id)
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }}
                className={cn(
                  "flex w-full items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-center transition",
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
                  {complete ? <Check className="size-3 stroke-[3]" /> : item.id}
                </span>
                <span className="truncate font-typewriter text-[0.65rem] font-bold tracking-wider uppercase">
                  {item.label}
                </span>
              </button>
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
  /** When set on step 3, next CTA reflects the active simulator channel. */
  dispatchPlatform?:
    | "ig_story"
    | "ig_feed"
    | "tiktok"
    | "facebook"
    | "email"
    | null
  className?: string
}

export function StepDock({
  step,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextBusy = false,
  dispatchPlatform = null,
  className,
}: StepDockProps) {
  const platformLabel =
    dispatchPlatform === "tiktok"
      ? "Dispatch TikTok"
      : dispatchPlatform === "email"
        ? "Dispatch Email"
        : dispatchPlatform === "facebook"
          ? "Dispatch Facebook"
          : dispatchPlatform === "ig_feed"
            ? "Dispatch Feed"
            : "Publish Now"
  const primary =
    nextLabel ??
    (step === 3 ? platformLabel : `Continue`)

  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 border-t border-mad-black/20 bg-mad-white/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => {
            onBack()
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
          disabled={step <= 1}
          className="border border-mad-black/30 bg-mad-white px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase hover:border-mad-black hover:bg-mad-lime/40 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Back
        </button>
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
      </div>
    </div>
  )
}

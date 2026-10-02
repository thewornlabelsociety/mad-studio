"use client"

import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

import {
  type CanvasTextOverlayState,
  type StoryStickerTheme,
} from "@/lib/studio/canvas-text-types"
import { cn } from "@/lib/utils"

export type { StoryStickerTheme }

function themeShell(theme: StoryStickerTheme) {
  return theme === "linen"
    ? "border-neutral-300 bg-white/80 text-neutral-900"
    : "border-neutral-700 bg-[#181816]/75 text-[#EDECE8]"
}

type PollProps = {
  question: string
  optionA: string
  optionB: string
  percentA?: number
  percentB?: number
  theme?: StoryStickerTheme
  className?: string
}

export function EditorialPoll({
  question,
  optionA,
  optionB,
  percentA = 54,
  percentB,
  theme = "noir",
  className,
}: PollProps) {
  const a = Math.min(96, Math.max(4, percentA))
  const b = percentB != null ? Math.min(96, Math.max(4, percentB)) : 100 - a

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[320px] rounded-xl border p-4 backdrop-blur-md",
        themeShell(theme),
        className
      )}
    >
      <p className="mb-2 text-center font-mono text-[10px] tracking-[0.2em] text-neutral-400 uppercase">
        {question.trim() || "Which direction?"}
      </p>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-neutral-600/40">
        {[0, 1].map((index) => {
          const label = index === 0 ? optionA : optionB
          const pct = index === 0 ? a : b
          return (
            <div
              key={index}
              className={cn(
                "relative min-h-[4.5rem] p-2.5",
                index === 0 && "border-r border-neutral-600/30"
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-neutral-500/15"
                style={{ width: `${pct}%` }}
              />
              <div className="relative z-[1] flex h-full flex-col justify-between gap-2">
                <span className="line-clamp-2 font-mono text-[10px] leading-snug tracking-wide uppercase">
                  {label.trim() || (index === 0 ? "Option A" : "Option B")}
                </span>
                <span className="font-mono text-sm tabular-nums tracking-tight">
                  {pct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type CountdownProps = {
  dropTitle: string
  days: string
  hours: string
  minutes: string
  seconds: string
  theme?: StoryStickerTheme
  className?: string
}

export function ArchivalCountdown({
  dropTitle,
  days,
  hours,
  minutes,
  seconds,
  theme = "noir",
  className,
}: CountdownProps) {
  const units = [
    { value: days, label: "DAYS" },
    { value: hours, label: "HRS" },
    { value: minutes, label: "MIN" },
    { value: seconds, label: "SEC" },
  ]

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[320px] rounded-xl border p-4 text-center backdrop-blur-md",
        themeShell(theme),
        className
      )}
    >
      <p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-neutral-400 uppercase">
        {dropTitle.trim() || "Drop opens"}
      </p>
      <div className="flex items-start justify-center gap-1.5 font-mono text-lg tabular-nums tracking-tight sm:text-xl">
        {units.map((unit, index) => (
          <div key={unit.label} className="flex items-start gap-1.5">
            {index > 0 ? (
              <span className="text-neutral-500 select-none">:</span>
            ) : null}
            <div className="flex flex-col items-center">
              <span>{unit.value}</span>
              <span className="mt-1 font-mono text-[8px] tracking-wider text-neutral-400 uppercase">
                {unit.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type LinkPillProps = {
  label?: string
  theme?: StoryStickerTheme
  className?: string
}

export function StoryLinkPill({
  label = "EXPLORE DROP ↗",
  theme = "noir",
  className,
}: LinkPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 font-mono text-[11px] tracking-[0.16em] uppercase shadow-sm backdrop-blur-md",
        theme === "linen"
          ? "border-neutral-300 bg-white/95 text-neutral-900"
          : "border-neutral-700 bg-[#181816]/90 text-[#EDECE8]",
        className
      )}
    >
      {label.trim() || "EXPLORE DROP ↗"}
    </span>
  )
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0")
}

export function useCountdownParts(targetIso: string | null | undefined): {
  days: string
  hours: string
  minutes: string
  seconds: string
  expired: boolean
} {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!targetIso?.trim()) {
    return {
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
      expired: false,
    }
  }

  const target = Date.parse(targetIso)
  if (!Number.isFinite(target)) {
    return {
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
      expired: false,
    }
  }

  const diffMs = Math.max(0, target - now)
  const expired = target <= now
  const totalSec = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  return {
    days: pad2(days),
    hours: pad2(hours),
    minutes: pad2(minutes),
    seconds: pad2(seconds),
    expired,
  }
}

type OverlaySlotProps = {
  overlay: CanvasTextOverlayState
  interactive?: boolean
  linkHref?: string | null
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  dragHint?: string
}

function EditorialStickerBody({
  overlay,
  linkHref,
  interactive,
}: {
  overlay: CanvasTextOverlayState
  linkHref?: string | null
  interactive?: boolean
}) {
  const theme = overlay.storyStickerTheme
  const countdown = useCountdownParts(overlay.countdownTargetAt)

  if (overlay.storyStickerMode === "editorial_poll") {
    return (
      <EditorialPoll
        question={overlay.pollQuestion}
        optionA={overlay.pollOptionA}
        optionB={overlay.pollOptionB}
        percentA={overlay.pollPercentA}
        theme={theme}
      />
    )
  }

  if (overlay.storyStickerMode === "countdown_timer") {
    return (
      <ArchivalCountdown
        dropTitle={overlay.countdownTitle}
        days={countdown.days}
        hours={countdown.hours}
        minutes={countdown.minutes}
        seconds={countdown.seconds}
        theme={theme}
      />
    )
  }

  return null
}

/** Renders editorial poll / timer / link inside IG story safe zone. */
export function EditorialStoryStickerOverlay({
  overlay,
  interactive = false,
  linkHref = null,
  onPointerDown,
  dragHint = "Drag sticker",
  className,
}: OverlaySlotProps & { className?: string }) {
  if (overlay.storyStickerMode === "none") return null

  const body = (
    <EditorialStickerBody
      overlay={overlay}
      linkHref={linkHref}
      interactive={interactive}
    />
  )

  if (!body) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-30",
        className
      )}
    >
      <div
        className="absolute inline-block w-max max-w-[92%] touch-none select-none"
        style={{
          left: `${overlay.stickerX}%`,
          top: `${overlay.stickerY}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {interactive && onPointerDown ? (
          <div
            role="button"
            tabIndex={0}
            aria-label={dragHint || "Drag story sticker"}
            onPointerDown={onPointerDown}
            className="pointer-events-auto absolute bottom-full left-1/2 z-20 mb-1 flex -translate-x-1/2 cursor-grab items-center justify-center gap-1 border-2 border-mad-vermillion/80 bg-mad-vermillion/90 px-2 py-0.5 shadow-keycap-sm active:cursor-grabbing"
          >
            <span className="font-typewriter text-[0.4rem] font-bold tracking-wider text-mad-black uppercase">
              {dragHint || "Drag"}
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            "inline-block w-max max-w-full",
            interactive &&
              "pointer-events-auto ring-2 ring-transparent hover:ring-mad-vermillion/80 hover:ring-offset-1 hover:ring-offset-black/20"
          )}
        >
          {body}
        </div>
      </div>
    </div>
  )
}

export function storyStickerPreviewNode(
  overlay: CanvasTextOverlayState,
  linkHref?: string | null
): ReactNode {
  if (overlay.storyStickerMode === "none") return null
  return (
    <EditorialStoryStickerOverlay overlay={overlay} linkHref={linkHref} />
  )
}

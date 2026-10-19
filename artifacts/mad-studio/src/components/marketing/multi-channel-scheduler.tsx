"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, Save, Send, Zap } from "lucide-react"

import {
  applyBrainTiming,
  CHANNEL_META,
  demographicTagFor,
  formatSlotLabel,
  fromLocalInputValue,
  nextOptimalSlot,
  toLocalInputValue,
  type ChannelSlot,
  type DispatchMode,
  type SchedulerChannel,
} from "@/lib/scheduling/brain-timing"
import type { ScheduledSlotOccupancy } from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

const CLASH_WINDOW_MS = 20 * 60 * 1000

function isPast(iso: string): boolean {
  return Date.parse(iso) < Date.now()
}

type Props = {
  plan: ChannelSlot[]
  onPlanChange: (plan: ChannelSlot[]) => void
  occupied?: ScheduledSlotOccupancy[]
  onSaveDraft: () => void
  onArm: () => void
  saving?: boolean
  arming?: boolean
  /** Already published — the queue can't be re-armed. */
  locked?: boolean
  /** When true, primary Save / Arm actions live in the workspace dock only. */
  hideFooterActions?: boolean
  /** Studio wizard: 2-col slot rows + shorter helper copy. */
  wizardLayout?: boolean
  /** Pack title / generate actions — rendered inside the same card. */
  topBanner?: ReactNode
  className?: string
}

export function MultiChannelScheduler({
  plan,
  onPlanChange,
  occupied = [],
  onSaveDraft,
  onArm,
  saving = false,
  arming = false,
  locked = false,
  hideFooterActions = false,
  wizardLayout = false,
  topBanner = null,
  className,
}: Props) {
  // Re-render periodically so "time has passed" warnings stay current.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const enabled = plan.filter((slot) => slot.enabled)
  const allSelected = enabled.length === plan.length
  const busy = saving || arming

  const summary = useMemo(() => {
    if (enabled.length === 0) return "No channels selected"
    const immediate = enabled.filter((slot) => slot.mode === "immediate").length
    const scheduled = enabled
      .filter((slot) => slot.mode === "scheduled")
      .map((slot) => slot.scheduledAt)
      .sort()
    const parts = [`${enabled.length} channel${enabled.length === 1 ? "" : "s"}`]
    if (immediate) parts.push(`${immediate} immediate`)
    if (scheduled[0]) parts.push(`first out ${formatSlotLabel(scheduled[0])}`)
    return parts.join(" · ")
  }, [enabled])

  function patchSlot(channel: SchedulerChannel, patch: Partial<ChannelSlot>) {
    onPlanChange(
      plan.map((slot) => (slot.channel === channel ? { ...slot, ...patch } : slot))
    )
  }

  function toggleChannel(channel: SchedulerChannel) {
    const slot = plan.find((row) => row.channel === channel)
    if (!slot) return
    if (!slot.enabled && isPast(slot.scheduledAt)) {
      const next = nextOptimalSlot(channel)
      patchSlot(channel, {
        enabled: true,
        scheduledAt: next.at.toISOString(),
        timingSource: "brain",
        demographicTag: next.tag,
      })
      return
    }
    patchSlot(channel, { enabled: !slot.enabled })
  }

  function toggleAll() {
    onPlanChange(plan.map((slot) => ({ ...slot, enabled: !allSelected })))
  }

  function setMode(channel: SchedulerChannel, mode: DispatchMode) {
    const slot = plan.find((row) => row.channel === channel)
    if (!slot) return
    if (mode === "scheduled" && isPast(slot.scheduledAt)) {
      const next = nextOptimalSlot(channel)
      patchSlot(channel, {
        mode,
        scheduledAt: next.at.toISOString(),
        timingSource: "brain",
        demographicTag: next.tag,
      })
      return
    }
    patchSlot(channel, { mode })
  }

  function setTime(channel: SchedulerChannel, value: string) {
    const iso = fromLocalInputValue(value)
    if (!iso) return
    patchSlot(channel, {
      scheduledAt: iso,
      mode: "scheduled",
      timingSource: "manual",
      demographicTag: demographicTagFor(channel, new Date(iso)),
    })
  }

  function clashFor(slot: ChannelSlot): ScheduledSlotOccupancy | null {
    if (slot.mode !== "scheduled") return null
    const at = Date.parse(slot.scheduledAt)
    return (
      occupied.find(
        (row) => Math.abs(Date.parse(row.scheduled_at) - at) < CLASH_WINDOW_MS
      ) ?? null
    )
  }

  const hasPastSlot = enabled.some(
    (slot) => slot.mode === "scheduled" && isPast(slot.scheduledAt)
  )

  return (
    <section
      className={cn(
        "border-2 border-mad-black bg-mad-white shadow-keycap-sm",
        wizardLayout
          ? "flex min-h-0 flex-1 flex-col gap-3 p-4 md:p-5"
          : "space-y-3 p-3",
        className
      )}
    >
      {topBanner ? (
        <div className={cn(wizardLayout ? "shrink-0 pb-1" : "pb-2")}>
          {topBanner}
        </div>
      ) : null}
      {wizardLayout && topBanner ? (
        <p className="shrink-0 font-typewriter text-xs font-bold tracking-wide text-neutral-600 uppercase">
          {summary}
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Dispatch & Schedule
          </p>
          <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-600 uppercase">
            {summary}
          </span>
        </div>
      )}

      <div
        className={cn(
          "flex flex-wrap gap-1.5",
          wizardLayout && "shrink-0"
        )}
      >
        <button
          type="button"
          onClick={toggleAll}
          disabled={locked}
          className={cn(
            "border-2 border-mad-black px-2.5 py-1.5 font-typewriter text-xs font-bold tracking-wide uppercase disabled:opacity-40",
            allSelected
              ? "bg-mad-lime text-mad-black"
              : "bg-mad-white text-mad-black hover:bg-mad-lime/50"
          )}
        >
          {allSelected ? "Clear All" : "Select All"}
        </button>
        {plan.map((slot) => (
          <button
            key={slot.channel}
            type="button"
            onClick={() => toggleChannel(slot.channel)}
            disabled={locked}
            aria-pressed={slot.enabled}
            className={cn(
              "inline-flex items-center gap-1.5 border-2 border-mad-black px-2.5 py-1.5 font-typewriter text-xs font-bold tracking-wide uppercase disabled:opacity-40",
              slot.enabled
                ? "bg-mad-black text-mad-white"
                : "bg-mad-white text-neutral-500 hover:bg-mad-lime/50 hover:text-mad-black"
            )}
          >
            <span
              className={cn(
                "flex size-3.5 items-center justify-center border",
                slot.enabled ? "border-mad-lime bg-mad-lime" : "border-neutral-400"
              )}
            >
              {slot.enabled ? (
                <Check className="size-3 text-mad-black" strokeWidth={3} />
              ) : null}
            </span>
            {CHANNEL_META[slot.channel].label}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border border-dashed border-mad-black/40 bg-mad-lime/10 px-3",
          wizardLayout ? "shrink-0 py-2.5" : "py-1.5"
        )}
      >
        <button
          type="button"
          onClick={() => onPlanChange(applyBrainTiming(plan))}
          disabled={locked || enabled.length === 0}
          className={cn(
            "border-2 border-mad-black bg-mad-lime font-typewriter font-bold tracking-wide text-mad-black uppercase shadow-keycap-sm hover:bg-mad-black hover:text-mad-lime disabled:opacity-40",
            wizardLayout ? "px-3 py-2 text-xs" : "px-2.5 py-1 text-[0.6rem]"
          )}
        >
          <Zap className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
          Apply optimal Brain timing
        </button>
        {wizardLayout ? (
          <p className="min-w-0 flex-1 font-typewriter text-xs leading-relaxed text-neutral-600 normal-case">
            Staggers channels to Brain audience windows.
          </p>
        ) : (
          <p className="min-w-0 flex-1 font-typewriter text-[0.5rem] leading-relaxed text-neutral-600 normal-case">
            Staggers each channel to its audience window — IG Story lunch /
            commute, IG Feed midday / evening, TikTok night, Facebook morning,
            VIP email Tue / Thu 10am.
          </p>
        )}
      </div>

      {enabled.length === 0 ? (
        <p className="border border-mad-black/20 px-2 py-3 text-center font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
          Tick a channel to add its slot
        </p>
      ) : (
        <ul
          className={cn(
            wizardLayout
              ? "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto border border-mad-black/25"
              : "divide-y divide-mad-black/25 border border-mad-black/25"
          )}
        >
          {enabled.map((slot) => {
            const clash = clashFor(slot)
            const past = slot.mode === "scheduled" && isPast(slot.scheduledAt)
            return (
              <li
                key={slot.channel}
                className={cn(
                  "grid bg-mad-white sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center",
                  wizardLayout
                    ? "min-h-[3.25rem] flex-1 gap-2 border border-mad-black/10 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                    : "gap-2 px-2 py-2"
                )}
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "font-typewriter font-bold tracking-wide text-mad-black uppercase",
                      wizardLayout ? "text-sm" : "text-[0.6rem]"
                    )}
                  >
                    {CHANNEL_META[slot.channel].label}
                  </p>
                  <p
                    className={cn(
                      "truncate font-typewriter text-neutral-600 normal-case",
                      wizardLayout ? "mt-0.5 text-xs" : "text-[0.5rem]"
                    )}
                  >
                    {slot.demographicTag}
                    <span
                      className={cn(
                        "ml-1.5 px-1 font-bold uppercase",
                        slot.mode === "immediate"
                          ? "bg-mad-vermillion text-mad-white"
                          : slot.timingSource === "brain"
                            ? "bg-mad-lime text-mad-black"
                            : "bg-neutral-200 text-neutral-700"
                      )}
                    >
                      {slot.mode === "immediate"
                        ? "now"
                        : slot.timingSource === "brain"
                          ? "brain"
                          : "manual"}
                    </span>
                  </p>
                  {clash ? (
                    <p className="font-typewriter text-[0.5rem] text-amber-700 normal-case">
                      Within 20 min of “{clash.title}”
                    </p>
                  ) : null}
                  {past ? (
                    <p className="font-typewriter text-[0.5rem] text-mad-vermillion normal-case">
                      Time has passed — pick a new slot or switch to Immediate
                    </p>
                  ) : null}
                </div>

                <input
                  type="datetime-local"
                  value={
                    slot.mode === "immediate"
                      ? ""
                      : toLocalInputValue(slot.scheduledAt)
                  }
                  onChange={(event) => setTime(slot.channel, event.target.value)}
                  disabled={locked || slot.mode === "immediate"}
                  aria-label={`${CHANNEL_META[slot.channel].label} post time`}
                  className={cn(
                    "w-full border-2 border-mad-black bg-mad-white font-typewriter text-mad-black focus:bg-mad-lime/20 disabled:border-mad-black/30 disabled:text-neutral-400",
                    wizardLayout
                      ? "px-2.5 py-2 text-sm sm:w-[13rem]"
                      : "px-1.5 py-1 text-[0.6rem] sm:w-[11.5rem]"
                  )}
                />

                <div
                  role="group"
                  aria-label={`${CHANNEL_META[slot.channel].label} dispatch mode`}
                  className="flex border-2 border-mad-black"
                >
                  {(["immediate", "scheduled"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMode(slot.channel, mode)}
                      disabled={locked}
                      aria-pressed={slot.mode === mode}
                      className={cn(
                        "flex-1 font-typewriter font-bold tracking-wide uppercase disabled:opacity-40",
                        wizardLayout
                          ? "px-3 py-2 text-xs"
                          : "px-2 py-1 text-[0.5rem]",
                        slot.mode === mode
                          ? mode === "immediate"
                            ? "bg-mad-vermillion text-mad-white"
                            : "bg-mad-black text-mad-white"
                          : "bg-mad-white text-mad-black hover:bg-mad-lime/50"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {hideFooterActions ? null : (
        <div className="flex flex-col gap-2 border-t border-mad-black/15 pt-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={busy || locked}
            className="border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase hover:bg-mad-lime disabled:opacity-40"
          >
            <Save className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={onArm}
            disabled={busy || locked || enabled.length === 0 || hasPastSlot}
            className="border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-40"
          >
            <Send className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
            {arming ? "Arming…" : "Confirm & schedule"}
          </button>
        </div>
      )}
      {locked ? (
        <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
          Published — queue locked
        </p>
      ) : null}
    </section>
  )
}

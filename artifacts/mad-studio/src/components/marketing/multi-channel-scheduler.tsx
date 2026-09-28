"use client"

import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"

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
        "space-y-3 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Dispatch & Schedule
        </p>
        <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-600 uppercase">
          {summary}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={toggleAll}
          disabled={locked}
          className={cn(
            "border-2 border-mad-black px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase disabled:opacity-40",
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
              "inline-flex items-center gap-1 border-2 border-mad-black px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase disabled:opacity-40",
              slot.enabled
                ? "bg-mad-black text-mad-white"
                : "bg-mad-white text-neutral-500 hover:bg-mad-lime/50 hover:text-mad-black"
            )}
          >
            <span
              className={cn(
                "flex size-3 items-center justify-center border",
                slot.enabled ? "border-mad-lime bg-mad-lime" : "border-neutral-400"
              )}
            >
              {slot.enabled ? (
                <Check className="size-2.5 text-mad-black" strokeWidth={3} />
              ) : null}
            </span>
            {CHANNEL_META[slot.channel].label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border border-dashed border-mad-black/40 bg-mad-lime/10 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onPlanChange(applyBrainTiming(plan))}
          disabled={locked || enabled.length === 0}
          className="border-2 border-mad-black bg-mad-lime px-2.5 py-1 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-black uppercase shadow-keycap-sm hover:bg-mad-black hover:text-mad-lime disabled:opacity-40"
        >
          ⚡ Apply Optimal Brain Timing
        </button>
        <p className="min-w-0 flex-1 font-typewriter text-[0.5rem] leading-relaxed text-neutral-600 normal-case">
          Staggers each channel to its audience window — IG Story lunch /
          commute, IG Feed midday / evening, TikTok night, Facebook morning,
          VIP email Tue / Thu 10am.
        </p>
      </div>

      {enabled.length === 0 ? (
        <p className="border border-mad-black/20 px-2 py-3 text-center font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
          Tick a channel to add its slot
        </p>
      ) : (
        <ul className="divide-y divide-mad-black/15 border border-mad-black/25">
          {enabled.map((slot) => {
            const clash = clashFor(slot)
            const past = slot.mode === "scheduled" && isPast(slot.scheduledAt)
            return (
              <li
                key={slot.channel}
                className="grid gap-2 px-2 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-black uppercase">
                    {CHANNEL_META[slot.channel].label}
                  </p>
                  <p className="truncate font-typewriter text-[0.5rem] text-neutral-600 normal-case">
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
                  className="w-full border-2 border-mad-black bg-mad-white px-1.5 py-1 font-typewriter text-[0.6rem] text-mad-black focus:bg-mad-lime/20 disabled:border-mad-black/30 disabled:text-neutral-400 sm:w-[11.5rem]"
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
                        "flex-1 px-2 py-1 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase disabled:opacity-40",
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

      <div className="flex flex-col gap-2 border-t border-mad-black/15 pt-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={busy || locked}
          className="border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase hover:bg-mad-lime disabled:opacity-40"
        >
          {saving ? "Saving…" : "💾 Save Draft"}
        </button>
        <button
          type="button"
          onClick={onArm}
          disabled={busy || locked || enabled.length === 0 || hasPastSlot}
          className="border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-40"
        >
          {arming ? "Arming…" : "🚀 Confirm & Arm Multi-Channel Post"}
        </button>
      </div>
      {locked ? (
        <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
          Published — queue locked
        </p>
      ) : null}
    </section>
  )
}

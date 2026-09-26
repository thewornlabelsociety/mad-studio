"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock } from "lucide-react"

import {
  buildSlotIso,
  buildUpcomingDays,
  DAY_SLOTS,
  formatScheduleToast,
  slotOccupancyKey,
  type SlotDefinition,
} from "@/lib/inventory/schedule"
import type { ScheduledSlotOccupancy } from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

export type DispatchChannelOption = {
  id: "instagram_feed" | "facebook" | "email_newsletter" | "tiktok"
  label: string
  short: string
}

const CHANNEL_OPTIONS: DispatchChannelOption[] = [
  { id: "instagram_feed", label: "Instagram", short: "IG" },
  { id: "facebook", label: "Facebook", short: "FB" },
  { id: "tiktok", label: "TikTok", short: "TT" },
  { id: "email_newsletter", label: "Email", short: "EM" },
]

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type Props = {
  occupied: ScheduledSlotOccupancy[]
  selectedAt: string | null
  onSelect: (iso: string) => void
  channels: string[]
  onChannelsChange: (channels: string[]) => void
  onConfirm: () => void
  onDispatchNow?: () => void
  onSaveDraft?: () => void
  confirming?: boolean
  dispatchingNow?: boolean
  savingDraft?: boolean
  disabled?: boolean
  /** When true, schedule is locked (already published). */
  locked?: boolean
  /** When nested in the Step 3 SOP panel. */
  embedded?: boolean
}

export function ScheduleStrip({
  occupied,
  selectedAt,
  onSelect,
  channels,
  onChannelsChange,
  onConfirm,
  onDispatchNow,
  onSaveDraft,
  confirming = false,
  dispatchingNow = false,
  savingDraft = false,
  disabled = false,
  locked = false,
  embedded = false,
}: Props) {
  const [customValue, setCustomValue] = useState(() =>
    toDatetimeLocalValue(selectedAt)
  )

  useEffect(() => {
    setCustomValue(toDatetimeLocalValue(selectedAt))
  }, [selectedAt])

  const days = useMemo(() => buildUpcomingDays(7), [])
  const occupiedMap = useMemo(() => {
    const map = new Map<string, ScheduledSlotOccupancy>()
    for (const item of occupied) {
      if (!item.scheduled_at) continue
      map.set(slotOccupancyKey(item.scheduled_at), item)
    }
    return map
  }, [occupied])

  const minLocal = useMemo(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 1, 0, 0)
    return toDatetimeLocalValue(now.toISOString())
  }, [])

  function toggleChannel(id: string) {
    if (disabled || locked) return
    if (channels.includes(id)) {
      onChannelsChange(channels.filter((value) => value !== id))
    } else {
      onChannelsChange([...channels, id])
    }
  }

  function selectSlot(day: Date, slot: SlotDefinition) {
    if (disabled || locked) return
    const iso = buildSlotIso(day, slot)
    if (new Date(iso).getTime() < Date.now()) return
    const key = slotOccupancyKey(iso)
    if (occupiedMap.has(key)) return
    onSelect(iso)
  }

  function applyDatetimeLocal(value: string) {
    if (!value || disabled || locked) return
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return
    onSelect(date.toISOString())
  }

  const canConfirm =
    Boolean(selectedAt) &&
    channels.length > 0 &&
    !disabled &&
    !locked &&
    new Date(selectedAt as string).getTime() > Date.now() - 30_000

  const scheduleReady = Boolean(selectedAt) && channels.length > 0

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col gap-3",
        embedded
          ? "border-0 bg-transparent p-0 shadow-none"
          : "border-2 border-mad-black bg-mad-white p-4 shadow-keycap"
      )}
    >
      {!embedded ? (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-mad-black pb-2">
          <div>
            <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
              SOP · Schedule gate
            </p>
            <h2 className="mt-0.5 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              Lock a vibe window
            </h2>
          </div>
          <SopScheduleBadge ready={scheduleReady} locked={locked} />
        </header>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
            SOP gate · channels + slot
          </p>
          <SopScheduleBadge ready={scheduleReady} locked={locked} />
        </div>
      )}

      {onDispatchNow ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <button
            type="button"
            onClick={onDispatchNow}
            disabled={disabled || locked || dispatchingNow || confirming}
            className="inline-flex items-center justify-center gap-2 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm transition hover:bg-mad-vermillion disabled:opacity-50"
          >
            {dispatchingNow ? "Publishing…" : "🚀 Publish Now"}
          </button>
          <span className="hidden text-center font-typewriter text-[0.5rem] font-bold tracking-widest text-neutral-500 uppercase sm:block">
            or schedule
          </span>
          <p className="hidden truncate font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase sm:block sm:text-right">
            {selectedAt
              ? formatScheduleToast(selectedAt)
              : "Pick a slot below"}
          </p>
        </div>
      ) : null}

      {/* Dense 7-day × 3-slot matrix — fits laptop half-pane */}
      <div className="min-w-0 overflow-hidden border-2 border-mad-black bg-mad-white shadow-keycap-sm">
        <div
          className="grid border-b-2 border-mad-black bg-neutral-50"
          style={{
            gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="border-r-2 border-mad-black px-1.5 py-1.5 font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
            Slot
          </div>
          {days.map((day) => (
            <div
              key={day.dateKey}
              className="border-r-2 border-mad-black px-0.5 py-1.5 text-center last:border-r-0"
            >
              <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-vermillion uppercase">
                {day.weekday}
              </p>
              <p className="font-typewriter text-[0.55rem] font-bold tracking-tight text-mad-black uppercase">
                {day.label.replace(" ", "\u00a0")}
              </p>
            </div>
          ))}
        </div>

        {DAY_SLOTS.map((slot, slotIndex) => (
          <div
            key={slot.key}
            className={cn(
              "grid",
              slotIndex < DAY_SLOTS.length - 1 && "border-b-2 border-mad-black"
            )}
            style={{
              gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="flex flex-col justify-center border-r-2 border-mad-black px-1.5 py-1.5">
              <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-black uppercase">
                {slot.label}
              </span>
              <span className="font-typewriter text-[0.55rem] text-neutral-500">
                {String(slot.hour).padStart(2, "0")}:
                {String(slot.minute).padStart(2, "0")}
              </span>
            </div>
            {days.map((day) => {
              const iso = buildSlotIso(day.date, slot)
              const key = slotOccupancyKey(iso)
              const taken = occupiedMap.get(key)
              const selected = selectedAt === iso
              const past = new Date(iso).getTime() < Date.now()
              return (
                <button
                  key={`${day.dateKey}-${slot.key}`}
                  type="button"
                  title={
                    taken
                      ? "Taken"
                      : past
                        ? "Past"
                        : selected
                          ? "Selected"
                          : `${day.weekday} ${slot.label}`
                  }
                  disabled={Boolean(taken) || disabled || locked || past}
                  onClick={() => selectSlot(day.date, slot)}
                  className={cn(
                    "flex min-h-[2.35rem] items-center justify-center border-r-2 border-mad-black px-0.5 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase transition last:border-r-0",
                    taken || past
                      ? "cursor-default bg-neutral-100 text-neutral-400"
                      : selected
                        ? "bg-mad-black text-mad-lime"
                        : "bg-mad-white text-mad-black hover:bg-mad-lime"
                  )}
                >
                  {taken ? "●" : past ? "—" : selected ? "SET" : "+"}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid min-w-0 gap-1">
          <span className="inline-flex items-center gap-1.5 font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-black uppercase">
            <CalendarClock className="size-3" />
            Exact time
          </span>
          <input
            type="datetime-local"
            value={customValue}
            min={minLocal}
            disabled={disabled || locked}
            onChange={(event) => {
              setCustomValue(event.target.value)
              applyDatetimeLocal(event.target.value)
            }}
            className="w-full min-w-0 border-2 border-mad-black bg-mad-white px-2.5 py-1.5 font-typewriter text-xs text-mad-black outline-none focus:bg-mad-lime/30 disabled:opacity-60"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {CHANNEL_OPTIONS.map((option) => {
            const checked = channels.includes(option.id)
            return (
              <label
                key={option.id}
                title={option.label}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 border-mad-black px-2 py-1.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm transition",
                  locked || disabled
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer",
                  checked
                    ? "bg-mad-black text-mad-white"
                    : "bg-mad-white text-mad-black hover:bg-mad-lime"
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleChannel(option.id)}
                  disabled={disabled || locked}
                />
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center border-2 border-mad-black text-[0.55rem]",
                    checked
                      ? "bg-mad-lime text-mad-black"
                      : "bg-mad-white text-mad-black"
                  )}
                >
                  {checked ? "✓" : ""}
                </span>
                <span className="sm:hidden">{option.short}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {selectedAt ? (
        <p className="border-2 border-mad-black bg-mad-lime/40 px-2.5 py-1.5 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase">
          Auto-post · {formatScheduleToast(selectedAt)}
          {channels.length > 0
            ? ` · ${channels.length} channel${channels.length === 1 ? "" : "s"}`
            : " · pick channels"}
        </p>
      ) : (
        <p className="font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
          Tap a cell or set exact time — then confirm to arm auto-dispatch
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || confirming || dispatchingNow}
          className={cn(
            "inline-flex items-center justify-center border-2 border-mad-black px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest uppercase shadow-keycap-sm transition",
            canConfirm
              ? "bg-mad-vermillion text-mad-white hover:brightness-95 disabled:opacity-60"
              : "cursor-not-allowed bg-neutral-200 text-neutral-500"
          )}
        >
          {confirming ? "Scheduling…" : "Confirm schedule"}
        </button>
        {onSaveDraft ? (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={
              disabled || locked || confirming || dispatchingNow || savingDraft
            }
            className="inline-flex items-center justify-center border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm transition hover:bg-mad-lime disabled:opacity-50"
          >
            {savingDraft ? "Saving…" : "💾 Save Draft"}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function SopScheduleBadge({
  ready,
  locked,
}: {
  ready: boolean
  locked: boolean
}) {
  if (locked) {
    return (
      <span className="border-2 border-mad-black bg-mad-lime px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-black uppercase shadow-keycap-sm">
        Published
      </span>
    )
  }
  return (
    <span
      className={cn(
        "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase shadow-keycap-sm",
        ready
          ? "bg-mad-lime text-mad-black"
          : "bg-mad-white text-neutral-500"
      )}
    >
      {ready ? "SOP · Slot ready" : "SOP · Needs slot"}
    </span>
  )
}

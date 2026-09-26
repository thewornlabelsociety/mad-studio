export type DaySlotKey = "morning" | "midday" | "evening"

export type SlotDefinition = {
  key: DaySlotKey
  label: string
  hour: number
  minute: number
}

export const DAY_SLOTS: SlotDefinition[] = [
  { key: "morning", label: "Morning", hour: 9, minute: 30 },
  { key: "midday", label: "Midday", hour: 12, minute: 30 },
  { key: "evening", label: "Evening", hour: 19, minute: 0 },
]

export type CalendarDay = {
  dateKey: string
  label: string
  weekday: string
  date: Date
}

export function startOfLocalDay(date = new Date()): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function buildUpcomingDays(count = 7, from = new Date()): CalendarDay[] {
  const start = startOfLocalDay(from)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      dateKey: toDateKey(date),
      label: date.toLocaleDateString("en-NZ", {
        month: "short",
        day: "numeric",
      }),
      weekday: date.toLocaleDateString("en-NZ", { weekday: "short" }),
      date,
    }
  })
}

export function buildSlotIso(
  day: Date,
  slot: SlotDefinition
): string {
  const next = new Date(day)
  next.setHours(slot.hour, slot.minute, 0, 0)
  return next.toISOString()
}

export function slotOccupancyKey(iso: string): string {
  const date = new Date(iso)
  const key = toDateKey(date)
  const minutes = date.getHours() * 60 + date.getMinutes()
  const nearest =
    DAY_SLOTS.find((slot) => slot.hour * 60 + slot.minute === minutes) ??
    DAY_SLOTS.reduce((best, slot) => {
      const delta = Math.abs(slot.hour * 60 + slot.minute - minutes)
      const bestDelta = Math.abs(best.hour * 60 + best.minute - minutes)
      return delta < bestDelta ? slot : best
    })
  return `${key}:${nearest.key}`
}

export function formatScheduleToast(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString("en-NZ", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
  const time = date.toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  })
  return `${day} at ${time}`
}

/** Which day and time a draft is for. No imports, so it can be tested on its own. */

/** Tuesday is sale rack and dot special day. */
const DRAFT_WEEKDAY = 2

/** "2026-11-17" for a local date. */
export function ymdOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A local date from "2026-11-17", or null if it isn't one. */
export function parseYmd(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "")
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getMonth() === Number(match[2]) - 1 ? date : null
}

/** This week's Tuesday, or next week's once this one has gone. */
export function nextDraftDay(now = new Date()): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  day.setDate(day.getDate() + ((DRAFT_WEEKDAY - day.getDay() + 7) % 7))
  return day
}

/**
 * When a draft is set to go out: its hour on that day, or, if that's already
 * gone (drafting for today), the next whole hour with a little room to approve.
 */
export function draftTime(day: Date, hour: number, now = new Date()): Date {
  const time = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0)
  const earliest = now.getTime() + 30 * 60 * 1000
  if (time.getTime() >= earliest) return time
  const next = new Date(earliest)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next
}

/** Day name for messages, e.g. "Tuesday 17 Nov". */
export function dayLabel(day: Date): string {
  return day.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "short" })
}

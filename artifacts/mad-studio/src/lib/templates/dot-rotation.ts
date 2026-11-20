/**
 * Which dot is on special this week — the same rotation the Worn Label
 * website uses for its "This week's dot special" banner.
 *
 * Every Monday a new dot colour is tagged onto fresh stock, in a fixed order.
 * Four weeks after its tagging week a colour goes 25% off, the week after
 * that 50% off, and the week after that it's pulled. Before the weekly
 * rotation began (Monday 12 October 2026) dots were tagged in quarters of the
 * month: Yellow (1–7), Blue (8–15), Green (16–23), Red (24–end).
 */

import type { WlsDotColour } from "@/lib/inventory/listing-dot"

const WEEKLY_ORDER: WlsDotColour[] = ["Black", "Pink", "Orange", "Yellow", "Blue", "Green", "Red"]
const WEEKLY_START = "2026-10-12"
const WEEKS_TO_25 = 4
const DAY_MS = 86_400_000

export type DotSpecialWeek = {
  colour: WlsDotColour
  percent: 25 | 50
  /** First and last day the colour was tagged (YYYY-MM-DD). */
  taggedFrom: string
  taggedTo: string
}

function toUtc(day: string): number {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function addDays(day: string, days: number): string {
  return toDay(toUtc(day) + days * DAY_MS)
}

/** The Monday of the week containing `day`. */
export function mondayOf(day: string): string {
  const ms = toUtc(day)
  const weekday = new Date(ms).getUTCDay()
  return toDay(ms - ((weekday + 6) % 7) * DAY_MS)
}

/** Today's date in New Zealand, as YYYY-MM-DD. */
export function nzToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

function lastDayOfMonth(day: string): string {
  const [y, m] = day.split("-").map(Number)
  return toDay(Date.UTC(y, m, 0))
}

/** The tagging period a day falls in, and its colour. */
function taggingPeriod(day: string): { start: string; end: string; colour: WlsDotColour } {
  if (day >= WEEKLY_START) {
    const start = mondayOf(day)
    const weeks = Math.floor((toUtc(start) - toUtc(WEEKLY_START)) / (7 * DAY_MS))
    return { start, end: addDays(start, 6), colour: WEEKLY_ORDER[weeks % WEEKLY_ORDER.length] }
  }
  const date = Number(day.slice(8, 10))
  const month = day.slice(0, 8)
  const [from, to, colour]: [number, number, WlsDotColour] =
    date <= 7
      ? [1, 7, "Yellow"]
      : date <= 15
        ? [8, 15, "Blue"]
        : date <= 23
          ? [16, 23, "Green"]
          : [24, 0, "Red"]
  let end = to === 0 ? lastDayOfMonth(day) : `${month}${String(to).padStart(2, "0")}`
  if (end >= WEEKLY_START) end = addDays(WEEKLY_START, -1)
  return { start: `${month}${String(from).padStart(2, "0")}`, end, colour }
}

/** The tagging period that started in the week `weeksAgo` weeks before `monday`. */
function periodStartedWeeksAgo(monday: string, weeksAgo: number) {
  const weekStart = addDays(monday, -7 * weeksAgo)
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(weekStart, offset)
    const period = taggingPeriod(day)
    if (period.start === day) return period
  }
  return null
}

/** This week's dot specials: the 25% colour, then the 50% colour. */
export function dotSpecialsForWeek(day: string = nzToday()): DotSpecialWeek[] {
  const monday = mondayOf(day)
  const out: DotSpecialWeek[] = []
  const quarter = periodStartedWeeksAgo(monday, WEEKS_TO_25)
  if (quarter) out.push({ colour: quarter.colour, percent: 25, taggedFrom: quarter.start, taggedTo: quarter.end })
  const half = periodStartedWeeksAgo(monday, WEEKS_TO_25 + 1)
  if (half) out.push({ colour: half.colour, percent: 50, taggedFrom: half.start, taggedTo: half.end })
  return out
}

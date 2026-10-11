import type { PlannerDuration } from "@/lib/planner/planner-timeline-types"
import { plannerDurationDayCount } from "@/lib/planner/planner-timeline-types"

function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const MONTH_BY_NAME: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

export function parseLaunchEndDateFromBrief(
  brief: string,
  referenceYear = new Date().getFullYear()
): Date | null {
  const text = brief.trim()
  if (!text) return null

  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) {
    const y = Number.parseInt(iso[1]!, 10)
    const m = Number.parseInt(iso[2]!, 10)
    const d = Number.parseInt(iso[3]!, 10)
    const date = new Date(y, m - 1, d)
    if (!Number.isNaN(date.getTime())) return date
  }

  const dmy =
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(20\d{2}))?\b/i.exec(
      text
    )
  if (dmy) {
    const day = Number.parseInt(dmy[1]!, 10)
    const month = MONTH_BY_NAME[dmy[2]!.toLowerCase()]
    const year = dmy[3] ? Number.parseInt(dmy[3], 10) : referenceYear
    const date = new Date(year, month, day)
    if (!Number.isNaN(date.getTime())) return date
  }

  const mdy =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i.exec(
      text
    )
  if (mdy) {
    const month = MONTH_BY_NAME[mdy[1]!.toLowerCase()]
    const day = Number.parseInt(mdy[2]!, 10)
    const year = mdy[3] ? Number.parseInt(mdy[3], 10) : referenceYear
    const date = new Date(year, month, day)
    if (!Number.isNaN(date.getTime())) return date
  }

  return null
}

/** If the brief names a launch/final date, back-calculate timeline start from duration. */
export function resolvePlannerStartDate(input: {
  brief: string
  duration: PlannerDuration
  fallbackStart: Date
}): string {
  const launchEnd = parseLaunchEndDateFromBrief(input.brief)
  if (!launchEnd) {
    return formatIsoDate(input.fallbackStart)
  }

  const dayCount = plannerDurationDayCount(input.duration)
  const start = new Date(
    launchEnd.getFullYear(),
    launchEnd.getMonth(),
    launchEnd.getDate()
  )
  start.setDate(start.getDate() - (dayCount - 1))
  return formatIsoDate(start)
}

export function formatLaunchEndIso(brief: string): string | null {
  const end = parseLaunchEndDateFromBrief(brief)
  return end ? formatIsoDate(end) : null
}

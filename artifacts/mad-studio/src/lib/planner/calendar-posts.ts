import { createClient } from "@/lib/supabase/client"

export type CalendarPostStatus =
  | "scheduled"
  | "processing"
  | "published"
  | "failed"
  | "cancelled"

/** One platform's piece of a post (a scheduled_posts row). */
export type CalendarPostSlot = {
  id: string
  platform: string
  time: Date
  status: CalendarPostStatus
  error: string | null
  publishedAt: Date | null
}

/**
 * One post on the calendar: the same content going to one or more platforms
 * on a day (Studio schedules a row per platform).
 */
export type CalendarPost = {
  key: string
  campaignId: string | null
  title: string
  caption: string
  /** Finished artwork: carousel slides, or a single image. */
  mediaUrls: string[]
  slots: CalendarPostSlot[]
  /** Earliest time that day, for ordering. */
  time: Date
  /** Worst-first summary: failed > processing > scheduled > published. */
  status: CalendarPostStatus
  /** Still waiting to go out well after its time — the scheduler may be paused. */
  overdue: boolean
}

/** A few minutes' grace before a scheduled post counts as overdue. */
const OVERDUE_AFTER_MS = 5 * 60 * 1000

type Row = {
  id: string
  campaign_id: string | null
  platform: string
  status: string
  scheduled_time: string
  published_at: string | null
  last_error: string | null
  error_message: string | null
  media_url: string | null
  caption: string | null
  payload: unknown
}

const STATUS_RANK: Record<CalendarPostStatus, number> = {
  failed: 0,
  processing: 1,
  scheduled: 2,
  published: 3,
  cancelled: 4,
}

function asStatus(value: string): CalendarPostStatus {
  return value in STATUS_RANK ? (value as CalendarPostStatus) : "scheduled"
}

function payloadOf(row: Row): Record<string, unknown> {
  return row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? (row.payload as Record<string, unknown>)
    : {}
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** Scheduled and posted content between two dates, grouped into posts. */
export async function fetchCalendarPosts(input: {
  entityId: string
  from: Date
  to: Date
}): Promise<CalendarPost[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select(
      "id, campaign_id, platform, status, scheduled_time, published_at, last_error, error_message, media_url, caption, payload"
    )
    .eq("entity_id", input.entityId)
    .neq("status", "cancelled")
    .gte("scheduled_time", input.from.toISOString())
    .lt("scheduled_time", input.to.toISOString())
    .order("scheduled_time", { ascending: true })
    .limit(500)
  if (error) throw new Error(error.message)

  const groups = new Map<string, CalendarPost>()
  for (const row of (data ?? []) as Row[]) {
    // Hidden from the calendar (e.g. test posts) — still live on the platform.
    if (payloadOf(row).calendar_hidden === true) continue
    const time = new Date(row.scheduled_time)
    const key = row.campaign_id ? `${row.campaign_id}:${dayKey(time)}` : row.id
    const payload = payloadOf(row)
    const slides = Array.isArray(payload.media_urls)
      ? payload.media_urls.filter((url): url is string => typeof url === "string")
      : []
    const single = stringOf(payload.media_url) || stringOf(row.media_url)
    const slot: CalendarPostSlot = {
      id: row.id,
      platform: row.platform,
      time,
      status: asStatus(row.status),
      error: row.last_error || row.error_message || null,
      publishedAt: row.published_at ? new Date(row.published_at) : null,
    }
    const existing = groups.get(key)
    if (existing) {
      existing.slots.push(slot)
      if (slot.time < existing.time) existing.time = slot.time
      if (STATUS_RANK[slot.status] < STATUS_RANK[existing.status]) {
        existing.status = slot.status
      }
      // Prefer a feed carousel's slides for the card.
      if (slides.length > existing.mediaUrls.length) existing.mediaUrls = slides
      if (!existing.caption) existing.caption = stringOf(payload.caption) || stringOf(row.caption)
      continue
    }
    groups.set(key, {
      key,
      campaignId: row.campaign_id,
      title: stringOf(payload.title) || stringOf(payload.headline) || "Post",
      caption: stringOf(payload.caption) || stringOf(row.caption),
      mediaUrls: slides.length > 0 ? slides : single ? [single] : [],
      slots: [slot],
      time,
      status: slot.status,
      overdue: false,
    })
  }
  const now = Date.now()
  for (const post of groups.values()) {
    post.overdue = post.slots.some(
      (slot) => slot.status === "scheduled" && slot.time.getTime() < now - OVERDUE_AFTER_MS
    )
  }
  return [...groups.values()].sort((a, b) => a.time.getTime() - b.time.getTime())
}

/**
 * New times for a post's platforms when it moves (each keeps its own time of
 * day). Returns an error instead of moving if any would be in the past, so a
 * post never ends up split across two days.
 */
export function plannedMove(
  post: CalendarPost,
  target: (slotTime: Date) => Date
): { moves: Array<{ id: string; time: Date }>; error: string | null } {
  const earliest = Date.now() + 2 * 60 * 1000
  const moves = post.slots
    .filter((slot) => slot.status === "scheduled" || slot.status === "failed")
    .map((slot) => ({ id: slot.id, time: target(slot.time) }))
  if (moves.length === 0) return { moves, error: "Nothing here can be moved." }
  if (moves.some((move) => move.time.getTime() < earliest)) {
    return {
      moves: [],
      error: "That time has already passed — pick a later time, or use Post now.",
    }
  }
  return { moves, error: null }
}

/** Same time of day, on another date. */
export function moveToDay(time: Date, day: Date): Date {
  const next = new Date(day)
  next.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return next
}

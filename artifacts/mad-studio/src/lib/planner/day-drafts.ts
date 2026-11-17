import type { Json } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/client"

import { draftTime, ymdOf } from "./draft-day"

export { dayLabel, draftTime, nextDraftDay, parseYmd, ymdOf } from "./draft-day"

/**
 * Drafts: posts made for a day that wait on the calendar until approved.
 * They're scheduled_posts rows with status "draft". The dispatcher only
 * claims "scheduled" rows, so a draft can't go out until Approve.
 */

/** What made the draft; a new draft of the same kind replaces the old one that day. */
export type DraftKind = string

export type DayDraft = {
  kind: DraftKind
  /** Where it goes: a row each, shown and approved together as one post. */
  platforms: Array<"instagram_feed" | "facebook" | "instagram_story">
  title: string
  caption: string
  /** One image, or 2–10 carousel slides. */
  mediaUrls: string[]
  /** Hour of the day it's set to go out (local time). */
  hour: number
  /** What it was made from (e.g. the dot special's wording), so it can be edited from the calendar. */
  data?: Json
}

function draftError(message: string): Error {
  // The status check rejects "draft" until the migration has been run.
  if (/scheduled_posts_status_check/i.test(message)) {
    return new Error(
      "Drafts aren't switched on yet: run supabase/migrations/20261117_scheduled_posts_draft.sql in Supabase."
    )
  }
  return new Error(message)
}

/**
 * Puts drafts on a day, replacing any earlier draft of the same kind there.
 * A kind that's already approved (scheduled or posted) that day is left alone
 * and skipped, so redrafting can't post it twice.
 */
export async function saveDayDrafts(input: {
  entityId: string
  day: Date
  drafts: DayDraft[]
}): Promise<{ saved: DraftKind[]; skipped: DraftKind[] }> {
  if (input.drafts.length === 0) return { saved: [], skipped: [] }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const from = new Date(input.day.getFullYear(), input.day.getMonth(), input.day.getDate())
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  const nowIso = new Date().toISOString()

  const { data: approvedRows, error: approvedError } = await supabase
    .from("scheduled_posts")
    .select("payload->>draft_kind")
    .eq("entity_id", input.entityId)
    .in("status", ["scheduled", "processing", "publishing", "published"])
    .gte("scheduled_time", from.toISOString())
    .lt("scheduled_time", to.toISOString())
  if (approvedError) throw draftError(approvedError.message)
  const approved = new Set(
    ((approvedRows ?? []) as Array<{ draft_kind?: string | null }>).map((row) => row.draft_kind).filter(Boolean)
  )
  const skipped = input.drafts.filter((draft) => approved.has(draft.kind)).map((draft) => draft.kind)
  const drafts = input.drafts.filter((draft) => !approved.has(draft.kind))
  if (drafts.length === 0) return { saved: [], skipped }

  for (const draft of drafts) {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "cancelled", updated_at: nowIso })
      .eq("entity_id", input.entityId)
      .eq("status", "draft")
      .eq("payload->>draft_kind", draft.kind)
      .gte("scheduled_time", from.toISOString())
      .lt("scheduled_time", to.toISOString())
    if (error) throw draftError(error.message)
  }

  const { error } = await supabase.from("scheduled_posts").insert(
    drafts.flatMap((draft) => {
      const urls = draft.mediaUrls.filter(Boolean)
      const time = draftTime(input.day, draft.hour).toISOString()
      // Ties the platforms together so the calendar shows them as one post.
      const group = `${draft.kind}:${ymdOf(input.day)}:${Date.now()}`
      return draft.platforms.map((platform) => ({
        entity_id: input.entityId,
        platform,
        status: "draft",
        mode: "scheduled",
        timing_source: "manual",
        scheduled_time: time,
        created_by: user?.id ?? null,
        payload: {
          title: draft.title,
          caption: draft.caption,
          media_url: urls[0] ?? null,
          // Feed and Facebook take the slides as a carousel; a Story is one image.
          media_urls: platform !== "instagram_story" && urls.length >= 2 ? urls.slice(0, 10) : null,
          story_urls: null,
          draft_kind: draft.kind,
          draft_group: group,
          draft_data: draft.data ?? null,
        } as Json,
      }))
    })
  )
  if (error) throw draftError(error.message)
  return { saved: drafts.map((draft) => draft.kind), skipped }
}

/** Approve: the draft goes out at `time` like any other scheduled post. */
export async function approveDrafts(input: {
  entityId: string
  ids: string[]
  time: Date
  caption?: string
}): Promise<void> {
  if (input.time.getTime() < Date.now() + 2 * 60 * 1000) {
    throw new Error("That time has already passed. Pick a later time.")
  }
  const supabase = createClient()
  for (const id of input.ids) {
    const { data: row, error: readError } = await supabase
      .from("scheduled_posts")
      .select("payload")
      .eq("id", id)
      .eq("entity_id", input.entityId)
      .eq("status", "draft")
      .maybeSingle()
    if (readError) throw new Error(readError.message)
    if (!row) throw new Error("This draft has already been approved or removed.")
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, Json | undefined>)
        : {}
    const { error } = await supabase
      .from("scheduled_posts")
      .update({
        status: "scheduled",
        scheduled_time: input.time.toISOString(),
        updated_at: new Date().toISOString(),
        payload: (input.caption === undefined ? payload : { ...payload, caption: input.caption }) as Json,
      })
      .eq("id", id)
      .eq("entity_id", input.entityId)
      .eq("status", "draft")
    if (error) throw new Error(error.message)
  }
}

/**
 * Books Instagram Stories straight onto the calendar (no approval step), e.g.
 * the 8am "Open today" hours. A day's earlier booking of the same kind is
 * replaced; a day where it has already gone out is skipped.
 */
export async function scheduleDayStories(input: {
  entityId: string
  kind: string
  stories: Array<{ postAt: Date; mediaUrl: string; title: string; caption: string }>
}): Promise<{ booked: number; skipped: number }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let booked = 0
  let skipped = 0
  for (const story of input.stories) {
    const from = new Date(story.postAt.getFullYear(), story.postAt.getMonth(), story.postAt.getDate())
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    const sameDay = () =>
      supabase
        .from("scheduled_posts")
        .select("id, status")
        .eq("entity_id", input.entityId)
        .eq("platform", "instagram_story")
        .eq("payload->>draft_kind", input.kind)
        .gte("scheduled_time", from.toISOString())
        .lt("scheduled_time", to.toISOString())
        .neq("status", "cancelled")
    const { data: existing, error: readError } = await sameDay()
    if (readError) throw new Error(readError.message)
    const rows = (existing ?? []) as Array<{ id: string; status: string }>
    if (rows.some((row) => row.status === "published" || row.status === "processing" || row.status === "publishing")) {
      skipped++
      continue
    }
    const stale = rows.filter((row) => row.status === "scheduled" || row.status === "draft" || row.status === "failed")
    if (stale.length > 0) {
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .in(
          "id",
          stale.map((row) => row.id)
        )
      if (error) throw new Error(error.message)
    }
    const { error } = await supabase.from("scheduled_posts").insert({
      entity_id: input.entityId,
      platform: "instagram_story",
      status: "scheduled",
      mode: "scheduled",
      timing_source: "manual",
      scheduled_time: story.postAt.toISOString(),
      created_by: user?.id ?? null,
      payload: {
        title: story.title,
        caption: story.caption,
        media_url: story.mediaUrl,
        media_urls: null,
        story_urls: null,
        draft_kind: input.kind,
      } as Json,
    })
    if (error) throw new Error(error.message)
    booked++
  }
  return { booked, skipped }
}

/** New artwork (and wording) for a draft that's still waiting on approval. */
export async function updateDraftArtwork(input: {
  entityId: string
  ids: string[]
  mediaUrl: string
  title: string
  caption: string
  data: Json
}): Promise<void> {
  const supabase = createClient()
  for (const id of input.ids) {
    const { data: row, error: readError } = await supabase
      .from("scheduled_posts")
      .select("payload")
      .eq("id", id)
      .eq("entity_id", input.entityId)
      .eq("status", "draft")
      .maybeSingle()
    if (readError) throw new Error(readError.message)
    if (!row) throw new Error("This draft has already been approved or removed.")
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, Json | undefined>)
        : {}
    const { error } = await supabase
      .from("scheduled_posts")
      .update({
        updated_at: new Date().toISOString(),
        payload: {
          ...payload,
          media_url: input.mediaUrl,
          title: input.title,
          caption: input.caption,
          draft_data: input.data,
        } as Json,
      })
      .eq("id", id)
      .eq("entity_id", input.entityId)
      .eq("status", "draft")
    if (error) throw new Error(error.message)
  }
}

/** Discard: the draft leaves the calendar and never posts. */
export async function discardDrafts(input: { entityId: string; ids: string[] }): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("entity_id", input.entityId)
    .eq("status", "draft")
    .in("id", input.ids)
  if (error) throw new Error(error.message)
}

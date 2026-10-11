import type { Database } from "@/lib/database.types"
import {
  dispatchOutboundChannel,
  publishCampaignToSocials,
  type CampaignPublishResult,
  type ServiceDispatchContext,
} from "@/lib/social/publish-campaign"
import { tikTokMediaGuardError } from "@/lib/social/tiktok-media-guard"
import { claimDuePostsForDispatch } from "@/lib/dispatch/claim-posts"
import { createAdminClient } from "@/lib/supabase/admin"

type ScheduledPostRow = Database["public"]["Tables"]["scheduled_posts"]["Row"]

export type ScheduledPostPayload = {
  title?: string
  headline?: string | null
  caption?: string
  media_url?: string | null
  destination_url?: string | null
  slug_seed?: string | null
}

export type ProcessScheduledPostsResult = {
  processed: number
  successes: number
  failures: number
  errors: Array<{ id: string; platform: string; error: string }>
}

const DEFAULT_MAX_RETRIES = 3
const STALE_PROCESSING_MS = 10 * 60 * 1000
const BACKOFF_BASE_MS = 5 * 60 * 1000

function maxRetriesForRow(row: ScheduledPostRow): number {
  return row.max_retries > 0 ? row.max_retries : DEFAULT_MAX_RETRIES
}

function backoffScheduledTime(attempts: number, from: Date): string {
  const multiplier = Math.max(1, attempts)
  return new Date(from.getTime() + BACKOFF_BASE_MS * multiplier).toISOString()
}

function readPayload(raw: unknown): ScheduledPostPayload {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as ScheduledPostPayload)
    : {}
}

async function dispatchRow(
  ctx: ServiceDispatchContext,
  row: ScheduledPostRow
): Promise<CampaignPublishResult> {
  const payload = readPayload(row.payload)
  const mediaUrl = payload.media_url?.trim()
  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    return { ok: false, error: "No public media URL locked for this post." }
  }
  const caption =
    payload.caption?.trim() || payload.headline?.trim() || payload.title || ""
  const base = {
    entityId: row.entity_id,
    marketingEntityId: row.marketing_entity_id,
    mediaUrl,
    caption,
    headline: payload.headline ?? payload.title ?? null,
    destinationUrl: payload.destination_url ?? null,
    slugSeed: payload.slug_seed ?? payload.title ?? null,
  }

  switch (row.platform) {
    case "instagram_story":
      return publishCampaignToSocials(ctx, {
        ...base,
        platform: "instagram",
        placement: "story",
      })
    case "instagram_feed":
      return publishCampaignToSocials(ctx, {
        ...base,
        platform: "instagram",
        placement: "feed",
      })
    case "facebook":
      return publishCampaignToSocials(ctx, {
        ...base,
        platform: "facebook",
        placement: "feed",
      })
    case "tiktok": {
      const tiktokMediaError = tikTokMediaGuardError(mediaUrl)
      if (tiktokMediaError) {
        return { ok: false, error: tiktokMediaError }
      }
      return dispatchOutboundChannel(ctx, { ...base, platform: "tiktok" })
    }
    case "email":
      return dispatchOutboundChannel(ctx, { ...base, platform: "email" })
    default:
      return { ok: false, error: `Unsupported platform "${row.platform}".` }
  }
}

/** Marks the parent drop + campaign published once no queue rows remain pending. */
async function finaliseParents(
  admin: ReturnType<typeof createAdminClient>,
  marketingEntityIds: string[]
) {
  for (const marketingEntityId of marketingEntityIds) {
    const { data: rows } = await admin
      .from("scheduled_posts")
      .select("status, campaign_id, entity_id")
      .eq("marketing_entity_id", marketingEntityId)
      .neq("status", "cancelled")

    const list = rows ?? []
    const pending = list.some(
      (row) => row.status === "scheduled" || row.status === "processing"
    )
    const anyPublished = list.some((row) => row.status === "published")
    if (pending || !anyPublished) continue

    const now = new Date().toISOString()
    const entityId = list[0]?.entity_id
    await admin
      .from("marketing_entities")
      .update({ status: "published", published_at: now, updated_at: now })
      .eq("id", marketingEntityId)
      .eq("status", "scheduled")

    const campaignIds = Array.from(
      new Set(list.map((row) => row.campaign_id).filter(Boolean))
    ) as string[]
    if (campaignIds.length > 0 && entityId) {
      await admin
        .from("campaigns")
        .update({ status: "published", published_at: now, updated_at: now })
        .in("id", campaignIds)
        .eq("entity_id", entityId)
    }
  }
}

/** Studio pack rows (no inventory item): publish the campaign once its queue drains. */
async function finaliseCampaigns(
  admin: ReturnType<typeof createAdminClient>,
  campaignIds: string[]
) {
  for (const campaignId of campaignIds) {
    const { data: rows } = await admin
      .from("scheduled_posts")
      .select("status, entity_id")
      .eq("campaign_id", campaignId)
      .is("marketing_entity_id", null)
      .neq("status", "cancelled")

    const list = rows ?? []
    const pending = list.some(
      (row) => row.status === "scheduled" || row.status === "processing"
    )
    if (pending || !list.some((row) => row.status === "published")) continue

    const now = new Date().toISOString()
    await admin
      .from("campaigns")
      .update({ status: "published", published_at: now, updated_at: now })
      .eq("id", campaignId)
      .eq("entity_id", list[0].entity_id)
  }
}

/**
 * Dispatches due `public.scheduled_posts` rows. Pass `ids` to dispatch specific
 * rows (e.g. Immediate channels right after arming).
 */
export async function processScheduledPosts(input: {
  ctx: ServiceDispatchContext
  ids?: string[]
  limit?: number
  now?: Date
}): Promise<ProcessScheduledPostsResult> {
  const admin = createAdminClient()
  const now = input.now ?? new Date()
  const result: ProcessScheduledPostsResult = {
    processed: 0,
    successes: 0,
    failures: 0,
    errors: [],
  }

  if (!input.ids) {
    await admin
      .from("scheduled_posts")
      .update({ status: "scheduled", updated_at: now.toISOString() })
      .eq("status", "processing")
      .lt("updated_at", new Date(now.getTime() - STALE_PROCESSING_MS).toISOString())
  }

  let due: ScheduledPostRow[] = []

  if (input.ids) {
    if (input.ids.length === 0) return result
    const { data, error } = await admin
      .from("scheduled_posts")
      .select("*")
      .in("id", input.ids)
      .eq("status", "scheduled")
    if (error) throw new Error(error.message)
    const claimedAt = now.toISOString()
    const claimedRows: ScheduledPostRow[] = []
    for (const row of (data ?? []) as ScheduledPostRow[]) {
      const { data: claimed } = await admin
        .from("scheduled_posts")
        .update({
          status: "processing",
          attempts: row.attempts + 1,
          updated_at: claimedAt,
        })
        .eq("id", row.id)
        .eq("status", "scheduled")
        .select("*")
        .maybeSingle()
      if (claimed) claimedRows.push(claimed as ScheduledPostRow)
    }
    due = claimedRows
  } else {
    due = await claimDuePostsForDispatch(admin, input.limit ?? 25)
  }

  const touchedParents = new Set<string>()
  const touchedCampaigns = new Set<string>()

  for (const claimed of due) {
    result.processed += 1
    const outcome = await dispatchRow(input.ctx, claimed)
    const finishedAt = new Date().toISOString()
    const retryLimit = maxRetriesForRow(claimed)

    if (outcome.ok) {
      result.successes += 1
      await admin
        .from("scheduled_posts")
        .update({
          status: "published",
          published_at: finishedAt,
          remote_media_id: outcome.mediaId,
          last_error: null,
          error_message: null,
          updated_at: finishedAt,
        })
        .eq("id", claimed.id)
    } else {
      result.failures += 1
      result.errors.push({
        id: claimed.id,
        platform: claimed.platform,
        error: outcome.error,
      })
      const deadLetter = claimed.attempts >= retryLimit
      await admin
        .from("scheduled_posts")
        .update({
          status: deadLetter ? "failed" : "scheduled",
          last_error: outcome.error.slice(0, 1000),
          error_message: outcome.error.slice(0, 1000),
          scheduled_time: deadLetter
            ? claimed.scheduled_time
            : backoffScheduledTime(claimed.attempts, now),
          updated_at: finishedAt,
        })
        .eq("id", claimed.id)
    }

    if (claimed.marketing_entity_id) {
      touchedParents.add(claimed.marketing_entity_id)
    } else if (claimed.campaign_id) {
      touchedCampaigns.add(claimed.campaign_id)
    }
  }

  await finaliseParents(admin, Array.from(touchedParents))
  await finaliseCampaigns(admin, Array.from(touchedCampaigns))
  result.errors = result.errors.slice(0, 40)
  return result
}

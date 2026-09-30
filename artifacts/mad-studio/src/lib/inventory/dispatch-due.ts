import { composeCaption, sanitizeItemTitle } from "@/lib/copy/caption-hygiene"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import { mergeCaptionWithTags } from "@/lib/inventory/optimization-tags"
import {
  parseCopyDraft,
  type DispatchChannel,
} from "@/lib/inventory/types"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  resolveAppOrigin,
  resolveCronSecret,
} from "@/lib/social/publish-campaign"
import { trackableUrl } from "@/lib/social/types"

type DueItem = {
  id: string
  entity_id: string
  title: string
  website_item_id: string
  images: string[] | null
  channels: string[] | null
  copy_draft: unknown
  scheduled_at: string
  trackable_slug: string | null
}

type ChannelPublishPlan = {
  channel: string
  platform: "instagram" | "facebook" | "email" | "tiktok"
  placement: "feed" | "story"
}

function mapChannelToPlan(
  channel: string,
  draftPlacement?: "feed" | "story"
): ChannelPublishPlan | null {
  if (channel === "instagram_feed" || channel === "instagram") {
    return {
      channel: "instagram_feed",
      platform: "instagram",
      placement: draftPlacement === "story" ? "story" : "feed",
    }
  }
  if (channel === "instagram_story") {
    return {
      channel: "instagram_story",
      platform: "instagram",
      placement: "story",
    }
  }
  if (channel === "facebook") {
    return {
      channel: "facebook",
      platform: "facebook",
      placement: "feed",
    }
  }
  if (channel === "email_newsletter" || channel === "email") {
    return {
      channel: "email_newsletter",
      platform: "email",
      placement: "feed",
    }
  }
  if (channel === "tiktok") {
    return {
      channel: "tiktok",
      platform: "tiktok",
      placement: "feed",
    }
  }
  return null
}

async function publishChannel(input: {
  origin: string
  secret: string
  entityId: string
  item: DueItem
  plan: ChannelPublishPlan
  mediaUrl: string
  caption: string
  destinationUrl: string | null
}): Promise<{ ok: true; shortUrl?: string } | { ok: false; error: string }> {
  const draft = parseCopyDraft(input.item.copy_draft)
  const response = await fetch(`${input.origin}/api/social/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.secret}`,
      "x-cron-secret": input.secret,
    },
    body: JSON.stringify({
      entityId: input.entityId,
      marketingEntityId: input.item.id,
      platform: input.plan.platform,
      placement: input.plan.placement,
      mediaUrl: input.mediaUrl,
      caption: input.caption,
      destinationUrl: input.destinationUrl,
      slugSeed: input.item.title,
      emailSubject: draft.headline || input.item.title,
      emailPreview: (draft.caption || input.caption).slice(0, 140),
      onScreenText: draft.headline || input.item.title,
      spokenHook: draft.caption || input.caption,
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    shortUrl?: string
  }

  if (!response.ok) {
    return {
      ok: false,
      error: payload.error || `Publish failed (${response.status})`,
    }
  }

  return { ok: true, shortUrl: payload.shortUrl }
}

/**
 * Finds due scheduled inventory drops and publishes each selected channel.
 */
export async function dispatchDueScheduledDrops(input?: {
  limit?: number
  now?: Date
}): Promise<{
  scanned: number
  dispatched: number
  skipped: number
  failures: Array<{ id: string; title: string; error: string }>
}> {
  const admin = createAdminClient()
  const now = input?.now ?? new Date()
  const limit = input?.limit ?? 25
  const secret = resolveCronSecret()
  if (!secret) {
    throw new Error("CRON_SECRET is not configured.")
  }

  const { data: due, error } = await admin
    .from("marketing_entities")
    .select(
      "id, entity_id, title, website_item_id, images, channels, copy_draft, scheduled_at, trackable_slug, status"
    )
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  const origin = resolveAppOrigin()
  const failures: Array<{ id: string; title: string; error: string }> = []
  let dispatched = 0
  let skipped = 0

  const entityIds = Array.from(new Set((due ?? []).map((row) => row.entity_id)))
  const websiteByEntity = new Map<string, string | null>()
  if (entityIds.length > 0) {
    const { data: entities } = await admin
      .from("entities")
      .select("id, website_url")
      .in("id", entityIds)
    for (const row of entities ?? []) {
      websiteByEntity.set(row.id, row.website_url as string | null)
    }
  }

  for (const raw of due ?? []) {
    const item = raw as DueItem

    const draft = parseCopyDraft(item.copy_draft)
    const draftRecord =
      item.copy_draft &&
      typeof item.copy_draft === "object" &&
      !Array.isArray(item.copy_draft)
        ? (item.copy_draft as Record<string, unknown>)
        : {}
    // Per-channel rows in public.scheduled_posts are dispatched by /api/cron/dispatch.
    if (draftRecord.dispatch_queue === "scheduled_posts") {
      skipped += 1
      continue
    }
    const existingClaim =
      typeof draftRecord._dispatch_claim_at === "string"
        ? Date.parse(draftRecord._dispatch_claim_at)
        : NaN
    if (
      Number.isFinite(existingClaim) &&
      Date.now() - existingClaim < 10 * 60 * 1000
    ) {
      skipped += 1
      continue
    }

    // Claim row so overlapping cron ticks don't double-post.
    const claimAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await admin
      .from("marketing_entities")
      .update({
        copy_draft: {
          ...draftRecord,
          headline: draft.headline,
          caption: draft.caption,
          platform: draft.platform,
          placement: draft.placement,
          media_url: draft.media_url,
          _dispatch_claim_at: claimAt,
        },
        updated_at: claimAt,
      })
      .eq("id", item.id)
      .eq("status", "scheduled")
      .lte("scheduled_at", now.toISOString())
      .select("id")
      .maybeSingle()

    if (claimError || !claimed) {
      skipped += 1
      continue
    }
    const mediaUrl =
      draft.media_url ||
      (Array.isArray(item.images)
        ? item.images.find((url) => /^https?:\/\//i.test(url))
        : null)

    if (!mediaUrl) {
      failures.push({
        id: item.id,
        title: item.title,
        error: "No public media URL locked for this scheduled drop.",
      })
      continue
    }

    const channels = (
      Array.isArray(item.channels) && item.channels.length > 0
        ? item.channels
        : (["instagram_feed"] as DispatchChannel[])
    ).filter(Boolean)

    const plans = channels
      .map((channel) => mapChannelToPlan(channel, draft.placement))
      .filter((plan): plan is ChannelPublishPlan => Boolean(plan))

    if (plans.length === 0) {
      failures.push({
        id: item.id,
        title: item.title,
        error: "No publishable channels on this scheduled drop.",
      })
      continue
    }

    const caption =
      mergeCaptionWithTags(
        composeCaption(draft.headline, draft.caption) ||
          sanitizeItemTitle(item.title),
        draft.tags
      )

    const destinationUrl = resolveItemDestinationUrl({
      entityId: item.entity_id,
      websiteUrl: websiteByEntity.get(item.entity_id) ?? null,
      websiteItemId: item.website_item_id,
      copyDraft: item.copy_draft,
    })

    let anyOk = false
    const channelErrors: string[] = []

    for (const plan of plans) {
      const result = await publishChannel({
        origin,
        secret,
        entityId: item.entity_id,
        item,
        plan,
        mediaUrl,
        caption,
        destinationUrl,
      })
      if (result.ok) {
        anyOk = true
      } else {
        channelErrors.push(`${plan.platform}: ${result.error}`)
      }
    }

    if (!anyOk) {
      failures.push({
        id: item.id,
        title: item.title,
        error: channelErrors.join(" · ") || "All channel publishes failed.",
      })
      // Leave as scheduled so the next tick can retry.
      continue
    }

    if (channelErrors.length > 0) {
      failures.push({
        id: item.id,
        title: item.title,
        error: `Partial: ${channelErrors.join(" · ")}`,
      })
    }

    dispatched += 1
  }

  return {
    scanned: due?.length ?? 0,
    dispatched,
    skipped,
    failures: failures.slice(0, 40),
  }
}

/** Helper for UI toasts — absolute shop URL when a slug exists. */
export function scheduledShopPreview(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null
  return trackableUrl(slug.trim())
}

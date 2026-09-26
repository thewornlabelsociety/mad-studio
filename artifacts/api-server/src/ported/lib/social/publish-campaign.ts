import { getInternalApiOrigin } from "@server/request-context"

export type ServiceDispatchContext = {
  origin: string
  secret: string
}

export type CampaignPublishPayload = {
  entityId: string
  marketingEntityId?: string | null
  mediaUrl: string
  caption: string
  headline?: string | null
  destinationUrl?: string | null
  slugSeed?: string | null
}

export type CampaignPublishResult =
  | { ok: true; mediaId: string | null; shortUrl: string | null }
  | { ok: false; error: string }

export function resolveAppOrigin(): string {
  return getInternalApiOrigin()
}

export function resolveCronSecret(): string | null {
  return (
    process.env.CRON_SECRET?.trim() ||
    process.env.SYNC_WEBHOOK_SECRET?.trim() ||
    null
  )
}

async function postToPublishRoute(
  ctx: ServiceDispatchContext,
  body: Record<string, unknown>
): Promise<CampaignPublishResult> {
  let response: Response
  try {
    response = await fetch(`${ctx.origin}/api/social/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.secret}`,
        "x-cron-secret": ctx.secret,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Publish request failed.",
    }
  }

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    mediaId?: string
    shortUrl?: string
  }
  if (!response.ok) {
    return {
      ok: false,
      error: payload.error || `Publish failed (${response.status})`,
    }
  }
  return {
    ok: true,
    mediaId: payload.mediaId ?? null,
    shortUrl: payload.shortUrl ?? null,
  }
}

/** Meta Graph dispatch (Instagram Story / Feed, Facebook Page). */
export async function publishCampaignToSocials(
  ctx: ServiceDispatchContext,
  input: CampaignPublishPayload & {
    platform: "instagram" | "facebook"
    placement: "feed" | "story"
  }
): Promise<CampaignPublishResult> {
  return postToPublishRoute(ctx, {
    entityId: input.entityId,
    marketingEntityId: input.marketingEntityId ?? null,
    platform: input.platform,
    placement: input.placement,
    mediaUrl: input.mediaUrl,
    caption: input.caption,
    destinationUrl: input.destinationUrl ?? null,
    slugSeed: input.slugSeed ?? null,
    keepEntityStatus: true,
  })
}

/** TikTok → outbound webhook (Make / n8n); VIP Email → Resend or webhook. */
export async function dispatchOutboundChannel(
  ctx: ServiceDispatchContext,
  input: CampaignPublishPayload & { platform: "tiktok" | "email" }
): Promise<CampaignPublishResult> {
  const headline = input.headline?.trim() || null
  return postToPublishRoute(ctx, {
    entityId: input.entityId,
    marketingEntityId: input.marketingEntityId ?? null,
    platform: input.platform,
    placement: "feed",
    mediaUrl: input.mediaUrl,
    caption: input.caption,
    destinationUrl: input.destinationUrl ?? null,
    slugSeed: input.slugSeed ?? null,
    emailSubject: headline,
    emailPreview: input.caption.slice(0, 140),
    onScreenText: headline,
    spokenHook: input.caption.slice(0, 500),
    keepEntityStatus: true,
  })
}

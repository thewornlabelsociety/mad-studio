import { timingSafeEqual } from "crypto"
import { HttpResponse } from "@server/http-response"

import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import {
  composeCaption,
  finalizePlatformCaption,
  IG_LINK_CTA,
} from "@/lib/copy/caption-hygiene"
import type { Json } from "@/lib/database.types"
import { ensurePublicMediaUrl } from "@/lib/social/ensure-public-media"
import { publishToMeta } from "@/lib/social/meta-publisher"
import { ensureTrackableLink } from "@/lib/social/link-tracker"
import {
  TIKTOK_SANDBOX_DISPATCH_NOTE,
  tikTokMediaGuardError,
} from "@/lib/social/tiktok-media-guard"
import { publishToTikTok, resolveTikTokConnection } from "@/lib/social/tiktok-publisher"
import {
  formatMetaDispatchError,
  postOutboundWebhook,
  resolveOutboundWebhookUrl,
  resolveSocialConnection,
  resolveVipEmailRecipients,
  sendVipEmailViaResend,
  WLS_DEFAULT_ENTITY_ID,
} from "@/lib/social/outbound-dispatch"
import {
  isUuid,
  normalizeBrandKey,
  normalizePublishPlacement,
  parsePublishedMediaIds,
  socialPublishRequestSchema,
} from "@/lib/social/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof createAdminClient>

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractBearerSecret(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null
  }
  return (
    request.headers.get("x-cron-secret")?.trim() ||
    request.headers.get("x-sync-secret")?.trim() ||
    null
  )
}

function isServiceSecretAuthorized(request: Request): boolean {
  const provided = extractBearerSecret(request)
  if (!provided) return false
  const candidates = [
    process.env.CRON_SECRET?.trim(),
    process.env.SYNC_WEBHOOK_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value))

  return candidates.some((expected) => secretsMatch(provided, expected))
}

function resolveDestination(
  entityWebsiteUrl: string | null,
  override?: string | null
): string | null {
  if (override?.trim()) {
    const trimmed = override.trim()
    try {
      return new URL(trimmed).toString()
    } catch {
      return trimmed
    }
  }
  if (!entityWebsiteUrl) return null
  try {
    const base = new URL(
      /^https?:\/\//i.test(entityWebsiteUrl)
        ? entityWebsiteUrl
        : `https://${entityWebsiteUrl}`
    )
    if (base.hostname === "wornlabelsociety.co.nz") {
      base.hostname = "www.wornlabelsociety.co.nz"
    }
    return `${base.origin}/`
  } catch {
    return null
  }
}

async function resolveEntity(
  supabase: DbClient,
  entityIdOrSlug: string
): Promise<{ id: string; name: string; website_url: string | null } | null> {
  const raw = entityIdOrSlug.trim()
  if (!raw) return null

  if (isUuid(raw)) {
    const { data } = await supabase
      .from("entities")
      .select("id, name, website_url")
      .eq("id", raw)
      .maybeSingle()
    return data
  }

  const needle = normalizeBrandKey(raw)
  const { data: rows } = await supabase
    .from("entities")
    .select("id, name, website_url")
    .limit(200)

  const exact = (rows ?? []).find(
    (row) => normalizeBrandKey(row.name) === needle
  )
  if (exact) return exact

  const byWebsite = (rows ?? []).find((row) => {
    if (!row.website_url) return false
    return normalizeBrandKey(row.website_url).includes(needle)
  })
  if (byWebsite) return byWebsite

  const fuzzy = (rows ?? []).find((row) => {
    const key = normalizeBrandKey(row.name)
    return key.includes(needle) || needle.includes(key)
  })
  if (fuzzy) return fuzzy

  const { data: byName } = await supabase
    .from("entities")
    .select("id, name, website_url")
    .ilike("name", `%${raw}%`)
    .limit(1)
    .maybeSingle()

  return byName
}

function luxuryEmailHtml(input: {
  brandName: string
  subject: string
  previewText?: string | null
  bodyHtml: string
  mediaUrl?: string | null
  ctaUrl?: string | null
}): string {
  const media = input.mediaUrl
    ? `<img src="${input.mediaUrl}" alt="" style="width:100%;max-width:560px;height:auto;display:block;margin:0 auto 24px;" />`
    : ""
  const cta = input.ctaUrl
    ? `<p style="text-align:center;margin:28px 0 8px;"><a href="${input.ctaUrl}" style="display:inline-block;padding:12px 22px;background:#111;color:#fff;text-decoration:none;font-family:Georgia,serif;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;">Shop the drop</a></p>`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#f6f4f1;padding:32px 12px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:36px 28px;border:1px solid #e6e1da;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a857c;">${input.brandName}</p>
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:normal;line-height:1.25;">${input.subject}</h1>
    ${input.previewText ? `<p style="margin:0 0 20px;color:#5c574f;font-size:15px;line-height:1.5;">${input.previewText}</p>` : ""}
    ${media}
    <div style="font-size:16px;line-height:1.65;color:#2a2a2a;">${input.bodyHtml}</div>
    ${cta}
  </div>
</body></html>`
}

async function markItemDispatched(input: {
  supabase: DbClient
  item: {
    id: string
    entity_id: string
    channels: string[] | null
    published_media_ids: Json | null
    trackable_slug: string | null
  }
  channel: string
  slug?: string | null
  publishedMediaIds?: ReturnType<typeof parsePublishedMediaIds> | null
  keepStatus?: boolean
}) {
  const now = new Date().toISOString()
  await input.supabase
    .from("marketing_entities")
    .update({
      ...(input.keepStatus
        ? {}
        : { status: "published", published_at: now }),
      updated_at: now,
      trackable_slug: input.slug ?? input.item.trackable_slug,
      published_media_ids: (input.publishedMediaIds ??
        parsePublishedMediaIds(input.item.published_media_ids)) as Json,
      channels: Array.from(
        new Set([
          ...(Array.isArray(input.item.channels) ? input.item.channels : []),
          input.channel,
        ])
      ),
    })
    .eq("id", input.item.id)
    .eq("entity_id", input.item.entity_id)
}

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return HttpResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 }
      )
    }

    const parsed = socialPublishRequestSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        {
          error: "Invalid publish payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const input = parsed.data
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()

    const serviceAuthorized = !user && isServiceSecretAuthorized(request)
    if (!user && !serviceAuthorized) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase: DbClient = serviceAuthorized
      ? createAdminClient()
      : sessionClient

    const entityRef =
      input.entityId?.trim() || WLS_DEFAULT_ENTITY_ID

    const entity = await resolveEntity(supabase, entityRef)
    if (!entity) {
      return HttpResponse.json(
        {
          error: `Brand entity not found for "${entityRef}". Pass a UUID or recognizable brand slug/name.`,
        },
        { status: 404 }
      )
    }

    if (user && !serviceAuthorized) {
      const { data: canEdit, error: accessError } = await supabase.rpc(
        "has_entity_access",
        {
          ent_id: entity.id,
          allowed_roles: ["entity_manager", "creator"],
        }
      )
      if (accessError) {
        return HttpResponse.json({ error: accessError.message }, { status: 500 })
      }
      if (!canEdit) {
        return HttpResponse.json(
          { error: "You need creator or manager access to publish." },
          { status: 403 }
        )
      }
    }

    const placement = normalizePublishPlacement(input.placement)

    let item: {
      id: string
      entity_id: string
      title: string
      description: string | null
      images: string[] | null
      status: string
      copy_draft: Json | null
      published_media_ids: Json | null
      trackable_slug: string | null
      website_item_id: string
      channels: string[] | null
    } | null = null

    if (input.marketingEntityId) {
      const { data, error: itemError } = await supabase
        .from("marketing_entities")
        .select(
          "id, entity_id, title, description, images, status, copy_draft, published_media_ids, trackable_slug, website_item_id, channels"
        )
        .eq("id", input.marketingEntityId)
        .eq("entity_id", entity.id)
        .maybeSingle()

      if (itemError || !data) {
        return HttpResponse.json(
          {
            error:
              itemError?.message ??
              "Inventory item not found for this brand (marketingEntityId).",
          },
          { status: 404 }
        )
      }
      item = data
    }

    const draft =
      item?.copy_draft &&
      typeof item.copy_draft === "object" &&
      !Array.isArray(item.copy_draft)
        ? (item.copy_draft as Record<string, unknown>)
        : {}
    const draftCaption =
      typeof draft.caption === "string" ? draft.caption : ""
    const draftHeadline =
      typeof draft.headline === "string" ? draft.headline : ""

    const destination = resolveDestination(
      entity.website_url,
      input.destinationUrl ?? input.ctaUrl
    )

    let shortUrl: string | null = null
    let slug: string | null = item?.trackable_slug ?? null
    if (destination && item) {
      const link = await ensureTrackableLink({
        entityId: entity.id,
        marketingEntityId: item.id,
        destinationUrl: destination,
        existingSlug: item.trackable_slug,
        titleSeed: input.slugSeed?.trim() || item.title,
        utmMedium:
          input.platform === "email"
            ? "email"
            : placement === "story"
              ? "story"
              : "social",
      })
      shortUrl = link.shortUrl
      slug = link.slug
    }

    const captionBase = (
      input.caption?.trim() ||
      composeCaption(draftHeadline, draftCaption) ||
      item?.description?.trim() ||
      ""
    ).slice(0, 2000)

    const isWornLabel =
      resolveIndustryProfile({ name: entity.name }).id === "worn_label"
    const caption = finalizePlatformCaption({
      caption: captionBase,
      platform: input.platform,
      placement,
      shortUrl,
      cta: isWornLabel
        ? `Tap link in bio to shop or try it on in our Whangārei showroom today.`
        : IG_LINK_CTA,
      bannedSeeds: item?.website_item_id ? [item.website_item_id] : [],
    })
    const linkSticker =
      input.platform === "instagram" && placement === "story"
        ? shortUrl || destination
        : null

    let mediaUrl =
      input.mediaUrl?.trim() ||
      (Array.isArray(item?.images) ? item.images[0] : null) ||
      null

    if (mediaUrl) {
      try {
        const ensured = await ensurePublicMediaUrl({
          mediaUrl,
          entityId: entity.id,
        })
        mediaUrl = ensured.url
      } catch (error) {
        return HttpResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "mediaUrl must be a public HTTPS URL Meta can fetch.",
          },
          { status: 400 }
        )
      }
    }

    // ── TikTok: native OAuth connection, else outbound webhook ──────────
    if (input.platform === "tiktok") {
      if (!mediaUrl) {
        return HttpResponse.json(
          { error: "mediaUrl is required for TikTok dispatch." },
          { status: 400 }
        )
      }

      const tiktokMediaError = tikTokMediaGuardError(mediaUrl)
      if (tiktokMediaError) {
        return HttpResponse.json({ error: tiktokMediaError }, { status: 400 })
      }

      const tiktokConnection = await resolveTikTokConnection(supabase, entity.id)
      if (tiktokConnection) {
        const posted = await publishToTikTok({
          accessToken: tiktokConnection.accessToken,
          mediaUrl,
          caption,
        })
        if (!posted.ok) {
          return HttpResponse.json({ error: posted.error }, { status: posted.status })
        }

        if (item) {
          await markItemDispatched({
            supabase,
            item,
            channel: "tiktok",
            slug,
            publishedMediaIds: {
              ...parsePublishedMediaIds(item.published_media_ids),
              tiktok: posted.publishId,
            },
            keepStatus: input.keepEntityStatus,
          })
        }

        await supabase.from("activity_logs").insert({
          entity_id: entity.id,
          user_id: user?.id ?? null,
          action: "social_published",
          details: {
            marketing_entity_id: item?.id ?? null,
            platform: "tiktok",
            via: "tiktok_oauth",
            tiktok_account: tiktokConnection.accountName,
            publish_id: posted.publishId,
            privacy_level: posted.privacyLevel,
            media_type: posted.mediaType,
            short_url: shortUrl,
            slug,
          },
        })

        return HttpResponse.json({
          ok: true,
          entityId: entity.id,
          entityName: entity.name,
          platform: "tiktok",
          status: "dispatched",
          mediaId: posted.publishId,
          message: posted.publishId
            ? `${TIKTOK_SANDBOX_DISPATCH_NOTE} (${tiktokConnection.accountName}, ${posted.privacyLevel})`
            : `Sent to TikTok (${tiktokConnection.accountName}, ${posted.privacyLevel})`,
          shortUrl,
          slug,
          marketingEntityId: item?.id ?? null,
        })
      }

      const webhookUrl = await resolveOutboundWebhookUrl(supabase, entity.id)
      if (!webhookUrl) {
        return HttpResponse.json(
          {
            error:
              "No TikTok connection for this brand. Connect TikTok under Settings → Social, or add an outbound webhook (Make.com / n8n / Zapier).",
          },
          { status: 400 }
        )
      }

      const ping = await postOutboundWebhook({
        webhookUrl,
        payload: {
          platform: "tiktok",
          entityId: entity.id,
          entityName: entity.name,
          marketingEntityId: item?.id ?? null,
          mediaUrl,
          caption,
          spokenHook: input.spokenHook ?? draftHeadline ?? null,
          onScreenText: input.onScreenText ?? null,
          searchKeywords: input.searchKeywords ?? [],
          shortUrl,
          slug,
          timestamp: new Date().toISOString(),
        },
      })
      if (!ping.ok) {
        return HttpResponse.json({ error: ping.error }, { status: 502 })
      }

      const tiktokMediaId = `webhook:${Date.now()}`
      if (item) {
        await markItemDispatched({
          supabase,
          item,
          channel: "tiktok",
          slug,
          publishedMediaIds: {
            ...parsePublishedMediaIds(item.published_media_ids),
            tiktok: tiktokMediaId,
          },
          keepStatus: input.keepEntityStatus,
        })
      }

      await supabase.from("activity_logs").insert({
        entity_id: entity.id,
        user_id: user?.id ?? null,
        action: "social_published",
        details: {
          marketing_entity_id: item?.id ?? null,
          platform: "tiktok",
          via: "outbound_webhook",
          short_url: shortUrl,
          slug,
        },
      })

      return HttpResponse.json({
        ok: true,
        entityId: entity.id,
        entityName: entity.name,
        platform: "tiktok",
        status: "dispatched",
        mediaId: tiktokMediaId,
        message: "Dispatched to TikTok Webhook (Make/n8n)",
        shortUrl,
        slug,
        marketingEntityId: item?.id ?? null,
      })
    }

    // ── VIP Email (Resend or outbound webhook) ──────────────────────────
    if (input.platform === "email") {
      const subject =
        input.emailSubject?.trim() ||
        draftHeadline ||
        item?.title ||
        `${entity.name} drop`
      const emailBody = finalizePlatformCaption({
        caption: captionBase,
        platform: "email",
      })
      const previewText =
        input.emailPreview?.trim() || emailBody.slice(0, 140)
      const htmlBody =
        input.htmlBody?.trim() ||
        `<p>${emailBody.replace(/\n/g, "<br/>")}</p>`
      const styled = luxuryEmailHtml({
        brandName: entity.name,
        subject,
        previewText,
        bodyHtml: htmlBody,
        mediaUrl,
        ctaUrl: shortUrl || destination,
      })

      const recipients = resolveVipEmailRecipients(entity.id)
      const hasResend = Boolean(process.env.RESEND_API_KEY?.trim())

      if (hasResend && recipients.length > 0) {
        const sent = await sendVipEmailViaResend({
          to: recipients,
          subject,
          previewText,
          htmlBody: styled,
        })
        if (!sent.ok) {
          return HttpResponse.json({ error: sent.error }, { status: 502 })
        }

        if (item) {
          await markItemDispatched({
            supabase,
            item,
            channel: "email_newsletter",
            slug,
            publishedMediaIds: {
              ...parsePublishedMediaIds(item.published_media_ids),
              email: sent.id,
            },
            keepStatus: input.keepEntityStatus,
          })
        }

        await supabase.from("activity_logs").insert({
          entity_id: entity.id,
          user_id: user?.id ?? null,
          action: "social_published",
          details: {
            marketing_entity_id: item?.id ?? null,
            platform: "email",
            via: "resend",
            resend_id: sent.id,
            short_url: shortUrl,
          },
        })

        return HttpResponse.json({
          ok: true,
          entityId: entity.id,
          entityName: entity.name,
          platform: "email",
          status: "dispatched",
          mediaId: sent.id,
          message: "VIP Email Campaign Dispatched",
          shortUrl,
          slug,
          marketingEntityId: item?.id ?? null,
        })
      }

      const webhookUrl = await resolveOutboundWebhookUrl(supabase, entity.id)
      if (!webhookUrl) {
        return HttpResponse.json(
          {
            error: hasResend
              ? "RESEND_API_KEY is set but VIP_EMAIL_TEST_LIST is empty, and no outbound webhook is configured."
              : "Configure RESEND_API_KEY + VIP_EMAIL_TEST_LIST, or set an Outbound Webhook URL under Settings → Social.",
          },
          { status: 400 }
        )
      }

      const ping = await postOutboundWebhook({
        webhookUrl,
        payload: {
          platform: "email",
          entityId: entity.id,
          entityName: entity.name,
          subject,
          previewText,
          htmlBody: styled,
          mediaUrl,
          ctaUrl: shortUrl || destination,
          caption,
          timestamp: new Date().toISOString(),
        },
      })
      if (!ping.ok) {
        return HttpResponse.json({ error: ping.error }, { status: 502 })
      }

      const emailMediaId = `webhook:${Date.now()}`
      if (item) {
        await markItemDispatched({
          supabase,
          item,
          channel: "email_newsletter",
          slug,
          publishedMediaIds: {
            ...parsePublishedMediaIds(item.published_media_ids),
            email: emailMediaId,
          },
          keepStatus: input.keepEntityStatus,
        })
      }

      await supabase.from("activity_logs").insert({
        entity_id: entity.id,
        user_id: user?.id ?? null,
        action: "social_published",
        details: {
          marketing_entity_id: item?.id ?? null,
          platform: "email",
          via: "outbound_webhook",
          short_url: shortUrl,
        },
      })

      return HttpResponse.json({
        ok: true,
        entityId: entity.id,
        entityName: entity.name,
        platform: "email",
        status: "dispatched",
        mediaId: emailMediaId,
        message: "VIP Email Campaign Dispatched",
        shortUrl,
        slug,
        marketingEntityId: item?.id ?? null,
      })
    }

    // ── Instagram / Facebook via Meta Graph ─────────────────────────────
    if (!mediaUrl) {
      return HttpResponse.json(
        {
          error:
            "mediaUrl is required when marketingEntityId is omitted or the inventory item has no images.",
        },
        { status: 400 }
      )
    }

    const connection = await resolveSocialConnection({
      supabase,
      entityId: entity.id,
      platform: input.platform,
      connectionId: input.connectionId,
    })

    if (!connection) {
      return HttpResponse.json(
        {
          error: `No active ${input.platform} connection for ${entity.name}. Configure credentials at /settings/social, or set META_ACCESS_TOKEN + WLS_INSTAGRAM_ACCOUNT_ID / WLS_FACEBOOK_PAGE_ID.`,
        },
        { status: 400 }
      )
    }

    let publishResult
    try {
      publishResult = await publishToMeta({
        connection,
        mediaUrl,
        caption,
        placement,
      })
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "Meta publish failed."
      const formatted = formatMetaDispatchError(raw)
      return HttpResponse.json(
        { error: formatted.message },
        { status: formatted.status }
      )
    }

    const mediaKey =
      publishResult.platform === "instagram"
        ? publishResult.placement === "story"
          ? "instagram_story"
          : "instagram"
        : "facebook"

    let publishedMediaIds: ReturnType<typeof parsePublishedMediaIds> | null =
      null
    if (item) {
      const existingIds = parsePublishedMediaIds(item.published_media_ids)
      publishedMediaIds = {
        ...existingIds,
        [mediaKey]: publishResult.mediaId,
      }

      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .from("marketing_entities")
        .update({
          ...(input.keepEntityStatus
            ? {}
            : { status: "published", published_at: now }),
          published_media_ids: publishedMediaIds as Json,
          trackable_slug: slug,
          updated_at: now,
          channels: Array.from(
            new Set([
              ...(Array.isArray(item.channels) ? item.channels : []),
              input.platform === "instagram"
                ? placement === "story"
                  ? "instagram_story"
                  : "instagram_feed"
                : "facebook",
            ])
          ),
        })
        .eq("id", item.id)
        .eq("entity_id", entity.id)

      if (updateError) {
        return HttpResponse.json(
          {
            error: `Published to ${input.platform}, but failed to update inventory: ${updateError.message}`,
            mediaId: publishResult.mediaId,
            shortUrl,
          },
          { status: 500 }
        )
      }
    }

    await supabase.from("activity_logs").insert({
      entity_id: entity.id,
      user_id: user?.id ?? null,
      action: "social_published",
      details: {
        marketing_entity_id: item?.id ?? null,
        platform: input.platform,
        placement,
        requested_placement: input.placement,
        media_id: publishResult.mediaId,
        short_url: shortUrl,
        link_sticker: linkSticker,
        slug,
        auth_mode: serviceAuthorized
          ? "service_secret"
          : connection.id.startsWith("env-")
            ? "env_fallback"
            : "session",
      },
    })

    return HttpResponse.json({
      ok: true,
      entityId: entity.id,
      entityName: entity.name,
      platform: input.platform,
      placement,
      requestedPlacement: input.placement,
      mediaId: publishResult.mediaId,
      publishedMediaIds,
      shortUrl,
      linkSticker,
      slug,
      status: item ? "published" : "dispatched",
      marketingEntityId: item?.id ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Social publish failed."
    const formatted = formatMetaDispatchError(message)
    return HttpResponse.json(
      { error: formatted.message },
      { status: formatted.status }
    )
  }
}

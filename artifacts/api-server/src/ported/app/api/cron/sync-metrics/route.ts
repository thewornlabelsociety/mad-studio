import { timingSafeEqual } from "crypto"
import { HttpResponse } from "@server/http-response"

import type { Json } from "@/lib/database.types"
import { fetchMediaInsights } from "@/lib/social/meta-publisher"
import { parsePublishedMediaIds } from "@/lib/social/types"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 60

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractCronSecret(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim()
  }
  return request.headers.get("x-cron-secret")?.trim() || null
}

function platformKeyToPlatform(
  key: string
): "instagram" | "facebook" | null {
  if (key === "instagram" || key === "instagram_story") return "instagram"
  if (key === "facebook") return "facebook"
  return null
}

export async function GET(request: Request) {
  return runSync(request)
}

export async function POST(request: Request) {
  return runSync(request)
}

async function runSync(request: Request) {
  try {
    const expected =
      process.env.CRON_SECRET?.trim() ||
      process.env.SYNC_WEBHOOK_SECRET?.trim()
    if (!expected) {
      return HttpResponse.json(
        { error: "CRON_SECRET is not configured." },
        { status: 500 }
      )
    }

    const provided = extractCronSecret(request)
    if (!provided || !secretsMatch(provided, expected)) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const { data: items, error } = await admin
      .from("marketing_entities")
      .select(
        "id, entity_id, metrics, published_media_ids, published_at, status, updated_at"
      )
      .eq("status", "published")
      .or(
        `published_at.gte.${since.toISOString()},and(published_at.is.null,updated_at.gte.${since.toISOString()})`
      )
      .limit(200)

    if (error) {
      return HttpResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: connections } = await admin
      .from("social_connections")
      .select(
        "id, entity_id, platform, account_id, access_token, account_name, is_active"
      )
      .eq("is_active", true)
      .in("platform", ["instagram", "facebook"])

    const connectionByEntityPlatform = new Map<
      string,
      { access_token: string }
    >()
    for (const row of connections ?? []) {
      connectionByEntityPlatform.set(
        `${row.entity_id}:${row.platform}`,
        { access_token: row.access_token }
      )
    }

    let synced = 0
    let skipped = 0
    const failures: Array<{ id: string; error: string }> = []

    for (const item of items ?? []) {
      const mediaIds = parsePublishedMediaIds(item.published_media_ids)
      const entries = Object.entries(mediaIds).filter(([, id]) => Boolean(id))
      if (entries.length === 0) {
        skipped += 1
        continue
      }

      const metrics: Record<string, unknown> =
        item.metrics &&
        typeof item.metrics === "object" &&
        !Array.isArray(item.metrics)
          ? { ...(item.metrics as Record<string, unknown>) }
          : { views: 0, clicks: 0, sales: 0 }


      let impressions = 0
      let reach = 0
      let saved = 0
      let anySuccess = false

      for (const [key, mediaId] of entries) {
        if (!mediaId) continue
        const platform = platformKeyToPlatform(key)
        if (!platform) continue
        const connection = connectionByEntityPlatform.get(
          `${item.entity_id}:${platform}`
        )
        if (!connection) {
          continue
        }

        try {
          const insights = await fetchMediaInsights({
            mediaId,
            accessToken: connection.access_token,
          })
          impressions += insights.impressions ?? 0
          reach += insights.reach ?? 0
          saved += insights.saved ?? 0
          anySuccess = true
        } catch (insightError) {
          failures.push({
            id: item.id,
            error:
              insightError instanceof Error
                ? `${key}/${mediaId}: ${insightError.message}`
                : `${key}/${mediaId}: insights failed`,
          })
        }
      }

      if (!anySuccess) {
        skipped += 1
        continue
      }

      metrics.impressions = impressions
      metrics.reach = reach
      metrics.saved = saved
      // Keep views aligned with impressions for existing ledger UI.
      metrics.views = Math.max(
        typeof metrics.views === "number" ? metrics.views : 0,
        impressions
      )

      const { data: clicks } = await admin
        .from("link_clicks")
        .select("click_count")
        .eq("marketing_entity_id", item.id)

      const clickTotal = (clicks ?? []).reduce(
        (sum, row) => sum + (row.click_count ?? 0),
        0
      )
      metrics.clicks = clickTotal

      const { error: updateError } = await admin
        .from("marketing_entities")
        .update({
          metrics: metrics as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)

      if (updateError) {
        failures.push({ id: item.id, error: updateError.message })
        continue
      }

      synced += 1
    }

    return HttpResponse.json({
      ok: true,
      scanned: items?.length ?? 0,
      synced,
      skipped,
      failures: failures.slice(0, 20),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Metrics sync failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}

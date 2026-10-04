import type { Json } from "@/lib/database.types"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  appendUtmParams,
  createTrackableSlug,
  trackableUrl,
} from "@/lib/social/types"

export async function ensureTrackableLink(input: {
  entityId: string
  marketingEntityId: string
  destinationUrl: string
  existingSlug?: string | null
  titleSeed?: string
  utmMedium?: string
}): Promise<{ slug: string; shortUrl: string; destinationUrl: string }> {
  const admin = createAdminClient()
  const withUtm = appendUtmParams(input.destinationUrl, {
    source: "social",
    medium: input.utmMedium ?? "story",
    campaign: input.titleSeed?.slice(0, 40),
  })

  if (input.existingSlug) {
    const { data: existing } = await admin
      .from("link_clicks")
      .select("slug, destination_url")
      .eq("slug", input.existingSlug)
      .eq("marketing_entity_id", input.marketingEntityId)
      .maybeSingle()

    if (existing) {
      if (existing.destination_url !== withUtm) {
        await admin
          .from("link_clicks")
          .update({
            destination_url: withUtm,
            updated_at: new Date().toISOString(),
          })
          .eq("slug", existing.slug)
      }
      return {
        slug: existing.slug,
        shortUrl: trackableUrl(existing.slug, input.entityId),
        destinationUrl: withUtm,
      }
    }
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = createTrackableSlug(input.titleSeed)
    const { data, error } = await admin
      .from("link_clicks")
      .insert({
        entity_id: input.entityId,
        marketing_entity_id: input.marketingEntityId,
        slug,
        destination_url: withUtm,
        click_count: 0,
      })
      .select("slug, destination_url")
      .single()

    if (!error && data) {
      return {
        slug: data.slug,
        shortUrl: trackableUrl(data.slug, input.entityId),
        destinationUrl: data.destination_url,
      }
    }

    // Unique violation — retry with a new slug.
    if (error?.code !== "23505") {
      throw new Error(error?.message ?? "Failed to create trackable link.")
    }
  }

  throw new Error("Could not allocate a unique trackable slug.")
}

export async function syncClicksIntoMarketingMetrics(
  marketingEntityId: string,
  clickCount: number
): Promise<void> {
  const admin = createAdminClient()
  const { data: row } = await admin
    .from("marketing_entities")
    .select("metrics")
    .eq("id", marketingEntityId)
    .maybeSingle()

  const metrics =
    row?.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics)
      ? { ...(row.metrics as Record<string, unknown>) }
      : {}

  metrics.clicks = clickCount
  metrics.views = typeof metrics.views === "number" ? metrics.views : 0
  metrics.sales = typeof metrics.sales === "number" ? metrics.sales : 0

  await admin
    .from("marketing_entities")
    .update({
      metrics: metrics as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", marketingEntityId)
}

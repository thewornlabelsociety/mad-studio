import type { SupabaseClient } from "@supabase/supabase-js"

import type { Json } from "@/lib/database.types"
import {
  mapMarketingEntityRow,
  parseCopyDraft,
} from "@/lib/inventory/types"
import { evaluateWlsProductEligibility } from "@/lib/inventory/wls-product-eligibility"
import {
  assertWlsDailyStoryRenderable,
  buildWlsDailyStoryDraftMeta,
  buildWlsDailyStoryGenerationKey,
  readWlsDailyStoryDraftMeta,
  type WlsDailyStoryDraftMeta,
} from "@/lib/templates/wls-daily-story"

export type SaveWlsDailyStoryDraftInput = {
  supabase: SupabaseClient
  entityId: string
  brandName: string
  industry?: string | null
  websiteUrl?: string | null
  marketingEntityId: string
  templateInstanceId: string
  templateVersionId: string | null
  sourceImageUrl: string
  renderedUrl: string
}

export type SaveWlsDailyStoryDraftResult = {
  reusedExisting: boolean
  marketingEntityId: string
  draftMeta: WlsDailyStoryDraftMeta
  status: "draft"
}

/**
 * Persist a Daily Story draft on the marketing_entities row.
 * Idempotent per (marketingEntityId, templateInstanceId).
 * Sets status to draft — never publishes or schedules.
 * Does not mutate the source images array.
 */
export async function saveWlsDailyStoryDraft(
  input: SaveWlsDailyStoryDraftInput
): Promise<SaveWlsDailyStoryDraftResult> {
  const { data: canEdit, error: accessError } = await input.supabase.rpc(
    "has_entity_access",
    {
      ent_id: input.entityId,
      allowed_roles: ["entity_manager", "creator"],
    }
  )
  if (accessError) throw new Error(accessError.message)
  if (!canEdit) throw new Error("You need creator or manager access.")

  const { data: row, error } = await input.supabase
    .from("marketing_entities")
    .select(
      "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
    )
    .eq("id", input.marketingEntityId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) throw new Error("Product not found for this brand.")

  const item = mapMarketingEntityRow(row)
  const selection = evaluateWlsProductEligibility(item, {
    entityId: input.entityId,
    websiteUrl: input.websiteUrl,
    template: "daily_story",
  })

  const generationKey = buildWlsDailyStoryGenerationKey({
    marketingEntityId: input.marketingEntityId,
    templateInstanceId: input.templateInstanceId,
  })
  const existingMeta = readWlsDailyStoryDraftMeta(item.copy_draft?.metadata)
  const isSameDraft =
    existingMeta?.generation_key === generationKey && item.status === "draft"

  const gate = assertWlsDailyStoryRenderable({
    selection,
    entityId: input.entityId,
    brandName: input.brandName,
    industry: input.industry,
  })
  if (!gate.ok) throw new Error(gate.detail)

  if (!selection.destinationUrl) {
    throw new Error("Missing WLS product URL.")
  }

  const listingImages = item.images.filter((url) => /^https?:\/\//i.test(url))
  const sourceImageUrl =
    listingImages.find((url) => url === input.sourceImageUrl) ??
    listingImages[0]
  if (!sourceImageUrl) {
    throw new Error("Source product image is missing on the listing.")
  }

  if (!/^https?:\/\//i.test(input.renderedUrl)) {
    throw new Error("Rendered Story URL is required.")
  }

  if (
    isSameDraft &&
    existingMeta?.rendered_url === input.renderedUrl &&
    existingMeta
  ) {
    return {
      reusedExisting: true,
      marketingEntityId: item.id,
      draftMeta: existingMeta,
      status: "draft",
    }
  }

  const draftMeta = buildWlsDailyStoryDraftMeta({
    selection: { ...selection, destinationUrl: selection.destinationUrl },
    templateInstanceId: input.templateInstanceId,
    templateVersionId: input.templateVersionId,
    sourceImageUrl,
    renderedUrl: input.renderedUrl,
  })

  const previous = parseCopyDraft(row.copy_draft)
  const nextCopyDraft = {
    ...previous,
    platform: "story" as const,
    media_url: input.renderedUrl,
    placement: "story" as const,
    metadata: {
      ...(previous.metadata ?? {}),
      target_url: draftMeta.destination_url,
      wls_daily_story: draftMeta,
    },
  }

  const { error: updateError } = await input.supabase
    .from("marketing_entities")
    .update({
      status: "draft",
      copy_draft: nextCopyDraft as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("entity_id", input.entityId)

  if (updateError) throw new Error(updateError.message)

  return {
    reusedExisting: isSameDraft,
    marketingEntityId: item.id,
    draftMeta,
    status: "draft",
  }
}

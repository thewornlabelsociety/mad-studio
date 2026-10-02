import type { SupabaseClient } from "@supabase/supabase-js"

import { looksLikeFashionCatalogContamination } from "@/lib/inventory/entity-intake"
import { mapMarketingEntityRow } from "@/lib/inventory/types"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"
import { buildTodayQueueView, type TodayQueueView } from "@/lib/today/queue"

export type DailyQueueRow = {
  id: string
  entity_id: string
  marketing_entity_id: string
  status: string
  proposed_hook: string | null
  proposed_headline: string | null
}

export type TodayDeckCard = TodayQueueView & {
  queueId: string
}

const MARKETING_SELECT =
  "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"

export async function syncDailyQueueFromIntake(
  supabase: SupabaseClient,
  entityId: string
): Promise<void> {
  const { data: intakeRows } = await supabase
    .from("marketing_entities")
    .select("id")
    .eq("entity_id", entityId)
    .eq("status", "unfeatured")

  const ids = (intakeRows ?? []).map((row) => row.id)
  if (ids.length === 0) return

  const inserts = ids.map((marketingEntityId) => ({
    entity_id: entityId,
    marketing_entity_id: marketingEntityId,
    status: "pending_review" as const,
  }))

  await supabase
    .from("daily_queue")
    .upsert(inserts, {
      onConflict: "entity_id,marketing_entity_id",
      ignoreDuplicates: true,
    })
}

export async function fetchPendingTodayDeck(input: {
  supabase: SupabaseClient
  entityId: string
  brandName: string
  industry?: string | null
}): Promise<TodayDeckCard[]> {
  const { supabase, entityId, brandName, industry } = input
  const isFudi = isFudiStudioEntity({ name: brandName, industry })

  await syncDailyQueueFromIntake(supabase, entityId)

  const { data: queueRows, error } = await supabase
    .from("daily_queue")
    .select(
      `id, entity_id, marketing_entity_id, status, proposed_hook, proposed_headline, marketing_entities (${MARKETING_SELECT})`
    )
    .eq("entity_id", entityId)
    .eq("status", "pending_review")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) {
    console.warn("[today] daily_queue unavailable, falling back to intake:", error.message)
    return fetchIntakeFallbackDeck({ supabase, entityId, brandName, industry })
  }

  const cards: TodayDeckCard[] = []

  for (const row of queueRows ?? []) {
    const nestedRaw = row.marketing_entities as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null
    const nested = Array.isArray(nestedRaw) ? nestedRaw[0] : nestedRaw
    if (!nested || typeof nested !== "object") continue
    const item = mapMarketingEntityRow(
      nested as Parameters<typeof mapMarketingEntityRow>[0]
    )
    if (isFudi && looksLikeFashionCatalogContamination(item)) continue
    if (item.status !== "unfeatured") continue

    const view = buildTodayQueueView({ item, brandName, industry })
    if (row.proposed_headline?.trim()) {
      view.recommendedHook = row.proposed_headline.trim()
      view.item = {
        ...view.item,
        copy_draft: {
          ...view.item.copy_draft,
          headline: row.proposed_headline.trim(),
          caption: row.proposed_hook?.trim() || view.item.copy_draft?.caption,
        },
      }
    } else if (row.proposed_hook?.trim()) {
      view.recommendedHook = row.proposed_hook.trim()
    }

    cards.push({
      ...view,
      queueId: row.id,
    })
  }

  if (cards.length === 0) {
    return fetchIntakeFallbackDeck({ supabase, entityId, brandName, industry })
  }

  return cards
}

async function fetchIntakeFallbackDeck(input: {
  supabase: SupabaseClient
  entityId: string
  brandName: string
  industry?: string | null
}): Promise<TodayDeckCard[]> {
  const isFudi = isFudiStudioEntity({
    name: input.brandName,
    industry: input.industry,
  })
  const { data: rows } = await input.supabase
    .from("marketing_entities")
    .select(MARKETING_SELECT)
    .eq("entity_id", input.entityId)
    .eq("status", "unfeatured")
    .order("created_at", { ascending: false })
    .limit(12)

  return (rows ?? [])
    .map(mapMarketingEntityRow)
    .filter((item) => (isFudi ? !looksLikeFashionCatalogContamination(item) : true))
    .map((item) => ({
      ...buildTodayQueueView({
        item,
        brandName: input.brandName,
        industry: input.industry,
      }),
      queueId: item.id,
    }))
}

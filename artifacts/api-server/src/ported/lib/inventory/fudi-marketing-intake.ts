import type { Json } from "@/lib/database.types"
import {
  fudiFeedCopyDraft,
  fudiFeedPrice,
  fudiFeedWebsiteItemId,
  fudiSupabaseCopyDraft,
  fudiSupabaseWebsiteItemId,
  type FudiFeedItem,
  type FudiFeedItemType,
} from "@/lib/inventory/fudi-feed"
import { parsePrice } from "@/lib/inventory/types"
import { FUDI_ENTITY_ID } from "@/lib/studio/fudi-platform"
import type { createAdminClient } from "@/lib/supabase/admin"

export type MappedFudiSupabaseRow = {
  originalId: string
  sourceTable: string
  itemType: FudiFeedItemType
  metadataItemType?: string
  title: string
  brand: string
  price: number | null
  description: string | null
  images: string[]
  location?: string | null
  targetUrl?: string | null
  expiresAt?: string | null
  eventDate?: string | null
  /** Used to pick the newest rows when capping a pull batch. */
  sourceCreatedAtMs: number
}

function normalizeImages(images: string[]): string[] {
  return images
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 20)
}

async function findByOriginalId(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  originalId: string
) {
  const { data, error } = await admin
    .from("marketing_entities")
    .select("id, status, website_item_id")
    .eq("entity_id", entityId)
    .filter("copy_draft->metadata->>original_id", "eq", originalId)
    .maybeSingle()
  if (error && !error.message.includes("copy_draft")) {
    throw new Error(error.message)
  }
  return data
}

export async function upsertFudiFeedWebhookItem(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  item: FudiFeedItem,
  now: string
) {
  if (entityId !== FUDI_ENTITY_ID) {
    throw new Error("FÜDI webhook intake is scoped to the FÜDI entity only.")
  }

  const websiteItemId = fudiFeedWebsiteItemId(item)
  const base = {
    entity_id: entityId,
    website_item_id: websiteItemId,
    title: item.title.trim(),
    brand: item.brand.trim(),
    price: fudiFeedPrice(item),
    description: item.description?.trim() ?? null,
    images: normalizeImages(item.images ?? []),
    copy_draft: fudiFeedCopyDraft(item) as Json,
    updated_at: now,
  }

  const { data: existing } = await admin
    .from("marketing_entities")
    .select("id, status")
    .eq("entity_id", entityId)
    .eq("website_item_id", websiteItemId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await admin
      .from("marketing_entities")
      .update(base)
      .eq("id", existing.id)
      .select("id, entity_id, website_item_id, title, brand, price, status")
      .single()
    if (error) throw new Error(error.message)
    return { row: data, imported: false as const }
  }

  const { data, error } = await admin
    .from("marketing_entities")
    .insert({
      ...base,
      status: "unfeatured",
      metrics: { views: 0, clicks: 0, sales: 0 } as Json,
      channels: [],
    })
    .select("id, entity_id, website_item_id, title, brand, price, status")
    .single()
  if (error) throw new Error(error.message)
  return { row: data, imported: true as const }
}

export async function upsertFudiSupabaseMappedRow(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  row: MappedFudiSupabaseRow,
  now: string
) {
  if (entityId !== FUDI_ENTITY_ID) {
    throw new Error("FÜDI Supabase sync is scoped to the FÜDI entity only.")
  }

  const websiteItemId = fudiSupabaseWebsiteItemId({
    itemType: row.itemType,
    sourceTable: row.sourceTable,
    originalId: row.originalId,
  })

  const copy_draft = fudiSupabaseCopyDraft({
    itemType: row.itemType,
    metadataItemType: row.metadataItemType,
    originalId: row.originalId,
    sourceTable: row.sourceTable,
    location: row.location,
    targetUrl: row.targetUrl,
    expiresAt: row.expiresAt,
    eventDate: row.eventDate,
  }) as Json

  const base = {
    entity_id: entityId,
    website_item_id: websiteItemId,
    title: row.title.trim().slice(0, 500),
    brand: row.brand.trim().slice(0, 200),
    price: row.price,
    description: row.description?.trim().slice(0, 8000) ?? null,
    images: normalizeImages(row.images),
    copy_draft,
    updated_at: now,
  }

  const byOriginal = await findByOriginalId(admin, entityId, row.originalId)
  const existingId = byOriginal?.id

  if (existingId) {
    const { data, error } = await admin
      .from("marketing_entities")
      .update(base)
      .eq("id", existingId)
      .select("id, entity_id, website_item_id, title, brand, price, status")
      .single()
    if (error) throw new Error(error.message)
    return { row: data, imported: false as const }
  }

  const { data: existingByWebsite } = await admin
    .from("marketing_entities")
    .select("id")
    .eq("entity_id", entityId)
    .eq("website_item_id", websiteItemId)
    .maybeSingle()

  if (existingByWebsite) {
    const { data, error } = await admin
      .from("marketing_entities")
      .update(base)
      .eq("id", existingByWebsite.id)
      .select("id, entity_id, website_item_id, title, brand, price, status")
      .single()
    if (error) throw new Error(error.message)
    return { row: data, imported: false as const }
  }

  const { data, error } = await admin
    .from("marketing_entities")
    .insert({
      ...base,
      status: "unfeatured",
      metrics: { views: 0, clicks: 0, sales: 0 } as Json,
      channels: [],
    })
    .select("id, entity_id, website_item_id, title, brand, price, status")
    .single()
  if (error) throw new Error(error.message)
  return { row: data, imported: true as const }
}

export function parseMappedRowPrice(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") return parsePrice(value)
  return null
}

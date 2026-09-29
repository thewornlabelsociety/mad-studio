import type { SupabaseClient } from "@supabase/supabase-js"

import {
  type MappedFudiSupabaseRow,
  parseMappedRowPrice,
  upsertFudiSupabaseMappedRow,
} from "@/lib/inventory/fudi-marketing-intake"
import type { FudiFeedItemType } from "@/lib/inventory/fudi-feed"
import { FUDI_ENTITY_ID } from "@/lib/studio/fudi-platform"
import {
  getFudiSupabaseClient,
  getFudiSupabaseProjectUrl,
} from "@/lib/supabase/fudi-client"
import type { createAdminClient } from "@/lib/supabase/admin"

const FUDI_TABLE_ITEM_TYPE: Record<string, FudiFeedItemType> = {
  feed_posts: "drop",
  posts: "drop",
  specials: "deal",
  deals: "deal",
  drops: "drop",
  events: "event",
  dishes: "marketplace",
}

const FUDI_FEED_TABLES = [
  "feed_posts",
  "posts",
  "specials",
  "drops",
  "deals",
  "events",
  "dishes",
] as const

export type FudiSupabaseSyncResult = {
  imported: number
  updated: number
  skipped: number
  scanned: number
  sources: string[]
  items: Array<{ id: string; website_item_id: string; title: string }>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function nestedVenueBrand(record: Record<string, unknown>): string | null {
  for (const key of ["venues", "venue", "eatery", "restaurant", "profile", "profiles"]) {
    const nested = asRecord(record[key])
    if (!nested) continue
    const name = stringField(
      nested,
      "name",
      "display_name",
      "venue_name",
      "business_name",
      "title"
    )
    if (name) return name
  }
  return (
    stringField(
      record,
      "venue_name",
      "eatery_name",
      "restaurant_name",
      "brand",
      "business_name"
    ) ?? null
  )
}

function resolveFudiMediaUrl(raw: string, projectUrl: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = projectUrl.replace(/\/$/, "")
  if (trimmed.startsWith("storage/v1/")) return `${base}/${trimmed.replace(/^\//, "")}`
  return `${base}/storage/v1/object/public/${trimmed.replace(/^\//, "")}`
}

function collectMedia(record: Record<string, unknown>, projectUrl: string): string[] {
  const urls: string[] = []
  const push = (value: unknown) => {
    if (typeof value !== "string") return
    const resolved = resolveFudiMediaUrl(value, projectUrl)
    if (resolved) urls.push(resolved)
  }

  push(record.photo_url)
  push(record.photoUrl)
  push(record.image_url)
  push(record.imageUrl)
  push(record.cover_url)
  push(record.coverUrl)
  push(record.cover_image_url)
  push(record.media_url)
  push(record.mediaUrl)
  push(record.thumbnail_url)
  push(record.thumbnailUrl)
  push(record.video_url)
  push(record.videoUrl)
  push(record.poster_url)

  for (const key of ["images", "photos", "media", "gallery"]) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    for (const entry of value) {
      if (typeof entry === "string") {
        push(entry)
        continue
      }
      const nested = asRecord(entry)
      if (!nested) continue
      push(nested.url)
      push(nested.src)
      push(nested.publicUrl)
    }
  }

  return Array.from(new Set(urls)).slice(0, 20)
}

function isInactiveRow(record: Record<string, unknown>): boolean {
  const status = stringField(record, "status", "state")?.toLowerCase()
  if (
    status &&
    ["draft", "archived", "deleted", "inactive", "hidden", "cancelled"].includes(
      status
    )
  ) {
    return true
  }

  const activeFlags = ["is_active", "active", "published", "is_published", "live"]
  for (const key of activeFlags) {
    if (key in record && record[key] === false) return true
  }

  const expires = stringField(record, "expires_at", "expired_at", "ends_at")
  if (expires) {
    const ts = Date.parse(expires)
    if (Number.isFinite(ts) && ts < Date.now()) return true
  }

  return false
}

function mapRowToIntake(
  table: string,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const itemType = FUDI_TABLE_ITEM_TYPE[table] ?? "drop"
  const originalId =
    stringField(row, "id", "uuid", "post_id", "special_id", "drop_id") ?? null
  if (!originalId) return null
  if (isInactiveRow(row)) return null

  const caption = stringField(row, "caption", "body", "text")
  const title =
    stringField(
      row,
      "title",
      "name",
      "headline",
      "dish_name",
      "dish",
      "special_name",
      "event_name"
    ) ??
    (caption ? caption.split("\n")[0]?.slice(0, 120) ?? null : null)
  if (!title) return null

  const images = collectMedia(row, projectUrl)
  if (images.length === 0) return null

  const brand = nestedVenueBrand(row) ?? "FÜDI"
  const price = parseMappedRowPrice(
    row.price ?? row.offer_price ?? row.sale_price ?? row.amount
  )

  const descriptionParts = [
    stringField(row, "description", "details", "notes", "ingredients"),
    caption,
    stringField(row, "dietary_tags", "tags"),
  ].filter(Boolean)

  return {
    originalId,
    sourceTable: table,
    itemType,
    title,
    brand,
    price,
    description:
      descriptionParts.length > 0
        ? descriptionParts.join(" · ").slice(0, 8000)
        : null,
    images,
    location: stringField(row, "location", "suburb", "city", "address"),
    targetUrl: stringField(row, "target_url", "permalink", "url", "link"),
    expiresAt: stringField(row, "expires_at", "ends_at"),
    eventDate: stringField(row, "event_date", "starts_at", "start_time"),
  }
}

function isMissingTableError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache")
  )
}

async function fetchTableRows(
  client: SupabaseClient,
  table: string
): Promise<Record<string, unknown>[]> {
  const selects = [
    "*, venues(name, display_name, instagram_handle, handle, slug)",
    "*, venue:venues(name, display_name, instagram_handle, handle, slug)",
    "*, profiles(name, handle, instagram_handle, display_name)",
    "*",
  ]

  for (const select of selects) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .order("created_at", { ascending: false })
      .limit(100)

    if (!error) {
      return (data ?? []) as unknown as Record<string, unknown>[]
    }
    if (isMissingTableError(error.message)) return []
    const joinIssue =
      error.message.toLowerCase().includes("relationship") ||
      error.message.toLowerCase().includes("could not embed")
    if (joinIssue) continue
    throw new Error(`${table}: ${error.message}`)
  }

  return []
}

export async function pullFudiSupabaseFeedRows(): Promise<{
  mapped: MappedFudiSupabaseRow[]
  sources: string[]
  scanned: number
}> {
  const client = getFudiSupabaseClient()
  const projectUrl = getFudiSupabaseProjectUrl()
  const mapped: MappedFudiSupabaseRow[] = []
  const sources: string[] = []
  let scanned = 0
  const seen = new Set<string>()

  for (const table of FUDI_FEED_TABLES) {
    const rows = await fetchTableRows(client, table)
    if (rows.length === 0) continue
    sources.push(table)
    scanned += rows.length

    for (const row of rows) {
      const intake = mapRowToIntake(table, row, projectUrl)
      if (!intake) continue
      const dedupeKey = `${intake.sourceTable}:${intake.originalId}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      mapped.push(intake)
    }
  }

  return { mapped, sources, scanned }
}

export async function syncFudiSupabaseToMarketingEntities(input: {
  madAdmin: ReturnType<typeof createAdminClient>
  entityId?: string
}): Promise<FudiSupabaseSyncResult> {
  const entityId = input.entityId ?? FUDI_ENTITY_ID
  if (entityId !== FUDI_ENTITY_ID) {
    throw new Error("FÜDI Supabase sync must target the FÜDI entity only.")
  }

  const { mapped, sources, scanned } = await pullFudiSupabaseFeedRows()
  if (mapped.length === 0) {
    if (sources.length === 0) {
      throw new Error(
        "No FÜDI feed tables returned data. Expected one of: feed_posts, posts, specials, drops, deals, events, dishes — check FUDI_SUPABASE_* credentials and RLS."
      )
    }
    throw new Error(
      "FÜDI Supabase tables were found but no active items with titles and images matched the intake mapper."
    )
  }

  const now = new Date().toISOString()
  let imported = 0
  let updated = 0
  let skipped = 0
  const items: FudiSupabaseSyncResult["items"] = []

  for (const row of mapped) {
    const result = await upsertFudiSupabaseMappedRow(
      input.madAdmin,
      entityId,
      row,
      now
    )
    if (result.imported) {
      imported += 1
    } else {
      updated += 1
    }
    if (result.row) {
      items.push({
        id: result.row.id,
        website_item_id: result.row.website_item_id,
        title: result.row.title,
      })
    } else {
      skipped += 1
    }
  }

  return { imported, updated, skipped, scanned, sources, items }
}

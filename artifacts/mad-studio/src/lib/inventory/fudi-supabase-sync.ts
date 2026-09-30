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

/** Real FÜDI Supabase tables, queried in priority order. */
const FUDI_FEED_TABLES = [
  "fudi_deals",
  "fudi_events",
  "fudi_posts",
  "marketplace_items",
  "trails",
] as const

type FudiFeedTable = (typeof FUDI_FEED_TABLES)[number]

/** Plain selects only — embeds fail on many FÜDI schemas and must not abort the probe. */
const TABLE_SELECTS: Record<FudiFeedTable, string[]> = {
  fudi_deals: ["*"],
  fudi_events: ["*"],
  fudi_posts: ["*"],
  marketplace_items: ["*"],
  trails: ["*"],
}

const DEFAULT_FUDI_PULL_LIMIT = 20

export function resolveFudiSupabasePullLimit(): number {
  const raw = process.env.FUDI_SUPABASE_PULL_LIMIT?.trim()
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100) {
      return parsed
    }
  }
  return DEFAULT_FUDI_PULL_LIMIT
}

type FudiTableProbeStatus =
  | "ok"
  | "empty"
  | "missing"
  | "permission_denied"
  | "query_error"

export type FudiTableProbe = {
  table: FudiFeedTable
  status: FudiTableProbeStatus
  rowCount: number
  detail?: string
}

export type FudiSupabaseSyncResult = {
  imported: number
  updated: number
  skipped: number
  scanned: number
  sources: string[]
  probes: FudiTableProbe[]
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

function nestedName(
  record: Record<string, unknown>,
  relationKeys: string[],
  nameKeys: string[] = ["name", "title", "display_name", "venue_name"]
): string | null {
  for (const rel of relationKeys) {
    const raw = record[rel]
    const nested = asRecord(raw)
    if (nested) {
      const name = stringField(nested, ...nameKeys)
      if (name) return name
    }
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        const row = asRecord(entry)
        if (!row) continue
        const name = stringField(row, ...nameKeys)
        if (name) return name
      }
    }
  }
  return null
}

function rowCreatedAtMs(record: Record<string, unknown>): number {
  const raw = stringField(
    record,
    "created_at",
    "published_at",
    "posted_at",
    "updated_at",
    "start_time",
    "date"
  )
  if (!raw) return 0
  const ts = Date.parse(raw)
  return Number.isFinite(ts) ? ts : 0
}

function resolveFudiMediaUrl(raw: string, projectUrl: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const base = projectUrl.replace(/\/$/, "")
  if (trimmed.startsWith("storage/v1/")) return `${base}/${trimmed.replace(/^\//, "")}`
  return `${base}/storage/v1/object/public/${trimmed.replace(/^\//, "")}`
}

function pushMediaUrl(urls: string[], value: unknown, projectUrl: string) {
  if (typeof value !== "string") return
  const resolved = resolveFudiMediaUrl(value, projectUrl)
  if (resolved) urls.push(resolved)
}

function collectMedia(record: Record<string, unknown>, projectUrl: string): string[] {
  const urls: string[] = []

  for (const key of [
    "photo_url",
    "photoUrl",
    "image_url",
    "imageUrl",
    "video_url",
    "videoUrl",
    "cover_url",
    "coverUrl",
    "cover_image_url",
    "media_url",
    "mediaUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "poster_url",
    "poster",
    "featured_image_url",
    "hero_image_url",
    "cover_image",
    "image_path",
    "media_path",
  ]) {
    pushMediaUrl(urls, record[key], projectUrl)
  }

  for (const key of [
    "images",
    "image_urls",
    "photos",
    "media",
    "gallery",
    "eatery_menu_images",
  ]) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    for (const entry of value) {
      if (typeof entry === "string") {
        pushMediaUrl(urls, entry, projectUrl)
        continue
      }
      const nested = asRecord(entry)
      if (!nested) continue
      pushMediaUrl(urls, nested.image_url, projectUrl)
      pushMediaUrl(urls, nested.url, projectUrl)
      pushMediaUrl(urls, nested.path, projectUrl)
      pushMediaUrl(urls, nested.storage_path, projectUrl)
      pushMediaUrl(urls, nested.src, projectUrl)
      pushMediaUrl(urls, nested.publicUrl, projectUrl)
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

function baseMappedRow(input: {
  table: FudiFeedTable
  row: Record<string, unknown>
  projectUrl: string
  itemType: FudiFeedItemType
  metadataItemType: string
  originalId: string
  title: string
  brand: string
  price: number | null
  description: string | null
  eventDate?: string | null
}): MappedFudiSupabaseRow | null {
  if (isInactiveRow(input.row)) return null
  const images = collectMedia(input.row, input.projectUrl)
  if (images.length === 0) return null

  return {
    originalId: input.originalId,
    sourceTable: input.table,
    itemType: input.itemType,
    metadataItemType: input.metadataItemType,
    title: input.title,
    brand: input.brand,
    price: input.price,
    description: input.description,
    images,
    location: stringField(
      input.row,
      "location",
      "suburb",
      "city",
      "address",
      "venue_name"
    ),
    targetUrl: stringField(input.row, "target_url", "permalink", "url", "link"),
    expiresAt: stringField(input.row, "expires_at", "ends_at"),
    eventDate:
      input.eventDate ??
      stringField(input.row, "event_date", "starts_at", "start_time", "date"),
    sourceCreatedAtMs: rowCreatedAtMs(input.row),
  }
}

function firstLine(value: string | null, maxLen = 100): string | null {
  if (!value?.trim()) return null
  const line = value.trim().split(/\n+/)[0]?.trim() ?? ""
  if (!line) return null
  return line.length > maxLen ? `${line.slice(0, maxLen - 1)}…` : line
}

function mapFudiPost(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid", "post_id") ?? null
  if (!originalId) return null

  const caption = stringField(row, "caption", "body", "text", "content")
  const locationName = stringField(
    row,
    "location_name",
    "fudi_tag",
    "eatery_address"
  )
  const title =
    stringField(row, "title", "headline") ??
    (locationName ? `${locationName} · FÜDI post` : null) ??
    firstLine(caption, 100)
  if (!title) return null

  const brand =
    stringField(
      row,
      "location_name",
      "username",
      "fudi_tag",
      "eatery_address"
    ) ??
    nestedName(row, ["profiles", "author", "profile", "eatery", "eateries"]) ??
    "FÜDI Community"

  const description = caption ?? stringField(row, "content", "body", "description")

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "drop",
    metadataItemType: "post",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(row.price ?? row.offer_price),
    description: description?.slice(0, 8000) ?? null,
  })
}

function mapMarketplaceItem(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid", "listing_id") ?? null
  if (!originalId) return null

  const title = stringField(row, "name", "title", "listing_title") ?? null
  if (!title) return null

  const brand =
    stringField(row, "seller_name", "supplier_name", "location") ??
    nestedName(row, ["eateries", "eatery", "seller", "profiles", "venue"]) ??
    stringField(row, "eatery_name", "venue_name", "brand") ??
    "FÜDI Marketplace"

  const description =
    stringField(row, "description", "summary", "condition_notes") ?? null

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "marketplace",
    metadataItemType: "listing",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(
      row.price ?? row.list_price ?? row.base_price ?? row.amount
    ),
    description: description?.slice(0, 8000) ?? null,
  })
}

function mapFudiDeal(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid", "deal_id") ?? null
  if (!originalId) return null

  const title =
    stringField(row, "title", "deal_title", "headline", "name") ?? null
  if (!title) return null

  const brand =
    nestedName(row, ["eateries", "eatery", "venue", "profiles"]) ??
    stringField(row, "venue_name", "eatery_name", "brand") ??
    "FÜDI Partner"

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "deal",
    metadataItemType: "deal",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(
      row.price ?? row.offer_price ?? row.deal_price ?? row.amount
    ),
    description:
      stringField(row, "description", "details", "offer_details", "terms")?.slice(
        0,
        8000
      ) ?? null,
  })
}

function mapTrail(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid", "trail_id") ?? null
  if (!originalId) return null

  const title =
    stringField(row, "name", "title", "trail_name", "headline") ?? null
  if (!title) return null

  const brand =
    nestedName(row, ["profiles", "author", "creator"]) ??
    stringField(row, "author_name", "creator_name") ??
    "FÜDI Trail"

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "drop",
    metadataItemType: "trail",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(row.price),
    description:
      stringField(row, "description", "summary", "blurb")?.slice(0, 8000) ??
      null,
  })
}

function mapFoodEvent(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid", "event_id") ?? null
  if (!originalId) return null

  const title =
    stringField(row, "name", "event_title", "title") ?? null
  if (!title) return null

  const brand =
    stringField(row, "eatery_name", "host_name", "organizer_name", "venue_name") ??
    nestedName(row, ["venue", "eatery", "organizer"]) ??
    "Local Food Event"

  const eventDate = stringField(
    row,
    "start_date",
    "date",
    "start_time",
    "starts_at",
    "event_date"
  )

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "event",
    metadataItemType: "event",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(
      row.ticket_price ?? row.entry_fee ?? row.price
    ),
    description:
      stringField(row, "description", "summary")?.slice(0, 8000) ?? null,
    eventDate,
  })
}

function mapRowToIntake(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  switch (table) {
    case "fudi_deals":
      return mapFudiDeal(table, row, projectUrl)
    case "fudi_events":
      return mapFoodEvent(table, row, projectUrl)
    case "fudi_posts":
      return mapFudiPost(table, row, projectUrl)
    case "marketplace_items":
      return mapMarketplaceItem(table, row, projectUrl)
    case "trails":
      return mapTrail(table, row, projectUrl)
    default:
      return null
  }
}

function isRelationshipEmbedError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("could not find a relationship") ||
    lower.includes("could not embed") ||
    (lower.includes("relationship") && lower.includes("schema cache"))
  )
}

function isMissingTableError(message: string): boolean {
  if (isRelationshipEmbedError(message)) return false
  const lower = message.toLowerCase()
  return (
    lower.includes("could not find the table") ||
    (lower.includes("relation") && lower.includes("does not exist")) ||
    /pgrst205/i.test(message)
  )
}

/** Table exists but this key/RLS cannot read it — skip probe, continue other tables. */
function isPermissionOrAccessError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("violates row-level security") ||
    lower.includes("insufficient privilege") ||
    lower.includes("42501") ||
    (lower.includes("rls") && lower.includes("policy"))
  )
}

function isOrderColumnError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("42703") ||
    (lower.includes("column") && lower.includes("does not exist"))
  )
}

const ORDER_COLUMNS = [
  "created_at",
  "updated_at",
  "published_at",
  "posted_at",
] as const

async function runTableSelect(
  client: SupabaseClient,
  table: FudiFeedTable,
  select: string,
  rowLimit: number,
  orderColumn: string | null
) {
  let query = client.from(table).select(select).limit(rowLimit)
  if (orderColumn) {
    query = query.order(orderColumn, { ascending: false })
  }
  return query
}

function classifyProbeFailure(
  table: FudiFeedTable,
  message: string
): FudiTableProbe {
  if (isMissingTableError(message)) {
    return { table, status: "missing", rowCount: 0, detail: message }
  }
  if (isPermissionOrAccessError(message)) {
    return { table, status: "permission_denied", rowCount: 0, detail: message }
  }
  return { table, status: "query_error", rowCount: 0, detail: message }
}

async function fetchTableRows(
  client: SupabaseClient,
  table: FudiFeedTable,
  rowLimit: number
): Promise<{ rows: Record<string, unknown>[]; probe: FudiTableProbe }> {
  const selects = TABLE_SELECTS[table]
  let lastError: string | null = null

  for (const select of selects) {
    const orderAttempts: Array<string | null> = [...ORDER_COLUMNS, null]
    let joinFailed = false

    for (const orderColumn of orderAttempts) {
      const { data, error } = await runTableSelect(
        client,
        table,
        select,
        rowLimit,
        orderColumn
      )

      if (!error) {
        const rows = (data ?? []) as unknown as Record<string, unknown>[]
        return {
          rows,
          probe: {
            table,
            status: rows.length > 0 ? "ok" : "empty",
            rowCount: rows.length,
          },
        }
      }

      lastError = error.message
      if (isPermissionOrAccessError(error.message)) {
        return { rows: [], probe: classifyProbeFailure(table, error.message) }
      }

      const joinIssue = isRelationshipEmbedError(error.message)
      if (joinIssue) {
        joinFailed = true
        break
      }

      if (isMissingTableError(error.message)) {
        return { rows: [], probe: classifyProbeFailure(table, error.message) }
      }
      if (orderColumn && isOrderColumnError(error.message)) {
        continue
      }

      if (orderColumn === null) {
        break
      }
    }

    if (joinFailed) continue
  }

  if (lastError) {
    return { rows: [], probe: classifyProbeFailure(table, lastError) }
  }

  return { rows: [], probe: { table, status: "empty", rowCount: 0 } }
}

function formatEmptyPullError(probes: FudiTableProbe[]): string {
  const denied = probes.filter((p) => p.status === "permission_denied")
  const missing = probes.filter((p) => p.status === "missing")
  const empty = probes.filter((p) => p.status === "empty")
  const errors = probes.filter((p) => p.status === "query_error")

  if (denied.length > 0 && denied.length + missing.length === probes.length) {
    const tables = denied.map((p) => p.table).join(", ")
    return (
      `FÜDI intake key cannot SELECT any feed tables (RLS/permissions). Blocked: ${tables}. ` +
      "On the FÜDI Supabase project, add SELECT policies for the anon role (or set FUDI_SUPABASE_USE_SERVICE_ROLE_FOR_READ=1 with FUDI_SUPABASE_SERVICE_ROLE_KEY — code still read-only)."
    )
  }

  if (missing.length === probes.length) {
    const projectHint = (() => {
      try {
        const host = new URL(getFudiSupabaseProjectUrl()).hostname
        const mad =
          process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
          process.env.VITE_SUPABASE_URL?.trim()
        const madHost = mad ? new URL(mad).hostname : null
        const sameAsMad =
          madHost && madHost.toLowerCase() === host.toLowerCase()
            ? " (this matches MAD Studio — use the FÜDI app project URL instead)."
            : ""
        return `Connected project: ${host}${sameAsMad} `
      } catch {
        return ""
      }
    })()
    return (
      "No FÜDI feed tables exist in this Supabase project. " +
      projectHint +
      "Expected tables: fudi_deals, fudi_events, fudi_posts, marketplace_items, trails. " +
      "Set FUDI_SUPABASE_URL and FUDI_SUPABASE_ANON_KEY from the FÜDI app Supabase dashboard (API settings), not MAD Studio."
    )
  }

  const parts: string[] = []
  if (denied.length) {
    parts.push(`RLS blocked: ${denied.map((p) => p.table).join(", ")}`)
  }
  if (empty.length) {
    parts.push(`no rows: ${empty.map((p) => p.table).join(", ")}`)
  }
  if (missing.length) {
    parts.push(`missing: ${missing.map((p) => p.table).join(", ")}`)
  }
  if (errors.length) {
    parts.push(
      `query errors: ${errors.map((p) => `${p.table} (${p.detail ?? "failed"})`).join("; ")}`
    )
  }

  const projectHint = (() => {
    try {
      const host = new URL(getFudiSupabaseProjectUrl()).hostname
      return `Connected project: ${host}. `
    } catch {
      return ""
    }
  })()

  return (
    `No FÜDI feed data could be read. ${parts.join(" · ")}. ` +
    projectHint +
    "Confirm FUDI_SUPABASE_URL and FUDI_SUPABASE_ANON_KEY are from the same FÜDI app project (not MAD Studio). " +
    "For RLS-blocked tables, add anon SELECT policies on the FÜDI project or set FUDI_SUPABASE_USE_SERVICE_ROLE_FOR_READ=1 on the API server only."
  )
}

export async function pullFudiSupabaseFeedRows(): Promise<{
  mapped: MappedFudiSupabaseRow[]
  sources: string[]
  scanned: number
  probes: FudiTableProbe[]
}> {
  const client = getFudiSupabaseClient()
  const projectUrl = getFudiSupabaseProjectUrl()
  const pullLimit = resolveFudiSupabasePullLimit()
  const perTableFetch = Math.min(100, Math.max(pullLimit, 20))
  const mapped: MappedFudiSupabaseRow[] = []
  const sources: string[] = []
  const probes: FudiTableProbe[] = []
  let scanned = 0
  const seen = new Set<string>()

  for (const table of FUDI_FEED_TABLES) {
    const { rows, probe } = await fetchTableRows(client, table, perTableFetch)
    probes.push(probe)
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

  mapped.sort((a, b) => b.sourceCreatedAtMs - a.sourceCreatedAtMs)

  return {
    mapped: mapped.slice(0, pullLimit),
    sources,
    scanned,
    probes,
  }
}

export async function syncFudiSupabaseToMarketingEntities(input: {
  madAdmin: ReturnType<typeof createAdminClient>
  entityId?: string
}): Promise<FudiSupabaseSyncResult> {
  const entityId = input.entityId ?? FUDI_ENTITY_ID
  if (entityId !== FUDI_ENTITY_ID) {
    throw new Error("FÜDI Supabase sync must target the FÜDI entity only.")
  }

  const { mapped, sources, scanned, probes } = await pullFudiSupabaseFeedRows()
  if (mapped.length === 0) {
    if (sources.length === 0) {
      throw new Error(formatEmptyPullError(probes))
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

  return { imported, updated, skipped, scanned, sources, probes, items }
}

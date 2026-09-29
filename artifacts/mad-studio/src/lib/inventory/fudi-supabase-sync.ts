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
  "fudi_board_items",
  "eatery_menu_items",
  "eats_community_events",
  "foodie_events",
  "craving_offer_responses",
] as const

type FudiFeedTable = (typeof FUDI_FEED_TABLES)[number]

const TABLE_SELECTS: Record<FudiFeedTable, string[]> = {
  fudi_board_items: [
    "*, fudi_boards(name, title, display_name)",
    "*, board:fudi_boards(name, title, display_name)",
    "*",
  ],
  eatery_menu_items: [
    "*, eatery_menus(name), eatery_menu_images(image_url, url, path, storage_path)",
    "*, eatery_menu_images(image_url, url, path, storage_path)",
    "*",
  ],
  eats_community_events: ["*"],
  foodie_events: ["*"],
  craving_offer_responses: [
    "*, eateries(name, display_name, venue_name)",
    "*, eatery:eateries(name, display_name)",
    "*",
  ],
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
    "cover_url",
    "coverUrl",
    "cover_image_url",
    "media_url",
    "mediaUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "poster_url",
    "poster",
  ]) {
    pushMediaUrl(urls, record[key], projectUrl)
  }

  for (const key of ["images", "photos", "media", "gallery", "eatery_menu_images"]) {
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

function mapFudiBoardItem(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid") ?? null
  if (!originalId) return null

  const caption = stringField(row, "caption", "body", "text")
  const title =
    stringField(row, "title", "caption", "headline") ??
    (caption ? caption.split("\n")[0]?.slice(0, 120) ?? null : null)
  if (!title) return null

  const brand =
    nestedName(row, ["fudi_boards", "board", "eatery", "author", "profile"]) ??
    stringField(row, "author_name", "eatery_name", "venue_name") ??
    "FÜDI Community"

  const description =
    stringField(row, "content", "body", "description", "caption") ??
    caption

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "drop",
    metadataItemType: "drop",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(row.price ?? row.offer_price),
    description: description?.slice(0, 8000) ?? null,
  })
}

function mapEateryMenuItem(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid", "menu_item_id") ?? null
  if (!originalId) return null

  const title = stringField(row, "name", "title") ?? null
  if (!title) return null

  const brand =
    nestedName(row, ["eatery_menus", "menu", "eatery", "eateries"]) ??
    stringField(row, "eatery_name", "venue_name") ??
    "FÜDI Partner Eatery"

  const description =
    stringField(row, "description", "tasting_notes", "dietary_summary") ??
    null

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "marketplace",
    metadataItemType: "dish",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(row.price ?? row.base_price),
    description: description?.slice(0, 8000) ?? null,
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
    stringField(row, "organizer_name", "venue_name", "host_name") ??
    nestedName(row, ["venue", "eatery", "organizer"]) ??
    "Local Food Event"

  const eventDate = stringField(row, "start_time", "date", "starts_at", "event_date")

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

function mapCravingOffer(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  const originalId = stringField(row, "id", "uuid", "offer_id") ?? null
  if (!originalId) return null

  const title =
    stringField(row, "title", "offer_title", "headline", "name") ?? null
  if (!title) return null

  const brand =
    nestedName(row, ["eateries", "eatery", "venue"]) ??
    stringField(row, "venue_name", "eatery_name", "brand") ??
    "FÜDI Partner Eatery"

  return baseMappedRow({
    table,
    row,
    projectUrl,
    itemType: "deal",
    metadataItemType: "deal",
    originalId,
    title,
    brand,
    price: parseMappedRowPrice(row.price ?? row.offer_price ?? row.amount),
    description:
      stringField(row, "description", "details", "offer_details")?.slice(
        0,
        8000
      ) ?? null,
  })
}

function mapRowToIntake(
  table: FudiFeedTable,
  row: Record<string, unknown>,
  projectUrl: string
): MappedFudiSupabaseRow | null {
  switch (table) {
    case "fudi_board_items":
      return mapFudiBoardItem(table, row, projectUrl)
    case "eatery_menu_items":
      return mapEateryMenuItem(table, row, projectUrl)
    case "eats_community_events":
    case "foodie_events":
      return mapFoodEvent(table, row, projectUrl)
    case "craving_offer_responses":
      return mapCravingOffer(table, row, projectUrl)
    default:
      return null
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
    lower.includes("created_at") ||
    lower.includes("does not exist") ||
    lower.includes("column") ||
    lower.includes("42703")
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
      if (isMissingTableError(error.message)) {
        return { rows: [], probe: classifyProbeFailure(table, error.message) }
      }
      if (isPermissionOrAccessError(error.message)) {
        return { rows: [], probe: classifyProbeFailure(table, error.message) }
      }

      const joinIssue =
        error.message.toLowerCase().includes("relationship") ||
        error.message.toLowerCase().includes("could not embed")
      if (joinIssue) {
        joinFailed = true
        break
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
    return (
      "No FÜDI feed tables exist in this Supabase project. Confirm FUDI_SUPABASE_URL points at the FÜDI app project (not MAD Studio)."
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

  return (
    `No FÜDI feed data could be read. ${parts.join(" · ")}. ` +
    "Check FUDI_SUPABASE_URL, FUDI_SUPABASE_ANON_KEY, and table RLS on the FÜDI project."
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

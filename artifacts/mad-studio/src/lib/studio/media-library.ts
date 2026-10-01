import { createClient } from "@/lib/supabase/client"
import { detectMediaKindFromUrl } from "@/lib/media/kind"

export type MediaLibraryOrigin = "fudi_intake" | "upload"

export type MediaLibraryItem = {
  id: string
  url: string
  kind: "image" | "video"
  origin: MediaLibraryOrigin
  sourceTitle: string
  marketingEntityId: string
  updatedAt: string
}

const FUDI_SOURCE_TABLES = new Set([
  "fudi_posts",
  "fudi_deals",
  "fudi_events",
  "marketplace_items",
  "trails",
])

function resolveOrigin(copyDraft: unknown, websiteItemId: string): MediaLibraryOrigin {
  if (
    websiteItemId.startsWith("fudi-") ||
    websiteItemId.startsWith("partner-") ||
    /^fudi_/i.test(websiteItemId)
  ) {
    return "fudi_intake"
  }
  if (!copyDraft || typeof copyDraft !== "object" || Array.isArray(copyDraft)) {
    return "upload"
  }
  const meta = (copyDraft as { metadata?: unknown }).metadata
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return "upload"
  }
  const sourceTable = (meta as { source_table?: unknown }).source_table
  if (typeof sourceTable === "string" && FUDI_SOURCE_TABLES.has(sourceTable)) {
    return "fudi_intake"
  }
  return "upload"
}

export async function fetchEntityMediaLibrary(
  entityId: string,
  limit = 80
): Promise<MediaLibraryItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("marketing_entities")
    .select("id, title, website_item_id, images, copy_draft, updated_at")
    .eq("entity_id", entityId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const items: MediaLibraryItem[] = []
  const seen = new Set<string>()

  for (const row of data ?? []) {
    const images = Array.isArray(row.images) ? row.images : []
    const origin = resolveOrigin(row.copy_draft, row.website_item_id ?? "")
    for (const raw of images) {
      if (typeof raw !== "string" || !/^https?:\/\//i.test(raw.trim())) continue
      const url = raw.trim()
      if (seen.has(url)) continue
      seen.add(url)
      const kind = detectMediaKindFromUrl(url) === "video" ? "video" : "image"
      items.push({
        id: `${row.id}-${items.length}-${url.slice(-24)}`,
        url,
        kind,
        origin,
        sourceTitle: row.title?.trim() || "Untitled drop",
        marketingEntityId: row.id,
        updatedAt: row.updated_at ?? new Date().toISOString(),
      })
    }
  }

  return items.sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  )
}

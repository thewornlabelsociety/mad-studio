import type { SupabaseClient } from "@supabase/supabase-js"

export type ResolvedProgramDayAsset = {
  marketingEntityId: string
  mediaUrl: string | null
  title: string
}

function firstHttpsImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  return (
    images.find(
      (url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)
    ) ?? null
  )
}

export async function resolveProgramDayAsset(input: {
  supabase: SupabaseClient
  entityId: string
  marketingEntityId?: string | null
}): Promise<ResolvedProgramDayAsset | null> {
  if (input.marketingEntityId) {
    const { data: row } = await input.supabase
      .from("marketing_entities")
      .select("id, title, images, copy_draft")
      .eq("id", input.marketingEntityId)
      .eq("entity_id", input.entityId)
      .maybeSingle()

    if (row) {
      const draft =
        row.copy_draft &&
        typeof row.copy_draft === "object" &&
        !Array.isArray(row.copy_draft)
          ? (row.copy_draft as { media_url?: string })
          : null
      const mediaUrl =
        (typeof draft?.media_url === "string" && /^https?:\/\//i.test(draft.media_url)
          ? draft.media_url
          : null) ?? firstHttpsImage(row.images)
      return {
        marketingEntityId: row.id,
        mediaUrl,
        title: row.title ?? "Program day drop",
      }
    }
  }

  const { data: rows } = await input.supabase
    .from("marketing_entities")
    .select("id, title, images, copy_draft, updated_at")
    .eq("entity_id", input.entityId)
    .in("status", ["unfeatured", "draft", "ready", "scheduled"])
    .order("updated_at", { ascending: false })
    .limit(12)

  for (const row of rows ?? []) {
    const draft =
      row.copy_draft &&
      typeof row.copy_draft === "object" &&
      !Array.isArray(row.copy_draft)
        ? (row.copy_draft as { media_url?: string })
        : null
    const mediaUrl =
      (typeof draft?.media_url === "string" && /^https?:\/\//i.test(draft.media_url)
        ? draft.media_url
        : null) ?? firstHttpsImage(row.images)
    if (mediaUrl) {
      return {
        marketingEntityId: row.id,
        mediaUrl,
        title: row.title ?? "Program day drop",
      }
    }
  }

  const fallback = rows?.[0]
  if (!fallback) return null

  return {
    marketingEntityId: fallback.id,
    mediaUrl: firstHttpsImage(fallback.images),
    title: fallback.title ?? "Program day drop",
  }
}

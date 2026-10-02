import type { SupabaseClient } from "@supabase/supabase-js"

import type { MarketingCopyDraft } from "@/lib/inventory/types"
import { resilientTableUpdate } from "@/lib/today/resilient-table-update"

export type TodayDeckDismissStatus = "skipped" | "archived"

export const DISMISSED_DAILY_QUEUE_STATUSES = [
  "skipped",
  "archived",
  "published",
] as const

export function readTodayDeckDismissStatus(
  copyDraft: MarketingCopyDraft | null | undefined
): TodayDeckDismissStatus | null {
  const raw = copyDraft?.metadata?.today_deck_status
  if (raw === "skipped" || raw === "archived") return raw
  return null
}

export async function persistTodayDeckDismissal(input: {
  supabase: SupabaseClient
  entityId: string
  itemId: string
  status: TodayDeckDismissStatus
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await input.supabase
    .from("marketing_entities")
    .select("copy_draft")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  const existing =
    row?.copy_draft &&
    typeof row.copy_draft === "object" &&
    !Array.isArray(row.copy_draft)
      ? (row.copy_draft as MarketingCopyDraft)
      : {}

  const metadata = {
    ...(existing.metadata ?? {}),
    today_deck_status: input.status,
    today_deck_dismissed_at: new Date().toISOString(),
  }

  const { error, droppedColumns } = await resilientTableUpdate(
    input.supabase,
    "marketing_entities",
    {
      copy_draft: { ...existing, metadata },
      updated_at: new Date().toISOString(),
    },
    [
      ["id", input.itemId],
      ["entity_id", input.entityId],
    ]
  )

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Could not persist deck dismissal on item.",
    }
  }

  if (droppedColumns.includes("updated_at")) {
    console.warn(
      "[today-deck] marketing_entities.updated_at omitted (schema cache)."
    )
  }

  return { ok: true }
}

export async function fetchDismissedMarketingEntityIds(input: {
  supabase: SupabaseClient
  entityId: string
}): Promise<Set<string>> {
  const { data, error } = await input.supabase
    .from("daily_queue")
    .select("marketing_entity_id, status")
    .eq("entity_id", input.entityId)
    .in("status", [...DISMISSED_DAILY_QUEUE_STATUSES])

  if (error) {
    return new Set()
  }

  return new Set(
    (data ?? [])
      .map((row) => row.marketing_entity_id)
      .filter((id): id is string => typeof id === "string")
  )
}

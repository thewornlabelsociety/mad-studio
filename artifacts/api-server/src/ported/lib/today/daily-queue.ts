import type { SupabaseClient } from "@supabase/supabase-js"

import type { MarketingEntity } from "@/lib/inventory/types"
import { readTodayDeckDismissStatus } from "@/lib/today/today-deck-dismiss"

function isHiddenFromTodayDeck(
  item: Pick<MarketingEntity, "status" | "copy_draft">
): boolean {
  if (item.status !== "unfeatured") return true
  const dismissed = readTodayDeckDismissStatus(item.copy_draft ?? null)
  return dismissed === "skipped" || dismissed === "archived"
}

/** After website pull, enqueue new unfeatured rows for Today (idempotent). */
export async function syncDailyQueueFromIntake(
  supabase: SupabaseClient,
  entityId: string
): Promise<void> {
  const { data: intakeRows } = await supabase
    .from("marketing_entities")
    .select("id, status, copy_draft")
    .eq("entity_id", entityId)
    .eq("status", "unfeatured")

  const ids = (intakeRows ?? [])
    .filter(
      (row) =>
        !isHiddenFromTodayDeck({
          status: row.status as MarketingEntity["status"],
          copy_draft: row.copy_draft as MarketingEntity["copy_draft"],
        })
    )
    .map((row) => row.id)

  if (ids.length === 0) return

  const inserts = ids.map((marketingEntityId) => ({
    entity_id: entityId,
    marketing_entity_id: marketingEntityId,
    status: "pending_review" as const,
  }))

  await supabase.from("daily_queue").upsert(inserts, {
    onConflict: "entity_id,marketing_entity_id",
    ignoreDuplicates: true,
  })
}

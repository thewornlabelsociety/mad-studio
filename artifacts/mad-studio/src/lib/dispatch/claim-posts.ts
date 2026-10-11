import type { Database } from "@/lib/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

type ScheduledPostRow = Database["public"]["Tables"]["scheduled_posts"]["Row"]

/**
 * Atomically claims due queue rows via `claim_due_scheduled_posts` (FOR UPDATE SKIP LOCKED).
 * Falls back to a best-effort select+update when the RPC is not deployed yet.
 */
export async function claimDuePostsForDispatch(
  supabase: SupabaseClient,
  limit = 10
): Promise<ScheduledPostRow[]> {
  const batchSize = Math.max(1, Math.min(limit, 50))

  const { data, error } = await supabase.rpc("claim_due_scheduled_posts", {
    batch_size: batchSize,
  })

  if (!error) {
    return (data ?? []) as ScheduledPostRow[]
  }

  const missingRpc =
    error.message.includes("claim_due_scheduled_posts") ||
    error.message.includes("Could not find the function") ||
    error.code === "PGRST202"

  if (!missingRpc) {
    throw new Error(error.message)
  }

  const nowIso = new Date().toISOString()
  const { data: due, error: selectError } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_time", nowIso)
    .order("scheduled_time", { ascending: true })
    .limit(batchSize)

  if (selectError) throw new Error(selectError.message)

  const claimed: ScheduledPostRow[] = []
  for (const row of due ?? []) {
    const maxRetries =
      typeof row.max_retries === "number" && row.max_retries > 0 ? row.max_retries : 3
    if (row.attempts >= maxRetries) continue

    const { data: updated } = await supabase
      .from("scheduled_posts")
      .update({
        status: "processing",
        attempts: row.attempts + 1,
        updated_at: nowIso,
      })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("*")
      .maybeSingle()

    if (updated) claimed.push(updated as ScheduledPostRow)
  }

  return claimed
}

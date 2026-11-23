import { createAdminClient } from "@/lib/supabase/admin"

const DISPATCH_JOB = "dispatch-scheduled"
const STALE_MS = 15 * 60 * 1000

export type DispatchCronHealth = {
  jobName: string
  lastRunAt: string | null
  lastStatus: string | null
  stale: boolean
  detail: Record<string, unknown> | null
}

export async function readDispatchCronHealth(entityId?: string | null): Promise<DispatchCronHealth> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("cron_heartbeats")
      .select("job_name, last_run_at, status, details")
      .eq("job_name", DISPATCH_JOB)
      .maybeSingle()

    if (error) throw error

    const lastRunAt = data?.last_run_at ?? null
    const stale =
      !lastRunAt ||
      Date.now() - Date.parse(lastRunAt) > STALE_MS

    return {
      jobName: DISPATCH_JOB,
      lastRunAt,
      lastStatus: data?.status ?? null,
      stale,
      detail:
        data?.details && typeof data.details === "object" && !Array.isArray(data.details)
          ? (data.details as Record<string, unknown>)
          : null,
    }
  } catch {
    // In the browser there's no service key to read the heartbeat. Judge by
    // what matters instead: is any of this brand's booked posts well overdue?
    if (entityId) {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const { count } = await createClient()
          .from("scheduled_posts")
          .select("id", { count: "exact", head: true })
          .eq("entity_id", entityId)
          .eq("status", "scheduled")
          .lt("scheduled_time", new Date(Date.now() - STALE_MS).toISOString())
        return { jobName: DISPATCH_JOB, lastRunAt: null, lastStatus: null, stale: (count ?? 0) > 0, detail: null }
      } catch {
        /* fall through */
      }
    }
    return {
      jobName: DISPATCH_JOB,
      lastRunAt: null,
      lastStatus: null,
      stale: true,
      detail: null,
    }
  }
}

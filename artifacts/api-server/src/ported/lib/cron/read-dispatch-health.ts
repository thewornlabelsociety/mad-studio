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

export async function readDispatchCronHealth(): Promise<DispatchCronHealth> {
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
    return {
      jobName: DISPATCH_JOB,
      lastRunAt: null,
      lastStatus: null,
      stale: true,
      detail: null,
    }
  }
}

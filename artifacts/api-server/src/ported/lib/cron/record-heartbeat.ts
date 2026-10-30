import type { Json } from "@/lib/database.types"
import { createAdminClient } from "@/lib/supabase/admin"

export async function recordCronHeartbeat(input: {
  jobName: string
  status: "ok" | "error"
  detail?: Record<string, unknown>
}): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("cron_heartbeats").upsert(
      {
        job_name: input.jobName,
        last_run_at: new Date().toISOString(),
        status: input.status,
        details: (input.detail ?? {}) as Json,
      },
      { onConflict: "job_name" }
    )
    if (error) throw error
  } catch (error) {
    console.warn("[cron] heartbeat skipped", error)
  }
}

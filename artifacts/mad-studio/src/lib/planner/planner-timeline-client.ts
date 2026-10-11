import { parseApiJsonResponse } from "@/lib/api/parse-response"
import type { CampaignAutonomyMode } from "@/lib/campaigns/program-types"
import type {
  PlannerDuration,
  PlannerTimelineApiDay,
  PlannerTimelineDay,
} from "@/lib/planner/planner-timeline-types"

function parseApiDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map((part) => Number.parseInt(part, 10))
  return new Date(y, m - 1, d)
}

export function mapApiTimelineToDays(
  rows: PlannerTimelineApiDay[]
): PlannerTimelineDay[] {
  return rows.map((row, index) => ({
    id: `${row.date}-${index}`,
    date: parseApiDate(row.date),
    phase: row.phase,
    hook: row.hook,
    vibe: row.vibe,
    directorialAction: row.directorialAction,
    formulaId: row.formula_id ?? null,
  }))
}

export function formatPlannerStartDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export async function requestPlannerTimeline(input: {
  entityId: string
  prompt: string
  duration: PlannerDuration
  startDate: string
  autonomyMode?: CampaignAutonomyMode
}): Promise<{ days: PlannerTimelineDay[]; programId: string | null }> {
  const response = await fetch("/api/generate/campaign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const payload = await parseApiJsonResponse<{
    error?: string
    timeline?: PlannerTimelineApiDay[]
    programId?: string | null
  }>(response)

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to generate timeline.")
  }

  if (!Array.isArray(payload.timeline) || payload.timeline.length === 0) {
    throw new Error("Timeline response was empty.")
  }

  return {
    days: mapApiTimelineToDays(payload.timeline),
    programId: payload.programId ?? null,
  }
}

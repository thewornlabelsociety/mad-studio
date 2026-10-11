import { parseApiJsonResponse } from "@/lib/api/parse-response"
import type {
  CampaignProgramDayRow,
  CampaignProgramRow,
} from "@/lib/campaigns/program-types"
import { programDayToTimelineDay } from "@/lib/campaigns/persist-program-timeline"
import type { PlannerTimelineDay } from "@/lib/planner/planner-timeline-types"

export type CampaignProgramResponse = {
  program: CampaignProgramRow | null
  days: CampaignProgramDayRow[]
}

export async function fetchCampaignProgram(input: {
  entityId: string
  programId?: string | null
}): Promise<CampaignProgramResponse> {
  const params = new URLSearchParams({ entityId: input.entityId })
  if (input.programId) params.set("programId", input.programId)

  const response = await fetch(`/api/campaigns/programs?${params.toString()}`, {
    credentials: "include",
  })

  const payload = await parseApiJsonResponse<CampaignProgramResponse & { error?: string }>(
    response
  )
  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to load campaign program.")
  }

  return {
    program: payload.program ?? null,
    days: payload.days ?? [],
  }
}

export async function generateProgramDayPack(input: {
  entityId: string
  dayId: string
}): Promise<{ day: CampaignProgramDayRow; campaignId: string | null }> {
  const response = await fetch(`/api/campaign-days/${input.dayId}/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId: input.entityId }),
  })
  const payload = await parseApiJsonResponse<{
    day: CampaignProgramDayRow
    campaignId: string | null
    error?: string
  }>(response)
  if (!response.ok) {
    throw new Error(payload.error ?? "Pack generation failed.")
  }
  return { day: payload.day, campaignId: payload.campaignId }
}

export async function armProgramDay(input: {
  entityId: string
  dayId: string
}): Promise<{ day: CampaignProgramDayRow; armed: number }> {
  const response = await fetch(`/api/campaign-days/${input.dayId}/arm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId: input.entityId }),
  })
  const payload = await parseApiJsonResponse<{
    day: CampaignProgramDayRow
    armed: number
    error?: string
  }>(response)
  if (!response.ok) {
    throw new Error(payload.error ?? "Arming failed.")
  }
  return { day: payload.day, armed: payload.armed }
}

export async function orchestrateCampaignProgram(input: {
  entityId: string
  programId: string
  maxDays?: number
}) {
  const response = await fetch("/api/campaigns/orchestrate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = await parseApiJsonResponse<{ ok?: boolean; error?: string }>(
    response
  )
  if (!response.ok) {
    throw new Error(payload.error ?? "Orchestrate failed.")
  }
  return payload
}

export function programDaysToTimeline(days: CampaignProgramDayRow[]): PlannerTimelineDay[] {
  return days.map((row) => {
    const mapped = programDayToTimelineDay(row)
    return {
      id: mapped.id,
      date: mapped.date,
      phase: mapped.phase,
      hook: mapped.hook,
      vibe: mapped.vibe,
      directorialAction: mapped.directorialAction,
      formulaId: mapped.formulaId,
      status: mapped.status,
    }
  })
}

import type { Json } from "@/lib/database.types"
import type {
  CampaignAutonomyMode,
  CampaignProgramBundle,
  PersistProgramTimelineInput,
} from "@/lib/campaigns/program-types"
import { createAdminClient } from "@/lib/supabase/admin"

function deriveProgramTitle(brief: string): string {
  const line =
    brief
      .split(/\n/)
      .map((row) => row.trim())
      .find(Boolean) ?? "Campaign program"
  return line.slice(0, 160)
}

function requiresApprovalForMode(mode: CampaignAutonomyMode): boolean {
  return mode === "suggest"
}

export async function persistCampaignProgramTimeline(
  input: PersistProgramTimelineInput
): Promise<CampaignProgramBundle> {
  if (input.days.length === 0) {
    throw new Error("Cannot persist an empty program timeline.")
  }

  const sorted = [...input.days].sort((a, b) => a.date.localeCompare(b.date))
  const startDate = sorted[0]!.date
  const endDate = sorted[sorted.length - 1]!.date
  const autonomyMode = input.autonomyMode ?? "arm"
  const now = new Date().toISOString()
  const admin = createAdminClient()

  const { data: program, error: programError } = await admin
    .from("campaign_programs")
    .insert({
      entity_id: input.entityId,
      created_by: input.userId,
      title: deriveProgramTitle(input.brief),
      brief: input.brief.trim(),
      autonomy_mode: autonomyMode,
      status: "generating",
      start_date: startDate,
      end_date: endDate,
      duration_key: input.duration,
      updated_at: now,
    })
    .select("*")
    .single()

  if (programError || !program) {
    throw new Error(programError?.message ?? "Failed to create campaign program.")
  }

  const dayRows = sorted.map((day, index) => ({
    program_id: program.id,
    day_index: index,
    scheduled_date: day.date,
    phase: day.phase,
    hook: day.hook,
    vibe: day.vibe,
    directorial_action: day.directorialAction,
    formula_id: day.formulaId ?? null,
    status: "pending" as const,
    requires_approval: requiresApprovalForMode(autonomyMode),
    updated_at: now,
  }))

  const { data: insertedDays, error: daysError } = await admin
    .from("campaign_program_days")
    .insert(dayRows)
    .select("*")

  if (daysError || !insertedDays?.length) {
    await admin.from("campaign_programs").delete().eq("id", program.id)
    throw new Error(daysError?.message ?? "Failed to create program days.")
  }

  const { error: activateError } = await admin
    .from("campaign_programs")
    .update({ status: "active", updated_at: now })
    .eq("id", program.id)

  if (activateError) {
    throw new Error(activateError.message)
  }

  return {
    program: { ...program, status: "active" } as CampaignProgramBundle["program"],
    days: insertedDays as CampaignProgramBundle["days"],
  }
}

export async function loadCampaignProgramBundle(input: {
  programId: string
  entityId: string
}): Promise<CampaignProgramBundle | null> {
  const admin = createAdminClient()
  const { data: program, error: programError } = await admin
    .from("campaign_programs")
    .select("*")
    .eq("id", input.programId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (programError) throw new Error(programError.message)
  if (!program) return null

  const { data: days, error: daysError } = await admin
    .from("campaign_program_days")
    .select("*")
    .eq("program_id", program.id)
    .order("day_index", { ascending: true })

  if (daysError) throw new Error(daysError.message)

  return {
    program: program as CampaignProgramBundle["program"],
    days: (days ?? []) as CampaignProgramBundle["days"],
  }
}

export async function loadLatestCampaignProgramForEntity(
  entityId: string
): Promise<CampaignProgramBundle | null> {
  const admin = createAdminClient()
  const { data: program, error: programError } = await admin
    .from("campaign_programs")
    .select("*")
    .eq("entity_id", entityId)
    .in("status", ["active", "generating", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (programError) throw new Error(programError.message)
  if (!program) return null

  return loadCampaignProgramBundle({ programId: program.id, entityId })
}

export function programDayToTimelineDay(row: CampaignProgramBundle["days"][number]) {
  const [y, m, d] = row.scheduled_date.split("-").map((part) => Number.parseInt(part, 10))
  return {
    id: row.id,
    date: new Date(y, m - 1, d),
    phase: row.phase,
    hook: row.hook,
    vibe: row.vibe,
    directorialAction: row.directorial_action ?? "",
    status: row.status,
    formulaId: row.formula_id,
  }
}

export type ProgramDayTimeline = ReturnType<typeof programDayToTimelineDay>

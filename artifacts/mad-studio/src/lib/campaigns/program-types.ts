import type { Json } from "@/lib/database.types"
import type { PlannerDuration } from "@/lib/planner/planner-timeline-types"

export type CampaignAutonomyMode = "suggest" | "arm" | "full_auto"

export type CampaignProgramStatus =
  | "draft"
  | "generating"
  | "active"
  | "paused"
  | "completed"
  | "failed"

export type CampaignProgramDayStatus =
  | "pending"
  | "generating"
  | "ready"
  | "armed"
  | "published"
  | "failed"
  | "skipped"

export type CampaignProgramRow = {
  id: string
  entity_id: string
  created_by: string | null
  title: string
  brief: string
  autonomy_mode: CampaignAutonomyMode
  status: CampaignProgramStatus
  start_date: string
  end_date: string
  target_channels: string[]
  spend_cap_cents: number
  duration_key: string | null
  created_at: string
  updated_at: string
}

export type CampaignProgramDayRow = {
  id: string
  program_id: string
  day_index: number
  scheduled_date: string
  phase: string
  hook: string
  vibe: string
  directorial_action: string | null
  formula_id: string | null
  status: CampaignProgramDayStatus
  pack_snapshot: Json | null
  marketing_entity_id: string | null
  campaign_id: string | null
  requires_approval: boolean
  approved_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type PersistProgramTimelineInput = {
  entityId: string
  userId: string
  brief: string
  duration: PlannerDuration
  autonomyMode?: CampaignAutonomyMode
  days: Array<{
    date: string
    phase: string
    hook: string
    vibe: string
    directorialAction: string
    formulaId?: string | null
  }>
}

export type CampaignProgramBundle = {
  program: CampaignProgramRow
  days: CampaignProgramDayRow[]
}

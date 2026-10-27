"use server"

import { revalidatePath } from "@server/http-response"

import {
  buildStudioContext,
  campaignRowToPack,
  parseStudioContext,
  type StudioContext,
} from "@/lib/campaigns/pack-hydrate"
import type { MultiplexerIntent } from "@/lib/campaigns/multiplexer"
import {
  campaignPackSchema,
  normalizePackForPersistence,
  packToAssetPack,
  type CampaignPack,
} from "@/lib/campaigns/pack-schema"
import type { Json } from "@/lib/database.types"
import type { FudiAudienceTrack } from "@/lib/studio/fudi-tracks"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type SaveCampaignInput = {
  entityId: string
  eventDescription: string
  targetGoal: string
  targetSegment?: string | null
  pack: CampaignPack
  status: "draft" | "published"
  mediaUrl?: string | null
  /** When set, updates the existing draft instead of inserting a duplicate. */
  campaignId?: string | null
  intent?: MultiplexerIntent | null
  fudiTrack?: FudiAudienceTrack | null
  /** Written to studio_context.metadata.forecasting_tag for ledger grouping. */
  forecastingTag?: string | null
  /** Checkpoint 4 — multi-frame creative sequence (studio_context.metadata). */
  creativeSequence?: unknown
}

export type SaveCampaignResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: string }

export type DispatchResult =
  | {
      ok: true
      campaignId: string
      dispatched: number
      endpoints: string[]
    }
  | { ok: false; error: string }

export type StudioPackSnapshot = {
  campaignId: string
  entityId: string
  pack: CampaignPack
  mediaUrl: string | null
  targetGoal: string
  targetSegment: string | null
  status: string | null
  updatedAt: string
  createdAt: string
  context: StudioContext
}

async function assertCanView(entityId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null as null, error: "You must be signed in." }
  }

  const { data: canView, error } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager", "creator", "viewer"],
  })

  if (error) {
    return { supabase, user, error: error.message }
  }

  if (!canView) {
    return {
      supabase,
      user,
      error: "You do not have access to this brand.",
    }
  }

  return { supabase, user, error: null as null }
}

async function assertCanEdit(entityId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null as null, error: "You must be signed in." }
  }

  const { data: canEdit, error } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager", "creator"],
  })

  if (error) {
    return { supabase, user, error: error.message }
  }

  if (!canEdit) {
    return {
      supabase,
      user,
      error: "You need creator or manager access to save campaigns.",
    }
  }

  return { supabase, user, error: null as null }
}

function rowToSnapshot(row: {
  id: string
  entity_id: string
  title: string
  target_goal: string
  target_segment: string | null
  status: string | null
  media_url: string | null
  algorithmic_signals: Json | null
  asset_pack: Json | null
  studio_context: Json
  created_at: string
  updated_at: string
}): StudioPackSnapshot | null {
  const pack = campaignRowToPack({
    title: row.title,
    algorithmic_signals: row.algorithmic_signals,
    asset_pack: row.asset_pack,
  })
  if (!pack) return null

  const context =
    parseStudioContext(row.studio_context) ??
    buildStudioContext({
      eventDescription: "",
      intent: "Drive Sales",
      objective: row.target_goal,
      personaName: row.target_segment,
    })

  if (!context.objective) {
    context.objective = row.target_goal
  }
  if (!context.persona_name && row.target_segment) {
    context.persona_name = row.target_segment
  }

  return {
    campaignId: row.id,
    entityId: row.entity_id,
    pack,
    mediaUrl: row.media_url,
    targetGoal: row.target_goal,
    targetSegment: row.target_segment,
    status: row.status,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    context,
  }
}

const STUDIO_PACK_SELECT =
  "id, entity_id, title, target_goal, target_segment, status, media_url, algorithmic_signals, asset_pack, studio_context, created_at, updated_at"

export async function getStudioPack(input: {
  entityId: string
  campaignId: string
}): Promise<
  { ok: true; snapshot: StudioPackSnapshot } | { ok: false; error: string }
> {
  const auth = await assertCanView(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data, error } = await auth.supabase
    .from("campaigns")
    .select(STUDIO_PACK_SELECT)
    .eq("id", input.campaignId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Pack not found." }

  const snapshot = rowToSnapshot(data)
  if (!snapshot) {
    return {
      ok: false,
      error: "Saved pack is incomplete and cannot be restored.",
    }
  }
  return { ok: true, snapshot }
}

export async function getLatestStudioDraft(input: {
  entityId: string
}): Promise<
  | { ok: true; snapshot: StudioPackSnapshot | null }
  | { ok: false; error: string }
> {
  const auth = await assertCanView(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data, error } = await auth.supabase
    .from("campaigns")
    .select(STUDIO_PACK_SELECT)
    .eq("entity_id", input.entityId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: true, snapshot: null }

  const snapshot = rowToSnapshot(data)
  if (!snapshot) return { ok: true, snapshot: null }
  return { ok: true, snapshot }
}

export async function saveCampaign(
  input: SaveCampaignInput
): Promise<SaveCampaignResult> {
  const packParsed = campaignPackSchema.safeParse(
    normalizePackForPersistence(input.pack)
  )
  if (!packParsed.success) {
    return { ok: false, error: "Campaign pack is incomplete." }
  }

  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const pack = packParsed.data
  const now = new Date().toISOString()
  const existingId = input.campaignId?.trim() || null
  // When callers omit creativeSequence (legacy arm paths), keep the draft's
  // multi-frame metadata instead of wiping studio_context.metadata.
  let creativeSequence = input.creativeSequence
  let forecastingTag = input.forecastingTag ?? null
  if (existingId && creativeSequence === undefined) {
    const { data: existing } = await auth.supabase
      .from("campaigns")
      .select("studio_context")
      .eq("id", existingId)
      .eq("entity_id", input.entityId)
      .maybeSingle()
    const prior = parseStudioContext(existing?.studio_context)
    if (prior?.metadata?.creative_sequence !== undefined) {
      creativeSequence = prior.metadata.creative_sequence
    }
    if (!forecastingTag?.trim() && prior?.metadata?.forecasting_tag) {
      forecastingTag = prior.metadata.forecasting_tag
    }
  }
  const studioContext = buildStudioContext({
    eventDescription: input.eventDescription,
    intent: input.intent ?? "Drive Sales",
    objective: input.targetGoal,
    personaName: input.targetSegment,
    fudiTrack: input.fudiTrack ?? null,
    forecastingTag,
    creativeSequence,
  })

  const contentFields = {
    title: pack.campaign_title,
    target_goal: input.targetGoal,
    target_segment: input.targetSegment || null,
    algorithmic_signals: pack.algorithmic_signals as unknown as Json,
    asset_pack: packToAssetPack(pack) as unknown as Json,
    media_url: input.mediaUrl || null,
    studio_context: studioContext as unknown as Json,
    updated_at: now,
  }

  let campaignId = existingId

  if (existingId) {
    const { data, error } = await auth.supabase
      .from("campaigns")
      .update({
        ...contentFields,
        ...(input.status === "published"
          ? { status: "published", published_at: now }
          : {}),
      })
      .eq("id", existingId)
      .eq("entity_id", input.entityId)
      .select("id")
      .maybeSingle()

    if (error) {
      return { ok: false, error: error.message }
    }
    if (!data) {
      return {
        ok: false,
        error: "Campaign draft not found for this brand.",
      }
    }
    campaignId = data.id
  } else {
    const { data, error } = await auth.supabase
      .from("campaigns")
      .insert({
        entity_id: input.entityId,
        created_by: auth.user.id,
        status: input.status,
        published_at: input.status === "published" ? now : null,
        ...contentFields,
      })
      .select("id")
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to save campaign." }
    }
    campaignId = data.id
  }

  await auth.supabase.from("activity_logs").insert({
    entity_id: input.entityId,
    user_id: auth.user.id,
    action:
      input.status === "published"
        ? "published_campaign"
        : existingId
          ? "updated_campaign"
          : "saved_campaign",
    details: {
      campaign_id: campaignId,
      title: pack.campaign_title,
      target_goal: input.targetGoal,
      status: input.status,
      event_description: input.eventDescription.slice(0, 500),
    },
  })

  revalidatePath("/studio")
  revalidatePath("/campaigns")
  return { ok: true, campaignId: campaignId! }
}

export async function dispatchCampaignPack(
  input: SaveCampaignInput
): Promise<DispatchResult> {
  const saved = await saveCampaign({ ...input, status: "published" })
  if (!saved.ok) {
    return saved
  }

  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: channels, error: channelsError } = await auth.supabase
    .from("entity_channels")
    .select("id, account_name, webhook_url, platform")
    .eq("entity_id", input.entityId)
    .eq("platform", "outbound")
    .eq("is_active", true)

  if (channelsError) {
    return { ok: false, error: channelsError.message }
  }

  const endpoints = (channels ?? [])
    .map((channel) => channel.webhook_url?.trim())
    .filter((url): url is string => Boolean(url))

  if (endpoints.length === 0) {
    return {
      ok: false,
      error:
        "No active outbound webhook configured. Add one in Entity Setup (Automation Secrets).",
    }
  }

  const pack = campaignPackSchema.parse(
    normalizePackForPersistence(input.pack)
  )
  const payload = {
    event: "campaign.dispatch",
    campaign_id: saved.campaignId,
    entity_id: input.entityId,
    target_goal: input.targetGoal,
    target_segment: input.targetSegment ?? null,
    event_description: input.eventDescription,
    title: pack.campaign_title,
    algorithmic_signals: pack.algorithmic_signals,
    asset_pack: packToAssetPack(pack),
    dispatched_at: new Date().toISOString(),
  }

  const results = await Promise.allSettled(
    endpoints.map(async (url) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error(`${url} responded ${response.status}`)
      }
      return url
    })
  )

  const succeeded = results.filter(
    (result): result is PromiseFulfilledResult<string> =>
      result.status === "fulfilled"
  )
  const failed = results.filter((result) => result.status === "rejected")

  await auth.supabase.from("activity_logs").insert({
    entity_id: input.entityId,
    user_id: auth.user.id,
    action: "dispatched_campaign",
    details: {
      campaign_id: saved.campaignId,
      succeeded: succeeded.length,
      failed: failed.length,
      endpoints: succeeded.map((result) => result.value),
    },
  })

  if (succeeded.length === 0) {
    return {
      ok: false,
      error: "Webhook dispatch failed for all outbound endpoints.",
    }
  }

  return {
    ok: true,
    campaignId: saved.campaignId,
    dispatched: succeeded.length,
    endpoints: succeeded.map((result) => result.value),
  }
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Calendar: clear a whole campaign plan (its already-scheduled posts stay). */
export async function archiveCampaignProgram(input: {
  entityId: string
  programId: string
}): Promise<ActionResult<{ archived: true }>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }
  // Plan tables aren't in every copy's generated types.
  const admin = createAdminClient() as unknown as { from: (table: string) => any }
  const { data, error } = await admin
    .from("campaign_programs")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", input.programId)
    .eq("entity_id", input.entityId)
    .select("id")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "That plan wasn't found." }
  return { ok: true, data: { archived: true } }
}

/** Calendar: drop one planned day from a campaign plan. */
export async function skipCampaignProgramDay(input: {
  entityId: string
  dayId: string
}): Promise<ActionResult<{ skipped: true }>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }
  // Plan tables aren't in every copy's generated types.
  const admin = createAdminClient() as unknown as { from: (table: string) => any }
  const { data: day } = await admin
    .from("campaign_program_days")
    .select("id, program_id")
    .eq("id", input.dayId)
    .maybeSingle()
  if (!day) return { ok: false, error: "That planned day wasn't found." }
  const { data: program } = await admin
    .from("campaign_programs")
    .select("id")
    .eq("id", day.program_id)
    .eq("entity_id", input.entityId)
    .maybeSingle()
  if (!program) return { ok: false, error: "That planned day wasn't found." }
  const { error } = await admin
    .from("campaign_program_days")
    .update({ status: "skipped", updated_at: new Date().toISOString() })
    .eq("id", input.dayId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { skipped: true } }
}

/**
 * Calendar: hide posts from the calendar (e.g. test posts). Nothing changes
 * on Instagram, Facebook or TikTok.
 */
export async function hideCalendarPosts(input: {
  entityId: string
  postIds: string[]
}): Promise<ActionResult<{ hidden: number }>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }
  const ids = input.postIds.slice(0, 50)
  const { data: rows, error: readError } = await auth.supabase
    .from("scheduled_posts")
    .select("id, payload")
    .eq("entity_id", input.entityId)
    .in("id", ids)
  if (readError) return { ok: false, error: readError.message }
  let hidden = 0
  for (const row of rows ?? []) {
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {}
    const { error } = await auth.supabase
      .from("scheduled_posts")
      .update({
        payload: { ...payload, calendar_hidden: true } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("entity_id", input.entityId)
    if (error) return { ok: false, error: error.message }
    hidden += 1
  }
  return { ok: true, data: { hidden } }
}

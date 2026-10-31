"use client"

import { toast } from "sonner"

import { getCampaignPlans, saveCampaignPlans } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import { ymd, type CampaignPlan, type CampaignStep, type CampaignTool } from "@/lib/planner/campaign-recipes"

/** The campaign step opened with Make it, so finishing that post ticks it off. */
const ACTIVE_STEP_KEY = "mad.campaign.activeStep"
/** A step left open longer than this isn't what you're finishing now. */
const ACTIVE_STEP_MAX_AGE_MS = 12 * 60 * 60 * 1000

type ActiveStep = { entityId: string; planId: string; stepId: string; at: number }

export function rememberActiveStep(entityId: string, planId: string, stepId: string) {
  try {
    window.sessionStorage.setItem(
      ACTIVE_STEP_KEY,
      JSON.stringify({ entityId, planId, stepId, at: Date.now() } satisfies ActiveStep)
    )
  } catch {
    /* the step just won't tick itself */
  }
}

function readActiveStep(entityId: string): ActiveStep | null {
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_STEP_KEY)
    const active = raw ? (JSON.parse(raw) as ActiveStep) : null
    if (!active || active.entityId !== entityId) return null
    if (Date.now() - active.at > ACTIVE_STEP_MAX_AGE_MS) return null
    return active
  } catch {
    return null
  }
}

/** Tick the steps `pick` chooses; saves only when something changed. */
async function tickSteps(
  entityId: string,
  pick: (plan: CampaignPlan, step: CampaignStep) => boolean
): Promise<CampaignStep[]> {
  const loaded = (await getCampaignPlans({ entityId })) as { ok: boolean; data?: { plans: CampaignPlan[] } }
  if (!loaded.ok || !loaded.data) return []
  const ticked: CampaignStep[] = []
  const plans = loaded.data.plans.map((plan) => ({
    ...plan,
    steps: plan.steps.map((step) => {
      if (step.done || !pick(plan, step)) return step
      ticked.push(step)
      return { ...step, done: true }
    }),
  }))
  if (ticked.length === 0) return []
  const saved = (await saveCampaignPlans({ entityId, plans })) as { ok: boolean }
  return saved.ok ? ticked : []
}

function announce(ticked: CampaignStep[]) {
  if (ticked.length === 0) return
  toast.success(
    ticked.length === 1 ? `Campaign step done: ${ticked[0].title}` : `${ticked.length} campaign steps done`
  )
}

/** Finish the step opened with Make it (after saving, posting or scheduling its post). */
export async function completeActiveStep(entityId: string): Promise<void> {
  const active = readActiveStep(entityId)
  if (!active) return
  try {
    window.sessionStorage.removeItem(ACTIVE_STEP_KEY)
  } catch {
    /* ignore */
  }
  try {
    announce(await tickSteps(entityId, (plan, step) => plan.id === active.planId && step.id === active.stepId))
  } catch {
    /* the tick can be done by hand on Campaigns */
  }
}

/** Tick today's steps made with `tool` (e.g. Stories once one is marked shared). */
export async function completeStepsFor(entityId: string, tool: CampaignTool, date = new Date()): Promise<void> {
  const day = ymd(date)
  try {
    announce(await tickSteps(entityId, (_plan, step) => step.tool === tool && step.date === day))
  } catch {
    /* the tick can be done by hand on Campaigns */
  }
}

export type SharedStory = { id: string; title: string; image: string | null; sharedAt: Date }

/** Stories marked shared on Today between `from` and `to`, for the calendars. */
export async function fetchSharedStories(input: { entityId: string; from: Date; to: Date }): Promise<SharedStory[]> {
  const { data, error } = await createClient()
    .from("marketing_entities")
    .select("id, title, images, copy_draft")
    .eq("entity_id", input.entityId)
    .gte("copy_draft->metadata->>wls_story_shared_at", input.from.toISOString())
    .lt("copy_draft->metadata->>wls_story_shared_at", input.to.toISOString())
    .limit(200)
  if (error) throw new Error(error.message)
  const out: SharedStory[] = []
  for (const row of data ?? []) {
    const draft = row.copy_draft as { metadata?: { wls_story_shared_at?: unknown } } | null
    const at = draft?.metadata?.wls_story_shared_at
    if (typeof at !== "string") continue
    out.push({
      id: row.id,
      title: row.title,
      image: (row.images ?? []).find((url: string) => /^https?:\/\//i.test(url)) ?? null,
      sharedAt: new Date(at),
    })
  }
  return out
}

/** Shared Stories grouped by local day (yyyy-mm-dd). */
export function sharedStoriesByDay(stories: SharedStory[]): Map<string, SharedStory[]> {
  const map = new Map<string, SharedStory[]>()
  for (const story of stories) {
    const key = ymd(story.sharedAt)
    map.set(key, [...(map.get(key) ?? []), story])
  }
  return map
}

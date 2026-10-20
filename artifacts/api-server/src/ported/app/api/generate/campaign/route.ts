import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { loadBrainTakeawaysForEntity } from "@/lib/campaigns/brain-takeaways"
import { inferFormulaIdForHook } from "@/lib/campaigns/infer-program-formula"
import { orchestrateProgramByAutonomy } from "@/lib/campaigns/orchestrate-program"
import { persistCampaignProgramTimeline } from "@/lib/campaigns/persist-program-timeline"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import {
  buildPlannerTimelineSystem,
  buildPlannerTimelineUserPrompt,
} from "@/lib/planner/planner-timeline-prompt"
import { formatLaunchEndIso } from "@/lib/planner/planner-schedule-dates"
import {
  generateCampaignRequestSchema,
  plannerDurationDayCount,
  plannerTimelineDaySchema,
  type PlannerTimelineApiDay,
} from "@/lib/planner/planner-timeline-types"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

function addDaysIso(startDate: string, offset: number): string {
  const [y, m, d] = startDate.split("-").map((part) => Number.parseInt(part, 10))
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + offset)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function humanizeRouteError(error: unknown): { message: string; status: number } {
  const raw =
    error instanceof Error ? error.message : "Failed to generate campaign timeline."
  const lower = raw.toLowerCase()

  if (
    lower.includes("api key") ||
    lower.includes("google_generative_ai") ||
    lower.includes("not configured")
  ) {
    return { message: "SYSTEM HALTED. Check Gemini Key.", status: 500 }
  }

  if (
    lower.includes("high demand") ||
    lower.includes("resource_exhausted") ||
    lower.includes("overloaded")
  ) {
    return {
      message:
        "SYSTEM HALTED. Gemini is under high demand — retry in a moment.",
      status: 503,
    }
  }

  if (lower.includes("no object") || lower.includes("did not match schema")) {
    return {
      message:
        "Gemini returned a malformed timeline. Retry with a shorter brief or different duration.",
      status: 502,
    }
  }

  return { message: raw, status: 500 }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = generateCampaignRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Entity, prompt (8+ chars), duration, and startDate are required." },
        { status: 400 }
      )
    }

    const { entityId, prompt, duration, startDate, autonomyMode } = parsed.data
    const dayCount = plannerDurationDayCount(duration)

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json(
        { error: "MULTI-BRAND ISOLATION ACTIVE. Verify Entity Access." },
        { status: 403 }
      )
    }

    const { data: entityRow, error: entityError } = await supabase
      .from("entities")
      .select(
        "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
      )
      .eq("id", entityId)
      .single()

    if (entityError || !entityRow) {
      return NextResponse.json(
        { error: entityError?.message ?? "Entity not found." },
        { status: 404 }
      )
    }

    const entity = parseStudioEntity(entityRow)

    const brainTakeaways = await loadBrainTakeawaysForEntity(supabase, entityId, 5)

    const responseSchema = z.object({
      days: z.array(plannerTimelineDaySchema).length(dayCount),
    })

    const started = Date.now()
    const { object, model, usage } = await generateObjectWithFallback({
      schema: responseSchema,
      schemaName: "PlannerCampaignTimeline",
      schemaDescription: `${dayCount}-day social launch timeline with hook, vibe, and shoot cue per day`,
      temperature: 0.65,
      maxOutputTokens: 2200,
      system: buildPlannerTimelineSystem({ entity, brainTakeaways }),
      prompt: buildPlannerTimelineUserPrompt({
        prompt,
        duration,
        startDate,
        launchEndDate: formatLaunchEndIso(prompt),
      }),
    })

    try {
      await recordOrchestratedCall({
        entityId,
        agentType: "multiplexer",
        agentLabel: "Planner timeline",
        model,
        usage,
        durationMs: Date.now() - started,
        summary: `${dayCount}-day launch timeline`,
        metadata: { duration, startDate },
      })
    } catch (meterError) {
      console.warn("[generate/campaign] metering skipped", meterError)
    }

    const timeline: PlannerTimelineApiDay[] = object.days.map((day, index) => ({
      phase: day.phase,
      hook: day.hook,
      vibe: day.vibe,
      directorialAction: day.directorialAction,
      formula_id: inferFormulaIdForHook(entity, day.hook, day.formula_id),
      date: addDaysIso(startDate, index),
    }))

    let programId: string | null = null
    try {
      const bundle = await persistCampaignProgramTimeline({
        entityId,
        userId: user.id,
        brief: prompt,
        duration,
        autonomyMode,
        days: timeline.map((day) => ({
          date: day.date,
          phase: day.phase,
          hook: day.hook,
          vibe: day.vibe,
          directorialAction: day.directorialAction,
          formulaId: day.formula_id ?? null,
        })),
      })
      programId = bundle.program.id

      const mode = autonomyMode ?? bundle.program.autonomy_mode
      if (mode === "arm" || mode === "full_auto") {
        try {
          await orchestrateProgramByAutonomy({
            programId: bundle.program.id,
            entityId,
            userId: user.id,
            maxDays: dayCount,
          })
        } catch (orchestrateError) {
          console.warn("[generate/campaign] autonomy orchestrate", orchestrateError)
        }
      }
    } catch (persistError) {
      console.error("[generate/campaign] persist failed", persistError)
      return NextResponse.json(
        {
          error:
            persistError instanceof Error
              ? `Timeline generated but could not save program: ${persistError.message}. Apply migration 20261008_campaign_programs.sql on MAD Supabase.`
              : "Timeline generated but could not save program.",
          timeline,
          programId: null,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ timeline, programId })
  } catch (error) {
    const { message, status } = humanizeRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

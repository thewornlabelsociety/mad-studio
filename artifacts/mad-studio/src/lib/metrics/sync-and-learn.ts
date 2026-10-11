import { z } from "zod"

import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { loadBrainTakeawaysForEntity } from "@/lib/campaigns/brain-takeaways"
import type { Json } from "@/lib/database.types"
import { adjustFormulaWeight } from "@/lib/metrics/formula-weighting"
import { fetchMediaInsights } from "@/lib/social/meta-publisher"
import { parsePublishedMediaIds } from "@/lib/social/types"
import type { SupabaseClient } from "@supabase/supabase-js"

const takeawaySchema = z.object({
  summary: z.string().min(20).max(1200),
  winning_patterns: z.array(z.string()).max(3),
  anti_patterns: z.array(z.string()).max(2),
})

export type SyncAndLearnResult = {
  entityId: string
  postsEvaluated: number
  takeawayId?: string
  skipped?: string
}

function engagementScore(input: {
  impressions: number
  clicks: number
  saved: number
}): number {
  return input.impressions + input.clicks * 4 + input.saved * 2
}

async function appendAutonomousMemory(input: {
  supabase: SupabaseClient
  entityId: string
  text: string
}) {
  const now = new Date().toISOString()
  await input.supabase.from("campaigns").insert({
    entity_id: input.entityId,
    title: "Autonomous metrics takeaway",
    target_goal: "memory_vault",
    status: "draft",
    outcome_rating: "winner",
    ai_takeaway: input.text,
    studio_context: { source: "sync_metrics" } as Json,
    updated_at: now,
  })
}

export async function syncAndLearnForEntity(
  admin: SupabaseClient,
  entityId: string
): Promise<SyncAndLearnResult> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: posts, error } = await admin
    .from("scheduled_posts")
    .select(
      "id, entity_id, marketing_entity_id, program_day_id, platform, published_at, campaign_id"
    )
    .eq("entity_id", entityId)
    .eq("status", "published")
    .gte("published_at", since)
    .limit(40)

  if (error) throw new Error(error.message)
  if (!posts?.length) {
    return { entityId, postsEvaluated: 0, skipped: "no_recent_published_posts" }
  }

  const programDayIds = posts
    .map((row) => row.program_day_id)
    .filter((id): id is string => Boolean(id))

  const { data: programDays } = programDayIds.length
    ? await admin
        .from("campaign_program_days")
        .select("id, formula_id, hook, phase, program_id")
        .in("id", programDayIds)
    : { data: [] as Array<Record<string, unknown>> }

  const dayById = new Map((programDays ?? []).map((row) => [row.id, row]))

  const marketingIds = [
    ...new Set(
      posts.map((row) => row.marketing_entity_id).filter((id): id is string => Boolean(id))
    ),
  ]

  const { data: items } = marketingIds.length
    ? await admin
        .from("marketing_entities")
        .select("id, metrics, published_media_ids")
        .in("id", marketingIds)
    : { data: [] as Array<Record<string, unknown>> }

  const itemById = new Map((items ?? []).map((row) => [row.id as string, row]))

  const { data: connections } = await admin
    .from("social_connections")
    .select("entity_id, platform, access_token")
    .eq("entity_id", entityId)
    .eq("is_active", true)
    .in("platform", ["instagram", "facebook"])

  const tokenFor = (platform: string) =>
    connections?.find((row) => row.platform === platform)?.access_token ?? null

  const evaluated: Array<{
    postId: string
    formulaId: string | null
    hook: string | null
    score: number
    impressions: number
    clicks: number
  }> = []

  for (const post of posts) {
    const day = post.program_day_id ? dayById.get(post.program_day_id) : null
    const item = post.marketing_entity_id
      ? itemById.get(post.marketing_entity_id)
      : null

    let impressions = 0
    let saved = 0
    const metrics =
      item?.metrics && typeof item.metrics === "object" && !Array.isArray(item.metrics)
        ? (item.metrics as Record<string, number>)
        : {}
    impressions = typeof metrics.impressions === "number" ? metrics.impressions : metrics.views ?? 0
    saved = typeof metrics.saved === "number" ? metrics.saved : 0

    const mediaIds = item ? parsePublishedMediaIds(item.published_media_ids) : {}
    const platformKey =
      post.platform === "instagram_feed" || post.platform === "instagram_story"
        ? "instagram"
        : post.platform === "facebook"
          ? "facebook"
          : null

    if (platformKey && tokenFor(platformKey)) {
      const mediaId =
        mediaIds[post.platform] ?? mediaIds[platformKey] ?? mediaIds.instagram_feed
      if (mediaId) {
        try {
          const insights = await fetchMediaInsights({
            mediaId,
            accessToken: tokenFor(platformKey)!,
          })
          impressions = Math.max(impressions, insights.impressions ?? 0)
          saved = Math.max(saved, insights.saved ?? 0)
        } catch {
          /* keep stored metrics */
        }
      }
    }

    const { data: clicks } = post.marketing_entity_id
      ? await admin
          .from("link_clicks")
          .select("click_count")
          .eq("marketing_entity_id", post.marketing_entity_id)
      : { data: [] as { click_count: number }[] }

    const clickTotal = (clicks ?? []).reduce(
      (sum, row) => sum + (row.click_count ?? 0),
      0
    )

    const score = engagementScore({
      impressions,
      clicks: clickTotal,
      saved,
    })

    evaluated.push({
      postId: post.id,
      formulaId: typeof day?.formula_id === "string" ? day.formula_id : null,
      hook: typeof day?.hook === "string" ? day.hook : null,
      score,
      impressions,
      clicks: clickTotal,
    })
  }

  if (evaluated.length === 0) {
    return { entityId, postsEvaluated: 0, skipped: "no_metrics" }
  }

  const avg =
    evaluated.reduce((sum, row) => sum + row.score, 0) / Math.max(1, evaluated.length)

  for (const row of evaluated) {
    if (!row.formulaId) continue
    const ratio = avg > 0 ? row.score / avg : 1
    if (ratio >= 1.25) {
      await adjustFormulaWeight({
        supabase: admin,
        entityId,
        formulaId: row.formulaId,
        outcome: "win",
      })
    } else if (ratio <= 0.75) {
      await adjustFormulaWeight({
        supabase: admin,
        entityId,
        formulaId: row.formulaId,
        outcome: "loss",
      })
    }
  }

  const { object } = await generateObjectWithFallback({
    schema: takeawaySchema,
    schemaName: "MetricsTakeaway",
    schemaDescription: "Autonomous marketer insights from recent post performance",
    temperature: 0.4,
    maxOutputTokens: 800,
    prompt: [
      `Entity ${entityId} — analyze the last 7 days of published scheduled posts.`,
      `Average engagement score: ${avg.toFixed(1)}`,
      `Per-post samples: ${JSON.stringify(evaluated.slice(0, 12))}`,
      `Return concrete hook/vibe/formula guidance for the next campaign timeline.`,
    ].join("\n"),
  })

  const takeawayText = [
    object.summary,
    object.winning_patterns.length
      ? `Winning: ${object.winning_patterns.join(" · ")}`
      : "",
    object.anti_patterns.length
      ? `Avoid: ${object.anti_patterns.join(" · ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")

  const programId =
    programDays?.[0] && typeof programDays[0].program_id === "string"
      ? programDays[0].program_id
      : null

  const { data: inserted, error: insertError } = await admin
    .from("campaign_takeaways")
    .insert({
      entity_id: entityId,
      program_id: programId,
      metric_summary: { evaluated, averageScore: avg } as Json,
      ai_takeaway: takeawayText,
      applied: true,
    })
    .select("id")
    .single()

  if (insertError) throw new Error(insertError.message)

  await appendAutonomousMemory({
    supabase: admin,
    entityId,
    text: takeawayText,
  })

  // Warm cache for planner (optional read path uses loadBrainTakeawaysForEntity)
  await loadBrainTakeawaysForEntity(admin, entityId, 5)

  return {
    entityId,
    postsEvaluated: evaluated.length,
    takeawayId: inserted.id,
  }
}

export async function syncAndLearnAllEntities(admin: SupabaseClient): Promise<{
  entities: number
  results: SyncAndLearnResult[]
}> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: entityRows } = await admin
    .from("scheduled_posts")
    .select("entity_id")
    .eq("status", "published")
    .gte("published_at", since)

  const entityIds = [
    ...new Set((entityRows ?? []).map((row) => row.entity_id).filter(Boolean)),
  ]

  const results: SyncAndLearnResult[] = []
  for (const entityId of entityIds.slice(0, 20)) {
    try {
      results.push(await syncAndLearnForEntity(admin, entityId))
    } catch (error) {
      results.push({
        entityId,
        postsEvaluated: 0,
        skipped: error instanceof Error ? error.message : "learn_failed",
      })
    }
  }

  return { entities: entityIds.length, results }
}

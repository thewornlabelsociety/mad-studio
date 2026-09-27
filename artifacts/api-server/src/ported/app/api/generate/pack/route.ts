import { HttpResponse } from "@server/http-response"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { buildCampaignPackPrompt } from "@/lib/ai/prompts"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import {
  multiplexerIntentSchema,
  type MultiplexerIntent,
} from "@/lib/campaigns/multiplexer"
import {
  campaignPackSchema,
  generatePackRequestSchema,
  packToAssetPack,
} from "@/lib/campaigns/pack-schema"
import { buildStudioContext } from "@/lib/campaigns/pack-hydrate"
import {
  cleanHashtags,
  dedupeSentences,
  scrubCopyMarkers,
  scrubInlineHashtags,
  stripBareUrls,
  stripInternalMarkers,
} from "@/lib/copy/caption-hygiene"
import { packToStudioPreview } from "@/lib/campaigns/studio-preview"
import type { Json } from "@/lib/database.types"
import { scrubAgencyLeak } from "@/lib/inventory/context-hooks"
import {
  buildFudiRedirectSlugSeed,
  isFudiStudioEntity,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

function shuffleTake<T>(items: T[], count: number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

function humanizeRouteError(error: unknown): { message: string; status: number } {
  const raw =
    error instanceof Error ? error.message : "Failed to generate campaign pack."
  const lower = raw.toLowerCase()

  if (
    lower.includes("api key") ||
    lower.includes("google_generative_ai") ||
    lower.includes("not configured") ||
    lower.includes("401") ||
    lower.includes("permission denied")
  ) {
    return { message: "SYSTEM HALTED. Check Gemini Key.", status: 500 }
  }

  if (
    lower.includes("high demand") ||
    lower.includes("all model endpoints unavailable") ||
    lower.includes("resource_exhausted") ||
    lower.includes("overloaded")
  ) {
    return {
      message:
        "SYSTEM HALTED. Gemini is under high demand — all fallbacks exhausted. Retry in a moment.",
      status: 503,
    }
  }

  if (
    lower.includes("is not found") ||
    lower.includes("not supported for generatecontent") ||
    lower.includes("configured ai models are unavailable")
  ) {
    return {
      message:
        "SYSTEM HALTED. Model ID not supported — update AI_PRIMARY_MODEL / AI_FALLBACK_MODELS and restart the server.",
      status: 500,
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
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = generatePackRequestSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        {
          error:
            "Intent, objective, persona, and raw spark (8–500 chars) are required.",
        },
        { status: 400 }
      )
    }

    const {
      entityId,
      eventDescription,
      targetGoal,
      personaName,
      intent,
      attachedImageUrl,
      fudiTrack: requestedFudiTrack,
      visualDescription,
      concreteFeatures,
      aestheticTags,
    } = parsed.data

    const visualDropUrl =
      typeof attachedImageUrl === "string" &&
      /^https?:\/\//i.test(attachedImageUrl.trim())
        ? attachedImageUrl.trim()
        : null

    const groundedDescription =
      typeof visualDescription === "string" && visualDescription.trim()
        ? visualDescription.trim()
        : null
    const groundedFeatures = Array.isArray(concreteFeatures)
      ? concreteFeatures.map((row) => row.trim()).filter(Boolean).slice(0, 20)
      : []
    const groundedTags = Array.isArray(aestheticTags)
      ? aestheticTags.map((row) => row.trim()).filter(Boolean).slice(0, 12)
      : []

    const activeIntent: MultiplexerIntent =
      multiplexerIntentSchema.safeParse(intent).success
        ? (intent as MultiplexerIntent)
        : "Drive Sales"

    const { data: canAccess, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator", "viewer"],
      }
    )

    if (accessError) {
      return HttpResponse.json({ error: accessError.message }, { status: 500 })
    }

    if (!canAccess) {
      return HttpResponse.json(
        {
          error:
            "MULTI-BRAND ISOLATION ACTIVE. Verify Entity Access.",
        },
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
      return HttpResponse.json(
        { error: entityError?.message ?? "Entity not found." },
        { status: 404 }
      )
    }

    const entity = parseStudioEntity(entityRow)

    const fudiTrack: FudiAudienceTrack | null = isFudiStudioEntity({
      name: entity.name,
      industry: entity.industry,
    })
      ? requestedFudiTrack === "partners"
        ? "partners"
        : "diners"
      : null
    const fudiRedirectSlugSeed = fudiTrack
      ? buildFudiRedirectSlugSeed(fudiTrack, eventDescription)
      : null

    const [
      { data: learningRows },
      { data: documentRows },
      { data: quoteRows },
    ] = await Promise.all([
      supabase
        .from("campaigns")
        .select("ai_takeaway, outcome_rating, title")
        .eq("entity_id", entityId)
        .in("outcome_rating", ["winner", "loss"])
        .not("ai_takeaway", "is", null)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("entity_documents")
        .select("title, extracted_knowledge, created_at")
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("entity_customer_quotes")
        .select("quote_text, source")
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(40),
    ])

    const learningBlock =
      learningRows && learningRows.length > 0
        ? learningRows
            .map(
              (row) =>
                `- [${row.outcome_rating?.toUpperCase()}] ${row.title}: ${row.ai_takeaway}`
            )
            .join("\n")
        : "- No prior winner/loss takeaways yet. Default to proven direct-response clarity."

    const documentBlock =
      documentRows && documentRows.length > 0
        ? documentRows
            .map(
              (doc) =>
                `#### ${doc.title}\n${doc.extracted_knowledge.slice(0, 2500)}`
            )
            .join("\n\n")
        : "- No internal documents uploaded yet."

    const selectedQuotes = shuffleTake(quoteRows ?? [], 4)
    const quotesBlock =
      selectedQuotes.length > 0
        ? selectedQuotes
            .map(
              (quote) =>
                `- (${quote.source ?? "in_store"}) "${quote.quote_text}"`
            )
            .join("\n")
        : "- No customer quotes stored yet."

    const persona =
      entity.audience_segments.find(
        (segment) => segment.name === (personaName ?? "")
      ) ?? entity.audience_segments[0]

    const personaBlock = persona
      ? [
          `Name: ${persona.name} (${persona.role})`,
          `Pain: ${persona.pain}`,
          `Desire: ${persona.desire}`,
          `Trigger: ${persona.trigger}`,
          `Winning rebuttal: ${persona.winning_rebuttal}`,
        ].join("\n")
      : "General audience"

    const startTime = Date.now()
    const { object, model, usage } = await generateObjectWithFallback({
      schema: campaignPackSchema,
      schemaName: "CampaignPack",
      schemaDescription:
        "5-piece modular marketing asset pack with 2026 Algorithmic Targeting Triad — client brand voice only",
      prompt: buildCampaignPackPrompt({
        intent: activeIntent,
        objective: targetGoal,
        entity,
        contentPillars: entity.content_pillars,
        localContext: entity.local_context,
        personaBlock,
        documentBlock,
        quotesBlock,
        learningBlock,
        eventDescription,
        visualDropUrl,
        visualDescription: groundedDescription,
        concreteFeatures: groundedFeatures,
        aestheticTags: groundedTags,
        fudiTrack,
        fudiRedirectSlugSeed,
      }),
    })
    const durationMs = Date.now() - startTime

    const scrubCopy = (text: string) => scrubCopyMarkers(scrubAgencyLeak(text))
    const cleanTags = cleanHashtags(object.seo_caption.search_optimized_tags)
    for (const fallback of [
      entity.name,
      "shoplocal",
      "whangarei",
      "newarrival",
    ]) {
      if (cleanTags.length >= 3) break
      const [tag] = cleanHashtags([fallback])
      if (tag && !cleanTags.includes(tag)) cleanTags.push(tag)
    }

    const scrubbedPack = {
      ...object,
      campaign_title:
        stripInternalMarkers(object.campaign_title) || object.campaign_title,
      creative_hooks: object.creative_hooks
        ? {
            vibe_styling: scrubCopy(object.creative_hooks.vibe_styling),
            investment_condition: scrubCopy(
              object.creative_hooks.investment_condition
            ),
            local_instore: scrubCopy(object.creative_hooks.local_instore),
          }
        : undefined,
      algorithmic_signals: {
        ...object.algorithmic_signals,
        spoken_hook: scrubCopy(object.algorithmic_signals.spoken_hook),
        on_screen_text: scrubCopy(object.algorithmic_signals.on_screen_text),
      },
      seo_caption: {
        caption_body: dedupeSentences(
          scrubInlineHashtags(stripBareUrls(scrubCopy(object.seo_caption.caption_body)))
        ),
        search_optimized_tags: cleanTags,
      },
    }

    await recordOrchestratedCall({
      entityId,
      agentType: "multiplexer",
      agentLabel: "Campaign Multiplexer (5-Pack)",
      model,
      usage,
      durationMs,
      summary: eventDescription.slice(0, 140),
      metadata: {
        intent: activeIntent,
        objective: targetGoal,
        persona: persona?.name ?? null,
        has_visual: Boolean(visualDropUrl),
        has_visual_inspection: Boolean(groundedDescription),
        fudi_track: fudiTrack,
        redirect_slug_seed: fudiRedirectSlugSeed,
      },
    })

    // Persist draft campaign so the Studio Preview has a campaign_id
    let campaignId: string | null = null
    const { data: canEdit } = await supabase.rpc("has_entity_access", {
      ent_id: entityId,
      allowed_roles: ["entity_manager", "creator"],
    })

    if (canEdit) {
      const studioContext = buildStudioContext({
        eventDescription,
        intent: activeIntent,
        objective: targetGoal,
        personaName: persona?.name ?? null,
        fudiTrack,
      })

      const { data: saved } = await supabase
        .from("campaigns")
        .insert({
          entity_id: entityId,
          created_by: user.id,
          title: scrubbedPack.campaign_title,
          target_goal: targetGoal,
          target_segment: persona?.name ?? null,
          status: "draft",
          algorithmic_signals: scrubbedPack.algorithmic_signals as unknown as Json,
          asset_pack: packToAssetPack(scrubbedPack) as unknown as Json,
          media_url: visualDropUrl,
          studio_context: studioContext as unknown as Json,
        })
        .select("id")
        .single()

      campaignId = saved?.id ?? null
    }

    const preview = packToStudioPreview(scrubbedPack, campaignId)

    return HttpResponse.json({
      pack: scrubbedPack,
      preview,
      campaignId,
      intent: activeIntent,
      attachedImageUrl: visualDropUrl,
      fudiTrack,
      redirectSlugSeed: fudiRedirectSlugSeed,
    })
  } catch (error) {
    const { message, status } = humanizeRouteError(error)
    return HttpResponse.json({ error: message }, { status })
  }
}

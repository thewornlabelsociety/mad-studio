import { loadBrainTakeawaysForEntity } from "@/lib/campaigns/brain-takeaways"
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
  packToAssetPack,
  type CampaignPack,
  type GeneratePackRequest,
} from "@/lib/campaigns/pack-schema"
import { buildStudioContext, campaignRowToPack } from "@/lib/campaigns/pack-hydrate"
import { packToStudioPreview } from "@/lib/campaigns/studio-preview"
import type { Json } from "@/lib/database.types"
import { scrubAgencyLeak } from "@/lib/inventory/context-hooks"
import { isFudiHospitalityEntity } from "@/lib/studio/fudi-platform"
import {
  buildFudiRedirectSlugSeed,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"
import {
  TemplateIsolationError,
  buildAttributionColumns,
  buildTemplateGuidancePromptBlock,
  findCampaignByGenerationKey,
  isDuplicateGenerationError,
  makeGenerationKeyForTemplate,
  resolveTemplateForGeneration,
  type ResolvedTemplateForGeneration,
} from "@/lib/templates/template-generation"
import type { SupabaseClient } from "@supabase/supabase-js"

function shuffleTake<T>(items: T[], count: number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, count)
}

export type GeneratedCampaignPack = {
  pack: CampaignPack
  preview: ReturnType<typeof packToStudioPreview>
  campaignId: string | null
  intent: MultiplexerIntent
  attachedImageUrl: string | null
  fudiTrack: FudiAudienceTrack | null
  redirectSlugSeed: string | null
  /** Present when generation reused an idempotent template key. */
  reusedExistingCampaign?: boolean
  templateAttribution?: {
    template_instance_id: string
    template_version_id: string
    template_generation_key: string
  } | null
}

function scrubPack(object: CampaignPack): CampaignPack {
  return {
    ...object,
    creative_hooks: object.creative_hooks
      ? {
          vibe_styling: scrubAgencyLeak(object.creative_hooks.vibe_styling),
          investment_condition: scrubAgencyLeak(
            object.creative_hooks.investment_condition
          ),
          local_instore: scrubAgencyLeak(object.creative_hooks.local_instore),
        }
      : undefined,
    algorithmic_signals: {
      ...object.algorithmic_signals,
      spoken_hook: scrubAgencyLeak(object.algorithmic_signals.spoken_hook),
      on_screen_text: scrubAgencyLeak(object.algorithmic_signals.on_screen_text),
    },
    seo_caption: {
      ...object.seo_caption,
      caption_body: scrubAgencyLeak(object.seo_caption.caption_body),
    },
  }
}

export async function generateCampaignPackCore(input: {
  supabase: SupabaseClient
  userId: string
  data: GeneratePackRequest
  persistCampaign?: boolean
}): Promise<GeneratedCampaignPack> {
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
    templateInstanceId,
  } = input.data

  const visualDropUrl =
    typeof attachedImageUrl === "string" && /^https?:\/\//i.test(attachedImageUrl.trim())
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

  const activeIntent: MultiplexerIntent = multiplexerIntentSchema.safeParse(intent).success
    ? (intent as MultiplexerIntent)
    : "Drive Sales"

  const { data: entityRow, error: entityError } = await input.supabase
    .from("entities")
    .select(
      "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
    )
    .eq("id", entityId)
    .single()

  if (entityError || !entityRow) {
    throw new Error(entityError?.message ?? "Entity not found.")
  }

  const entity = parseStudioEntity(entityRow)

  let resolvedTemplate: ResolvedTemplateForGeneration | null = null
  let generationKey: string | null = null
  let templateGuidance: string | null = null
  let templateAttribution: GeneratedCampaignPack["templateAttribution"] = null

  if (templateInstanceId) {
    try {
      resolvedTemplate = await resolveTemplateForGeneration({
        supabase: input.supabase,
        entityId,
        templateInstanceId,
      })
    } catch (error) {
      if (error instanceof TemplateIsolationError) throw error
      throw error
    }
    generationKey = makeGenerationKeyForTemplate({
      entityId,
      template: resolvedTemplate,
      eventDescription,
      targetGoal,
      intent: activeIntent,
      personaName,
    })
    templateGuidance = buildTemplateGuidancePromptBlock(resolvedTemplate)
    templateAttribution = buildAttributionColumns(resolvedTemplate, generationKey)

    const existing = await findCampaignByGenerationKey({
      supabase: input.supabase,
      entityId,
      generationKey,
    })
    if (existing) {
      const reusedPack = campaignRowToPack({
        title: existing.title,
        algorithmic_signals: existing.algorithmic_signals,
        asset_pack: existing.asset_pack,
      })
      if (reusedPack) {
        const fudiTrackEarly: FudiAudienceTrack | null = isFudiHospitalityEntity({
          id: entity.id,
          name: entity.name,
          industry: entity.industry,
        })
          ? requestedFudiTrack === "partners"
            ? "partners"
            : "diners"
          : null
        return {
          pack: scrubPack(reusedPack),
          preview: packToStudioPreview(scrubPack(reusedPack), existing.id),
          campaignId: existing.id,
          intent: activeIntent,
          attachedImageUrl: existing.media_url ?? visualDropUrl,
          fudiTrack: fudiTrackEarly,
          redirectSlugSeed: fudiTrackEarly
            ? buildFudiRedirectSlugSeed(fudiTrackEarly, eventDescription)
            : null,
          reusedExistingCampaign: true,
          templateAttribution,
        }
      }
    }
  }

  const fudiTrack: FudiAudienceTrack | null = isFudiHospitalityEntity({
    id: entity.id,
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

  const [brainTakeaways, { data: documentRows }, { data: quoteRows }] =
    await Promise.all([
    loadBrainTakeawaysForEntity(input.supabase, entityId, 5),
    input.supabase
      .from("entity_documents")
      .select("title, extracted_knowledge, created_at")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(3),
    input.supabase
      .from("entity_customer_quotes")
      .select("quote_text, source")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(40),
  ])

  const learningBlock =
    brainTakeaways.length > 0
      ? brainTakeaways.map((line) => `- ${line}`).join("\n")
      : "- No prior winner/loss takeaways yet. Default to proven direct-response clarity."

  const documentBlock =
    documentRows && documentRows.length > 0
      ? documentRows
          .map(
            (doc) => `#### ${doc.title}\n${doc.extracted_knowledge.slice(0, 2500)}`
          )
          .join("\n\n")
      : "- No internal documents uploaded yet."

  const selectedQuotes = shuffleTake(quoteRows ?? [], 4)
  const quotesBlock =
    selectedQuotes.length > 0
      ? selectedQuotes
          .map((quote) => `- (${quote.source ?? "in_store"}) "${quote.quote_text}"`)
          .join("\n")
      : "- No customer quotes stored yet."

  const persona =
    entity.audience_segments.find((segment) => segment.name === (personaName ?? "")) ??
    entity.audience_segments[0]

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
      templateGuidance,
    }),
  })
  const durationMs = Date.now() - startTime

  const scrubbedPack = scrubPack(object)

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
      template_instance_id: resolvedTemplate?.instanceId ?? null,
      template_version_id: resolvedTemplate?.versionId ?? null,
    },
  })

  let campaignId: string | null = null
  let reusedExistingCampaign = false
  const shouldPersist = input.persistCampaign !== false

  if (shouldPersist) {
    const { data: canEdit } = await input.supabase.rpc("has_entity_access", {
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

      const insertPayload = {
        entity_id: entityId,
        created_by: input.userId,
        title: scrubbedPack.campaign_title,
        target_goal: targetGoal,
        target_segment: persona?.name ?? null,
        status: "draft" as const,
        algorithmic_signals: scrubbedPack.algorithmic_signals as unknown as Json,
        asset_pack: packToAssetPack(scrubbedPack) as unknown as Json,
        media_url: visualDropUrl,
        studio_context: studioContext as unknown as Json,
        ...(templateAttribution ?? {}),
      }

      const { data: saved, error: saveError } = await input.supabase
        .from("campaigns")
        .insert(insertPayload)
        .select("id")
        .single()

      if (saveError) {
        if (
          generationKey &&
          isDuplicateGenerationError(saveError)
        ) {
          const existing = await findCampaignByGenerationKey({
            supabase: input.supabase,
            entityId,
            generationKey,
          })
          if (existing) {
            campaignId = existing.id
            reusedExistingCampaign = true
            const reusedPack = campaignRowToPack({
              title: existing.title,
              algorithmic_signals: existing.algorithmic_signals,
              asset_pack: existing.asset_pack,
            })
            if (reusedPack) {
              const scrubbedReuse = scrubPack(reusedPack)
              return {
                pack: scrubbedReuse,
                preview: packToStudioPreview(scrubbedReuse, existing.id),
                campaignId: existing.id,
                intent: activeIntent,
                attachedImageUrl: existing.media_url ?? visualDropUrl,
                fudiTrack,
                redirectSlugSeed: fudiRedirectSlugSeed,
                reusedExistingCampaign: true,
                templateAttribution,
              }
            }
          }
        }
        // Attribution columns missing (pre-migration): retry without them once.
        const missingAttribution =
          saveError.message.toLowerCase().includes("template_instance_id") ||
          saveError.message.toLowerCase().includes("template_generation_key") ||
          saveError.message.toLowerCase().includes("template_version_id")
        if (missingAttribution && templateAttribution) {
          const { data: savedLegacy } = await input.supabase
            .from("campaigns")
            .insert({
              entity_id: entityId,
              created_by: input.userId,
              title: scrubbedPack.campaign_title,
              target_goal: targetGoal,
              target_segment: persona?.name ?? null,
              status: "draft",
              algorithmic_signals:
                scrubbedPack.algorithmic_signals as unknown as Json,
              asset_pack: packToAssetPack(scrubbedPack) as unknown as Json,
              media_url: visualDropUrl,
              studio_context: studioContext as unknown as Json,
            })
            .select("id")
            .single()
          campaignId = savedLegacy?.id ?? null
          templateAttribution = null
        } else if (!campaignId) {
          throw new Error(saveError.message)
        }
      } else {
        campaignId = saved?.id ?? null
      }
    }
  }

  const preview = packToStudioPreview(scrubbedPack, campaignId)

  return {
    pack: scrubbedPack,
    preview,
    campaignId,
    intent: activeIntent,
    attachedImageUrl: visualDropUrl,
    fudiTrack,
    redirectSlugSeed: fudiRedirectSlugSeed,
    reusedExistingCampaign,
    templateAttribution,
  }
}

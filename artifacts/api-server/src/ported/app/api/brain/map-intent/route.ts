import { NextResponse } from "next/server"

import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import {
  buildMapIntentOptionLabels,
  coerceMapIntentResult,
  mapIntentModelSchema,
  mapIntentRequestSchema,
  mapIntentRetailTopicSchema,
} from "@/lib/studio/map-intent"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

function coerceRetailTopic(
  raw: {
    listingVibe: string
    contentPillar: string
    customListingVibe?: string | null
    customContentPillar?: string | null
  },
  options: { listingVibes: string[]; pillars: string[] }
): Pick<
  import("@/lib/studio/map-intent").MapIntentResult,
  | "listingVibe"
  | "listingVibeIsCustom"
  | "contentPillar"
  | "contentPillarIsCustom"
  | "dropKind"
  | "dropTypeCustom"
  | "personaId"
  | "hookBlueprintId"
  | "ctaId"
> {
  const full = coerceMapIntentResult(
    {
      dropType: "",
      listingVibe: raw.listingVibe,
      contentPillar: raw.contentPillar,
      audiencePersona: "",
      hookBlueprint: "",
      cta: "",
      customListingVibe: raw.customListingVibe,
      customContentPillar: raw.customContentPillar,
    },
    {
      listingVibes: options.listingVibes,
      pillars: options.pillars,
      audiencePersonas: [],
      hookBlueprints: [],
      ctas: [],
    },
    {
      personaIdsByName: {},
      hookIdsByLabel: {},
      ctaIdsByLabel: {},
      dropIdsByLabel: {},
    }
  )
  return {
    dropKind: null,
    dropTypeCustom: null,
    listingVibe: full.listingVibe,
    listingVibeIsCustom: full.listingVibeIsCustom,
    contentPillar: full.contentPillar,
    contentPillarIsCustom: full.contentPillarIsCustom,
    personaId: "",
    hookBlueprintId: "",
    ctaId: "",
  }
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

    const parsed = mapIntentRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    const {
      entityId,
      visualDescription,
      activeBrand,
      aestheticTags,
      concreteFeatures,
      optionSource,
      retailTopicOnly,
      audienceToneCue,
      postFocusLabel,
      stillPhotoCount,
      brandProfileId,
    } = parsed.data

    const { availableOptions, maps } = buildMapIntentOptionLabels(optionSource)

    if (
      !visualDescription.trim() &&
      aestheticTags.length === 0 &&
      concreteFeatures.length === 0
    ) {
      return NextResponse.json(
        { error: "Run media inspect on Step 1 before auto-suggesting intent." },
        { status: 400 }
      )
    }

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: entityRow } = await supabase
      .from("entities")
      .select(
        "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
      )
      .eq("id", entityId)
      .maybeSingle()
    const entity = entityRow ? parseStudioEntity(entityRow) : null
    const profile = resolveIndustryProfile({
      name: entity?.name ?? activeBrand,
      industry: entity?.industry ?? "",
    })

    const optionsJson = JSON.stringify(
      retailTopicOnly
        ? {
            listingVibes: availableOptions.listingVibes,
            pillars: availableOptions.pillars,
          }
        : availableOptions,
      null,
      2
    )
    const visualContext = [
      `Active brand: ${activeBrand.trim() || "Unknown"}`,
      profile.multiplexerBias
        ? `Brand marketing rules:\n${profile.multiplexerBias}`
        : "",
      entity?.brand_identity.tone
        ? `Brand tone: ${entity.brand_identity.tone}`
        : "",
      audienceToneCue?.trim()
        ? `Operator-selected audience tone (do not contradict): ${audienceToneCue.trim()}`
        : "",
      postFocusLabel?.trim()
        ? `Operator post focus: ${postFocusLabel.trim()}`
        : "",
      stillPhotoCount != null && stillPhotoCount >= 2
        ? `This post has ${stillPhotoCount} still photos (carousel / brand promo — not a single SKU listing). Pick pillar/vibe for a collection edit, not item-level size/brand copy.`
        : stillPhotoCount === 1
          ? "Single hero still — may be one piece or a styled shot; prefer pillar over inventing SKU details."
          : "",
      visualDescription.trim()
        ? `Visual description:\n${visualDescription.trim()}`
        : "",
      aestheticTags.length
        ? `Aesthetic tags: ${aestheticTags.join(", ")}`
        : "",
      concreteFeatures.length
        ? `Concrete features:\n- ${concreteFeatures.join("\n- ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    const systemRetail = [
      "You map fashion/retail media to the best content pillar and listing vibe only.",
      "Return exact labels from the provided lists when possible.",
      "If nothing fits, use \"Custom...\" and put a short operator-facing label in the custom* field.",
      "Never invent designer names, sizes, or prices not visible in the visual context.",
      "For carousels and multi-image promos, choose brand/collection pillars — not single-item consignment hooks.",
    ].join(" ")

    const systemFull = [
      "You are a senior brand director. Map the visual to the single best label in each dropdown category.",
      "Return an exact label from each list when possible — do not paraphrase.",
      "If the media strongly calls for an angle not listed, set the field to exactly \"Custom...\" and put the proposed label in the matching custom* field.",
      "Never invent prices, SKUs, sizes, or designer names not supported by the visual context.",
      profile.id === "worn_label" || brandProfileId === "worn_label"
        ? "Worn Label Society: prefer Shop by Vibe / collection pillars for multi-piece or editorial shots; reserve item-level hooks only when one garment is clearly hero."
        : "",
    ]
      .filter(Boolean)
      .join(" ")

    if (retailTopicOnly) {
      const { object } = await generateObjectWithFallback({
        schema: mapIntentRetailTopicSchema,
        schemaName: "IntentMapRetailTopic",
        schemaDescription:
          "Map visual media to content pillar and listing vibe only",
        temperature: 0.15,
        maxOutputTokens: 350,
        system: systemRetail,
        prompt: [
          visualContext,
          "",
          "availableOptions (choose one label per category):",
          optionsJson,
        ].join("\n"),
      })

      const result = coerceRetailTopic(object, {
        listingVibes: availableOptions.listingVibes,
        pillars: availableOptions.pillars,
      })
      return NextResponse.json(result)
    }

    const { object } = await generateObjectWithFallback({
      schema: mapIntentModelSchema,
      schemaName: "IntentMapFromMedia",
      schemaDescription:
        "Map visual media context to the best dropdown label in each intent category",
      temperature: 0.15,
      maxOutputTokens: 600,
      system: systemFull,
      prompt: [
        visualContext,
        "",
        "availableOptions (choose one label per category):",
        optionsJson,
      ].join("\n"),
    })

    const result = coerceMapIntentResult(object, availableOptions, maps)

    if (!result.personaId || !result.hookBlueprintId || !result.ctaId) {
      return NextResponse.json(
        {
          error:
            "Brain DNA is missing personas, hook blueprints, or CTAs — complete entity setup first.",
        },
        { status: 422 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Intent mapping failed."
    console.error("[brain/map-intent]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { HttpResponse } from "@server/http-response"

import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import {
  buildMapIntentOptionLabels,
  coerceMapIntentResult,
  mapIntentModelSchema,
  mapIntentRequestSchema,
} from "@/lib/studio/map-intent"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = mapIntentRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return HttpResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    const {
      entityId,
      visualDescription,
      activeBrand,
      aestheticTags,
      concreteFeatures,
      optionSource,
    } = parsed.data

    const { availableOptions, maps } = buildMapIntentOptionLabels(optionSource)

    if (
      !visualDescription.trim() &&
      aestheticTags.length === 0 &&
      concreteFeatures.length === 0
    ) {
      return HttpResponse.json(
        { error: "Run media inspect on Step 1 before auto-suggesting intent." },
        { status: 400 }
      )
    }

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const optionsJson = JSON.stringify(availableOptions, null, 2)
    const visualContext = [
      `Active brand: ${activeBrand.trim() || "Unknown"}`,
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

    const { object } = await generateObjectWithFallback({
      schema: mapIntentModelSchema,
      schemaName: "IntentMapFromMedia",
      schemaDescription:
        "Map visual media context to the best dropdown label in each intent category",
      temperature: 0.2,
      maxOutputTokens: 600,
      system: [
        "You are a senior brand director. Review the visual description of the uploaded media and map it to the single most logical option in each provided dropdown category.",
        "If the media strongly calls for an angle not listed, set the field to exactly \"Custom...\" and put the proposed label in the matching custom* field (customDropType, customListingVibe, or customContentPillar).",
        "For audiencePersona, hookBlueprint, and cta, return an exact label from the list when possible.",
        "Prioritize acute audience pains and logical conversion paths for this brand.",
      ].join("\n"),
      prompt: [
        visualContext,
        "",
        "availableOptions (choose one label per category):",
        optionsJson,
      ].join("\n"),
    })

    const result = coerceMapIntentResult(object, availableOptions, maps)

    if (!result.personaId || !result.hookBlueprintId || !result.ctaId) {
      return HttpResponse.json(
        {
          error:
            "Brain DNA is missing personas, hook blueprints, or CTAs — complete entity setup first.",
        },
        { status: 422 }
      )
    }

    return HttpResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Intent mapping failed."
    console.error("[brain/map-intent]", error)
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}

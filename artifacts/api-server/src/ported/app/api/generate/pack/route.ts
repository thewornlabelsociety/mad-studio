import { HttpResponse as NextResponse } from "@server/http-response"

import { generateCampaignPackCore } from "@/lib/campaigns/generate-campaign-pack-core"
import { generatePackRequestSchema } from "@/lib/campaigns/pack-schema"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = generatePackRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Intent, objective, persona, and raw spark (8–500 chars) are required.",
        },
        { status: 400 }
      )
    }

    const { data: canAccess, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: parsed.data.entityId,
        allowed_roles: ["entity_manager", "creator", "viewer"],
      }
    )

    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 })
    }

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "MULTI-BRAND ISOLATION ACTIVE. Verify Entity Access.",
        },
        { status: 403 }
      )
    }

    const generated = await generateCampaignPackCore({
      supabase,
      userId: user.id,
      data: parsed.data,
    })

    return NextResponse.json({
      pack: generated.pack,
      preview: generated.preview,
      campaignId: generated.campaignId,
      intent: generated.intent,
      attachedImageUrl: generated.attachedImageUrl,
      fudiTrack: generated.fudiTrack,
      redirectSlugSeed: generated.redirectSlugSeed,
      reusedExistingCampaign: generated.reusedExistingCampaign ?? false,
      templateAttribution: generated.templateAttribution ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate campaign pack."
    if (/cross-entity template/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    const humanized = humanizeRouteError(error)
    return NextResponse.json(
      { error: humanized.message },
      { status: humanized.status }
    )
  }
}

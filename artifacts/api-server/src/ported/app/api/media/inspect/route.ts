import { HttpResponse } from "@server/http-response"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { mediaInspectRequestSchema } from "@/lib/media/inspect-schema"
import { inspectMediaVisuals } from "@/lib/media/vision-inspect"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = mediaInspectRequestSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "mediaUrl and entityId are required." },
        { status: 400 }
      )
    }

    const { mediaUrl, mediaType, entityId, frameDataUrl } = parsed.data

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
        { error: "You do not have access to this brand." },
        { status: 403 }
      )
    }

    const { data: entity } = await supabase
      .from("entities")
      .select("name, industry")
      .eq("id", entityId)
      .maybeSingle()

    const start = Date.now()
    const inspection = await inspectMediaVisuals({
      mediaUrl,
      mediaType,
      frameDataUrl,
      brandHint: entity
        ? `${entity.name}${entity.industry ? ` · ${entity.industry}` : ""}`
        : null,
    })
    const durationMs = Date.now() - start

    await recordOrchestratedCall({
      entityId,
      agentType: "media_inspect",
      agentLabel: "Media Vision Inspect",
      model: {
        raw: process.env.AI_PRIMARY_MODEL?.trim() || "gemini-2.5-flash",
        provider: "google",
        modelId: "gemini-2.5-flash",
      },
      usage: null,
      durationMs,
      summary: inspection.visualDescription.slice(0, 140),
      metadata: {
        media_type: mediaType,
        aesthetic_tags: inspection.aestheticTags,
        feature_count: inspection.concreteFeatures.length,
      },
    }).catch(() => undefined)

    return HttpResponse.json({
      ok: true,
      visualDescription: inspection.visualDescription,
      aestheticTags: inspection.aestheticTags,
      concreteFeatures: inspection.concreteFeatures,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Media inspection failed."
    const lower = message.toLowerCase()
    const status =
      lower.includes("api key") || lower.includes("unauthorized")
        ? 500
        : lower.includes("keyframe") || lower.includes("mediaurl")
          ? 400
          : 500
    return HttpResponse.json({ error: message }, { status })
  }
}

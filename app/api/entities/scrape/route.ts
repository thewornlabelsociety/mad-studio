import { NextResponse } from "next/server"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { extractDnaFromWebsite } from "@/lib/entities/extract-dna"
import { scrapeRequestSchema } from "@/lib/entities/dna-schema"
import type { Json } from "@/lib/database.types"
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = scrapeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Brand name and website URL are required." },
        { status: 400 }
      )
    }

    const entityId =
      typeof body.entityId === "string" ? body.entityId : null
    const shouldPersist =
      Boolean(entityId) && body.persist !== false

    if (entityId) {
      const { data: canAccess, error: accessError } = await supabase.rpc(
        "has_entity_access",
        {
          ent_id: entityId,
          allowed_roles: ["entity_manager", "creator", "viewer"],
        }
      )
      if (accessError) {
        return NextResponse.json(
          { error: accessError.message },
          { status: 500 }
        )
      }
      if (!canAccess) {
        return NextResponse.json(
          {
            error: "MULTI-BRAND ISOLATION ACTIVE. Verify Entity Access.",
          },
          { status: 403 }
        )
      }
    }

    const startTime = Date.now()
    const { dna, sourceUrl, model, usage } = await extractDnaFromWebsite(
      parsed.data
    )
    const durationMs = Date.now() - startTime

    let persisted = false
    if (entityId && shouldPersist) {
      const { data: canEdit } = await supabase.rpc("has_entity_access", {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator"],
      })
      if (canEdit) {
        const { error: persistError } = await supabase
          .from("entities")
          .update({
            website_url: sourceUrl,
            industry: dna.industry,
            business_model: dna.business_model,
            brand_identity: dna.brand_identity as unknown as Json,
            audience_segments: dna.audience_segments as unknown as Json,
            value_propositions: dna.value_propositions as unknown as Json,
            conversion_goals: dna.conversion_goals as unknown as Json,
            content_pillars: dna.content_pillars as unknown as Json,
            local_context: dna.local_context as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entityId)

        if (persistError) {
          return NextResponse.json(
            { error: `DNA extracted but failed to lock into Brain: ${persistError.message}` },
            { status: 500 }
          )
        }
        persisted = true
      }
    }

    if (entityId) {
      await recordOrchestratedCall({
        entityId,
        agentType: "website_intake",
        agentLabel: "Deep Brain Intake (Scraper)",
        model,
        usage,
        durationMs,
        summary: sourceUrl,
        metadata: { brandName: parsed.data.name, persisted },
      })
    }

    return NextResponse.json({
      dna,
      sourceUrl,
      persisted,
      matrix: {
        Voice_Tone: dna.brand_identity.tone,
        Visual_Vibe: dna.brand_identity.visual_vibe,
        Core_Objective: dna.brand_identity.core_mission,
        Forbidden_Words: dna.brand_identity.forbidden_words,
        Vibes: dna.brand_identity.vibes ?? [],
        Visual_Presets: dna.brand_identity.visual_presets ?? null,
        Audience_Pains: dna.audience_segments.map((s) => s.pain),
        Audience_Desires: dna.audience_segments.map((s) => s.desire),
      },
    })
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "Failed to analyze website and extract DNA."
    const lower = raw.toLowerCase()
    const message =
      lower.includes("api key") || lower.includes("not configured")
        ? "SYSTEM HALTED. Check Gemini Key."
        : raw

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

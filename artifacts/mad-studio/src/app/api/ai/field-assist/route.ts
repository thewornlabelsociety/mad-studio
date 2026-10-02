import { NextResponse } from "next/server"
import { z } from "zod"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { cleanHashtags } from "@/lib/copy/caption-hygiene"
import { scrubAgencyLeak } from "@/lib/inventory/context-hooks"
import { OPTIMIZATION_TAG_MAX } from "@/lib/inventory/optimization-tags"
import { repairFudiCaptionDoubling } from "@/lib/inventory/sop"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const bodySchema = z.object({
  entityId: z.string().uuid(),
  marketingEntityId: z.string().uuid().optional().nullable(),
  field: z.enum(["hook", "caption", "tags"]),
  headline: z.string().max(500),
  caption: z.string().max(4000),
  visualDescription: z.string().max(2000).optional().nullable(),
  listingVibe: z.string().max(120).optional().nullable(),
  existingTags: z.array(z.string().max(40)).max(20).optional(),
})

const copyResultSchema = z.object({
  variations: z.array(z.string().min(1).max(600)).min(1).max(4),
})

const tagsResultSchema = z.object({
  tags: z.array(z.string().min(2).max(30)).min(1).max(10),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }

    const {
      entityId,
      field,
      headline,
      caption,
      visualDescription,
      listingVibe,
      existingTags = [],
    } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: entityRow, error: entityError } = await supabase
      .from("entities")
      .select(
        "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
      )
      .eq("id", entityId)
      .single()
    if (entityError || !entityRow) {
      return NextResponse.json({ error: "Entity not found." }, { status: 404 })
    }

    const entity = parseStudioEntity(entityRow)

    if (field === "tags") {
      const prompt = [
        `Brand: ${entity.name} (${entity.industry}).`,
        "Suggest Instagram / TikTok discovery hashtags for this post.",
        "Return lowercase tokens without # — letters and numbers only, 2–30 chars each.",
        `Provide ${OPTIMIZATION_TAG_MAX} tags max, mix brand, locality, product, and search intent.`,
        "Do not repeat tags already selected.",
        listingVibe ? `Listing vibe: ${listingVibe}` : "",
        visualDescription ? `Visual: ${visualDescription}` : "",
        `Hook: ${headline}`,
        `Caption: ${caption}`,
        existingTags.length > 0
          ? `Already selected: ${existingTags.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")

      const started = Date.now()
      const { object, model, usage } = await generateObjectWithFallback({
        schema: tagsResultSchema,
        schemaName: "StudioTagAssist",
        schemaDescription: "Hashtag suggestions for studio publish footer",
        temperature: 0.55,
        maxOutputTokens: 400,
        system: [
          `You suggest social hashtags for "${entity.name}".`,
          `Tone / niche: ${entity.brand_identity.tone || "direct"}.`,
          `Forbidden words (never as tags): ${(entity.brand_identity.forbidden_words ?? []).join(", ") || "(none)"}.`,
          "JSON only — tags array of strings, no # prefix.",
        ].join("\n"),
        prompt,
      })

      await recordOrchestratedCall({
        entityId,
        agentType: "website_intake",
        agentLabel: "Studio tag assist",
        model,
        usage,
        durationMs: Date.now() - started,
        summary: "Field assist · tags",
        metadata: { field: "tags" },
      })

      const tags = cleanHashtags(
        object.tags.map((row) => row.trim()).filter(Boolean),
        { max: OPTIMIZATION_TAG_MAX }
      )

      if (tags.length === 0) {
        return NextResponse.json(
          { error: "Model returned no usable tags. Try again or add manually." },
          { status: 422 }
        )
      }

      return NextResponse.json({ tags })
    }

    const current = field === "hook" ? headline : caption

    const prompt = [
      `Brand: ${entity.name} (${entity.industry}).`,
      `Generate 3 alternate ${field === "hook" ? "on-screen hooks (≤120 chars)" : "caption bodies"} for the same post.`,
      "Keep tone on-brand; do not invent discounts or SKUs.",
      "If writing caption: NEVER repeat the hook verbatim as the opening sentence.",
      visualDescription ? `Visual: ${visualDescription}` : "",
      `Current hook: ${headline}`,
      `Current caption: ${caption}`,
    ]
      .filter(Boolean)
      .join("\n")

    const started = Date.now()
    const { object, model, usage } = await generateObjectWithFallback({
      schema: copyResultSchema,
      schemaName: "StudioFieldAssist",
      schemaDescription: "Field-level creative variations for studio customize",
      temperature: 0.65,
      maxOutputTokens: 700,
      system: [
        `You write social copy alternates for "${entity.name}".`,
        `Tone: ${entity.brand_identity.tone || "direct"}.`,
        `Forbidden: ${(entity.brand_identity.forbidden_words ?? []).join(", ") || "(none)"}.`,
        "Return JSON only — variations array of strings, no markdown fences.",
      ].join("\n"),
      prompt,
    })

    await recordOrchestratedCall({
      entityId,
      agentType: "website_intake",
      agentLabel: "Studio field assist",
      model,
      usage,
      durationMs: Date.now() - started,
      summary: `Field assist · ${field}`,
      metadata: { field },
    })

    const variations = object.variations
      .map((row) => scrubAgencyLeak(row.trim()))
      .filter(Boolean)
      .map((row) =>
        field === "caption"
          ? repairFudiCaptionDoubling(headline, row, null)
          : row
      )
      .filter((row) => row.toLowerCase() !== current.trim().toLowerCase())

    if (variations.length === 0) {
      return NextResponse.json({
        variations: [
          scrubAgencyLeak(`${current.trim()} · alt`.slice(0, 200)),
        ],
      })
    }

    return NextResponse.json({ variations: variations.slice(0, 3) })
  } catch (error) {
    console.error("[ai/field-assist]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Field assist failed." },
      { status: 500 }
    )
  }
}

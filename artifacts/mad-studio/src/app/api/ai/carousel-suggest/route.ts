import { NextResponse } from "next/server"
import { z } from "zod"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { fudiPlatformDefinitionBlock } from "@/lib/studio/fudi-platform"
import { createClient } from "@/lib/supabase/server"
import {
  FUDI_CAROUSEL_ANGLE_ARCHETYPES,
  FUDI_CAROUSEL_BANNED_TERMS,
} from "@/lib/today/carousel-suggest-types"
import { sanitizeCarouselAngle } from "@/lib/today/carousel-suggest-sanitize"

export const runtime = "nodejs"
export const maxDuration = 45

const itemSchema = z.object({
  title: z.string().min(1).max(200),
  venue: z.string().max(120).optional(),
  price: z.string().max(40).optional(),
  description: z.string().max(800).optional(),
  imageUrl: z.string().url().max(2000),
})

const bodySchema = z.object({
  entityId: z.string().uuid(),
  items: z.array(itemSchema).min(2).max(10),
})

const angleSchema = z.object({
  id: z.string().min(1).max(40),
  angle_title: z.string().min(1).max(120),
  reasoning: z.string().min(1).max(500),
  hero_item_index: z.number().int().min(0),
  recommended_order: z.array(z.number().int().min(0)),
  hook: z.string().min(1).max(220),
  slide_subheads: z.array(z.string().max(80)),
  caption: z.string().min(1).max(2200),
  tags: z.array(z.string().max(40)).min(3).max(12),
})

const resultSchema = z.object({
  angles: z.array(angleSchema).length(3),
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

    const { entityId, items } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: entityRow, error: entityError } = await supabase
      .from("entities")
      .select("id, name, industry, brand_identity")
      .eq("id", entityId)
      .single()
    if (entityError || !entityRow) {
      return NextResponse.json({ error: "Entity not found." }, { status: 404 })
    }

    const entity = parseStudioEntity(entityRow)
    const itemCount = items.length
    const indexLegend = items
      .map(
        (row, index) =>
          `[${index}] ${row.title}${row.venue ? ` @ ${row.venue}` : ""}${row.price ? ` · ${row.price}` : ""}`
      )
      .join("\n")

    const started = Date.now()
    const { object, model, usage } = await generateObjectWithFallback({
      schema: resultSchema,
      schemaName: "FudiCarouselPromoAngles",
      schemaDescription:
        "Three IG/Facebook carousel promo angles with slide order and copy",
      temperature: 0.6,
      maxOutputTokens: 2200,
      system: [
        `You are FÜDI Content Intelligence for "${entity.name}" — local food map marketing, not SaaS.`,
        fudiPlatformDefinitionBlock(),
        `Tone: ${entity.brand_identity.tone || "kinetic, neighbourhood-led, appetizing"}.`,
        `NEVER use: ${FUDI_CAROUSEL_BANNED_TERMS.join(", ")}.`,
        `Do not repeat the hook sentence verbatim at the start of caption.`,
        `Return exactly 3 angles mapped to these archetypes (one each): ${FUDI_CAROUSEL_ANGLE_ARCHETYPES.join(" | ")}.`,
        `recommended_order must be a permutation of item indices 0..${itemCount - 1} (hero slide first in order).`,
        `slide_subheads length must equal ${itemCount} (short on-slide labels).`,
        `tags: lowercase Instagram tokens without #, max 8.`,
      ].join("\n"),
      prompt: [
        `Build 3 carousel promo angles for a ${itemCount}-slide IG/Facebook feed carousel.`,
        "",
        "Items (index → title):",
        indexLegend,
        "",
        "Extra context per item:",
        ...items.map(
          (row, index) =>
            `[${index}] ${row.description?.trim() ? row.description.slice(0, 280) : "(no description)"}`
        ),
        "",
        "JSON only — angles array of 3 objects with id, angle_title, reasoning, hero_item_index, recommended_order, hook, slide_subheads, caption, tags.",
      ].join("\n"),
    })

    try {
      await recordOrchestratedCall({
        entityId,
        agentType: "website_intake",
        agentLabel: "Carousel promo suggest",
        model,
        usage,
        durationMs: Date.now() - started,
        summary: `Carousel angles · ${itemCount} slides`,
        metadata: { slideCount: itemCount },
      })
    } catch (meterError) {
      console.warn("[ai/carousel-suggest] metering skipped", meterError)
    }

    const angles = object.angles.map((row) =>
      sanitizeCarouselAngle(row, itemCount)
    )

    return NextResponse.json({ angles })
  } catch (error) {
    console.error("[ai/carousel-suggest]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Carousel suggest failed.",
      },
      { status: 500 }
    )
  }
}

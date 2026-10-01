import { NextResponse } from "next/server"
import { z } from "zod"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { scrubAgencyLeak } from "@/lib/inventory/context-hooks"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import {
  repairFudiCaptionDoubling,
  stripDuplicateHookFromCaption,
} from "@/lib/inventory/sop"
import {
  fudiPlatformDefinitionBlock,
  isFudiHospitalityEntity,
} from "@/lib/studio/fudi-platform"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 45

const bodySchema = z.object({
  entityId: z.string().uuid(),
  marketingEntityId: z.string().uuid(),
  headline: z.string().max(500),
  caption: z.string().max(4000),
  visualDescription: z.string().max(2000).optional().nullable(),
})

const enhanceResultSchema = z.object({
  headline: z.string().min(1).max(500),
  caption: z.string().min(1).max(2200),
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
      marketingEntityId,
      headline,
      caption,
      visualDescription,
    } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: entityRow, error: entityError } = await supabase
      .from("entities")
      .select(
        "id, name, industry, brand_identity, content_pillars, local_context"
      )
      .eq("id", entityId)
      .single()
    if (entityError || !entityRow) {
      return NextResponse.json({ error: "Entity not found." }, { status: 404 })
    }

    const { data: itemRow, error: itemError } = await supabase
      .from("marketing_entities")
      .select("id, title, description, brand, price")
      .eq("id", marketingEntityId)
      .eq("entity_id", entityId)
      .single()
    if (itemError || !itemRow) {
      return NextResponse.json({ error: "Inventory item not found." }, { status: 404 })
    }

    const entity = parseStudioEntity(entityRow)
    const profile = resolveIndustryProfile({
      name: entity.name,
      industry: entity.industry,
    })
    const isFudi = isFudiHospitalityEntity({
      id: entity.id,
      name: entity.name,
      industry: entity.industry,
    })

    const started = Date.now()
    const { object, model, usage } = await generateObjectWithFallback({
      schema: enhanceResultSchema,
      schemaName: "InventoryCaptionEnhance",
      schemaDescription:
        "Polished social hook + caption for an inventory workbench drop",
      temperature: 0.55,
      maxOutputTokens: 900,
      system: [
        `You polish Instagram/Facebook copy for "${entity.name}".`,
        `Brand tone: ${entity.brand_identity.tone || profile.tone}`,
        `Forbidden: ${(entity.brand_identity.forbidden_words ?? []).join(", ") || "(none)"}`,
        profile.multiplexerBias,
        isFudi ? fudiPlatformDefinitionBlock() : "",
        `Rules:`,
        `- Keep factual details from the listing (dish, venue, price, event) — do not invent SKUs or discounts.`,
        `- headline = short on-screen hook (≤ 160 chars). caption = feed/story body only — NEVER repeat the hook sentence at the start of caption.`,
        `- No agency jargon (synergy, funnel, ROAS, MAD Studio). No "link in bio" unless brand is fashion retail.`,
        `- Preserve optimization hashtags if present at end of caption; do not add raw URLs.`,
      ]
        .filter(Boolean)
        .join("\n"),
      prompt: [
        `Listing title: ${itemRow.title}`,
        itemRow.brand ? `Venue/brand: ${itemRow.brand}` : null,
        itemRow.description
          ? `Source description: ${itemRow.description.slice(0, 1200)}`
          : null,
        visualDescription?.trim()
          ? `Media inspection: ${visualDescription.trim().slice(0, 800)}`
          : null,
        ``,
        `Current hook: ${headline.trim() || "(empty)"}`,
        `Current caption: ${caption.trim() || "(empty)"}`,
        ``,
        `Return an improved hook + caption ready to paste into the workbench.`,
      ]
        .filter(Boolean)
        .join("\n"),
    })

    try {
      await recordOrchestratedCall({
        entityId,
        agentType: "website_intake",
        agentLabel: "Inventory caption enhance",
        model,
        usage,
        durationMs: Date.now() - started,
        summary: `Enhanced caption for ${itemRow.title.slice(0, 48)}`,
        metadata: { marketingEntityId },
      })
    } catch (meterError) {
      console.warn("[inventory/enhance-caption] metering skipped", meterError)
    }

    const nextHeadline = scrubAgencyLeak(object.headline)
    let nextCaption = scrubAgencyLeak(object.caption)
    nextCaption = stripDuplicateHookFromCaption(nextHeadline, nextCaption)
    if (isFudi) {
      nextCaption = repairFudiCaptionDoubling(
        nextHeadline,
        nextCaption,
        itemRow.description
      )
    }

    if (!nextHeadline.trim() || !nextCaption.trim()) {
      return NextResponse.json(
        { error: "Model returned empty copy after cleanup." },
        { status: 422 }
      )
    }

    return NextResponse.json({ headline: nextHeadline, caption: nextCaption })
  } catch (error) {
    console.error("[inventory/enhance-caption]", error)
    const message =
      error instanceof Error ? error.message : "Caption enhance failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

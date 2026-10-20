import { NextResponse } from "next/server"
import { z } from "zod"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { cleanHashtags } from "@/lib/copy/caption-hygiene"
import { mapMarketingEntityRow } from "@/lib/inventory/types"
import { extractSizeLabel } from "@/lib/marketing/story-presets"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 45

const bodySchema = z.object({
  entityId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(10),
  format: z.enum(["carousel", "story", "reel"]),
  /** The Art director's angle, e.g. "Shop by vibe: Quiet Luxury". */
  angle: z.string().max(200).optional().nullable(),
})

const resultSchema = z.object({
  headline: z.string().min(1).max(80),
  instagram: z.string().min(1).max(2000),
  facebook: z.string().min(1).max(2000),
  tiktok: z.string().min(1).max(600),
  hashtags: z.array(z.string().min(2).max(30)).max(12),
})

const ITEM_SELECT =
  "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"

/**
 * Brain team · Copywriter: captions for one planned post, in the brand's own
 * voice, using only the real details of the items in it.
 */
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
    const { entityId, itemIds, format, angle } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [{ data: entityRow }, { data: itemRows }, { data: quoteRows }] =
      await Promise.all([
        supabase
          .from("entities")
          .select(
            "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
          )
          .eq("id", entityId)
          .single(),
        supabase
          .from("marketing_entities")
          .select(ITEM_SELECT)
          .eq("entity_id", entityId)
          .in("id", itemIds),
        supabase
          .from("entity_customer_quotes")
          .select("quote_text")
          .eq("entity_id", entityId)
          .order("created_at", { ascending: false })
          .limit(8),
      ])
    if (!entityRow) {
      return NextResponse.json({ error: "Brand not found." }, { status: 404 })
    }
    const items = (itemRows ?? []).map(mapMarketingEntityRow)
    if (items.length === 0) {
      return NextResponse.json({ error: "Those items weren't found." }, { status: 404 })
    }

    const entity = parseStudioEntity(entityRow)
    const identity = entity.brand_identity
    const quotes = (quoteRows ?? [])
      .map((row) => row.quote_text)
      .filter((text): text is string => Boolean(text))

    // Only real facts go to the model.
    const facts = items.map((item, index) => {
      const brand =
        item.copy_draft?.metadata?.post_brand?.trim() || item.brand?.trim() || null
      const size = extractSizeLabel(item)
      const description =
        item.copy_draft?.metadata?.post_description?.trim() ||
        item.description?.slice(0, 400) ||
        null
      return [
        `${index + 1}. ${item.title}`,
        brand ? `   Brand: ${brand}` : null,
        size ? `   Size: ${size}` : null,
        item.price != null ? `   Price: $${item.price}` : null,
        item.vibe ? `   Vibe: ${item.vibe}` : null,
        description ? `   Details: ${description}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    })

    const formatLine =
      format === "carousel"
        ? "A swipeable carousel — one caption that introduces the set and invites a swipe."
        : format === "reel"
          ? "A short Reel — punchy caption, first line hooks in under 8 words."
          : "An Instagram Story with a shop-link sticker — very short, point to the link."

    const system = [
      `You are the Copywriter on ${entity.name}'s marketing team (${entity.industry}).`,
      `Brand voice: ${identity.tone || "warm, direct"}.`,
      identity.tagline ? `Tagline: ${identity.tagline}` : "",
      identity.visual_vibe ? `Look and feel: ${identity.visual_vibe}` : "",
      `Never use these words: ${(identity.forbidden_words ?? []).join(", ") || "(none)"}.`,
      quotes.length > 0
        ? `How real customers talk about the brand:\n${quotes.map((q) => `- "${q}"`).join("\n")}`
        : "",
      "Rules:",
      "- Use ONLY the item facts given. Never invent brands, sizes, prices, materials, condition or stock levels.",
      "- If a fact is missing, leave it out — don't guess.",
      "- Be specific: name the real brands (and sizes or prices where they help) from the items — shoppers search by brand and size. Avoid generic lines like \"curated set\" or \"discover our collection\".",
      "- No emoji. No hashtags inside the captions (return them separately, lowercase, no #).",
      "- Instagram: 1–4 short lines. Facebook: a little warmer, can be 2–5 lines. TikTok: one or two short lines.",
      "- Headline: the on-image line, 2–6 words.",
    ]
      .filter(Boolean)
      .join("\n")

    const prompt = [
      `Post: ${formatLine}`,
      angle ? `Angle from the Art director: ${angle}` : "",
      `Items (${items.length}):`,
      facts.join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n")

    const started = Date.now()
    const { object, model, usage } = await generateObjectWithFallback({
      schema: resultSchema,
      schemaName: "BrainCopywriterPost",
      schemaDescription: "Captions for one planned social post",
      temperature: 0.7,
      maxOutputTokens: 1200,
      system,
      prompt,
    })

    await recordOrchestratedCall({
      entityId,
      agentType: "website_intake",
      agentLabel: "Brain team · Copywriter",
      model,
      usage,
      durationMs: Date.now() - started,
      summary: `Copywriter · ${format} · ${items.length} item${items.length === 1 ? "" : "s"}`,
      metadata: { format, itemCount: items.length },
    })

    return NextResponse.json({
      headline: object.headline.trim(),
      instagram: object.instagram.trim(),
      facebook: object.facebook.trim(),
      tiktok: object.tiktok.trim(),
      hashtags: cleanHashtags(object.hashtags, { max: 12 }),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The Copywriter couldn't write this one.",
      },
      { status: 500 }
    )
  }
}

import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai"
import { z } from "zod"

import { resolvePrimaryLanguageModel } from "@/lib/ai/orchestrator"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const chatBodySchema = z.object({
  entityId: z.string().uuid().optional(),
  id: z.string().optional(),
  messages: z.array(z.unknown()).min(1),
})

function buildBrandDirectorSystem(input: {
  name: string
  industry: string
  brandIdentity: {
    tone: string
    core_mission: string
    visual_vibe: string
    forbidden_words: string[]
    tagline?: string
  }
  contentPillars: string[]
  audienceSegments: Array<{
    name: string
    role: string
    pain: string
    desire: string
    trigger: string
    winning_rebuttal: string
  }>
  localContext: string[]
  quotes: string[]
  memories: string[]
}): string {
  const segments = input.audienceSegments
    .map(
      (seg) =>
        `- ${seg.name} (${seg.role}): pain="${seg.pain}"; desire="${seg.desire}"; trigger="${seg.trigger}"; rebuttal="${seg.winning_rebuttal}"`
    )
    .join("\n")

  return [
    `You are the Brand Director for "${input.name}" (${input.industry}).`,
    `Speak ONLY in this brand's exact customer-facing persona — never as MAD Studio, an agency, or a marketing ops platform.`,
    `Never use agency jargon (funnels, ROAS, CTR, synergy, multiplexers, DNA Lab, asset packs).`,
    ``,
    `### Brand identity`,
    `- Tone: ${input.brandIdentity.tone || "(not set)"}`,
    `- Mission: ${input.brandIdentity.core_mission || "(not set)"}`,
    `- Visual vibe: ${input.brandIdentity.visual_vibe || "(not set)"}`,
    `- Tagline: ${input.brandIdentity.tagline || "(not set)"}`,
    `- Forbidden words: ${(input.brandIdentity.forbidden_words ?? []).join(", ") || "(none)"}`,
    ``,
    `### Content pillars`,
    input.contentPillars.length > 0
      ? input.contentPillars.map((p) => `- ${p}`).join("\n")
      : "- (none yet)",
    ``,
    `### Audience segments`,
    segments || "- (none yet)",
    ``,
    `### Local / seasonal context`,
    input.localContext.length > 0
      ? input.localContext.map((c) => `- ${c}`).join("\n")
      : "- (none yet)",
    ``,
    `### Real customer quotes (Street Ear)`,
    input.quotes.length > 0
      ? input.quotes.map((q) => `- "${q}"`).join("\n")
      : "- (no quotes yet)",
    ``,
    `### Learned memory rules`,
    input.memories.length > 0
      ? input.memories.map((m) => `- ${m}`).join("\n")
      : "- (no memories yet)",
    ``,
    `### Response style`,
    `- Be specific, opinionated, and actionable.`,
    `- When suggesting angles or hooks, number them clearly so operators can save or send to Studio.`,
    `- Stay in brand voice even when brainstorming or critiquing.`,
  ].join("\n")
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const raw = await request.json()
    const parsed = chatBodySchema.safeParse(raw)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid chat payload." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const entityId =
      parsed.data.entityId ??
      (typeof (raw as { body?: { entityId?: string } }).body?.entityId ===
      "string"
        ? (raw as { body: { entityId: string } }).body.entityId
        : null)

    if (!entityId) {
      return new Response(
        JSON.stringify({ error: "entityId is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const { data: canAccess, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator", "viewer"],
      }
    )
    if (accessError || !canAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { data: entityRow, error: entityError } = await supabase
      .from("entities")
      .select(
        "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
      )
      .eq("id", entityId)
      .single()

    if (entityError || !entityRow) {
      return new Response(JSON.stringify({ error: "Entity not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    const entity = parseStudioEntity(entityRow)

    const [{ data: quoteRows }, { data: memoryRows }] = await Promise.all([
      supabase
        .from("entity_customer_quotes")
        .select("quote_text")
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("campaigns")
        .select("ai_takeaway, title")
        .eq("entity_id", entityId)
        .not("ai_takeaway", "is", null)
        .order("updated_at", { ascending: false })
        .limit(10),
    ])

    const system = buildBrandDirectorSystem({
      name: entity.name,
      industry: entity.industry,
      brandIdentity: entity.brand_identity,
      contentPillars: entity.content_pillars,
      audienceSegments: entity.audience_segments,
      localContext: entity.local_context,
      quotes: (quoteRows ?? [])
        .map((row) => row.quote_text)
        .filter((text): text is string => Boolean(text)),
      memories: (memoryRows ?? [])
        .map((row) => row.ai_takeaway)
        .filter((text): text is string => Boolean(text)),
    })

    const messages = parsed.data.messages as UIMessage[]
    const { model } = resolvePrimaryLanguageModel()

    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(messages),
      temperature: 0.7,
      maxOutputTokens: 2048,
      abortSignal: request.signal,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[brain/chat]", error)
    const message =
      error instanceof Error ? error.message : "Brand Director chat failed."
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

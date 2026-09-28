import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai"
import { z } from "zod"

import { resolvePrimaryLanguageModel } from "@/lib/ai/orchestrator"
import { assertBrainEntityAccess } from "@/lib/brain/entity-access"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { createClient } from "@/lib/supabase/server"

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>
) {
  return new Response(
    JSON.stringify({
      error,
      ...extra,
    }),
    { status, headers: { "Content-Type": "application/json" } }
  )
}

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
      return jsonError(401, "Unauthorized")
    }

    const raw = await request.json()
    const parsed = chatBodySchema.safeParse(raw)
    if (!parsed.success) {
      return jsonError(400, "Invalid chat payload.", {
        detail: parsed.error.flatten(),
      })
    }

    const entityId =
      parsed.data.entityId ??
      (typeof (raw as { body?: { entityId?: string } }).body?.entityId ===
      "string"
        ? (raw as { body: { entityId: string } }).body.entityId
        : null)

    if (!entityId) {
      return jsonError(400, "entityId is required.")
    }

    const access = await assertBrainEntityAccess({
      supabase,
      userId: user.id,
      entityId,
      mode: "view",
    })
    if (!access.ok) {
      return jsonError(access.status, access.error)
    }

    const { data: entityRow, error: entityError } = await supabase
      .from("entities")
      .select(
        "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
      )
      .eq("id", entityId)
      .single()

    if (entityError || !entityRow) {
      return jsonError(404, entityError?.message ?? "Entity not found.")
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

    let model
    try {
      const resolved = resolvePrimaryLanguageModel()
      model = resolved.model
    } catch (modelError) {
      const message =
        modelError instanceof Error
          ? modelError.message
          : "AI model is not configured."
      return jsonError(503, message, { code: "AI_MODEL_CONFIG" })
    }

    let modelMessages
    try {
      modelMessages = await convertToModelMessages(messages)
    } catch (convertError) {
      const message =
        convertError instanceof Error
          ? convertError.message
          : "Could not read chat messages."
      return jsonError(400, message, { code: "INVALID_MESSAGES" })
    }

    const result = streamText({
      model,
      system,
      messages: modelMessages,
      temperature: 0.7,
      maxOutputTokens: 2048,
      abortSignal: request.signal,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[brain/chat]", error)
    const message =
      error instanceof Error ? error.message : "Brand Director chat failed."
    const name = error instanceof Error ? error.name : "Error"
    return jsonError(500, message, {
      code: "BRAIN_CHAT_FAILED",
      name,
      ...(process.env.NODE_ENV !== "production"
        ? { stack: error instanceof Error ? error.stack : String(error) }
        : {}),
    })
  }
}

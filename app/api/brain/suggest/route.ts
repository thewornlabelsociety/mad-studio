import { NextResponse } from "next/server"
import { z } from "zod"

import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import type { Json } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const suggestBodySchema = z.object({
  entityId: z.string().uuid(),
  suggestionText: z.string().trim().min(3).max(2000),
})

const suggestIntentSchema = z.object({
  targetField: z.enum([
    "forbidden_words",
    "tone",
    "memory_rule",
    "local_context",
  ]),
  updatedValue: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  actionSummary: z
    .string()
    .min(1)
    .max(200)
    .describe("Short human-readable description of the DNA change applied"),
})

export type SuggestIntent = z.infer<typeof suggestIntentSchema>

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function mergeUnique(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...existing, ...incoming]) {
    const trimmed = item.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
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

    const raw = await request.json()
    const parsed = suggestBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "entityId and suggestionText are required." },
        { status: 400 }
      )
    }

    const { entityId, suggestionText } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError || !canEdit) {
      return NextResponse.json(
        { error: "You need creator or manager access to teach the Brain." },
        { status: 403 }
      )
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

    const { object: intent } = await generateObjectWithFallback({
      schema: suggestIntentSchema,
      schemaName: "BrainSuggestionIntent",
      schemaDescription:
        "Classify a plain-English brand instruction into a DNA field update",
      temperature: 0.2,
      maxOutputTokens: 600,
      system: [
        `You route operator instructions into the brand Brain DNA for "${entity.name}".`,
        `Current tone: ${entity.brand_identity.tone || "(empty)"}`,
        `Current forbidden_words: ${(entity.brand_identity.forbidden_words ?? []).join(", ") || "(none)"}`,
        `Current local_context: ${entity.local_context.join("; ") || "(none)"}`,
        ``,
        `Classification rules:`,
        `- forbidden_words: negative rules, ban lists, "stop using X", "never say Y". updatedValue = array of words/phrases to ADD.`,
        `- tone: voice/tone adjustments ("more warm", "less salesy", "speak like…"). updatedValue = the NEW full tone string.`,
        `- local_context: seasonal focus, geography, tactics, campaigns-of-the-moment. updatedValue = array of short context notes to APPEND.`,
        `- memory_rule: lasting creative/strategy lesson to remember (hooks that worked, audience insight). updatedValue = a single concise memory string.`,
        `actionSummary must be a short past-tense confirmation suitable for a toast, e.g. "Added 'curated' to forbidden words".`,
      ].join("\n"),
      prompt: `Operator instruction:\n"""${suggestionText}"""`,
    })

    const now = new Date().toISOString()
    let actionTaken = intent.actionSummary

    if (intent.targetField === "forbidden_words") {
      const additions = Array.isArray(intent.updatedValue)
        ? intent.updatedValue
        : [intent.updatedValue]
      const nextForbidden = mergeUnique(
        entity.brand_identity.forbidden_words ?? [],
        additions
      )
      const nextIdentity = {
        ...entity.brand_identity,
        forbidden_words: nextForbidden,
      }
      const { error } = await supabase
        .from("entities")
        .update({
          brand_identity: nextIdentity as unknown as Json,
          updated_at: now,
        })
        .eq("id", entityId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      actionTaken =
        intent.actionSummary ||
        `Added ${additions.join(", ")} to forbidden words`
    } else if (intent.targetField === "tone") {
      const nextTone = Array.isArray(intent.updatedValue)
        ? intent.updatedValue.join(", ")
        : intent.updatedValue
      const nextIdentity = {
        ...entity.brand_identity,
        tone: nextTone,
      }
      const { error } = await supabase
        .from("entities")
        .update({
          brand_identity: nextIdentity as unknown as Json,
          updated_at: now,
        })
        .eq("id", entityId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      actionTaken = intent.actionSummary || `Updated tone to: ${nextTone}`
    } else if (intent.targetField === "local_context") {
      const additions = Array.isArray(intent.updatedValue)
        ? intent.updatedValue
        : [intent.updatedValue]
      const nextLocal = mergeUnique(entity.local_context, additions)
      const { error } = await supabase
        .from("entities")
        .update({
          local_context: nextLocal as unknown as Json,
          updated_at: now,
        })
        .eq("id", entityId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      actionTaken =
        intent.actionSummary || `Added seasonal/local context: ${additions[0]}`
    } else {
      // memory_rule → campaigns.ai_takeaway memory vault row
      const memoryText = Array.isArray(intent.updatedValue)
        ? intent.updatedValue.join(" · ")
        : intent.updatedValue
      const { error } = await supabase.from("campaigns").insert({
        entity_id: entityId,
        created_by: user.id,
        title: `Brain Memory · ${memoryText.slice(0, 72)}`,
        target_goal: "memory_vault",
        status: "draft",
        outcome_rating: "winner",
        ai_takeaway: memoryText,
        studio_context: {
          source: "brain_suggest",
          suggestion: suggestionText,
        } as unknown as Json,
        updated_at: now,
      })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      actionTaken = intent.actionSummary || `Saved memory rule: ${memoryText}`
    }

    return NextResponse.json({
      ok: true,
      targetField: intent.targetField,
      actionTaken,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to teach the Brain."
    console.error("[brain/suggest]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

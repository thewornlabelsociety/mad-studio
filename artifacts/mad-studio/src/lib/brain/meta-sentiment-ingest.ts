import { createHmac, timingSafeEqual } from "crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

import { generateTextWithFallback } from "@/lib/ai/orchestrator"

export const STREET_EAR_CONTEXT_TAG = "street_ear_inbound"

const COMMENT_FIELDS = new Set(["comments", "live_comments", "mentions"])

const CUSTOMER_SERVICE_RE =
  /\b(where('s| is) my (order|food|delivery)|track(ing)? (my )?order|refund|return policy|customer service|speak to (a )?manager|wrong order|missing item|never arrived|still waiting|how long|call you|dm me|price\?|hours\?)\b/i

const SPAM_RE =
  /\b(follow( back| for)|check (my|out) (bio|profile)|http:\/\/|https:\/\/|www\.|promo code|giveaway|crypto|nft\b)\b/i

const STRONG_PRAISE_RE =
  /\b(best|amazing|incredible|delicious|obsessed|love this|favorite|favourite|goat|fire|10\/10|highly recommend|so good|can't wait to come back|legend|beautiful|stunning|perfect)\b/i

export type MetaCommentExtract = {
  igAccountId: string
  text: string
  username: string
  field: string
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret.trim()) {
    return false
  }
  const expected = createHmac("sha256", appSecret.trim())
    .update(rawBody, "utf8")
    .digest("hex")
  const provided = signatureHeader.slice("sha256=".length)
  try {
    const a = Buffer.from(provided, "utf8")
    const b = Buffer.from(expected, "utf8")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function extractMetaInstagramComments(payload: unknown): MetaCommentExtract[] {
  if (!payload || typeof payload !== "object") return []
  const root = payload as Record<string, unknown>
  const objectType = String(root.object ?? "")
  if (objectType !== "instagram" && objectType !== "page") return []

  const entries = Array.isArray(root.entry) ? root.entry : []
  const out: MetaCommentExtract[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue
    const entryRow = entry as Record<string, unknown>
    const igAccountId = String(entryRow.id ?? "").trim()
    if (!igAccountId) continue

    const changes = Array.isArray(entryRow.changes) ? entryRow.changes : []
    for (const change of changes) {
      if (!change || typeof change !== "object") continue
      const changeRow = change as Record<string, unknown>
      const field = String(changeRow.field ?? "").trim()
      if (!COMMENT_FIELDS.has(field)) continue

      const value = changeRow.value
      if (!value || typeof value !== "object") continue
      const valueRow = value as Record<string, unknown>

      const textRaw =
        typeof valueRow.text === "string"
          ? valueRow.text
          : typeof valueRow.message === "string"
            ? valueRow.message
            : ""
      const text = textRaw.trim()
      if (!text || text.length < 4) continue

      const from =
        valueRow.from && typeof valueRow.from === "object"
          ? (valueRow.from as Record<string, unknown>)
          : null
      const username =
        typeof from?.username === "string" && from.username.trim()
          ? from.username.trim()
          : "unknown"

      out.push({ igAccountId, text, username, field })
    }
  }

  return out
}

function regexSentimentFastPath(text: string): "positive" | "reject" | "review" {
  if (CUSTOMER_SERVICE_RE.test(text) || SPAM_RE.test(text)) return "reject"
  if (STRONG_PRAISE_RE.test(text) && text.length >= 12) return "positive"
  if (/^\W*\d+\W*$/.test(text)) return "reject"
  return "review"
}

export async function isGenuineBrandPraise(text: string): Promise<boolean> {
  const fast = regexSentimentFastPath(text)
  if (fast === "positive") return true
  if (fast === "reject") return false

  try {
    const { text: verdict } = await generateTextWithFallback({
      system:
        "You classify Instagram comments for a brand quote vault. Answer exactly YES or NO. YES only for spontaneous praise, compliments, or enthusiastic recommendations about the brand/product/experience. NO for customer service, logistics, pricing questions, complaints, spam, tags-only, or neutral comments.",
      prompt: `Comment:\n"""${text.slice(0, 500)}"""`,
      temperature: 0,
      maxOutputTokens: 8,
    })
    return /^yes\b/i.test(verdict.trim())
  } catch {
    return false
  }
}

export async function resolveEntityIdForInstagramAccount(
  admin: SupabaseClient,
  igAccountId: string
): Promise<string | null> {
  const id = igAccountId.trim()
  if (!id) return null

  const { data, error } = await admin
    .from("social_connections")
    .select("entity_id")
    .eq("platform", "instagram")
    .eq("account_id", id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.entity_id) return null
  return data.entity_id
}

export async function ingestStreetEarQuote(input: {
  admin: SupabaseClient
  entityId: string
  quoteText: string
  username: string
}): Promise<{ inserted: boolean; quoteId?: string; reason?: string }> {
  const quoteText = input.quoteText.trim()
  if (!quoteText) return { inserted: false, reason: "empty" }

  const { data: existing } = await input.admin
    .from("entity_customer_quotes")
    .select("id")
    .eq("entity_id", input.entityId)
    .eq("quote_text", quoteText)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return { inserted: false, reason: "duplicate", quoteId: existing.id }
  }

  const source = `Instagram Comment - @${input.username.replace(/^@/, "")}`

  const { data, error } = await input.admin
    .from("entity_customer_quotes")
    .insert({
      entity_id: input.entityId,
      quote_text: quoteText,
      source,
      customer_emotion: STREET_EAR_CONTEXT_TAG,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { inserted: false, reason: error?.message ?? "insert_failed" }
  }

  return { inserted: true, quoteId: data.id }
}

export async function processMetaSentimentWebhook(
  admin: SupabaseClient,
  payload: unknown
): Promise<{
  received: number
  ingested: number
  skipped: number
  results: Array<{ text: string; status: string }>
}> {
  const comments = extractMetaInstagramComments(payload)
  const results: Array<{ text: string; status: string }> = []
  let ingested = 0
  let skipped = 0

  for (const row of comments) {
    const entityId = await resolveEntityIdForInstagramAccount(
      admin,
      row.igAccountId
    )
    if (!entityId) {
      skipped += 1
      results.push({ text: row.text.slice(0, 80), status: "unknown_ig_account" })
      continue
    }

    const positive = await isGenuineBrandPraise(row.text)
    if (!positive) {
      skipped += 1
      results.push({ text: row.text.slice(0, 80), status: "filtered" })
      continue
    }

    const insert = await ingestStreetEarQuote({
      admin,
      entityId,
      quoteText: row.text,
      username: row.username,
    })

    if (insert.inserted) {
      ingested += 1
      results.push({ text: row.text.slice(0, 80), status: "ingested" })
    } else {
      skipped += 1
      results.push({
        text: row.text.slice(0, 80),
        status: insert.reason ?? "skipped",
      })
    }
  }

  return { received: comments.length, ingested, skipped, results }
}

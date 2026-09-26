import { z } from "zod"

export const MULTIPLEXER_INTENTS = [
  "Drive Sales",
  "Build Hype",
  "Get Inventory",
  "Teach AI",
] as const

export type MultiplexerIntent = (typeof MULTIPLEXER_INTENTS)[number]

export const INTENT_OBJECTIVES: Record<MultiplexerIntent, string[]> = {
  "Drive Sales": [
    "Increase Store Traffic",
    "Sell Through Drop",
    "Boost Average Order Value",
    "Clear Dead Stock Fast",
  ],
  "Build Hype": [
    "Tease Upcoming Drop",
    "Spark Waitlist Signups",
    "Amplify Social Proof",
    "Create FOMO Momentum",
  ],
  "Get Inventory": [
    "Attract Consignors / Suppliers",
    "Fill Open Slots",
    "Source Specific Categories",
    "Recruit Wholesale Partners",
  ],
  "Teach AI": [
    "Encode a Winning Angle",
    "Capture Customer Language",
    "Document Brand Truth",
    "Ban a Losing Angle",
  ],
}

export const multiplexerIntentSchema = z.enum(MULTIPLEXER_INTENTS)

export type SupabasePersona = {
  id: string
  name: string
  role: string
  desires: string
  triggers: string
  pain: string
  winning_rebuttal: string
}

export type MultiplexerInputs = {
  intent: MultiplexerIntent
  objective: string
  persona_id: string
  raw_spark: string
}

export type CampaignPackOutputView = {
  id: string | null
  teleprompter_script: string
  carousel_copy: string
  seo_captions: string
  email_drop: string
  json_payload: Record<string, unknown>
}

export function intentBiasCopy(intent: MultiplexerIntent): string {
  switch (intent) {
    case "Drive Sales":
      return "Optimize for conversion and immediate action. Hard CTAs, scarcity with integrity, clear next step."
    case "Build Hype":
      return "Optimize for anticipation and shareability. Tease, intrigue, and social proof — not hard sell."
    case "Get Inventory":
      return "Optimize for supplier/consignor acquisition. Speak to sellers' fears and payout clarity."
    case "Teach AI":
      return "Optimize for durable brand-memory content: phrasing, truths, and angles the Brain should reuse."
  }
}

/** @deprecated Prefer industryBiasCopy from lib/brands/industry-templates */
export { industryBiasCopy } from "@/lib/brands/industry-templates"

export function personasFromAudienceSegments(
  segments: Array<{
    name: string
    role: string
    pain: string
    desire: string
    trigger: string
    winning_rebuttal: string
  }>
): SupabasePersona[] {
  return segments.map((segment, index) => ({
    id: `persona-${index}-${slugify(segment.name)}`,
    name: segment.name,
    role: segment.role,
    desires: segment.desire,
    triggers: segment.trigger,
    pain: segment.pain,
    winning_rebuttal: segment.winning_rebuttal,
  }))
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

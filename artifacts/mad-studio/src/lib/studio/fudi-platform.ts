import { resolveIndustryProfile } from "@/lib/brands/industry-templates"

/** Canonical FÜDI brand entity in production Supabase. */
export const FUDI_ENTITY_ID = "ac5ec175-12c6-416e-9cce-fbcafee32b77"

export const FUDI_BRAND_COLORS = {
  canvas: "#0A0A0A",
  accent: "#CCFF00",
  pop: "#FF007F",
} as const

export const FUDI_HOSPITALITY_BANNED_TAGS = [
  "SYNERGY",
  "DISRUPT",
  "SAAS",
  "SOFTWARE",
  "CHEAP EATS",
  "VOUCHER CODE",
  "AGGREGATOR",
  "THIRD-PARTY DELIVERY",
] as const

const HOSPITALITY_INDUSTRY = /food|beverage|hospitality|restaurant|eatery|caf[eé]|dining/i

export function isFudiHospitalityEntity(input: {
  id?: string | null
  name?: string | null
  industry?: string | null
  slug?: string | null
}): boolean {
  if (input.id === FUDI_ENTITY_ID) return true
  const slug = (input.slug ?? "").trim().toLowerCase()
  if (slug === "fudi" || slug === "füdi") return true
  if (resolveIndustryProfile(input).id === "fudi") return true
  const industry = input.industry ?? ""
  if (HOSPITALITY_INDUSTRY.test(industry)) {
    const name = (input.name ?? "").toLowerCase()
    if (/fudi|füdi/.test(name)) return true
  }
  return false
}

export function fudiPlatformDefinitionBlock(): string {
  return [
    "### FÜDI PLATFORM DEFINITION",
    "FÜDI is a hospitality platform and social network ecosystem helping independent eateries own their digital presence, customer relationships, and direct trade (0% commission), while giving foodies one single place to discover local food, drops, events, and table ordering.",
    "",
    "### FÜDI MASTER RULE",
    "- Market the ecosystem; never recreate the feed.",
    "- Social posts create FOMO and urgency — the app is where discovery, deals, events, marketplace, and table ordering actually happen.",
    "",
    "### DYNAMIC CONTAINERS — DEALS & EVENTS",
    "- DO NOT invent generic discounts or hardcode fake promotions.",
    "- Wrap whatever deal, special, or event the operator provided in the spark (or synced feed item) in high-urgency, appetite-inducing framing.",
    "- Extract exact venue names and titles from the spark — never replace with placeholder brands.",
    "- Deals = immediate local drops or limited-quantity perks (never \"voucher code\", \"cheap eats\", \"discount coupon\", or third-party delivery comparisons).",
    "- Events = weekend social gatherings, food tours, or live pop-ups (never sterile registrations or webinar tone).",
    "- Dishes / kitchen passes = sensory first-bite hooks tied to the named eatery and dish.",
    "- Marketplace = maker-led pantry items — direct order on FÜDI Marketplace.",
    "",
    "### FÜDI BANNED WORDS (NEVER IN PUBLIC COPY)",
    FUDI_HOSPITALITY_BANNED_TAGS.map((tag) => `- #${tag}`).join("\n"),
  ].join("\n")
}

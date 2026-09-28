import { visualPresetsFromTheme } from "@/lib/brands/visual-presets"
import type { BrandIdentity, EntityDna } from "@/lib/entities/dna-schema"

export type IndustryTemplateId = "worn_label" | "fudi" | "generic"

export type StoryTemplateId =
  | "moody_noir_edit"
  | "fresh_bite_eatery"
  | "default"

export type BrandColorTheme = {
  id: string
  label: string
  /** Primary canvas / charcoal or cream */
  canvas: string
  /** Accent — emerald or terracotta */
  accent: string
  /** Secondary surface / bone or roast */
  ink: string
  /** Soft supporting tone */
  mist: string
  /** Readable text on canvas */
  onCanvas: string
  /** Readable text on accent */
  onAccent: string
}

export type IndustryBrandProfile = {
  id: IndustryTemplateId
  displayName: string
  matchNames: string[]
  matchIndustries: RegExp[]
  theme: BrandColorTheme
  tagline: string
  tone: string
  visualVibe: string
  coreMission: string
  vibeTags: string[]
  storyTemplate: StoryTemplateId
  locationFooter: string | null
  stickerCta: string
  shopLinkLabel: string
  multiplexerBias: string
  forbiddenWords: string[]
  valuePropositions: Record<string, string>
  contentPillars: string[]
}

const WORN_LABEL_THEME: BrandColorTheme = {
  id: "moody_obsidian",
  label: "Moody Obsidian",
  canvas: "#121211",
  accent: "#0F3B2E",
  ink: "#EDECE8",
  mist: "#2A2926",
  onCanvas: "#EDECE8",
  onAccent: "#EDECE8",
}

const FUDI_THEME: BrandColorTheme = {
  id: "kinetic_food",
  label: "Dark Kinetic Food Network",
  canvas: "#0A0A0A",
  accent: "#CCFF00",
  ink: "#FF007F",
  mist: "#1A1A1A",
  onCanvas: "#F5F5F5",
  onAccent: "#0A0A0A",
}

const GENERIC_THEME: BrandColorTheme = {
  id: "mad_neutral",
  label: "MAD Neutral",
  canvas: "#FFFFFF",
  accent: "#000000",
  ink: "#111111",
  mist: "#F5F5F5",
  onCanvas: "#111111",
  onAccent: "#FFFFFF",
}

export const WORN_LABEL_PROFILE: IndustryBrandProfile = {
  id: "worn_label",
  displayName: "Worn Label Society",
  matchNames: [
    "worn label society",
    "worn label",
    "wornlabelsociety",
    "wls",
  ],
  matchIndustries: [/fashion/i, /apparel/i, /consign/i, /vintage/i, /pre-?loved/i],
  theme: WORN_LABEL_THEME,
  tagline: "Less searching. Better finding",
  tone: "Understated, discerning, archival, elevated, effortlessly chic",
  visualVibe:
    "Moody Obsidian — dark charcoal canvas, emerald accents, bone typography; serif headlines and Shop by Vibe badges",
  coreMission:
    "Less searching. Better finding. Extending luxury fashion through verified consignment.",
  vibeTags: [
    "Quiet Luxury",
    "Modern Muse",
    "Euro Summer Escape",
    "Coastal Creative",
    "Street Archive",
  ],
  storyTemplate: "moody_noir_edit",
  locationFooter: "Worn Label Society • Whangārei",
  stickerCta: "Shop Here",
  shopLinkLabel: "Shop Here",
  multiplexerBias: [
    "Write as Worn Label Society — a high-end luxury fashion editorial / curated boutique catalog.",
    "Use understated, archival, discerning, quiet-luxury language.",
    "Contextualize garments within Shop by Vibe labels when natural: Quiet Luxury, Modern Muse, Euro Summer Escape, Coastal Creative, Street Archive.",
    "Carry the customer tagline “Less searching. Better finding” when it fits.",
    "Speak fabric, provenance, fit, condition, and scarcity with integrity — never agency pitch language.",
    "CTAs: boutique / Instagram Shop Here / in-store Whangārei — never fast-fashion urgency spam.",
  ].join(" "),
  forbiddenWords: [
    "MAD",
    "MAD Studio",
    "Agency",
    "Lowballers",
    "Cheap",
    "Thrifty",
    "Op-shop",
    "Disruptive",
    "Synergy",
    "Funnel",
    "cheap",
    "bargain bin",
    "fast fashion",
    "must-have!!!",
    "OMG",
    "slay",
  ],
  valuePropositions: {
    discovery: "Less searching. Better finding",
    curation: "Quality-screened pre-loved pieces by vibe",
    local: "Whangārei boutique with Instagram Shop Here flow",
  },
  contentPillars: [
    "Shop by Vibe edits",
    "New arrivals provenance",
    "In-store atmosphere",
    "Designer archive drops",
  ],
}

export const FUDI_PROFILE: IndustryBrandProfile = {
  id: "fudi",
  displayName: "FÜDI",
  matchNames: ["füdi", "fudi", "fuudi"],
  matchIndustries: [
    /food/i,
    /beverage/i,
    /hospitality/i,
    /eatery/i,
    /restaurant/i,
    /cafe/i,
  ],
  theme: FUDI_THEME,
  tagline: "One map for everything local food",
  tone: "Kinetic, appetizing, neighbourhood-led, anti-clutter — speak like locals, not SaaS",
  visualVibe:
    "Dark mode kinetic food tech — canvas #0A0A0A, acid lime #CCFF00, hot pink #FF007F accents. High-contrast dish photography, real kitchen passes, tactile table pucks.",
  coreMission:
    "Unify the local food network — dishes, live deals, weekend events, pantry marketplace, and tap-and-pay tables in one app (market the ecosystem; never recreate the feed).",
  vibeTags: [
    "Dish Drop",
    "Mid-Week Deal",
    "Weekend Event",
    "Pantry Maker",
    "Table Tap",
  ],
  storyTemplate: "fresh_bite_eatery",
  locationFooter: "FÜDI • Your town's live food map",
  stickerCta: "Open on FÜDI",
  shopLinkLabel: "View on FÜDI",
  multiplexerBias: [
    "FÜDI is the unified local food network — not a single-feature app.",
    "Market dishes, live deals, events, marketplace makers, and table menus as one ecosystem.",
    "Master law: market the ecosystem; never recreate the in-app feed.",
    "Extract exact venue names and offer titles from the operator spark verbatim.",
    "Deals = exclusive local drops or limited perks — never vouchers, discount codes, or coupon jargon.",
    "Events = weekend/evening social gatherings or food trails — never sterile registrations.",
    "Address app fatigue: one place instead of Google PDFs, Instagram scroll, Facebook flyers, and marked-up delivery apps.",
    "Sensory hooks: steam, crunch, pass timing, real plates — high-contrast dark-mode kinetic tone.",
  ].join(" "),
  forbiddenWords: [
    "SYNERGY",
    "DISRUPT",
    "SAAS",
    "SOFTWARE",
    "CHEAP EATS",
    "VOUCHER CODE",
    "AGGREGATOR",
    "THIRD-PARTY DELIVERY",
    "PROCESSED",
  ],
  valuePropositions: {
    unified: "One app for dishes, deals, events, marketplace, and tables",
    local: "Live map of what's actually happening in your town",
    trust: "Real kitchens, real drops — no platform clutter",
  },
  contentPillars: [
    "Fresh dish & pass drops",
    "Live mid-week deals",
    "Weekend events & tours",
    "Local pantry / makers",
    "Table tap & menus",
  ],
}

export const GENERIC_PROFILE: IndustryBrandProfile = {
  id: "generic",
  displayName: "Brand",
  matchNames: [],
  matchIndustries: [],
  theme: GENERIC_THEME,
  tagline: "",
  tone: "",
  visualVibe: "",
  coreMission: "",
  vibeTags: [],
  storyTemplate: "default",
  locationFooter: null,
  stickerCta: "Shop Now",
  shopLinkLabel: "Shop Now",
  multiplexerBias:
    "Keep copy on-brand for the entity industry. Prefer clear hooks, one CTA, and platform-native phrasing.",
  forbiddenWords: [],
  valuePropositions: {},
  contentPillars: [],
}

const PROFILES: IndustryBrandProfile[] = [
  WORN_LABEL_PROFILE,
  FUDI_PROFILE,
]

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function resolveIndustryProfile(input: {
  name?: string | null
  industry?: string | null
}): IndustryBrandProfile {
  const name = normalizeName(input.name ?? "")
  const industry = input.industry ?? ""

  for (const profile of PROFILES) {
    if (
      profile.matchNames.some((match) => {
        const normalized = normalizeName(match)
        return name === normalized || name.includes(normalized)
      })
    ) {
      return profile
    }
  }

  for (const profile of PROFILES) {
    if (profile.matchIndustries.some((pattern) => pattern.test(industry))) {
      return profile
    }
  }

  return GENERIC_PROFILE
}

export function industryBiasCopy(input: {
  name?: string | null
  industry?: string | null
}): string {
  return resolveIndustryProfile(input).multiplexerBias
}

/** Fill sparse DNA fields from the industry template without wiping operator edits. */
export function mergeIndustryDnaDefaults(
  entityName: string,
  industry: string,
  dna: Partial<EntityDna> & { brand_identity?: Partial<BrandIdentity> }
): {
  industry: string
  brand_identity: BrandIdentity
  value_propositions: Record<string, string>
  content_pillars: string[]
  local_context: string[]
} {
  const profile = resolveIndustryProfile({ name: entityName, industry })
  const identity: Partial<BrandIdentity> = dna.brand_identity ?? {}

  return {
    industry: industry.trim() || inferIndustryLabel(profile),
    brand_identity: {
      tone: identity.tone?.trim() || profile.tone,
      forbidden_words:
        identity.forbidden_words && identity.forbidden_words.length > 0
          ? identity.forbidden_words
          : profile.forbiddenWords,
      visual_vibe: identity.visual_vibe?.trim() || profile.visualVibe,
      core_mission: identity.core_mission?.trim() || profile.coreMission,
      vibes:
        identity.vibes && identity.vibes.length > 0
          ? identity.vibes
          : profile.vibeTags,
      tagline: identity.tagline?.trim() || profile.tagline,
      visual_presets:
        identity.visual_presets ?? visualPresetsFromTheme(profile.theme),
    },
    value_propositions:
      dna.value_propositions && Object.keys(dna.value_propositions).length > 0
        ? dna.value_propositions
        : profile.valuePropositions,
    content_pillars:
      dna.content_pillars && dna.content_pillars.length > 0
        ? dna.content_pillars
        : profile.contentPillars,
    local_context:
      dna.local_context && dna.local_context.length > 0
        ? dna.local_context
        : profile.locationFooter
          ? [profile.locationFooter, profile.tagline].filter(Boolean)
          : [],
  }
}

function inferIndustryLabel(profile: IndustryBrandProfile): string {
  switch (profile.id) {
    case "worn_label":
      return "Fashion / Apparel"
    case "fudi":
      return "Food & Beverage"
    default:
      return "Consumer Brand"
  }
}

export function pickDefaultVibeTag(
  profile: IndustryBrandProfile,
  seed?: string | null
): string | null {
  if (profile.vibeTags.length === 0) return null
  if (!seed) return profile.vibeTags[0] ?? null
  const lower = seed.toLowerCase()
  return (
    profile.vibeTags.find((tag) => lower.includes(tag.toLowerCase())) ??
    profile.vibeTags[0] ??
    null
  )
}

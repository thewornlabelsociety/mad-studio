import {
  resolveIndustryProfile,
} from "@/lib/brands/industry-templates"
import type { MultiplexerIntent } from "@/lib/campaigns/multiplexer"
import type { AudienceSegment } from "@/lib/entities/dna-schema"
import type {
  StudioEntityPresets,
  StudioHookChip,
  StudioIntentChip,
} from "@/lib/studio/entity-presets"
import { scrubAgencyLeak } from "@/lib/inventory/context-hooks"
import { fudiPlatformDefinitionBlock } from "@/lib/studio/fudi-platform"

export type FudiAudienceTrack = "diners" | "partners"

export type FudiTrackPresets = {
  track: FudiAudienceTrack
  label: string
  shortLabel: string
  sparkPlaceholder: string
  intentChips: StudioIntentChip[]
  objectives: string[]
  hookChips: Array<{ id: string; label: string; template: string }>
  outputFormats: string[]
  defaultPersonaName: string
  fallbackAudience: AudienceSegment[]
  assetTabLabels: {
    video: string
    carousel: string
    caption: string
    email: string
    dm: string
  }
  promptDirectives: string
  slugPrefix: "fudi" | "partner"
}

export function isFudiStudioEntity(input: {
  name?: string | null
  industry?: string | null
}): boolean {
  return resolveIndustryProfile(input).id === "fudi"
}

const DINERS_TRACK: FudiTrackPresets = {
  track: "diners",
  label: "Track A: Diners & Foodies",
  shortLabel: "Track A · Diners",
  sparkPlaceholder:
    "e.g. Jovial Judge Tavern just dropped a Pavlova Cocktail for $14, or Mean's Vietnamese has 15 pork belly bao specials tonight only...",
  intentChips: [
    { id: "dish_drop", label: "Fresh Dish / Pass Drop", intent: "Build Hype" },
    { id: "live_deal", label: "Live Deal / Mid-Week Drop", intent: "Drive Sales" },
    { id: "weekend_event", label: "Weekend Event / Tour", intent: "Build Hype" },
    { id: "pantry_maker", label: "Local Pantry / Maker", intent: "Drive Sales" },
  ],
  objectives: [
    "Promote a Live Dish Drop",
    "Push a Mid-Week Deal",
    "Fill a Weekend Event",
    "Spotlight a Pantry Maker",
  ],
  hookChips: [
    {
      id: "dish_drop",
      label: "🍕 Kitchen Pass Drop",
      template:
        "Plated tonight at [Eatery Name]: [Dish Title]. Sizzling hot, live on the FÜDI map.",
    },
    {
      id: "live_deal",
      label: "🏷️ Live Deal / Perk",
      template:
        "Just dropped on FÜDI: [Eatery Name] has [Deal Title]. Limited portions, claim via table tap.",
    },
    {
      id: "weekend_event",
      label: "🎟️ Weekend Event / Tour",
      template:
        "Weekend plans? [Event Title] hosted by [Eatery Name]. Check the lineup and RSVP on FÜDI.",
    },
    {
      id: "pantry_maker",
      label: "🍯 Local Hands Market",
      template:
        "Fresh from local hands: [Product Name] by [Maker]. Order direct on FÜDI Marketplace.",
    },
  ],
  outputFormats: [
    "TikTok Reel script",
    "IG Story",
    "Search-optimized food tags",
  ],
  defaultPersonaName: "Unified Local Food Enthusiasts",
  fallbackAudience: [
    {
      name: "Unified Local Food Enthusiasts",
      role: "Local diners & weekend planners",
      pain:
        "Fragmented platform overload: bouncing between Google (outdated PDF menus), Instagram (non-shoppable photos), Facebook (buried flyers), and UberEats (marked-up fees). Disjointed apps cluttered with non-food noise.",
      desire:
        "One single place for everything local food: visual dish feeds, live mid-week deals, weekend event tickets, pantry marketplace, and instant tap-and-pay at the table.",
      trigger:
        "A concrete dish drop, limited deal, or weekend event from a venue they trust — surfaced on one map.",
      winning_rebuttal:
        "Stop app-hopping. FÜDI puts every dish, drop, event, and table menu in your town onto one live map.",
    },
  ],
  assetTabLabels: {
    video: "01 · TikTok Reel",
    carousel: "02 · Story Frames",
    caption: "03 · IG Story + Food Tags",
    email: "04 · Diner Email",
    dm: "05 · Social Invite",
  },
  promptDirectives: [
    "### FÜDI TRACK A — CONSUMER / UNIFIED LOCAL FOOD NETWORK",
    "Audience: Unified Local Food Enthusiasts — tired of app-hopping across Google, Instagram, Facebook, and delivery markups.",
    "Lead with sensory dish cues — pass timing, steam, crunch, real plates on a dark kinetic canvas.",
    "Extract exact [Venue Name] and offer titles from the operator spark — never invent generic placeholders if the spark names them.",
    "Frame Deals as exclusive local drops or limited-quantity perks — NEVER vouchers, discount codes, or coupon jargon.",
    "Frame Events as weekend/evening social gatherings or food trails — NEVER sterile registrations or webinar tone.",
    "CTA links MUST use consumer redirect shape: /r/fudi-[dish-or-event] (kebab-case).",
    "Default persona voice: Unified Local Food Enthusiasts.",
  ].join("\n"),
  slugPrefix: "fudi",
}

const PARTNERS_TRACK: FudiTrackPresets = {
  track: "partners",
  label: "Track B: Eatery Partners (B2B)",
  shortLabel: "Track B · Partners",
  sparkPlaceholder:
    'e.g. "Zero-commission founder partner onboarding for independent Whangārei cafes — fill slow Tuesdays without delivery apps..."',
  intentChips: [
    {
      id: "zero_commission",
      label: "0% Commission Pitch",
      intent: "Get Inventory",
    },
    {
      id: "midweek_seats",
      label: "Fill Mid-Week Seats",
      intent: "Drive Sales",
    },
    {
      id: "table_talker",
      label: "Table Talker Setup",
      intent: "Build Hype",
    },
    {
      id: "founder_partner",
      label: "Founder Partner Drop",
      intent: "Get Inventory",
    },
  ],
  objectives: [
    "Close 0% Commission Partners",
    "Fill Mid-Week Seats",
    "Deploy Table Talkers",
    "Announce Founder Partners",
  ],
  hookChips: [
    {
      id: "economics",
      label: "Commission Economics",
      template:
        "Keep the margin delivery apps take — 0% commission discovery that fills real covers.",
    },
    {
      id: "midweek",
      label: "Mid-Week Seats",
      template:
        "Slow Tuesday and Wednesday tables, solved — locals already craving what you cook.",
    },
    {
      id: "hardware",
      label: "NFC Table Hardware",
      template:
        "Hassle-free NFC table talkers: place, power, done — diners tap, you fill seats.",
    },
  ],
  outputFormats: [
    "Direct B2B Instagram DM",
    "Founder Cold Email",
    "LinkedIn Update",
  ],
  defaultPersonaName: "The Independent Eatery Owner / Head Chef",
  fallbackAudience: [
    {
      name: "The Independent Eatery Owner / Head Chef",
      role: "Hospitality partner",
      pain: "Paying 30%+ delivery commissions and watching mid-week seats sit empty.",
      desire: "Zero-commission local discovery with simple NFC table hardware.",
      trigger: "A founder partner pitch that talks covers and margin, not tech hype.",
      winning_rebuttal:
        "Fill Tuesday tables with locals — keep the cut delivery apps take.",
    },
  ],
  assetTabLabels: {
    video: "01 · Partner Reel",
    carousel: "02 · LinkedIn Update",
    caption: "03 · Outreach Caption",
    email: "04 · Founder Cold Email",
    dm: "05 · B2B Instagram DM",
  },
  promptDirectives: [
    "### FÜDI TRACK B — EATERY PARTNERS (B2B)",
    "Audience: independent eatery owners, head chefs, and hospitality operators.",
    "Lead with restaurant economics — covers, margin, and filling slow Tuesday/Wednesday seats.",
    "Contrast against 30%+ delivery-app commissions; pitch 0% commission discovery.",
    "Explain hassle-free NFC table hardware / table-talker deployment — place, power, done.",
    "HARD BAN tech buzzwords: disruptive, synergy, paradigm, revolutionary, next-gen, unlock scale.",
    "CTA links MUST use partner onboarding redirect shape: /r/partner-[venue] (kebab-case).",
    "Prioritize Direct B2B Instagram DM, Founder Cold Email, and LinkedIn Update formats.",
    "Default persona voice: The Independent Eatery Owner / Head Chef.",
  ].join("\n"),
  slugPrefix: "partner",
}

export function resolveFudiTrackPresets(
  track: FudiAudienceTrack
): FudiTrackPresets {
  return track === "partners" ? PARTNERS_TRACK : DINERS_TRACK
}

export function applyFudiTrackToStudioPresets(
  base: StudioEntityPresets,
  track: FudiAudienceTrack
): StudioEntityPresets {
  const trackPresets = resolveFudiTrackPresets(track)
  return {
    ...base,
    sparkPlaceholder: trackPresets.sparkPlaceholder,
    intentChips: trackPresets.intentChips,
    objectives: trackPresets.objectives,
    hookChips: trackPresets.hookChips,
    fallbackAudience: trackPresets.fallbackAudience,
  }
}

export function buildFudiTrackHookChips(input: {
  track: FudiAudienceTrack
  sparkHint?: string | null
  visualDescription?: string | null
  concreteFeatures?: string[] | null
}): StudioHookChip[] {
  const presets = resolveFudiTrackPresets(input.track)
  const textCue = softCue(input.sparkHint, 110)
  const features = (input.concreteFeatures ?? [])
    .map((row) => softenFeature(row))
    .filter(Boolean)
    .slice(0, 4)
  const visualFallback = softCue(input.visualDescription, 110)

  return presets.hookChips.map((chip, index) => {
    const visualCue =
      features[index] || features[0] || visualFallback || null
    const hook = weaveFudiHook({
      chipId: chip.id,
      template: chip.template,
      visualCue,
      textCue,
      track: input.track,
    })
    return {
      id: chip.id,
      label: chip.label,
      hook: scrubAgencyLeak(hook),
    }
  })
}

function softCue(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.length < 8) return null
  const bite = trimmed.split(/[.!?]/)[0]?.trim() || trimmed
  return bite.slice(0, max).trim() || null
}

function softenFeature(feature: string): string {
  return feature
    .replace(
      /^(fabric|color|colour|cut|silhouette|neckline|ingredient|plating|texture|hardware)\s*:\s*/i,
      ""
    )
    .replace(/^(camera sees|visual details|inspected)\s*:?\s*/i, "")
    .trim()
}

function ensurePeriod(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/[—–-]\s*$/, "").trim()
  if (!cleaned) return cleaned
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

function weaveFudiHook(input: {
  chipId: string
  template: string
  visualCue: string | null
  textCue: string | null
  track: FudiAudienceTrack
}): string {
  const { chipId, template, visualCue, textCue, track } = input
  if (!visualCue && !textCue) return template

  const isAppetite =
    chipId === "appetite" ||
    chipId === "vibe" ||
    chipId === "craving" ||
    chipId === "dish_drop" ||
    chipId === "pantry_maker"
  const isConvenience =
    chipId === "nfc" ||
    chipId === "investment" ||
    chipId === "weekend" ||
    chipId === "partner" ||
    chipId === "live_deal" ||
    chipId === "weekend_event"

  if (isAppetite) {
    if (visualCue && textCue) {
      return ensurePeriod(`${visualCue} — ${textCue}`)
    }
    if (visualCue) {
      return ensurePeriod(
        track === "partners"
          ? `${visualCue} — partner kitchen, ready for the feed`
          : `${visualCue}, plated for the neighbourhood table`
      )
    }
    return ensurePeriod(`${template.replace(/\.$/, "")} — ${textCue}`)
  }

  if (isConvenience) {
    if (visualCue && textCue) {
      return ensurePeriod(`${textCue}: ${visualCue}, one FÜDI Tap away`)
    }
    if (visualCue) {
      return ensurePeriod(
        `${visualCue} — tap the table, claim the special, eat`
      )
    }
    return ensurePeriod(`${template.replace(/\.$/, "")} — ${textCue}`)
  }

  if (visualCue && textCue) {
    return ensurePeriod(
      `${visualCue} — ${textCue}. Meet us on the neighbourhood table`
    )
  }
  if (visualCue) {
    return ensurePeriod(
      `Independent kitchen spotlight: ${visualCue}. Meet the neighbourhood table`
    )
  }
  return ensurePeriod(`${template.replace(/\.$/, "")} — ${textCue}`)
}

/** Seed for /r/fudi-[dish-or-event] or /r/partner-[venue]. */
export function buildFudiRedirectSlugSeed(
  track: FudiAudienceTrack,
  eventDescription: string
): string {
  const presets = resolveFudiTrackPresets(track)
  const stem = eventDescription
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 4)
    .join("-")
    .slice(0, 28)
  const body = stem || (track === "partners" ? "venue" : "special")
  return `${presets.slugPrefix}-${body}`
}

export function fudiMasterOperatingLawBlock(): string {
  return fudiPlatformDefinitionBlock()
}

export function fudiTrackPromptBlock(
  track: FudiAudienceTrack | null | undefined
): string {
  if (!track) return ""
  return [fudiMasterOperatingLawBlock(), resolveFudiTrackPresets(track).promptDirectives]
    .filter(Boolean)
    .join("\n\n")
}

export function intentBiasForFudiChip(
  chipId: string
): MultiplexerIntent | null {
  const chips = [
    ...DINERS_TRACK.intentChips,
    ...PARTNERS_TRACK.intentChips,
  ]
  return chips.find((chip) => chip.id === chipId)?.intent ?? null
}

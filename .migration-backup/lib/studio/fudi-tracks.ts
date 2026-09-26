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
    'e.g. "Friday 4:30 PM decision fatigue? 3 local Whangārei spots with exclusive FÜDI Tap specials this weekend..."',
  intentChips: [
    { id: "friday_rush", label: "Friday Rush", intent: "Drive Sales" },
    { id: "daily_special", label: "Daily Special", intent: "Drive Sales" },
    { id: "fudi_tap_demo", label: "FÜDI Tap Demo", intent: "Build Hype" },
    { id: "secret_menu", label: "Secret Menu", intent: "Build Hype" },
  ],
  objectives: [
    "Drive Friday Covers",
    "Promote Daily Special",
    "Demo FÜDI Tap",
    "Unlock Secret Menu",
  ],
  hookChips: [
    {
      id: "appetite",
      label: "Appetite Hook (0–2s)",
      template:
        "Steam, crunch, first bite — your Friday table is one FÜDI Tap away.",
    },
    {
      id: "nfc",
      label: "NFC Tap Convenience",
      template:
        "No PDF menus. No scroll fatigue. Tap the table, claim the special, eat.",
    },
    {
      id: "local",
      label: "Neighbourhood Guide",
      template:
        "Whangārei weekend shortlist: three local kitchens with exclusive FÜDI Tap drops.",
    },
  ],
  outputFormats: [
    "TikTok Reel script",
    "IG Story",
    "Search-optimized food tags",
  ],
  defaultPersonaName: "The Local Foodie & Social Diner",
  fallbackAudience: [
    {
      name: "The Local Foodie & Social Diner",
      role: "Weekend diner",
      pain: "Decision fatigue when picking where to eat with friends.",
      desire: "Trusted local specials and instant discovery via FÜDI Tap.",
      trigger: "A Friday rush or daily special that looks too good to skip.",
      winning_rebuttal: "Skip the scroll — tap the special and claim the table.",
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
    "### FÜDI TRACK A — CONSUMER DINERS & FOODIES",
    "Audience: local diners, foodies, and social groups deciding where to eat.",
    "Lead with sensory food cues — aroma, texture, heat, crunch, steam, first-bite payoff.",
    "Video hooks must land in 0–2 seconds with appetite-inducing visuals and spoken desire.",
    "Sell instant NFC / FÜDI Tap convenience: one tap at the table, zero friction.",
    "Explicitly eliminate clunky PDF menus, endless scrolling, and decision fatigue.",
    "CTA links MUST use consumer redirect shape: /r/fudi-[dish-or-event] (kebab-case).",
    "Prioritize TikTok Reel script, IG Story copy, and search-optimized food tags.",
    "Default persona voice: The Local Foodie & Social Diner.",
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
    chipId === "appetite" || chipId === "vibe" || chipId === "craving"
  const isConvenience =
    chipId === "nfc" ||
    chipId === "investment" ||
    chipId === "weekend" ||
    chipId === "partner"

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

export function fudiTrackPromptBlock(
  track: FudiAudienceTrack | null | undefined
): string {
  if (!track) return ""
  return resolveFudiTrackPresets(track).promptDirectives
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

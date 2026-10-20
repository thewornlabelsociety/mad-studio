import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import type { IndustryTemplateId } from "@/lib/brands/industry-templates"
import type { AudienceSegment } from "@/lib/entities/dna-schema"

const FUDI_AUDIENCE_PRESETS: AudienceSegment[] = [
  {
    name: "Unified Local Food Enthusiasts",
    role: "Local diners & weekend planners",
    audience_type: "b2c",
    age_bracket: "18–34",
    primary_feature: "Deals",
    target_channels: ["tiktok", "instagram_story"],
    forecasting_tag: "consumer_spontaneous_drops",
    conversion_goal: "App Search & Table Tap",
    pain:
      "Fragmented platform overload: bouncing between Google (outdated PDF menus), Instagram (non-shoppable photos), Facebook (buried flyers), and UberEats (marked-up fees). Disjointed apps cluttered with non-food noise.",
    desire:
      "One single place for everything local food: visual dish feeds, live mid-week deals, weekend event tickets, pantry marketplace, and instant tap-and-pay at the table.",
    trigger:
      "A concrete dish drop, limited deal, or weekend event from a venue they trust — surfaced on one map.",
    winning_rebuttal:
      "Stop app-hopping. FÜDI puts every dish, drop, event, and table menu in your town onto one live map.",
  },
  {
    name: "18–27 Gen Z Quick Casual",
    role: "Students & young professionals",
    audience_type: "b2c",
    age_bracket: "18–27",
    primary_feature: "Deals",
    target_channels: ["tiktok", "instagram_story"],
    forecasting_tag: "consumer_spontaneous_drops",
    conversion_goal: "App Search & Table Tap",
    pain: "Decision fatigue on where to eat or shop on a budget",
    desire: "Fast discovery, aesthetic vibes, honest value",
    trigger: "Midweek lunch or late-night scroll",
    winning_rebuttal: "Show real plates, real prices, zero corporate fluff",
  },
  {
    name: "28–42 Food Enthusiasts & Date Nights",
    role: "Curated millennial diners or shoppers",
    audience_type: "b2c",
    age_bracket: "28–42",
    primary_feature: "Events",
    target_channels: ["instagram_feed", "facebook"],
    forecasting_tag: "consumer_weekend_events",
    conversion_goal: "Event RSVP & map saves",
    pain: "Tired of generic chains and bait-and-switch promos",
    desire: "Editorial quality, story, and a reason to share",
    trigger: "Weekend plans or special occasion",
    winning_rebuttal: "Lead with craft, provenance, and limited drops",
  },
  {
    name: "35–60+ Local Community",
    role: "Neighbourhood regulars and loyal locals",
    audience_type: "b2c",
    age_bracket: "35–60+",
    primary_feature: "Events",
    target_channels: ["facebook", "instagram_feed"],
    forecasting_tag: "consumer_weekend_events",
    conversion_goal: "Event RSVP & map saves",
    pain: "Hard to trust noisy social ads and hidden fees",
    desire: "Warm, clear details — hours, location, who runs the place",
    trigger: "Community events, school holidays, local news",
    winning_rebuttal: "Plain language, familiar faces, Facebook-friendly clarity",
  },
]

const WORN_LABEL_AUDIENCE_PRESETS: AudienceSegment[] = [
  {
    name: "The Wardrobe Rotator",
    role: "Consignment seller & circular-fashion buyer",
    audience_type: "b2c",
    age_bracket: "18–34",
    primary_feature: "Marketplace",
    target_channels: ["tiktok", "instagram_feed"],
    forecasting_tag: "consumer_consignment_rotation",
    conversion_goal: "Shop by Vibe & consign intake",
    pain:
      "Closet full of pieces that no longer fit the mood — resale feels like homework and fast fashion dupes kill trust.",
    desire:
      "Curated pre-loved luxury with verified condition, vibe-led discovery, and a dignified way to rotate pieces in and out.",
    trigger: "Season change, wardrobe clear-out, or a “just landed” drop in their favourite vibe.",
    winning_rebuttal:
      "Less searching. Better finding — consign with integrity, shop archival edits by vibe, not algorithm noise.",
  },
  {
    name: "The Conscious Collector",
    role: "Quiet-luxury buyer who values provenance",
    audience_type: "b2c",
    age_bracket: "28–42",
    primary_feature: "Events",
    target_channels: ["instagram_feed", "facebook"],
    forecasting_tag: "consumer_quiet_luxury_drops",
    conversion_goal: "In-store Whangārei & Instagram Shop",
    pain:
      "Skeptical of hype drops and anonymous marketplaces — wants fabric, fit, and story before she commits.",
    desire:
      "Editorial mood, scarcity without spam, and a boutique that feels like a trusted curator not a warehouse.",
    trigger: "Limited capsule, Euro Summer / Modern Muse edit, or in-store event invite.",
    winning_rebuttal:
      "Moody, verified consignment — every piece earns its place in the archive; shop the vibe, not the churn.",
  },
  {
    name: "Gen Z Archive Hunters",
    role: "Trend-aware students & first luxury buyers",
    audience_type: "b2c",
    age_bracket: "18–27",
    primary_feature: "Deals",
    target_channels: ["tiktok", "instagram_story"],
    forecasting_tag: "consumer_street_archive",
    conversion_goal: "TikTok discovery → Shop Here",
    pain: "Dupe culture and fake “vintage” — hard to find real archive pieces on a student budget.",
    desire: "Authentic street / archive labels, try-on confidence, and shareable fits.",
    trigger: "Street Archive drop, creator try-on, or mid-week “just landed” carousel.",
    winning_rebuttal: "Real archive pieces, real condition notes — shop the drop before it’s gone, no fast-fashion guilt.",
  },
  {
    name: "Local Whangārei Regulars",
    role: "Northland locals who shop in person",
    audience_type: "b2c",
    age_bracket: "35–60+",
    primary_feature: "Events",
    target_channels: ["facebook", "instagram_feed"],
    forecasting_tag: "consumer_in_store_events",
    conversion_goal: "Visit boutique & event RSVP",
    pain: "Online-only brands with no local touch — wants to see fabric and meet the team.",
    desire: "Warm, clear hours, familiar faces, and occasional in-store evenings.",
    trigger: "Community event, school holidays, or new-season open day.",
    winning_rebuttal: "Your town’s luxury consignment home — visit Whangārei, try on, consign with people who care.",
  },
]

const GENERIC_AUDIENCE_PRESETS: AudienceSegment[] = [
  {
    name: "Primary buyers",
    role: "Core customer",
    audience_type: "b2c",
    age_bracket: "25–44",
    primary_feature: "Deals",
    target_channels: ["instagram_feed", "tiktok"],
    forecasting_tag: "consumer_core_buyers",
    conversion_goal: "Shop / sign up",
    pain: "Too much noise, not enough trust",
    desire: "Clear value and a brand that feels human",
    trigger: "Limited offer or social proof moment",
    winning_rebuttal: "Lead with proof, keep the CTA simple",
  },
  {
    name: "Local community",
    role: "Neighbourhood loyalists",
    audience_type: "b2c",
    age_bracket: "35–60+",
    primary_feature: "Events",
    target_channels: ["facebook", "instagram_feed"],
    forecasting_tag: "consumer_local_community",
    conversion_goal: "Visit or RSVP",
    pain: "Hard to parse flashy ads",
    desire: "Plain details — who, where, when",
    trigger: "Local event or seasonal moment",
    winning_rebuttal: "Friendly, specific, no jargon",
  },
]

const PRESETS_BY_INDUSTRY: Record<
  IndustryTemplateId,
  AudienceSegment[]
> = {
  fudi: FUDI_AUDIENCE_PRESETS,
  worn_label: WORN_LABEL_AUDIENCE_PRESETS,
  generic: GENERIC_AUDIENCE_PRESETS,
}

/** Quick-add audience rows scoped to the active brand (never cross-entity). */
export function audienceSegmentPresetsForEntity(input: {
  name: string
  industry: string
}): AudienceSegment[] {
  const profile = resolveIndustryProfile(input)
  return PRESETS_BY_INDUSTRY[profile.id] ?? GENERIC_AUDIENCE_PRESETS
}

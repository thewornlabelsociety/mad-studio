import type { AudienceSegment } from "@/lib/entities/dna-schema"

export type AudienceKind = "b2c" | "b2b"

export type PrimaryFeature =
  | "Deals"
  | "Events"
  | "Marketplace"
  | "FÜDI Tap"

export type ChannelPillLabel =
  | "TikTok"
  | "IG Feed"
  | "IG Story"
  | "Facebook"
  | "Email"

export type AudienceSegmentUi = {
  kind: AudienceKind
  ageBracket: string
  primaryFeature: PrimaryFeature
  channelPills: ChannelPillLabel[]
  forecastingTag: string
  conversionGoal: string
}

const AGE_IN_NAME = /\b(\d{2})\s*[–-]\s*(\d{2}\+?|\d{2})\b/

function inferKind(segment: AudienceSegment): AudienceKind {
  if (segment.audience_type === "b2b") return "b2b"
  if (segment.audience_type === "b2c") return "b2c"
  const blob = `${segment.name} ${segment.role}`.toLowerCase()
  if (
    /\bb2b\b|partner|eatery owner|venue operator|hospitality operator|merchant|operator|nfc table|commission|table talk/.test(
      blob
    )
  ) {
    return "b2b"
  }
  return "b2c"
}

function inferAgeBracket(segment: AudienceSegment): string {
  if (segment.age_bracket?.trim()) return segment.age_bracket.trim()
  const fromName = segment.name.match(AGE_IN_NAME)
  if (fromName) return `${fromName[1]}–${fromName[2]}`
  if (/gen z|student|18|young professional/i.test(segment.name)) return "18–27"
  if (/millennial|28|42|date night/i.test(segment.name)) return "28–42"
  if (/35|60|community|local regular/i.test(segment.name)) return "35–60+"
  return "18–34"
}

function inferPrimaryFeature(segment: AudienceSegment): PrimaryFeature {
  const stored = segment.primary_feature?.trim()
  if (
    stored === "Deals" ||
    stored === "Events" ||
    stored === "Marketplace" ||
    stored === "FÜDI Tap"
  ) {
    return stored
  }
  const blob = `${segment.desire} ${segment.pain} ${segment.trigger}`.toLowerCase()
  if (/tap|table menu|nfc|pay at the table|table tap/.test(blob)) return "FÜDI Tap"
  if (/event|weekend|ticket|tour|rsvp/.test(blob)) return "Events"
  if (/pantry|marketplace|maker|local hands/.test(blob)) return "Marketplace"
  if (/deal|mid-?week|drop|special|perk/.test(blob)) return "Deals"
  return inferKind(segment) === "b2b" ? "FÜDI Tap" : "Deals"
}

function channelKeyToPill(key: string): ChannelPillLabel | null {
  switch (key) {
    case "tiktok":
      return "TikTok"
    case "instagram_feed":
      return "IG Feed"
    case "instagram_story":
      return "IG Story"
    case "facebook":
      return "Facebook"
    case "email":
      return "Email"
    default:
      return null
  }
}

function defaultChannelsForFeature(feature: PrimaryFeature): ChannelPillLabel[] {
  switch (feature) {
    case "Events":
      return ["IG Feed", "Facebook"]
    case "Deals":
      return ["TikTok", "IG Story"]
    case "Marketplace":
      return ["TikTok", "IG Feed"]
    case "FÜDI Tap":
      return ["IG Story", "Facebook"]
    default:
      return ["TikTok", "IG Feed"]
  }
}

function inferChannelPills(segment: AudienceSegment, feature: PrimaryFeature): ChannelPillLabel[] {
  const fromStored = (segment.target_channels ?? [])
    .map(channelKeyToPill)
    .filter((row): row is ChannelPillLabel => Boolean(row))
  if (fromStored.length > 0) return fromStored
  return defaultChannelsForFeature(feature)
}

function slugifyTag(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48)
}

function inferForecastingTag(segment: AudienceSegment, feature: PrimaryFeature): string {
  if (segment.forecasting_tag?.trim()) {
    const tag = segment.forecasting_tag.trim()
    return tag.startsWith("#") ? tag : `#${tag}`
  }
  const kind = inferKind(segment)
  const base = kind === "b2b" ? "partner" : "consumer"
  const featureKey =
    feature === "Events"
      ? "weekend_events"
      : feature === "Marketplace"
        ? "pantry_marketplace"
        : feature === "FÜDI Tap"
          ? "table_tap"
          : "spontaneous_drops"
  return `#${base}_${featureKey}`
}

function inferConversionGoal(segment: AudienceSegment, feature: PrimaryFeature): string {
  if (segment.conversion_goal?.trim()) return segment.conversion_goal.trim()
  if (inferKind(segment) === "b2b") {
    return "Partner onboarding & table tap activation"
  }
  switch (feature) {
    case "Events":
      return "Event RSVP & map saves"
    case "Marketplace":
      return "Marketplace checkout"
    case "FÜDI Tap":
      return "App Search & Table Tap"
    case "Deals":
    default:
      return "App Search & Table Tap"
  }
}

export function resolveAudienceSegmentUi(segment: AudienceSegment): AudienceSegmentUi {
  const primaryFeature = inferPrimaryFeature(segment)
  return {
    kind: inferKind(segment),
    ageBracket: inferAgeBracket(segment),
    primaryFeature,
    channelPills: inferChannelPills(segment, primaryFeature),
    forecastingTag: inferForecastingTag(segment, primaryFeature),
    conversionGoal: inferConversionGoal(segment, primaryFeature),
  }
}

export function resolveForecastingTagForPersona(
  segments: AudienceSegment[],
  personaName: string | null | undefined
): string | null {
  if (!personaName?.trim()) return null
  const normalized = personaName.trim().toLowerCase()
  const match =
    segments.find((row) => row.name.trim().toLowerCase() === normalized) ??
    segments.find((row) =>
      normalized.includes(row.name.trim().toLowerCase().slice(0, 12))
    )
  if (!match) return null
  return resolveAudienceSegmentUi(match).forecastingTag
}

export function enrichSegmentForSave(segment: AudienceSegment): AudienceSegment {
  const ui = resolveAudienceSegmentUi(segment)
  return {
    ...segment,
    audience_type: segment.audience_type ?? ui.kind,
    age_bracket: segment.age_bracket?.trim() || ui.ageBracket,
    primary_feature: segment.primary_feature?.trim() || ui.primaryFeature,
    target_channels:
      segment.target_channels && segment.target_channels.length > 0
        ? segment.target_channels
        : ui.channelPills.map((pill) => {
            switch (pill) {
              case "TikTok":
                return "tiktok"
              case "IG Feed":
                return "instagram_feed"
              case "IG Story":
                return "instagram_story"
              case "Facebook":
                return "facebook"
              case "Email":
                return "email"
              default:
                return "tiktok"
            }
          }),
    forecasting_tag:
      segment.forecasting_tag?.trim() ||
      ui.forecastingTag.replace(/^#/, ""),
    conversion_goal: segment.conversion_goal?.trim() || ui.conversionGoal,
  }
}

/** Stable tag slug for presets (no leading #). */
export function defaultForecastingTagSlug(name: string, kind: AudienceKind): string {
  const fromName = slugifyTag(name)
  if (fromName.length > 4) return `${kind === "b2b" ? "partner" : "consumer"}_${fromName}`
  return kind === "b2b" ? "partner_table_tap" : "consumer_spontaneous_drops"
}

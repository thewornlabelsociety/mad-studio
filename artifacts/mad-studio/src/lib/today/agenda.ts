import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import type { MarketingEntity } from "@/lib/inventory/types"
import { formatInventoryPrice } from "@/lib/inventory/types"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"

export type FudiDropKind =
  | "foodie_post"
  | "eatery_spotlight"
  | "platform_promo"
  | "dish_drop"
  | "live_deal"
  | "event"
  | "pantry"

export const FUDI_DROP_BADGES: Record<
  FudiDropKind,
  { label: string; emoji: string }
> = {
  foodie_post: { emoji: "🍜", label: "FOODIE POST" },
  eatery_spotlight: { emoji: "🏪", label: "EATERY SPOTLIGHT" },
  platform_promo: { emoji: "📱", label: "FÜDI PROMO" },
  dish_drop: { emoji: "🍕", label: "DISH DROP" },
  live_deal: { emoji: "🏷️", label: "LIVE DEAL" },
  event: { emoji: "🎟️", label: "EVENT" },
  pantry: { emoji: "🍯", label: "MARKETPLACE" },
}

export function formatAgendaLiveDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  })
    .format(date)
    .toUpperCase()
}

export function getLocalDayBounds(date: Date = new Date()): {
  start: Date
  end: Date
} {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function metadataRecord(
  item: MarketingEntity
): Record<string, unknown> | null {
  const draft = item.copy_draft as Record<string, unknown> | null | undefined
  const raw = draft?.metadata
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  return raw as Record<string, unknown>
}

function isFudiEateryIntake(item: MarketingEntity): boolean {
  const blob = `${item.title} ${item.description ?? ""} ${item.website_item_id} ${item.brand ?? ""}`
  return (
    item.website_item_id?.startsWith("partner-") ||
    /partner|eatery|onboard|venue|restaurant|cafe|commission|table talker/i.test(
      blob
    )
  )
}

export function inferFudiDropKind(item: MarketingEntity): FudiDropKind {
  const meta = metadataRecord(item)
  const override = meta?.drop_kind
  if (typeof override === "string" && override in FUDI_DROP_BADGES) {
    return override as FudiDropKind
  }

  if (
    item.website_item_id?.startsWith("promo-carousel-") ||
    meta?.source_table === "mad_carousel"
  ) {
    return "platform_promo"
  }

  const sourceTable =
    typeof meta?.source_table === "string" ? meta.source_table : ""
  switch (sourceTable) {
    case "fudi_events":
      return "event"
    case "fudi_deals":
      return "live_deal"
    case "marketplace_items":
      return "pantry"
    case "trails":
      return "event"
    case "fudi_posts":
      return isFudiEateryIntake(item) ? "eatery_spotlight" : "foodie_post"
    default:
      break
  }

  const blob = `${item.title} ${item.description ?? ""} ${item.website_item_id}`.toLowerCase()
  if (/event|tour|ticket|weekend|rsvp|lineup|trail/.test(blob)) return "event"
  if (/pantry|maker|marketplace|local hands|honey|jam|marketplace_items/.test(blob))
    return "pantry"
  if (/deal|special|% off|mid-?week|perk|\$\d/.test(blob)) return "live_deal"
  return "dish_drop"
}

export function fudiChannelRecommendation(kind: FudiDropKind): string {
  switch (kind) {
    case "platform_promo":
    case "event":
    case "eatery_spotlight":
      return "IG Carousel / Facebook"
    case "pantry":
      return "TikTok / IG Feed"
    case "foodie_post":
    case "live_deal":
    case "dish_drop":
    default:
      return "TikTok / IG Story"
  }
}

export function extractWlsSize(item: MarketingEntity): string | null {
  const hay = `${item.title} ${item.description ?? ""}`
  const size =
    hay.match(/\b(?:sz|size)\s*[:.]?\s*([0-9]+|[xsml]{1,3})\b/i)?.[1] ??
    hay.match(/\b([0-9]{2})\s*(?:eu|it|fr)?\b/i)?.[1]
  return size ? size.toUpperCase() : null
}

export function resolveBrainDirective(
  entity: StudioEntityDna,
  fallbackTakeaway?: string | null
): string {
  const identity = entity.brand_identity as Record<string, unknown>
  const creative =
    typeof identity.creative_direction === "string"
      ? identity.creative_direction.trim()
      : ""
  if (creative) return creative
  const seasonal =
    typeof identity.seasonal_focus === "string"
      ? identity.seasonal_focus.trim()
      : ""
  if (seasonal) return seasonal
  if (entity.local_context[0]?.trim()) return entity.local_context[0].trim()
  if (entity.content_pillars[0]?.trim()) return entity.content_pillars[0].trim()
  if (fallbackTakeaway?.trim()) return fallbackTakeaway.trim()
  return "Set seasonal focus in Brand Brain → Memory or local context."
}

export function formatIntakeDetailLine(
  item: MarketingEntity,
  brandName: string,
  industry?: string | null
): string {
  const isFudi = isFudiStudioEntity({ name: brandName, industry })
  const price = formatInventoryPrice(item.price)
  if (isFudi) {
    if (price !== "—") return price
    return "Limited drop — confirm portions on site."
  }
  const size = extractWlsSize(item)
  return [size ? `Size ${size}` : null, price !== "—" ? price : null]
    .filter(Boolean)
    .join(" · ")
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case "instagram_story":
      return "Instagram Story"
    case "instagram_feed":
      return "Instagram"
    case "tiktok":
      return "TikTok"
    case "facebook":
      return "Facebook"
    case "email":
      return "Email"
    default:
      return platform.replace(/_/g, " ")
  }
}

export function platformEmoji(platform: string): string {
  switch (platform) {
    case "instagram_story":
    case "instagram_feed":
      return "📸"
    case "tiktok":
      return "🎵"
    case "facebook":
      return "📘"
    default:
      return "📡"
  }
}

import { buildContextAwareHooks } from "@/lib/inventory/context-hooks"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { detectMediaKindFromUrl } from "@/lib/media/kind"
import {
  extractWlsSize,
  formatIntakeDetailLine,
} from "@/lib/today/agenda"
import { conciseProductLabel } from "@/lib/marketing/story-presets"
import { sanitizeFudiDisplayTitle } from "@/lib/today/preview-copy"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import {
  resolveFudiChannelHint,
  resolveFudiDropKind,
} from "@/lib/inventory/post-intent"
import { type FudiDropKind } from "@/lib/today/agenda"
import {
  buildFudiRedirectSlugSeed,
  isFudiStudioEntity,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"

export type TodayChannel = "ig_story" | "tiktok"

export type TodayQueueView = {
  item: MarketingEntity
  /** Card headline — short label for FÜDI (not full caption). */
  displayTitle: string
  mediaUrl: string | null
  isVideo: boolean
  channel: TodayChannel
  channelLabel: string
  channelRecommendation: string
  specsLine: string
  detailLine: string
  recommendedHook: string
  fudiTrack: FudiAudienceTrack | null
  fudiTrackLabel: string | null
  fudiDropKind: FudiDropKind | null
  slugSeed: string | null
  isFudi: boolean
  isWls: boolean
  venueOrBrand: string | null
  wlsSize: string | null
  wlsPrice: string
}

function extractSize(item: MarketingEntity): string | null {
  const hay = `${item.title} ${item.description ?? ""}`
  const size =
    hay.match(/\b(?:sz|size)\s*[:.]?\s*([0-9]+|[xsml]{1,3})\b/i)?.[1] ??
    hay.match(/\b([0-9]{2})\s*(?:eu|it|fr)?\b/i)?.[1]
  return size ? `Sz ${size.toUpperCase()}` : null
}

export function formatQueueSpecsLine(
  item: MarketingEntity,
  brandName: string,
  industry?: string | null
): string {
  const isFudi = isFudiStudioEntity({ name: brandName, industry })
  const title = item.title.trim()
  const brand = item.brand?.trim()
  const price = formatInventoryPrice(item.price)
  const size = extractSize(item)

  if (isFudi) {
    const venue = brand && brand.toLowerCase() !== title.toLowerCase() ? brand : null
    const shortTitle = conciseProductLabel(title, brand)
    return [shortTitle, venue].filter(Boolean).join(" • ")
  }

  const parts = [
    brand && !title.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${title}`
      : title,
    size,
    price !== "—" ? price : null,
  ].filter(Boolean)

  return parts.join(" • ")
}

export function resolveQueueFudiTrack(
  item: MarketingEntity,
  brandName: string,
  industry?: string | null
): FudiAudienceTrack | null {
  if (!isFudiStudioEntity({ name: brandName, industry })) return null
  if (
    item.website_item_id?.startsWith("partner-") ||
    /partner|eatery|onboard|commission|table talker/i.test(
      `${item.title} ${item.description ?? ""}`
    )
  ) {
    return "partners"
  }
  return "diners"
}

export function buildTodayQueueView(input: {
  item: MarketingEntity
  brandName: string
  industry?: string | null
}): TodayQueueView {
  const mediaUrl = input.item.images[0]?.trim() || null
  const isVideo = mediaUrl
    ? detectMediaKindFromUrl(mediaUrl) === "video"
    : false
  const channel: TodayChannel = isVideo ? "tiktok" : "ig_story"
  const isFudi = isFudiStudioEntity({
    name: input.brandName,
    industry: input.industry,
  })
  const isWls = resolveIndustryProfile({
    name: input.brandName,
    industry: input.industry,
  }).id === "worn_label"
  const fudiTrack = resolveQueueFudiTrack(
    input.item,
    input.brandName,
    input.industry
  )
  const fudiDropKind = isFudi ? resolveFudiDropKind(input.item) : null
  const channelRecommendation = fudiDropKind
    ? resolveFudiChannelHint(input.item, fudiDropKind)
    : channel === "tiktok"
      ? "TikTok / IG Story"
      : "IG Story / Feed"
  const hooks = buildContextAwareHooks({
    item: input.item,
    brandName: input.brandName,
    industry: input.industry,
    vibeCategory: input.item.vibe,
  })
  const brand = input.item.brand?.trim() || null
  const title = input.item.title.trim()
  const hookFromDescription = input.item.description?.trim()
  const recommendedHook = isFudi
    ? sanitizeFudiDisplayTitle(
        conciseProductLabel(
          input.item.copy_draft?.caption?.trim() ||
            hookFromDescription?.split(/\n+/)[0] ||
            input.item.title,
          brand
        )
      )
    : input.item.copy_draft?.caption?.trim() ||
      hooks[0]?.hook ||
      hookFromDescription ||
      input.item.title

  const displayTitle = isFudi
    ? sanitizeFudiDisplayTitle(conciseProductLabel(title, brand))
    : title

  return {
    item: input.item,
    displayTitle,
    mediaUrl,
    isVideo,
    channel,
    channelLabel: channel === "tiktok" ? "TikTok" : "IG Story",
    channelRecommendation,
    specsLine: formatQueueSpecsLine(
      input.item,
      input.brandName,
      input.industry
    ),
    detailLine: formatIntakeDetailLine(
      input.item,
      input.brandName,
      input.industry
    ),
    recommendedHook,
    fudiTrack,
    fudiTrackLabel:
      fudiTrack === "partners"
        ? "Track B: Eatery"
        : fudiTrack === "diners"
          ? "Track A: Diners"
          : null,
    fudiDropKind,
    slugSeed: fudiTrack
      ? buildFudiRedirectSlugSeed(fudiTrack, input.item.title)
      : null,
    isFudi,
    isWls,
    venueOrBrand:
      brand && brand.toLowerCase() !== title.toLowerCase() ? brand : brand,
    wlsSize: extractWlsSize(input.item),
    wlsPrice: formatInventoryPrice(input.item.price),
  }
}

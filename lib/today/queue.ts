import { buildContextAwareHooks } from "@/lib/inventory/context-hooks"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { detectMediaKindFromUrl } from "@/lib/media/kind"
import {
  buildFudiRedirectSlugSeed,
  isFudiStudioEntity,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"

export type TodayChannel = "ig_story" | "tiktok"

export type TodayQueueView = {
  item: MarketingEntity
  mediaUrl: string | null
  isVideo: boolean
  channel: TodayChannel
  channelLabel: string
  specsLine: string
  recommendedHook: string
  fudiTrack: FudiAudienceTrack | null
  fudiTrackLabel: string | null
  slugSeed: string | null
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
    return [title, venue].filter(Boolean).join(" • ")
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
  const fudiTrack = resolveQueueFudiTrack(
    input.item,
    input.brandName,
    input.industry
  )
  const hooks = buildContextAwareHooks({
    item: input.item,
    brandName: input.brandName,
    industry: input.industry,
    vibeCategory: input.item.vibe,
  })
  const recommendedHook =
    input.item.copy_draft?.caption?.trim() ||
    hooks[0]?.hook ||
    input.item.description?.trim() ||
    input.item.title

  return {
    item: input.item,
    mediaUrl,
    isVideo,
    channel,
    channelLabel: channel === "tiktok" ? "TikTok" : "IG Story",
    specsLine: formatQueueSpecsLine(
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
    slugSeed: fudiTrack
      ? buildFudiRedirectSlugSeed(fudiTrack, input.item.title)
      : null,
  }
}

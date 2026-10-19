import type { AspectRatio } from "@/types/social-creative"

export type PromoPreviewChannel =
  | "instagram_story"
  | "instagram_feed"
  | "facebook"
  | "email"

export type PromoPreviewChannelMeta = {
  id: PromoPreviewChannel
  label: string
  shortLabel: string
  aspectRatio: AspectRatio
  /** Feed caption hook for mock chrome */
  captionHint: string
}

export const PROMO_PREVIEW_CHANNELS: PromoPreviewChannelMeta[] = [
  {
    id: "instagram_story",
    label: "Instagram Story",
    shortLabel: "Story",
    aspectRatio: "9:16",
    captionHint: "Story · full-screen vertical",
  },
  {
    id: "instagram_feed",
    label: "Instagram Feed",
    shortLabel: "IG Feed",
    aspectRatio: "1:1",
    captionHint: "Square feed post",
  },
  {
    id: "facebook",
    label: "Facebook",
    shortLabel: "Facebook",
    aspectRatio: "1:1",
    captionHint: "Square sponsored post",
  },
  {
    id: "email",
    label: "Email sales",
    shortLabel: "Email",
    aspectRatio: "1:1",
    captionHint: "Newsletter hero block",
  },
]

export function promoChannelMeta(
  channel: PromoPreviewChannel
): PromoPreviewChannelMeta {
  return (
    PROMO_PREVIEW_CHANNELS.find((row) => row.id === channel) ??
    PROMO_PREVIEW_CHANNELS[0]
  )
}

/** A4 at 96 CSS px/in (screen + PDF capture) */
export const A4_PRINT_WIDTH_PX = 794
export const A4_PRINT_HEIGHT_PX = 1123

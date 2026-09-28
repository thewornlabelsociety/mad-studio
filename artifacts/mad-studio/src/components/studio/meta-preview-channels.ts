import type { SimulatorPlatform } from "@/components/marketing/multi-platform-simulator"

export type MetaPreviewChannel = Extract<
  SimulatorPlatform,
  "ig_story" | "ig_feed" | "facebook"
>

export const META_PREVIEW_CHANNELS: Array<{
  id: MetaPreviewChannel
  label: string
}> = [
  { id: "ig_story", label: "📸 Instagram Story" },
  { id: "ig_feed", label: "🖼 Instagram Feed" },
  { id: "facebook", label: "📘 Facebook Page" },
]

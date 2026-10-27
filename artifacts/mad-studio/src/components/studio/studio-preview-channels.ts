import type { SimulatorPlatform } from "@/components/marketing/multi-platform-simulator"

/** Channels shown in Create Studio — includes preview-only / unavailable rows. */
export type StudioPreviewChannelId = SimulatorPlatform | "facebook_story"

export type StudioPreviewChannel = {
  id: StudioPreviewChannelId
  label: string
  /** Live phone mock renders for this channel in Studio today. */
  previewAvailable: boolean
  /** MAD can queue/autopublish to this destination (approximate operator hint). */
  publishSupported: boolean
  unavailableReason?: string
}

export const STUDIO_PREVIEW_CHANNELS: StudioPreviewChannel[] = [
  {
    id: "ig_feed",
    label: "Instagram Feed",
    previewAvailable: true,
    publishSupported: true,
  },
  {
    id: "ig_story",
    label: "Instagram Story",
    previewAvailable: true,
    publishSupported: false,
  },
  {
    id: "facebook",
    label: "Facebook Feed",
    previewAvailable: true,
    publishSupported: true,
  },
  {
    id: "facebook_story",
    label: "Facebook Story",
    previewAvailable: false,
    publishSupported: false,
    unavailableReason: "Facebook Story preview is not built yet — use Instagram Story for 9:16 creative.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    previewAvailable: true,
    publishSupported: false,
  },
  {
    id: "email",
    label: "Email",
    previewAvailable: true,
    publishSupported: false,
  },
]

export function studioPreviewChannelLabel(id: StudioPreviewChannelId): string {
  return STUDIO_PREVIEW_CHANNELS.find((row) => row.id === id)?.label ?? id
}

export function isSimulatorPlatform(
  id: StudioPreviewChannelId
): id is SimulatorPlatform {
  return id !== "facebook_story"
}

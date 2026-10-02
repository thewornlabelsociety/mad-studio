export type DispatchPlatform =
  | "ig_story"
  | "ig_feed"
  | "facebook"
  | "tiktok"
  | "email"

export type DispatchTrack = "autopilot" | "draft_drop" | "none"

export function dispatchTrackForPlatform(
  platform: DispatchPlatform
): DispatchTrack {
  if (platform === "ig_feed" || platform === "facebook") return "autopilot"
  if (platform === "ig_story" || platform === "tiktok") return "draft_drop"
  return "none"
}

export const DRAFT_DROP_SOP_HELPER =
  "Meta/TikTok policy: Native music stickers, polls, and clickable links must be attached in-app. Media & shortlink are ready for your 15-second phone drop."

export const TIKTOK_API_SOP_HELPER =
  "Optional: with TikTok connected under Settings → Social, use Direct Post for .mp4/.mov (sandbox posts are private until TikTok approves the app)."

export const AUTOPILOT_SOP_HELPER =
  "Track 1 autopilot: 4:5 feed post goes live via API with caption and trackable /r/ link — no phone step."

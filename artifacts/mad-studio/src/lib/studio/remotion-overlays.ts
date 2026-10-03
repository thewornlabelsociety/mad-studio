import type { CanvasTextOverlayState } from "@/lib/studio/canvas-text-types"
import { resolveCanvasTextFontScale } from "@/lib/studio/canvas-text-layout"

export type RemotionTextPreset = "kinetic_hook" | "acid_lime_pill" | "plain"

export type RemotionTextOverlay = {
  id: string
  text: string
  preset: RemotionTextPreset
  role: "hook" | "headline" | "subhead"
  /** 0–100 within composition width */
  x: number
  /** 0–100 within composition height */
  y: number
  rotationDeg?: number
  fontScale?: number
}

export type RemotionBadgeOverlay = {
  label: string
  x: number
  y: number
}

export const REMOTION_SAFE_TOP_PX = 90
export const REMOTION_SAFE_BOTTOM_PX = 120

export function remotionCompositionSize(aspect: "story" | "feed"): {
  width: number
  height: number
} {
  if (aspect === "feed") return { width: 1080, height: 1350 }
  return { width: 1080, height: 1920 }
}

export function buildRemotionTextOverlays(
  overlay: CanvasTextOverlayState
): RemotionTextOverlay[] {
  const blocks: RemotionTextOverlay[] = []
  const scale = resolveCanvasTextFontScale(overlay)

  if (overlay.enabled && overlay.headline.trim()) {
    const preset: RemotionTextPreset =
      overlay.highlight === "brand_pill" ? "acid_lime_pill" : "plain"
    blocks.push({
      id: "headline",
      text: overlay.headline.trim(),
      preset,
      role: "headline",
      x: overlay.positionX,
      y: overlay.positionY,
      rotationDeg: overlay.rotationDeg,
      fontScale: scale,
    })
  }

  if (overlay.enabled && overlay.subhead.trim()) {
    blocks.push({
      id: "subhead",
      text: overlay.subhead.trim(),
      preset: "plain",
      role: "subhead",
      x: overlay.positionX,
      y: Math.min(96, overlay.positionY + 8),
      rotationDeg: overlay.rotationDeg,
      fontScale: scale * 0.72,
    })
  }

  return blocks
}

export function buildRemotionBadgeOverlay(
  _overlay: CanvasTextOverlayState
): RemotionBadgeOverlay | null {
  return null
}

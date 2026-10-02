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

function kineticHookPosition(): { x: number; y: number } {
  const height = 1920
  const safeCenterY =
    REMOTION_SAFE_TOP_PX + (height - REMOTION_SAFE_TOP_PX - REMOTION_SAFE_BOTTOM_PX) / 2
  return { x: 50, y: (safeCenterY / height) * 100 }
}

export function buildRemotionTextOverlays(
  overlay: CanvasTextOverlayState,
  spokenHook: string
): RemotionTextOverlay[] {
  const blocks: RemotionTextOverlay[] = []
  const hookText = spokenHook.trim()
  if (hookText) {
    const pos = kineticHookPosition()
    blocks.push({
      id: "kinetic-hook",
      text: hookText,
      preset: "kinetic_hook",
      role: "hook",
      x: pos.x,
      y: pos.y,
    })
  }

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
  overlay: CanvasTextOverlayState
): RemotionBadgeOverlay | null {
  if (overlay.storyStickerMode === "link_badge") {
    const label = overlay.linkBadgeLabel?.trim() || "EXPLORE DROP ↗"
    return { label, x: overlay.stickerX, y: overlay.stickerY }
  }
  if (
    overlay.storyStickerMode === "none" &&
    overlay.stickerEnabled &&
    overlay.stickerId === "link_pill"
  ) {
    return {
      label: overlay.stickerLabel.trim() || "Shop now",
      x: overlay.stickerX,
      y: overlay.stickerY,
    }
  }
  return null
}

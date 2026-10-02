import type { CanvasTextOverlayState } from "@/lib/studio/canvas-text-types"

/** Matches baked PNG typography: font px = frameWidth × ratio × fontScale. */
export const CANVAS_TEXT_WIDTH_RATIO = 0.065

export const CANVAS_TEXT_FONT_SCALE_MIN = 0.5
export const CANVAS_TEXT_FONT_SCALE_MAX = 2.5
export const CANVAS_TEXT_FONT_SCALE_DEFAULT = 1

export function clampCanvasTextFontScale(value: number): number {
  if (!Number.isFinite(value)) return CANVAS_TEXT_FONT_SCALE_DEFAULT
  return Math.min(
    CANVAS_TEXT_FONT_SCALE_MAX,
    Math.max(CANVAS_TEXT_FONT_SCALE_MIN, value)
  )
}

export function resolveCanvasTextFontScale(
  overlay: Pick<CanvasTextOverlayState, "fontScale">
): number {
  return clampCanvasTextFontScale(
    overlay.fontScale ?? CANVAS_TEXT_FONT_SCALE_DEFAULT
  )
}

export function canvasTextFontSizePx(
  frameWidthPx: number,
  fontScale: number
): number {
  const width = Math.max(1, frameWidthPx)
  const scale = clampCanvasTextFontScale(fontScale)
  return Math.max(12, Math.round(width * CANVAS_TEXT_WIDTH_RATIO * scale))
}

export function canvasTextLineHeightPx(fontSizePx: number): number {
  return fontSizePx * 1.15
}

export function clampCanvasTextRotationDeg(value: number): number {
  if (!Number.isFinite(value)) return 0
  let deg = value % 360
  if (deg > 180) deg -= 360
  if (deg < -180) deg += 360
  return Math.round(deg * 10) / 10
}

export function resolveCanvasTextRotationDeg(
  overlay: Pick<CanvasTextOverlayState, "rotationDeg">
): number {
  return clampCanvasTextRotationDeg(overlay.rotationDeg ?? 0)
}

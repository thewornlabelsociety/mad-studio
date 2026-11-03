import type { CanvasTextOverlayState } from "@/lib/studio/canvas-text-types"

/** Matches baked PNG typography: font px = frameWidth × ratio × fontScale. */
export const CANVAS_TEXT_WIDTH_RATIO = 0.065

export const CANVAS_TEXT_FONT_SCALE_MIN = 0.15
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
  // No pixel floor: the preview must match the baked image at any size.
  return Math.max(1, width * CANVAS_TEXT_WIDTH_RATIO * scale)
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

/**
 * Text stays this far in from the image edges (percent of width / height).
 * Instagram's profile grid shows feed posts at 3:4, trimming about 3% off
 * each side of a 4:5 post, so anything closer to the edge gets cut off there.
 */
export const CANVAS_TEXT_SAFE_MARGIN_X = 4
export const CANVAS_TEXT_SAFE_MARGIN_Y = 3

/**
 * Where a box's centre actually sits so the whole box stays inside the safe
 * area. `sizePct` is the box's width (or height) as a percent of the image.
 */
export function clampCanvasBoxCentre(
  centrePct: number,
  sizePct: number,
  marginPct: number
): number {
  const half = sizePct / 2
  const min = marginPct + half
  const max = 100 - marginPct - half
  if (min > max) return 50
  return Math.min(max, Math.max(min, centrePct))
}

/** How much to shrink a box that's wider than the safe area (1 = fits). */
export function canvasBoxFitScale(widthPct: number): number {
  const safe = 100 - CANVAS_TEXT_SAFE_MARGIN_X * 2
  return widthPct > safe ? safe / widthPct : 1
}

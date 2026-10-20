import type { SavedCanvasLayout } from "@/lib/entities/dna-schema"
import {
  canvasOverlayHasDecor,
  canvasOverlayWithoutCopy,
  normalizeCanvasTextOverlay,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"

/** How saved headline/subhead interact with the slide you're editing. */
export type LayoutWordingMode = "keep-slide" | "fill-empty"

export type { SavedCanvasLayout }

/**
 * What a layout keeps: every style and position, which tags/logo/backdrop
 * are on, and the headline/subhead as starter wording. What it drops is
 * per-photo: the item's brand/size/price/vibe and the cutout image.
 */
export function layoutFromOverlay(
  overlay: CanvasTextOverlayState
): Record<string, unknown> {
  const {
    tagBrand: _brand,
    tagSize: _size,
    tagPrice: _price,
    tagVibe: _vibe,
    cutoutUrl: _cutout,
    cutoutSourceUrl: _cutoutSource,
    ...layout
  } = overlay
  return layout
}

/**
 * A slide with the layout applied: the layout's look and placement, this
 * slide's own words (or the layout's starter wording if it has none), its
 * own item details and its own cutout.
 */
export function applyLayoutToOverlay(input: {
  layout: SavedCanvasLayout
  slide: CanvasTextOverlayState
  /** keep-slide = style only, never replace words already on this slide */
  wording?: LayoutWordingMode
}): CanvasTextOverlayState {
  const { layout, slide, wording = "keep-slide" } = input
  const look = normalizeCanvasTextOverlay(layout.overlay)
  const slideNorm = normalizeCanvasTextOverlay(slide)

  const headline =
    wording === "keep-slide"
      ? slideNorm.headline
      : slideNorm.headline.trim()
        ? slideNorm.headline
        : look.headline
  const subhead =
    wording === "keep-slide"
      ? slideNorm.subhead
      : slideNorm.subhead.trim()
        ? slideNorm.subhead
        : look.subhead

  const merged = normalizeCanvasTextOverlay({
    ...look,
    headline,
    subhead,
    tagNewLabel: look.tagNewLabel,
    tagBrand: slideNorm.tagBrand,
    tagSize: slideNorm.tagSize,
    tagPrice: slideNorm.tagPrice,
    tagVibe: slideNorm.tagVibe,
    cutoutUrl: slideNorm.cutoutUrl,
    cutoutSourceUrl: slideNorm.cutoutSourceUrl,
    logoUrl: slideNorm.logoUrl || look.logoUrl,
    backdropEnabled:
      look.backdropEnabled && Boolean(slideNorm.cutoutUrl),
  })

  const enabled = canvasOverlayHasDecor({ ...merged, enabled: true })
  return { ...merged, enabled }
}

/** Starting point for a new post when a default layout is set. */
export function defaultLayoutOverlay(
  layouts: SavedCanvasLayout[] | null | undefined
): CanvasTextOverlayState | null {
  const layout = layouts?.find((row) => row.isDefault)
  if (!layout) return null
  return canvasOverlayWithoutCopy(
    normalizeCanvasTextOverlay({
      ...layout.overlay,
      tagBrand: "",
      tagSize: "",
      tagPrice: "",
      tagVibe: "",
      cutoutUrl: "",
      cutoutSourceUrl: "",
      // Backdrop needs each photo cut out first; it's switched on when applied.
      backdropEnabled: false,
    })
  )
}

export function layoutWantsBackdrop(layout: SavedCanvasLayout): boolean {
  return layout.overlay.backdropEnabled === true
}

import type { SavedCanvasLayout } from "@/lib/entities/dna-schema"
import {
  normalizeCanvasTextOverlay,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"

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
}): CanvasTextOverlayState {
  const { layout, slide } = input
  const look = normalizeCanvasTextOverlay(layout.overlay)
  return normalizeCanvasTextOverlay({
    ...look,
    enabled: true,
    headline: slide.headline.trim() ? slide.headline : look.headline,
    subhead: slide.subhead.trim() ? slide.subhead : look.subhead,
    tagNewLabel: look.tagNewLabel,
    tagBrand: slide.tagBrand,
    tagSize: slide.tagSize,
    tagPrice: slide.tagPrice,
    tagVibe: slide.tagVibe,
    cutoutUrl: slide.cutoutUrl,
    cutoutSourceUrl: slide.cutoutSourceUrl,
    // Logo comes from the brand, so a layout saved before a logo change
    // still shows the current one.
    logoUrl: slide.logoUrl || look.logoUrl,
  })
}

/** Starting point for a new post when a default layout is set. */
export function defaultLayoutOverlay(
  layouts: SavedCanvasLayout[] | null | undefined
): CanvasTextOverlayState | null {
  const layout = layouts?.find((row) => row.isDefault)
  if (!layout) return null
  return normalizeCanvasTextOverlay({
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
}

export function layoutWantsBackdrop(layout: SavedCanvasLayout): boolean {
  return layout.overlay.backdropEnabled === true
}

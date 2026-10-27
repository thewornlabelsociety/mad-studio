import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import type { SavedCanvasLayout } from "@/lib/entities/dna-schema"
import { overlayPatchFromItemFacts } from "@/lib/studio/new-arrival-suggestions"
import {
  canvasOverlayHasDecor,
  canvasOverlayWithoutCopy,
  canvasTagTogglesOn,
  DEFAULT_CANVAS_TEXT_OVERLAY,
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
  const normalized = normalizeCanvasTextOverlay(overlay)
  const {
    tagBrand: _brand,
    tagSize: _size,
    tagPrice: _price,
    tagVibe: _vibe,
    cutoutUrl: _cutout,
    cutoutSourceUrl: _cutoutSource,
    ...layout
  } = normalized
  // Drop undefined / non-JSON values so Zod + Postgres JSONB never reject.
  return JSON.parse(JSON.stringify(layout)) as Record<string, unknown>
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
    tagNewLabel: slideNorm.tagNewLabel.trim()
      ? slideNorm.tagNewLabel
      : look.tagNewLabel,
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

  // Style-only layouts (fonts/placement, tags off, no words yet) still need
  // enabled so the next typed Word/Tag paints with this layout's look.
  const hasLook =
    canvasOverlayHasDecor({ ...merged, enabled: true }) ||
    look.enabled ||
    Boolean(look.headline.trim() || look.subhead.trim()) ||
    canvasTagTogglesOn(look) ||
    Boolean(look.logoEnabled && look.logoUrl)
  return { ...merged, enabled: hasLook }
}

/**
 * Slide state before merging a saved layout — listing tag *values* only, no
 * auto toggles or stacked positions from freshOverlayFor / lastOverlayStyle.
 */
export function slideOverlayBeforeLayoutApply(input: {
  slide?: CanvasTextOverlayState | null
  facts?: CanvasItemFacts | null
}): CanvasTextOverlayState {
  if (input.slide) return normalizeCanvasTextOverlay(input.slide)
  const listing = input.facts
    ? overlayPatchFromItemFacts({ facts: input.facts, enableTags: false })
    : {}
  return normalizeCanvasTextOverlay({
    ...DEFAULT_CANVAS_TEXT_OVERLAY,
    ...listing,
  })
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

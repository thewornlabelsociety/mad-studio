import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import type { MediaAsset } from "@/components/marketing/media-tray"
import type { StoryPreviewState } from "@/components/marketing/multi-platform-simulator"
import type { SavedCanvasLayout } from "@/lib/entities/dna-schema"
import {
  applyLayoutToOverlay,
  defaultLayoutOverlay,
} from "@/lib/studio/canvas-layouts"
import {
  canvasOverlayWithoutCopy,
  DEFAULT_CANVAS_TEXT_OVERLAY,
  normalizeCanvasTextOverlay,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"
import {
  isCatalogMetadataDump,
  readableListingCaption,
} from "@/lib/inventory/context-hooks"
import { overlayPatchFromItemFacts } from "@/lib/studio/new-arrival-suggestions"
import { stripAuSizePrefix } from "@/lib/studio/canvas-size-tag-label"
import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import {
  buildWlsDailyStoryCanvasModel,
  WLS_DAILY_STORY_PALETTE,
  WLS_DAILY_STORY_TEMPLATE_NAME,
} from "@/lib/templates/wls-daily-story"

/** Max products in one Daily Story handoff (Checkpoint 1). */
export const WLS_DAILY_STORY_STUDIO_MAX_FRAMES = 5

export const WLS_DAILY_STORY_HANDOFF_QUERY_FLAG = "wlsDailyStory"

export type WlsDailyStoryStudioTemplateMeta = {
  templateInstanceId: string
  templateVersion: number
  formulaHookId: string | null
  canvasLayoutId: string | null
  storyStylePreset: string | null
  creativeSpark: string
}

export type WlsDailyStoryStudioSeedResult = {
  mediaAssets: MediaAsset[]
  slideOverlays: Record<string, CanvasTextOverlayState>
  slideFacts: Record<string, CanvasItemFacts>
  storyPreview: StoryPreviewState
}

function formatNzdPriceLabel(price: number | null): string | null {
  if (price == null || !Number.isFinite(price)) return null
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(price)
}

/** Copy-step caption from a synced WLS listing (title + details — not Canvas Words). */
export function wlsSelectionIntakeCaption(
  selection: WlsProductSelection
): string {
  const title = selection.title.replace(/\s+/g, " ").trim()
  const lines: string[] = []
  if (title) lines.push(title)

  const detailParts = [
    selection.brand?.trim(),
    selection.size?.trim() ? `Size ${selection.size.trim()}` : null,
    formatNzdPriceLabel(selection.price),
  ].filter(Boolean) as string[]
  if (detailParts.length > 0) {
    lines.push(detailParts.join(" · "))
  }

  const rawDesc = selection.description?.trim() ?? ""
  if (rawDesc) {
    if (isCatalogMetadataDump(rawDesc)) {
      const cleaned = readableListingCaption({
        title,
        description: rawDesc,
        brand: selection.brand,
      })
      if (cleaned && cleaned.toLowerCase() !== title.toLowerCase()) {
        lines.push(cleaned)
      }
    } else if (rawDesc.length <= 500) {
      lines.push(rawDesc)
    } else {
      lines.push(`${rawDesc.slice(0, 497).trim()}…`)
    }
  }

  return lines.join("\n\n")
}

/** Listing facts for Canvas tags — verified size only, NZD price, no description dump. */
export function wlsSelectionToItemFacts(
  selection: WlsProductSelection
): CanvasItemFacts {
  const sizeRaw = selection.size?.trim() ?? null
  const size = sizeRaw
    ? stripAuSizePrefix(sizeRaw).toUpperCase() || null
    : null
  return {
    brand: selection.brand?.trim() || null,
    size,
    price: formatNzdPriceLabel(selection.price),
    vibe: null,
    newLabel: "New Arrival",
  }
}

export function wlsDailyStoryPreviewDefaults(): StoryPreviewState {
  return {
    stylePreset: "moody_noir",
    canvasColor: WLS_DAILY_STORY_PALETTE.canvas,
    bgPresetId: "brand",
    cutoutMode: "original",
    cutoutImageUrl: null,
    subjectScale: 1,
    subjectOffsetY: 0,
  }
}

export function wlsStoryAssetIdForProduct(marketingEntityId: string): string {
  return `wls-story-${marketingEntityId}`
}

export type WlsStoryFrameBundle = {
  asset: MediaAsset
  overlay: CanvasTextOverlayState
  facts: CanvasItemFacts
}

function resolveWlsLayout(input: {
  canvasLayouts: SavedCanvasLayout[]
  canvasLayoutId: string | null
}): SavedCanvasLayout | null {
  return (
    (input.canvasLayoutId &&
      input.canvasLayouts.find((row) => row.id === input.canvasLayoutId)) ||
    input.canvasLayouts.find((row) => row.id === "story_9_16") ||
    null
  )
}

/** One Story frame from a validated WlsProductSelection (Checkpoint 2 add/replace). */
export function buildWlsStoryFrameFromSelection(input: {
  selection: WlsProductSelection
  entityId: string
  brandName: string
  brandLogoUrl?: string | null
  canvasLayouts: SavedCanvasLayout[]
  canvasLayoutId: string | null
  resolveImageUrl: (sourceUrl: string) => string
}): WlsStoryFrameBundle {
  const layout = resolveWlsLayout({
    canvasLayouts: input.canvasLayouts,
    canvasLayoutId: input.canvasLayoutId,
  })
  const layoutBase = resolveLayoutBase({
    canvasLayouts: input.canvasLayouts,
    canvasLayoutId: input.canvasLayoutId,
    brandLogoUrl: input.brandLogoUrl?.trim() ?? "",
  })
  const sourceImage =
    input.selection.sourceImageUrls.find((url) => /^https?:\/\//i.test(url)) ??
    ""
  const id = wlsStoryAssetIdForProduct(input.selection.marketingEntityId)
  const displayUrl = input.resolveImageUrl(sourceImage)
  const intakeCaption = wlsSelectionIntakeCaption(input.selection)

  return {
    asset: {
      id,
      url: displayUrl,
      publicUrl: displayUrl,
      type: "image",
      marketingEntityId: input.selection.marketingEntityId,
      destinationUrl: input.selection.destinationUrl,
      intakeCaption,
      intakeTags: [
        input.selection.brand?.trim(),
        input.selection.size?.trim(),
        formatNzdPriceLabel(input.selection.price) ?? undefined,
      ].filter(Boolean) as string[],
    },
    facts: wlsSelectionToItemFacts(input.selection),
    overlay: overlayForWlsFrame({
      selection: input.selection,
      brandName: input.brandName,
      imageUrl: displayUrl,
      layoutBase,
      layout,
    }),
  }
}

/**
 * Replace active frame product — keep operator typography, cutout scale and positions;
 * refresh listing tags/words; clear cutout when the source photo changes.
 */
export function mergeWlsReplaceOverlay(input: {
  existing: CanvasTextOverlayState | undefined
  seeded: CanvasTextOverlayState
  previousImageUrl: string
  nextImageUrl: string
}): CanvasTextOverlayState {
  const imageChanged =
    input.previousImageUrl.trim() !== input.nextImageUrl.trim()
  if (!input.existing) {
    return input.seeded
  }
  const prior = normalizeCanvasTextOverlay(input.existing)
  const seeded = normalizeCanvasTextOverlay(input.seeded)
  return normalizeCanvasTextOverlay({
    ...prior,
    tagBrand: seeded.tagBrand,
    tagSize: seeded.tagSize,
    tagPrice: seeded.tagPrice,
    tagVibe: seeded.tagVibe,
    tagNewLabel: seeded.tagNewLabel,
    tagShowBrand: seeded.tagShowBrand,
    tagShowSize: seeded.tagShowSize,
    tagShowPrice: seeded.tagShowPrice,
    tagShowVibe: seeded.tagShowVibe,
    headline: prior.headline,
    subhead: prior.subhead,
    stickerLabel: seeded.stickerLabel,
    enabled: prior.enabled || seeded.enabled,
    ...(imageChanged
      ? {
          cutoutUrl: "",
          cutoutSourceUrl: "",
          backdropEnabled: false,
        }
      : null),
  })
}

function resolveLayoutBase(input: {
  canvasLayouts: SavedCanvasLayout[]
  canvasLayoutId: string | null
  brandLogoUrl: string
}): CanvasTextOverlayState {
  const byId =
    input.canvasLayoutId &&
    input.canvasLayouts.find((row) => row.id === input.canvasLayoutId)
  const fromDefault = defaultLayoutOverlay(input.canvasLayouts)
  const base = normalizeCanvasTextOverlay(
    byId
      ? canvasOverlayWithoutCopy(
          normalizeCanvasTextOverlay({
            ...byId.overlay,
            tagBrand: "",
            tagSize: "",
            tagPrice: "",
            tagVibe: "",
            cutoutUrl: "",
            cutoutSourceUrl: "",
            backdropEnabled: false,
          })
        )
      : fromDefault ?? DEFAULT_CANVAS_TEXT_OVERLAY
  )
  return {
    ...base,
    logoUrl: input.brandLogoUrl || base.logoUrl,
    logoEnabled: Boolean(input.brandLogoUrl || base.logoUrl),
  }
}

function overlayForWlsFrame(input: {
  selection: WlsProductSelection
  brandName: string
  imageUrl: string
  layoutBase: CanvasTextOverlayState
  layout: SavedCanvasLayout | null
}): CanvasTextOverlayState {
  const facts = wlsSelectionToItemFacts(input.selection)
  const model = buildWlsDailyStoryCanvasModel({
    selection: input.selection,
    brandName: input.brandName,
    imageUrl: input.imageUrl,
  })
  const tagPatch = overlayPatchFromItemFacts({ facts, enableTags: true })
  const slideSeed = normalizeCanvasTextOverlay({
    ...input.layoutBase,
    ...tagPatch,
    headline: "",
    subhead: "",
    stickerLabel: model.stickerLabel,
    stickerEnabled: true,
    enabled: true,
    backdropEnabled: false,
    cutoutUrl: "",
    cutoutSourceUrl: "",
  })
  const withLayout = input.layout
    ? applyLayoutToOverlay({
        layout: input.layout,
        slide: slideSeed,
        wording: "keep-slide",
      })
    : slideSeed
  return normalizeCanvasTextOverlay({
    ...withLayout,
    headline: "",
    subhead: "",
    tagBrand: tagPatch.tagBrand,
    tagSize: tagPatch.tagSize,
    tagPrice: tagPatch.tagPrice,
    tagVibe: tagPatch.tagVibe,
    tagNewLabel: tagPatch.tagNewLabel,
    tagShowBrand: tagPatch.tagShowBrand,
    tagShowSize: tagPatch.tagShowSize,
    tagShowPrice: tagPatch.tagShowPrice,
    tagShowVibe: tagPatch.tagShowVibe,
  })
}

/**
 * Map server-validated WLS selections into Studio tray + per-frame overlays.
 * Caller must pass proxied image URLs for preview (entity-scoped proxy).
 */
export function buildWlsDailyStoryStudioSeed(input: {
  selections: WlsProductSelection[]
  entityId: string
  brandName: string
  brandLogoUrl?: string | null
  canvasLayouts: SavedCanvasLayout[]
  canvasLayoutId: string | null
  resolveImageUrl: (sourceUrl: string) => string
}): WlsDailyStoryStudioSeedResult {
  const mediaAssets: MediaAsset[] = []
  const slideOverlays: Record<string, CanvasTextOverlayState> = {}
  const slideFacts: Record<string, CanvasItemFacts> = {}

  for (const selection of input.selections) {
    const frame = buildWlsStoryFrameFromSelection({
      selection,
      entityId: input.entityId,
      brandName: input.brandName,
      brandLogoUrl: input.brandLogoUrl,
      canvasLayouts: input.canvasLayouts,
      canvasLayoutId: input.canvasLayoutId,
      resolveImageUrl: input.resolveImageUrl,
    })
    mediaAssets.push(frame.asset)
    slideFacts[frame.asset.id] = frame.facts
    slideOverlays[frame.asset.id] = frame.overlay
  }

  return {
    mediaAssets,
    slideOverlays,
    slideFacts,
    storyPreview: wlsDailyStoryPreviewDefaults(),
  }
}

export function isWlsDailyStoryTemplateName(name: string): boolean {
  return name.trim() === WLS_DAILY_STORY_TEMPLATE_NAME
}

import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import type { MediaAsset } from "@/components/marketing/media-tray"
import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import {
  wlsSelectionIntakeCaption,
  wlsSelectionToItemFacts,
} from "@/lib/templates/wls-daily-story-studio-seed"
import {
  suggestFormatForWlsSelection,
  wlsSelectionMedia,
} from "@/lib/studio/wls-strip-format"
import type { SuggestedFormat } from "@/lib/studio/new-arrival-suggestions"

export type WlsFeedTrayBundle = {
  assets: MediaAsset[]
  factsByAssetId: Record<string, CanvasItemFacts>
  format: SuggestedFormat
}

/** Build media tray rows using the same format rules as Suggested New Arrivals. */
export function buildFeedTrayFromWlsSelection(
  selection: WlsProductSelection,
  assetIdPrefix = "wls-pick"
): WlsFeedTrayBundle | null {
  const media = wlsSelectionMedia(selection)
  if (media.length === 0) return null

  const { format } = suggestFormatForWlsSelection(selection)
  const facts = wlsSelectionToItemFacts(selection)
  const intakeCaption = wlsSelectionIntakeCaption(selection)
  const intake = {
    marketingEntityId: selection.marketingEntityId,
    destinationUrl: selection.destinationUrl,
    intakeCaption,
    intakeTags: [facts.brand, facts.size, facts.price].filter(
      Boolean
    ) as string[],
  }

  const all: MediaAsset[] = media.map((row, index) => ({
    id: `${assetIdPrefix}-${selection.marketingEntityId}-${index}`,
    url: row.url,
    publicUrl: row.url,
    type: row.kind,
    ...intake,
  }))

  const firstVideo = all.find((row) => row.type === "video")
  const firstPhoto = all.find((row) => row.type !== "video") ?? all[0]
  const chosen =
    format === "carousel"
      ? all.filter((row) => row.type !== "video")
      : format === "reel" && firstVideo
        ? [firstVideo]
        : firstPhoto
          ? [firstPhoto]
          : []

  if (chosen.length === 0) return null

  const factsByAssetId = Object.fromEntries(
    chosen.map((asset) => [asset.id, facts] as const)
  )
  return { assets: chosen, factsByAssetId, format }
}

/** @deprecated Prefer buildFeedTrayFromWlsSelection */
export function mediaAssetFromWlsSelection(
  selection: WlsProductSelection,
  assetIdPrefix = "wls-pick"
): { asset: MediaAsset; facts: CanvasItemFacts } | null {
  const bundle = buildFeedTrayFromWlsSelection(selection, assetIdPrefix)
  if (!bundle || bundle.assets.length === 0) return null
  const asset = bundle.assets[0]
  return { asset, facts: bundle.factsByAssetId[asset.id] }
}

import { firstUsableProductImageUrl } from "@/lib/inventory/wls-product-eligibility"
import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import { detectMediaKindFromUrl } from "@/lib/media/kind"
import {
  suggestFormat,
  SUGGESTED_FORMAT_LABELS,
  type SuggestedFormat,
} from "@/lib/studio/new-arrival-suggestions"

export function wlsSelectionMedia(
  selection: WlsProductSelection
): Array<{ url: string; kind: "image" | "video" }> {
  const urls: string[] = []
  for (const raw of selection.sourceImageUrls) {
    const url =
      firstUsableProductImageUrl([raw]) ??
      (/^https?:\/\//i.test(raw.trim()) ? raw.trim() : null)
    if (url) urls.push(url)
  }
  return urls.map((url) => ({
    url,
    kind: detectMediaKindFromUrl(url) === "video" ? "video" : "image",
  }))
}

export function suggestFormatForWlsSelection(
  selection: WlsProductSelection,
  isFashion = true
): { format: SuggestedFormat; label: string; reason: string } {
  const media = wlsSelectionMedia(selection)
  const { format, reason } = suggestFormat({ media, isFashion })
  return {
    format,
    label: SUGGESTED_FORMAT_LABELS[format],
    reason,
  }
}

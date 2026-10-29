import { toPng } from "html-to-image"

import type { AspectRatio, WornLabelCampaignConfig } from "@/types/social-creative"

/** Logical width; `pixelRatio: 3` → 1080px output */
export const PROMO_EXPORT_WIDTH = 360

export function promoExportHeight(aspectRatio: AspectRatio): number {
  return aspectRatio === "1:1" ? 360 : 640
}

function exportFilename(config: WornLabelCampaignConfig): string {
  const ratio = config.aspectRatio.replace(":", "x")
  return `WLS-${config.colorName}-TAG-${ratio}.png`
}

export async function exportPromoPng(
  node: HTMLElement,
  config: WornLabelCampaignConfig
): Promise<void> {
  const width = PROMO_EXPORT_WIDTH
  const height = promoExportHeight(config.aspectRatio)

  const dataUrl = await toPng(node, {
    // Proxied images differ only by query string; without this they all share one cache entry.
    includeQueryParams: true,
    cacheBust: true,
    pixelRatio: 3,
    width,
    height,
  })

  const anchor = document.createElement("a")
  anchor.download = exportFilename(config)
  anchor.href = dataUrl
  anchor.click()
}

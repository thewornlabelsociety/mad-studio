import { toBlob } from "html-to-image"

import { storyExportFilter } from "@/components/marketing/story-canvas"

/** Store a rendered PNG in entity-assets and return its public URL. */
export async function uploadRenderedPng(
  blob: Blob,
  entityId: string
): Promise<string> {
  const form = new FormData()
  form.append("file", blob, "artwork.png")
  form.append("entityId", entityId)
  const response = await fetch("/api/media/upload-cutout", {
    method: "POST",
    body: form,
  })
  const payload = (await response.json().catch(() => ({}))) as {
    transparentUrl?: string
    error?: string
  }
  if (!response.ok || !payload.transparentUrl) {
    throw new Error(payload.error || "Couldn't upload the finished artwork.")
  }
  return payload.transparentUrl
}

/** Render a story card node at Instagram's 1080 × 1920 and upload it. */
export async function renderStoryCardToUrl(
  node: HTMLElement,
  entityId: string
): Promise<string> {
  const blob = await toBlob(node, {
    // Proxied images differ only by query string; without this they all share one cache entry.
    includeQueryParams: true,
    cacheBust: true,
    filter: storyExportFilter,
    pixelRatio: 1080 / node.offsetWidth,
  })
  if (!blob) throw new Error("Couldn't render the story card.")
  return uploadRenderedPng(blob, entityId)
}

/** Same-origin copy of a remote image so the browser can read its pixels. */
export function proxiedImageUrl(url: string, entityId: string): string {
  if (/^(data:|blob:|\/)/.test(url)) return url
  return `/api/media/image-proxy?url=${encodeURIComponent(url)}&entityId=${encodeURIComponent(entityId)}`
}

/** Width ÷ height of an image, or null if it can't be loaded. */
export function imageAspectRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () =>
      resolve(image.naturalHeight ? image.naturalWidth / image.naturalHeight : null)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

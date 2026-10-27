/**
 * Studio tray URLs are often same-origin image-proxy paths; remove-bg must fetch
 * the underlying public HTTPS image (Cloudinary + safe-image-fetch).
 */
export function resolveRemoveBgSourceUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Image source URL is required.")
  }

  const proxyPattern =
    /^(?:https?:\/\/[^/?#]+)?(\/api\/media\/image-proxy\?[^#]+)/i
  const proxyPath = trimmed.match(proxyPattern)
  if (proxyPath) {
    const query = proxyPath[1]?.includes("?")
      ? proxyPath[1].slice(proxyPath[1].indexOf("?") + 1)
      : ""
    const inner = new URLSearchParams(query).get("url")?.trim()
    if (inner && /^https?:\/\//i.test(inner)) {
      return inner
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  throw new Error(
    "Cutout needs a fetchable image URL. Try re-adding the photo from the library or synced listing."
  )
}

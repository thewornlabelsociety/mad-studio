export type MediaKind = "image" | "video"

/** Infer image vs video from a settled public / blob / data URL. Server-safe. */
export function detectMediaKindFromUrl(url: string): MediaKind {
  const cleaned = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? ""
  if (/\.(mp4|mov|webm|m4v)$/.test(cleaned)) return "video"
  if (cleaned.startsWith("blob:") || cleaned.startsWith("data:video")) {
    if (cleaned.startsWith("data:video")) return "video"
  }
  return "image"
}

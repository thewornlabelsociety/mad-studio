/** Query flag Studio looks for when finished slides are waiting in the tray. */
export const STUDIO_SLIDES_QUERY_FLAG = "slides"

export type StudioSlidesHandoff = {
  /** Public, already-baked slide images in carousel order. */
  urls: string[]
  /** Starting caption for the Copy step. */
  caption: string
  /** Shop links for the pieces, used as the post's destination. */
  destinationUrl?: string | null
}

function key(entityId: string): string {
  return `studio-slides:${entityId}`
}

export function saveStudioSlidesHandoff(entityId: string, handoff: StudioSlidesHandoff): void {
  sessionStorage.setItem(key(entityId), JSON.stringify(handoff))
}

/** Read and clear the waiting slides (once). */
export function takeStudioSlidesHandoff(entityId: string): StudioSlidesHandoff | null {
  try {
    const raw = sessionStorage.getItem(key(entityId))
    if (!raw) return null
    sessionStorage.removeItem(key(entityId))
    const parsed = JSON.parse(raw) as Partial<StudioSlidesHandoff>
    const urls = Array.isArray(parsed.urls)
      ? parsed.urls.filter((url): url is string => typeof url === "string" && /^https:\/\//i.test(url))
      : []
    if (urls.length === 0) return null
    return {
      urls: urls.slice(0, 10),
      caption: typeof parsed.caption === "string" ? parsed.caption : "",
      destinationUrl: typeof parsed.destinationUrl === "string" ? parsed.destinationUrl : null,
    }
  } catch {
    return null
  }
}

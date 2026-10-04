import type { MediaVisualInspection } from "@/lib/media/inspect-schema"

async function sampleVideoElementToJpegDataUrl(
  video: HTMLVideoElement
): Promise<string | null> {
  const target = Math.min(0.25, Math.max(0, (video.duration || 1) * 0.05))
  if (Number.isFinite(target) && target > 0) {
    await new Promise<void>((resolve) => {
      const onSeeked = () => resolve()
      video.addEventListener("seeked", onSeeked, { once: true })
      video.currentTime = target
      window.setTimeout(() => resolve(), 800)
    })
  }

  const width = video.videoWidth || 720
  const height = video.videoHeight || 1280
  const canvas = document.createElement("canvas")
  canvas.width = Math.min(width, 1280)
  canvas.height = Math.round((height / width) * canvas.width)
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.85)
}

async function loadVideoFromSrc(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video")
  video.preload = "auto"
  video.muted = true
  video.playsInline = true
  video.crossOrigin = "anonymous"
  video.src = src

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => resolve()
    const onError = () => reject(new Error("Could not load video for keyframe."))
    video.addEventListener("loadeddata", onLoaded, { once: true })
    video.addEventListener("error", onError, { once: true })
  })

  return video
}

function mediaProxyUrlForBrowser(originalMediaUrl: string): string {
  if (typeof window === "undefined") return originalMediaUrl
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""
  return `${window.location.origin}${base}/api/media/proxy?url=${encodeURIComponent(originalMediaUrl)}`
}

/** Sample the first readable frame of a video File as a JPEG data URL. */
export async function extractVideoKeyframeDataUrl(
  file: File
): Promise<string | null> {
  if (typeof document === "undefined") return null

  const objectUrl = URL.createObjectURL(file)
  try {
    const video = await loadVideoFromSrc(objectUrl)
    return await sampleVideoElementToJpegDataUrl(video)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Sample a keyframe from a public HTTPS reel (uses media proxy if direct CORS fails). */
export async function extractVideoKeyframeFromUrl(
  mediaUrl: string
): Promise<string | null> {
  if (typeof document === "undefined") return null
  const trimmed = mediaUrl.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null

  const candidates = [trimmed]
  const proxied = mediaProxyUrlForBrowser(trimmed)
  if (proxied !== trimmed) candidates.push(proxied)

  for (const src of candidates) {
    try {
      const video = await loadVideoFromSrc(src)
      const frame = await sampleVideoElementToJpegDataUrl(video)
      if (frame) return frame
    } catch {
      // try proxy or next source
    }
  }
  return null
}

export async function requestMediaInspection(input: {
  mediaUrl: string
  mediaType: "image" | "video"
  entityId: string
  frameDataUrl?: string | null
}): Promise<MediaVisualInspection> {
  const response = await fetch("/api/media/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
      entityId: input.entityId,
      frameDataUrl: input.frameDataUrl ?? null,
    }),
  })
  const payload = (await response.json()) as MediaVisualInspection & {
    error?: string
  }
  if (!response.ok) {
    throw new Error(payload.error || "Visual inspection failed.")
  }
  return {
    visualDescription: payload.visualDescription,
    aestheticTags: payload.aestheticTags ?? [],
    concreteFeatures: payload.concreteFeatures ?? [],
  }
}

import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import {
  buildMediaInspectPrompt,
  mediaVisualInspectionSchema,
  type MediaVisualInspection,
} from "@/lib/media/inspect-schema"
import { isPublicHttpUrl } from "@/lib/social/types"

function parseDataUrl(dataUrl: string): {
  bytes: Uint8Array
  mimeType: string
} | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl.trim())
  if (!match) return null
  const mimeType = match[1]?.trim() || "image/jpeg"
  const isBase64 = Boolean(match[2])
  const payload = match[3] ?? ""
  try {
    if (isBase64) {
      const buffer = Buffer.from(payload, "base64")
      return { bytes: new Uint8Array(buffer), mimeType }
    }
    const buffer = Buffer.from(decodeURIComponent(payload), "utf8")
    return { bytes: new Uint8Array(buffer), mimeType }
  } catch {
    return null
  }
}

async function fetchMediaBytes(url: string): Promise<{
  bytes: Uint8Array
  mimeType: string
} | null> {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null
    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream"
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length) return null
    return { bytes: new Uint8Array(buffer), mimeType }
  } catch {
    return null
  }
}

/**
 * Run Gemini multimodal inspection on a public media URL or keyframe data URL.
 */
export async function inspectMediaVisuals(input: {
  mediaUrl: string
  mediaType: "image" | "video"
  frameDataUrl?: string | null
  brandHint?: string | null
}): Promise<MediaVisualInspection> {
  const prompt = buildMediaInspectPrompt({
    mediaType: input.mediaType,
    brandHint: input.brandHint,
  })

  type ImagePart = { type: "image"; image: Uint8Array | URL | string }
  type TextPart = { type: "text"; text: string }
  const content: Array<TextPart | ImagePart> = [{ type: "text", text: prompt }]

  if (input.frameDataUrl?.startsWith("data:")) {
    const parsed = parseDataUrl(input.frameDataUrl)
    if (parsed) {
      content.push({ type: "image", image: parsed.bytes })
    }
  } else if (input.mediaType === "image" && isPublicHttpUrl(input.mediaUrl)) {
    // Prefer URL for public HTTPS images (Gemini can fetch).
    content.push({ type: "image", image: new URL(input.mediaUrl) })
  } else if (input.mediaType === "image" && input.mediaUrl.startsWith("data:")) {
    const parsed = parseDataUrl(input.mediaUrl)
    if (parsed) content.push({ type: "image", image: parsed.bytes })
  } else if (isPublicHttpUrl(input.mediaUrl)) {
    // Video without client keyframe — try fetching bytes; Gemini Flash may accept image-like stills only.
    // If content-type is video, still attempt URL (Google may reject); prefer requiring frameDataUrl.
    const fetched = await fetchMediaBytes(input.mediaUrl)
    if (fetched && fetched.mimeType.startsWith("image/")) {
      content.push({ type: "image", image: fetched.bytes })
    } else if (fetched && fetched.mimeType.startsWith("video/")) {
      // Pass as image URL fallback won't work for video. Require frame.
      throw new Error(
        "Video inspection needs a keyframe. Re-upload so the client can sample the first frame."
      )
    } else {
      content.push({ type: "image", image: new URL(input.mediaUrl) })
    }
  } else {
    throw new Error(
      "mediaUrl must be a public HTTPS URL or data URL (or provide frameDataUrl for video)."
    )
  }

  if (content.length < 2) {
    throw new Error("Could not attach media for vision inspection.")
  }

  const { object } = await generateObjectWithFallback({
    schema: mediaVisualInspectionSchema,
    schemaName: "MediaVisualInspection",
    schemaDescription:
      "Grounded visual attributes extracted from uploaded product or food media",
    messages: [
      {
        role: "user",
        content,
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 1200,
  })

  return object
}

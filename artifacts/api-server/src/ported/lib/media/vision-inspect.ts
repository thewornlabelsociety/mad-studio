import { generateObjectWithFallback } from "@/lib/ai/orchestrator"
import {
  buildMediaInspectPrompt,
  mediaVisualInspectionSchema,
  type MediaVisualInspection,
} from "@/lib/media/inspect-schema"
import { fetchPublicImage } from "@/lib/media/safe-image-fetch"

function parseDataUrl(dataUrl: string): {
  bytes: Uint8Array
  mimeType: string
} | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl.trim())
  if (!match) return null
  const mimeType = match[1]?.trim() || "image/jpeg"
  if (!mimeType.startsWith("image/")) return null
  const isBase64 = Boolean(match[2])
  const payload = match[3] ?? ""
  try {
    if (isBase64) {
      const buffer = Buffer.from(payload, "base64")
      if (buffer.byteLength > 15 * 1024 * 1024) return null
      return { bytes: new Uint8Array(buffer), mimeType }
    }
    const buffer = Buffer.from(decodeURIComponent(payload), "utf8")
    if (buffer.byteLength > 15 * 1024 * 1024) return null
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

  type ImagePart = { type: "image"; image: Uint8Array | string }
  type TextPart = { type: "text"; text: string }
  const content: Array<TextPart | ImagePart> = [{ type: "text", text: prompt }]

  if (input.frameDataUrl?.startsWith("data:")) {
    const parsed = parseDataUrl(input.frameDataUrl)
    if (parsed) {
      content.push({ type: "image", image: parsed.bytes })
    }
  } else if (input.mediaType === "image" && input.mediaUrl.startsWith("data:")) {
    const parsed = parseDataUrl(input.mediaUrl)
    if (!parsed) throw new Error("Could not attach media for vision inspection.")
    content.push({ type: "image", image: parsed.bytes })
  } else if (input.mediaType === "image") {
    const fetched = await fetchPublicImage(input.mediaUrl)
    content.push({ type: "image", image: new Uint8Array(fetched.bytes) })
  } else if (input.mediaType === "video") {
    throw new Error(
      "Video inspection needs a keyframe. Re-upload so the client can sample the first frame."
    )
  } else {
    throw new Error(
      "mediaUrl must be a public HTTP(S) URL or image data URL (or provide frameDataUrl for video)."
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

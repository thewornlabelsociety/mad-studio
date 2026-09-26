import { createAdminClient } from "@/lib/supabase/admin"
import { isPublicHttpUrl } from "@/lib/social/types"

function extensionFromContentType(contentType: string | null): string {
  const type = (contentType ?? "").toLowerCase()
  if (type.includes("png")) return "png"
  if (type.includes("webp")) return "webp"
  if (type.includes("gif")) return "gif"
  if (type.includes("mp4")) return "mp4"
  if (type.includes("quicktime") || type.includes("mov")) return "mov"
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg"
  return "bin"
}

function parseDataUrl(dataUrl: string): {
  buffer: Buffer
  contentType: string
} | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl)
  if (!match) return null
  const contentType = match[1]?.trim() || "application/octet-stream"
  const isBase64 = Boolean(match[2])
  const payload = match[3] ?? ""
  try {
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8")
    if (!buffer.length) return null
    return { buffer, contentType }
  } catch {
    return null
  }
}

async function uploadBufferToEntityAssets(input: {
  entityId: string
  buffer: Buffer
  contentType: string
  filenameHint?: string
}): Promise<string> {
  const admin = createAdminClient()
  const ext = extensionFromContentType(input.contentType)
  const safeHint = (input.filenameHint ?? "media")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 48)
  const path = `media/${input.entityId}/dispatch_${Date.now()}_${safeHint}.${ext}`

  const { error } = await admin.storage.from("entity-assets").upload(path, input.buffer, {
    contentType: input.contentType,
    upsert: false,
  })
  if (error) {
    throw new Error(`Failed to upload media to entity-assets: ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("entity-assets").getPublicUrl(path)

  if (!isPublicHttpUrl(publicUrl)) {
    throw new Error(
      "Uploaded media did not resolve to a public HTTPS URL. Check entity-assets bucket policies."
    )
  }

  return publicUrl
}

/**
 * Meta cannot fetch blob:/localhost media. Re-host to Supabase entity-assets when needed.
 */
export async function ensurePublicMediaUrl(input: {
  mediaUrl: string
  entityId: string
}): Promise<{ url: string; rehosted: boolean }> {
  const raw = input.mediaUrl.trim()
  if (!raw) {
    throw new Error("mediaUrl is required.")
  }

  if (isPublicHttpUrl(raw)) {
    return { url: raw, rehosted: false }
  }

  if (raw.startsWith("blob:")) {
    throw new Error(
      "Media is still a local blob URL. Wait for the upload to finish (or re-add the file) so Meta receives a public HTTPS link."
    )
  }

  if (raw.startsWith("data:")) {
    const parsed = parseDataUrl(raw)
    if (!parsed) {
      throw new Error("Could not decode data-URL media for upload.")
    }
    const url = await uploadBufferToEntityAssets({
      entityId: input.entityId,
      buffer: parsed.buffer,
      contentType: parsed.contentType,
      filenameHint: "data-url",
    })
    return { url, rehosted: true }
  }

  // localhost / private hosts — attempt server-side fetch then re-host
  try {
    const response = await fetch(raw, { cache: "no-store" })
    if (!response.ok) {
      throw new Error(`Upstream media responded ${response.status}`)
    }
    const contentType =
      response.headers.get("content-type") || "application/octet-stream"
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (!buffer.length) {
      throw new Error("Upstream media was empty.")
    }
    const url = await uploadBufferToEntityAssets({
      entityId: input.entityId,
      buffer,
      contentType,
      filenameHint: "rehost",
    })
    return { url, rehosted: true }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Could not re-host media."
    throw new Error(
      `mediaUrl must be a public HTTPS URL Meta can fetch. Auto-upload failed: ${detail}`
    )
  }
}

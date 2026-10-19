import sharp from "sharp"

import { uploadBufferToEntityAssets } from "@/lib/social/ensure-public-media"

/** TikTok photo mode caps images at 1080p on the long side. */
const TIKTOK_PHOTO_MAX_EDGE = 1920

/**
 * TikTok photo posts only take JPEG or WEBP, while Studio bakes slides as PNG.
 * Re-encode anything else to JPEG and re-host it in entity-assets.
 */
export async function ensureTikTokPhotoUrl(input: {
  mediaUrl: string
  entityId: string
}): Promise<string> {
  const response = await fetch(input.mediaUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new Error(`Couldn't fetch a carousel slide for TikTok (${response.status}).`)
  }
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase()
  if (/image\/(jpe?g|webp)/.test(contentType)) {
    await response.body?.cancel()
    return input.mediaUrl
  }

  const source = Buffer.from(await response.arrayBuffer())
  const buffer = await sharp(source)
    .rotate()
    .resize({
      width: TIKTOK_PHOTO_MAX_EDGE,
      height: TIKTOK_PHOTO_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()

  return uploadBufferToEntityAssets({
    entityId: input.entityId,
    buffer,
    contentType: "image/jpeg",
    filenameHint: "tiktok-slide",
  })
}

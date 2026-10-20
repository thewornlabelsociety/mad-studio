import { loadImageBlob, uploadCanvasImage } from "@/lib/media/bake-canvas-text"

/**
 * Fit a finished image to a platform's shape — never cropping the item. The
 * photo sits whole in the frame; the space around it is filled with the
 * photo's own background colour (plain studio shots look seamless) or, for
 * busier photos, a soft blurred copy of the photo.
 */

export type PlatformShape = {
  /** Output size in pixels. */
  width: number
  height: number
  /** Images already inside this ratio range (w/h) are left as they are. */
  minRatio: number
  maxRatio: number
}

/** Instagram / Facebook feed and carousels: 4:5 portrait, 1080×1350. */
export const FEED_SHAPE: PlatformShape = {
  width: 1080,
  height: 1350,
  minRatio: 0.8,
  maxRatio: 0.8,
}

/** Instagram square feed posts: 1:1, 1080×1080 — filled with center crop (no stretch). */
export const SQUARE_FEED_SHAPE: PlatformShape = {
  width: 1080,
  height: 1080,
  minRatio: 1,
  maxRatio: 1,
}

/** Stories, Reels covers and TikTok: 9:16 full screen, 1080×1920. */
export const STORY_SHAPE: PlatformShape = {
  width: 1080,
  height: 1920,
  minRatio: 0.5625,
  maxRatio: 0.5625,
}

const RATIO_TOLERANCE = 0.01

type EdgeSample = { color: string; plain: boolean }

/** Average colour around the photo's border, and whether it's a plain backdrop. */
function sampleEdges(bitmap: ImageBitmap): EdgeSample {
  const size = 48
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return { color: "#FFFFFF", plain: false }
  ctx.drawImage(bitmap, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  const pixels: Array<[number, number, number]> = []
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const onEdge = x < 3 || y < 3 || x >= size - 3 || y >= size - 3
      if (!onEdge) continue
      const i = (y * size + x) * 4
      pixels.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  const mean = [0, 1, 2].map(
    (c) => pixels.reduce((sum, px) => sum + px[c], 0) / pixels.length
  )
  const spread =
    pixels.reduce(
      (sum, px) =>
        sum +
        Math.abs(px[0] - mean[0]) +
        Math.abs(px[1] - mean[1]) +
        Math.abs(px[2] - mean[2]),
      0
    ) / pixels.length
  const hex = `#${mean
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")}`
  return { color: hex, plain: spread < 30 }
}

export function fitsShape(ratio: number, shape: PlatformShape): boolean {
  return (
    ratio >= shape.minRatio - RATIO_TOLERANCE &&
    ratio <= shape.maxRatio + RATIO_TOLERANCE
  )
}

/** The image fitted to the shape (or the same URL if it already fits). */
export async function fitImageToShape(input: {
  entityId: string
  sourceUrl: string
  shape: PlatformShape
  /** Force a solid colour around the photo (e.g. the Canvas backdrop). */
  fillColor?: string | null
}): Promise<string> {
  const bitmap = await createImageBitmap(
    await loadImageBlob(input.sourceUrl, input.entityId)
  )
  const ratio = bitmap.width / bitmap.height
  if (fitsShape(ratio, input.shape)) return input.sourceUrl

  const { width: W, height: H } = input.shape
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable.")

  const edges = sampleEdges(bitmap)
  if (input.fillColor || edges.plain) {
    ctx.fillStyle = input.fillColor || edges.color
    ctx.fillRect(0, 0, W, H)
  } else {
    // Soft blurred copy of the photo behind it, slightly dimmed.
    const cover = Math.max(W / bitmap.width, H / bitmap.height)
    const cw = bitmap.width * cover
    const ch = bitmap.height * cover
    ctx.filter = "blur(48px)"
    ctx.drawImage(bitmap, (W - cw) / 2, (H - ch) / 2, cw, ch)
    ctx.filter = "none"
    ctx.fillStyle = "rgba(0,0,0,0.18)"
    ctx.fillRect(0, 0, W, H)
  }

  // The photo itself, whole and centred.
  const fit = Math.min(W / bitmap.width, H / bitmap.height)
  const w = bitmap.width * fit
  const h = bitmap.height * fit
  ctx.drawImage(bitmap, (W - w) / 2, (H - h) / 2, w, h)

  return uploadCanvasImage(canvas, input.entityId, "platform-fit.png")
}

/** Fill the frame edge-to-edge with a center crop — same as CSS `object-fit: cover`. */
export async function fitImageToShapeCover(input: {
  entityId: string
  sourceUrl: string
  shape: PlatformShape
}): Promise<string> {
  const bitmap = await createImageBitmap(
    await loadImageBlob(input.sourceUrl, input.entityId)
  )
  const { width: W, height: H } = input.shape
  if (
    bitmap.width === W &&
    bitmap.height === H &&
    fitsShape(bitmap.width / bitmap.height, input.shape)
  ) {
    return input.sourceUrl
  }

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable.")

  const scale = Math.max(W / bitmap.width, H / bitmap.height)
  const dw = bitmap.width * scale
  const dh = bitmap.height * scale
  ctx.drawImage(bitmap, (W - dw) / 2, (H - dh) / 2, dw, dh)

  return uploadCanvasImage(canvas, input.entityId, "platform-fit-cover.png")
}

import type { Rgb } from "@/lib/brands/story-kit"

/**
 * Background reads go two at a time: opening the Story editor used to fetch
 * every new arrival's full-size photo at once, and the one you clicked waited
 * behind hundreds of others. Priority reads (the Stories on screen) jump the
 * queue.
 */
const MAX_LOADS = 2
let active = 0
const waiting: Array<() => void> = []

async function loadQueued(url: string, priority = false): Promise<HTMLImageElement | null> {
  if (active >= MAX_LOADS) {
    await new Promise<void>((start) => (priority ? waiting.unshift(start) : waiting.push(start)))
  }
  active++
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  } finally {
    active--
    waiting.shift()?.()
  }
}

/**
 * Average colour of the garment in an image. For a cutout only solid pixels
 * count; for a plain photo, the middle of the frame, skipping near-white
 * backdrop pixels. Null when the image can't be read.
 */
export async function sampleItemColour(
  url: string,
  options: { priority?: boolean } = {}
): Promise<Rgb | null> {
  const image = await loadQueued(url, options.priority)
  if (!image) return null

  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, size, size)

  let data: Uint8ClampedArray
  try {
    data = context.getImageData(0, 0, size, size).data
  } catch {
    return null
  }

  let clear = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 16) clear++
  const isCutout = clear > (size * size) / 10

  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      if (isCutout) {
        if (data[i + 3] < 200) continue
      } else {
        const central = x > size * 0.2 && x < size * 0.8 && y > size * 0.2 && y < size * 0.8
        const backdrop = data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235
        if (!central || backdrop) continue
      }
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      count++
    }
  }
  if (count === 0) return null
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) }
}

/**
 * True when the image already has a see-through background (a Photoroom-style
 * cutout): at least 8% of it fully clear. False when it can't be read.
 */
export async function hasSeeThroughBackground(
  url: string,
  options: { priority?: boolean } = {}
): Promise<boolean> {
  const image = await loadQueued(url, options.priority)
  if (!image) return false
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return false
  context.drawImage(image, 0, 0, size, size)
  try {
    const data = context.getImageData(0, 0, size, size).data
    let clear = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 16) clear++
    return clear / (size * size) >= 0.08
  } catch {
    return false
  }
}

import sharp from "sharp"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const input = path.join(__dirname, "brain-source.jpg")
const output = path.join(__dirname, "..", "public", "mad-brain.png")

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width, height, channels } = info
const pixels = new Uint8Array(data)

function isBackgroundBlack(r, g, b) {
  return r < 45 && g < 45 && b < 45
}

function index(x, y) {
  return (y * width + x) * channels
}

const flood = new Uint8Array(width * height)
const stack = []

for (let x = 0; x < width; x++) {
  for (const y of [0, height - 1]) {
    const i = index(x, y)
    if (isBackgroundBlack(pixels[i], pixels[i + 1], pixels[i + 2])) {
      const p = y * width + x
      if (!flood[p]) {
        flood[p] = 1
        stack.push([x, y])
      }
    }
  }
}

for (let y = 0; y < height; y++) {
  for (const x of [0, width - 1]) {
    const i = index(x, y)
    if (isBackgroundBlack(pixels[i], pixels[i + 1], pixels[i + 2])) {
      const p = y * width + x
      if (!flood[p]) {
        flood[p] = 1
        stack.push([x, y])
      }
    }
  }
}

while (stack.length > 0) {
  const [x, y] = stack.pop()
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
    const p = ny * width + nx
    if (flood[p]) continue
    const i = index(nx, ny)
    if (isBackgroundBlack(pixels[i], pixels[i + 1], pixels[i + 2])) {
      flood[p] = 1
      stack.push([nx, ny])
    }
  }
}

for (let p = 0; p < width * height; p++) {
  if (flood[p]) {
    pixels[p * channels + 3] = 0
  }
}

await sharp(pixels, { raw: { width, height, channels } }).png().toFile(output)

console.log(`Wrote ${output} (${width}x${height})`)

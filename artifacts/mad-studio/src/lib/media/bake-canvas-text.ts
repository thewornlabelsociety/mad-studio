import {
  canvasBackdropOn,
  canvasLogoOn,
  canvasOverlayHasDecor,
  canvasTextLayers,
  CANVAS_TEXT_BG_PAD_X,
  CANVAS_TEXT_BG_PAD_Y,
  resolveCanvasTextFont,
  type CanvasTextLayer,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"
import {
  canvasTextFontSizePx,
  canvasTextLineHeightPx,
} from "@/lib/studio/canvas-text-layout"

export async function loadImageBlob(sourceUrl: string, entityId: string): Promise<Blob> {
  try {
    const direct = await fetch(sourceUrl, { mode: "cors", cache: "no-store" })
    if (direct.ok) return await direct.blob()
  } catch {
    // fall through
  }
  const proxyUrl = `/api/media/image-proxy?url=${encodeURIComponent(sourceUrl)}&entityId=${encodeURIComponent(entityId)}`
  const proxied = await fetch(proxyUrl)
  if (!proxied.ok) {
    throw new Error("Could not load image for text bake.")
  }
  return proxied.blob()
}

function canvasFontStack(fontId: CanvasTextOverlayState["fontId"]): string {
  const font = resolveCanvasTextFont(fontId)
  const stack = font.style?.fontFamily
  if (typeof stack === "string") return stack
  return "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif"
}

async function ensureCanvasFontLoaded(
  fontId: CanvasTextOverlayState["fontId"],
  fontSize: number
): Promise<void> {
  const font = resolveCanvasTextFont(fontId)
  const weight = font.canvasWeight ?? 700
  const style = font.canvasStyle ?? "normal"
  const family = font.primaryFamily.includes(" ")
    ? `"${font.primaryFamily}"`
    : font.primaryFamily
  const spec = `${style} ${weight} ${fontSize}px ${family}`
  try {
    await document.fonts.load(spec)
    await document.fonts.ready
  } catch {
    // System fallbacks still render if a webfont fails.
  }
}

/** Break text into lines no wider than maxWidth (keeps typed line breaks). */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const out: string[] = []
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      out.push("")
      continue
    }
    let line = words[0]
    for (const word of words.slice(1)) {
      const next = `${line} ${word}`
      if (ctx.measureText(next).width <= maxWidth) {
        line = next
      } else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

/** Draw one text box (headline, subhead or a tag) at its own place and style. */
function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: CanvasTextOverlayState,
  layer: CanvasTextLayer
) {
  const fontSize = canvasTextFontSizePx(width, layer.fontScale)
  const lineHeight = canvasTextLineHeightPx(fontSize)
  const fontDef = resolveCanvasTextFont(layer.fontId)
  const weight = fontDef.canvasWeight ?? 700
  const fontStyle = fontDef.canvasStyle ?? "normal"
  const padX = layer.bgColor ? fontSize * CANVAS_TEXT_BG_PAD_X : 0
  const padY = layer.bgColor ? fontSize * CANVAS_TEXT_BG_PAD_Y : 0

  ctx.save()
  ctx.translate((layer.positionX / 100) * width, (layer.positionY / 100) * height)
  ctx.rotate((layer.rotationDeg * Math.PI) / 180)
  ctx.font = `${fontStyle} ${weight} ${fontSize}px ${canvasFontStack(layer.fontId)}`
  ctx.fillStyle = layer.color || "#FFFFFF"
  ctx.textBaseline = "middle"

  // Wrap where the preview wraps: a box can be at most 92% of the image wide.
  const lines = wrapLines(ctx, layer.text, width * 0.92 - padX * 2)
  const blockWidth = Math.max(...lines.map((line) => ctx.measureText(line).width))
  const blockHeight = lines.length * lineHeight

  // Like the preview, the box is centred on its point; alignment only moves
  // lines within the box.
  ctx.textAlign =
    overlay.textAlign === "left"
      ? "left"
      : overlay.textAlign === "right"
        ? "right"
        : "center"
  const lineX =
    overlay.textAlign === "left"
      ? -blockWidth / 2
      : overlay.textAlign === "right"
        ? blockWidth / 2
        : 0

  // Solid block behind the text, matching the preview's padding.
  if (layer.bgColor) {
    ctx.fillStyle = layer.bgColor
    ctx.fillRect(
      -blockWidth / 2 - padX,
      -blockHeight / 2 - padY,
      blockWidth + padX * 2,
      blockHeight + padY * 2
    )
    ctx.fillStyle = layer.color || "#FFFFFF"
  }

  // Preview shadows are sized for a ~320px phone; scale them to the image.
  const shadowScale = width / 320
  let y = -blockHeight / 2 + lineHeight / 2
  for (const line of lines) {
    // No shadow on a solid block (matches the preview).
    if (!layer.bgColor && (overlay.shadow === "hard" || overlay.shadow === "soft")) {
      ctx.shadowColor =
        overlay.shadow === "hard" ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.45)"
      ctx.shadowBlur = overlay.shadow === "hard" ? 0 : 8 * shadowScale
      ctx.shadowOffsetX = overlay.shadow === "hard" ? 3 * shadowScale : 0
      ctx.shadowOffsetY = (overlay.shadow === "hard" ? 3 : 2) * shadowScale
    }
    ctx.fillText(line, lineX, y)
    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    y += lineHeight
  }
  ctx.restore()
}

export function canvasOverlayNeedsBake(overlay: CanvasTextOverlayState): boolean {
  return canvasOverlayHasDecor(overlay)
}

export async function bakeCanvasTextOnImage(input: {
  entityId: string
  marketingEntityId?: string | null
  sourceUrl: string
  overlay: CanvasTextOverlayState
}): Promise<string> {
  if (!canvasOverlayNeedsBake(input.overlay)) {
    return input.sourceUrl
  }

  const blob = await loadImageBlob(input.sourceUrl, input.entityId)
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable.")
  const W = canvas.width
  const H = canvas.height
  const overlay = input.overlay

  if (canvasBackdropOn(overlay)) {
    // Item cut out on a solid colour, sized and placed like the preview.
    ctx.fillStyle = overlay.backdropColor || "#FFFFFF"
    ctx.fillRect(0, 0, W, H)
    const cutout = await createImageBitmap(
      await loadImageBlob(overlay.cutoutUrl, input.entityId)
    )
    const boxW = W * overlay.subjectScale
    const boxH = H * overlay.subjectScale
    const fit = Math.min(boxW / cutout.width, boxH / cutout.height)
    const dw = cutout.width * fit
    const dh = cutout.height * fit
    const cy = H / 2 + (overlay.subjectOffsetY / 100) * H
    ctx.drawImage(cutout, W / 2 - dw / 2, cy - dh / 2, dw, dh)
  } else {
    ctx.drawImage(bitmap, 0, 0)
  }

  if (canvasLogoOn(overlay)) {
    try {
      const logo = await createImageBitmap(
        await loadImageBlob(overlay.logoUrl, input.entityId)
      )
      const lw = (overlay.logoScale / 100) * W
      const lh = (logo.height / logo.width) * lw
      ctx.drawImage(
        logo,
        (overlay.logoX / 100) * W - lw / 2,
        (overlay.logoY / 100) * H - lh / 2,
        lw,
        lh
      )
    } catch {
      // A missing logo shouldn't block the post.
    }
  }
  // Headline and subhead are separate layers, each with its own style.
  for (const layer of canvasTextLayers(input.overlay)) {
    await ensureCanvasFontLoaded(
      layer.fontId,
      canvasTextFontSizePx(canvas.width, layer.fontScale)
    )
    drawTextLayer(ctx, canvas.width, canvas.height, input.overlay, layer)
  }

  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Export failed."))),
      "image/png",
      0.92
    )
  })

  const form = new FormData()
  form.append("file", outBlob, "canvas-text.png")
  form.append("entityId", input.entityId)
  if (input.marketingEntityId) {
    form.append("itemId", input.marketingEntityId)
  }

  const uploadRes = await fetch("/api/media/upload-cutout", {
    method: "POST",
    body: form,
  })
  if (!uploadRes.ok) {
    throw new Error("Could not upload baked image.")
  }
  const payload = (await uploadRes.json()) as { transparentUrl?: string }
  if (!payload.transparentUrl) {
    throw new Error("Upload did not return a public URL.")
  }
  return payload.transparentUrl
}

/**
 * A 1080×1920 Story: the (already baked) image fitted whole on a solid colour,
 * edge to edge — what the Story preview shows when the backdrop is on.
 */
export async function bakeStoryFrame(input: {
  entityId: string
  sourceUrl: string
  color: string
}): Promise<string> {
  const bitmap = await createImageBitmap(
    await loadImageBlob(input.sourceUrl, input.entityId)
  )
  const canvas = document.createElement("canvas")
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable.")
  ctx.fillStyle = input.color || "#FFFFFF"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const fit = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height)
  const w = bitmap.width * fit
  const h = bitmap.height * fit
  ctx.drawImage(bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)

  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Export failed."))),
      "image/png"
    )
  })
  const form = new FormData()
  form.append("file", outBlob, "story-frame.png")
  form.append("entityId", input.entityId)
  const uploadRes = await fetch("/api/media/upload-cutout", {
    method: "POST",
    body: form,
  })
  if (!uploadRes.ok) throw new Error("Could not upload the Story image.")
  const payload = (await uploadRes.json()) as { transparentUrl?: string }
  if (!payload.transparentUrl) throw new Error("Upload did not return a public URL.")
  return payload.transparentUrl
}

/** Save a finished canvas as a PNG in storage and return its public URL. */
export async function uploadCanvasImage(
  canvas: HTMLCanvasElement,
  entityId: string,
  filename: string
): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Export failed."))),
      "image/png"
    )
  })
  const form = new FormData()
  form.append("file", blob, filename)
  form.append("entityId", entityId)
  const response = await fetch("/api/media/upload-cutout", { method: "POST", body: form })
  if (!response.ok) throw new Error("Could not upload the image.")
  const payload = (await response.json()) as { transparentUrl?: string }
  if (!payload.transparentUrl) throw new Error("Upload did not return a public URL.")
  return payload.transparentUrl
}

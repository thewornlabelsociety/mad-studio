import {
  canvasOverlayHasDecor,
  resolveCanvasTextFont,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"
import {
  canvasTextFontSizePx,
  canvasTextLineHeightPx,
  resolveCanvasTextFontScale,
  resolveCanvasTextRotationDeg,
} from "@/lib/studio/canvas-text-layout"

async function loadImageBlob(sourceUrl: string, entityId: string): Promise<Blob> {
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

function canvasFontStack(overlay: CanvasTextOverlayState): string {
  const font = resolveCanvasTextFont(overlay.fontId)
  const stack = font.style?.fontFamily
  if (typeof stack === "string") return stack
  return "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif"
}

async function ensureCanvasFontLoaded(
  overlay: CanvasTextOverlayState,
  fontSize: number
): Promise<void> {
  const font = resolveCanvasTextFont(overlay.fontId)
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

function drawOverlayText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: CanvasTextOverlayState
) {
  if (!overlay.enabled) return
  const lines = [overlay.headline.trim(), overlay.subhead.trim()].filter(Boolean)
  if (lines.length === 0) return

  const anchorX = (overlay.positionX / 100) * width
  const anchorY = (overlay.positionY / 100) * height
  const fontSize = canvasTextFontSizePx(width, resolveCanvasTextFontScale(overlay))
  const lineHeight = canvasTextLineHeightPx(fontSize)
  const fontDef = resolveCanvasTextFont(overlay.fontId)
  const fontFamily = canvasFontStack(overlay)
  const weight = fontDef.canvasWeight ?? 700
  const fontStyle = fontDef.canvasStyle ?? "normal"
  const rotationRad =
    (resolveCanvasTextRotationDeg(overlay) * Math.PI) / 180

  ctx.save()
  ctx.translate(anchorX, anchorY)
  ctx.rotate(rotationRad)

  ctx.font = `${fontStyle} ${weight} ${fontSize}px ${fontFamily}`
  ctx.fillStyle = overlay.color || "#FFFFFF"
  ctx.textBaseline = "middle"

  if (overlay.textAlign === "left") {
    ctx.textAlign = "left"
  } else if (overlay.textAlign === "right") {
    ctx.textAlign = "right"
  } else {
    ctx.textAlign = "center"
  }

  const blockHeight = lines.length * lineHeight
  let y = -blockHeight / 2 + lineHeight / 2
  const anchorLocalX = 0

  for (const line of lines) {
    const metrics = ctx.measureText(line)
    const padX = fontSize * 0.25
    const padY = fontSize * 0.12
    let boxX = anchorLocalX
    if (overlay.textAlign === "center") {
      boxX = anchorLocalX - metrics.width / 2
    } else if (overlay.textAlign === "right") {
      boxX = anchorLocalX - metrics.width
    }

    if (overlay.highlight === "black_pill") {
      ctx.fillStyle = "rgba(0,0,0,0.6)"
      ctx.fillRect(
        boxX - padX,
        y - fontSize / 2 - padY,
        metrics.width + padX * 2,
        fontSize + padY * 2
      )
      ctx.fillStyle = overlay.color || "#FFFFFF"
    } else if (overlay.highlight === "brand_pill") {
      ctx.fillStyle = "#CCFF00"
      ctx.fillRect(
        boxX - padX,
        y - fontSize / 2 - padY,
        metrics.width + padX * 2,
        fontSize + padY * 2
      )
      ctx.fillStyle = "#0A0A0A"
    }

    if (overlay.shadow === "hard" || overlay.shadow === "soft") {
      ctx.shadowColor =
        overlay.shadow === "hard" ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.45)"
      ctx.shadowBlur = overlay.shadow === "hard" ? 0 : 8
      ctx.shadowOffsetX = overlay.shadow === "hard" ? 3 : 0
      ctx.shadowOffsetY = overlay.shadow === "hard" ? 3 : 2
    }

    ctx.fillText(line, anchorLocalX, y)

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

  ctx.drawImage(bitmap, 0, 0)
  const fontSize = canvasTextFontSizePx(
    canvas.width,
    resolveCanvasTextFontScale(input.overlay)
  )
  if (input.overlay.enabled) {
    await ensureCanvasFontLoaded(input.overlay, fontSize)
    drawOverlayText(ctx, canvas.width, canvas.height, input.overlay)
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

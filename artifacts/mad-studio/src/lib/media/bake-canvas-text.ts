import {
  canvasLinkPillBorderRadius,
  canvasOverlayHasDecor,
  resolveCanvasSticker,
  resolveCanvasTextFont,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"

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
  const fontSize = Math.max(18, Math.round(width * 0.065))
  const lineHeight = fontSize * 1.15
  const fontDef = resolveCanvasTextFont(overlay.fontId)
  const fontFamily = canvasFontStack(overlay)
  const weight = fontDef.canvasWeight ?? 700
  const fontStyle = fontDef.canvasStyle ?? "normal"

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
  let y = anchorY - blockHeight / 2 + lineHeight / 2

  for (const line of lines) {
    const metrics = ctx.measureText(line)
    const padX = fontSize * 0.25
    const padY = fontSize * 0.12
    let boxX = anchorX
    if (overlay.textAlign === "center") {
      boxX = anchorX - metrics.width / 2
    } else if (overlay.textAlign === "right") {
      boxX = anchorX - metrics.width
    }

    if (overlay.highlight === "black_pill") {
      ctx.fillStyle = "rgba(0,0,0,0.55)"
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

    ctx.fillText(line, anchorX, y)

    ctx.shadowColor = "transparent"
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    y += lineHeight
  }
}

function countdownPartsAtBake(targetIso: string): {
  days: string
  hours: string
  minutes: string
  seconds: string
} {
  const target = Date.parse(targetIso)
  if (!Number.isFinite(target)) {
    return { days: "00", hours: "00", minutes: "00", seconds: "00" }
  }
  const diffMs = Math.max(0, target - Date.now())
  const totalSec = Math.floor(diffMs / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    days: pad(Math.floor(totalSec / 86400)),
    hours: pad(Math.floor((totalSec % 86400) / 3600)),
    minutes: pad(Math.floor((totalSec % 3600) / 60)),
    seconds: pad(totalSec % 60),
  }
}

function drawEditorialStorySticker(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: CanvasTextOverlayState
) {
  if (overlay.storyStickerMode === "none") return

  const x = (overlay.stickerX / 100) * width
  const y = (overlay.stickerY / 100) * height
  const scale = width / 400
  const noir = overlay.storyStickerTheme !== "linen"
  const fill = noir ? "rgba(24,24,22,0.9)" : "rgba(255,255,255,0.95)"
  const stroke = noir ? "rgba(82,82,82,0.9)" : "rgba(212,212,212,0.9)"
  const ink = noir ? "#EDECE8" : "#171717"
  const muted = noir ? "#a3a3a3" : "#737373"

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `600 ${Math.max(10, Math.round(scale * 11))}px ui-monospace, monospace`

  if (overlay.storyStickerMode === "link_badge") {
    const label = (overlay.linkBadgeLabel || "EXPLORE DROP ↗").toUpperCase()
    const metrics = ctx.measureText(label)
    const padX = scale * 14
    const padY = scale * 8
    const boxW = metrics.width + padX * 2
    const boxH = Math.max(28, scale * 22)
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = Math.max(1, scale * 0.6)
    ctx.beginPath()
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, boxH / 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.fillText(label, x, y)
    return
  }

  const cardW = Math.min(width * 0.82, scale * 320)
  const cardH =
    overlay.storyStickerMode === "countdown_timer" ? scale * 96 : scale * 110
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1, scale * 0.6)
  ctx.beginPath()
  ctx.roundRect(x - cardW / 2, y - cardH / 2, cardW, cardH, scale * 10)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = muted
  ctx.font = `500 ${Math.max(9, Math.round(scale * 10))}px ui-monospace, monospace`
  const eyebrow =
    overlay.storyStickerMode === "countdown_timer"
      ? overlay.countdownTitle.trim() || "Drop opens"
      : overlay.pollQuestion.trim() || "Which direction?"
  ctx.fillText(eyebrow.toUpperCase(), x, y - cardH * 0.28)

  ctx.fillStyle = ink
  ctx.font = `600 ${Math.max(11, Math.round(scale * 13))}px ui-monospace, monospace`

  if (overlay.storyStickerMode === "countdown_timer") {
    const parts = countdownPartsAtBake(overlay.countdownTargetAt)
    ctx.fillText(
      `${parts.days} : ${parts.hours} : ${parts.minutes} : ${parts.seconds}`,
      x,
      y + cardH * 0.08
    )
    return
  }

  const a = Math.min(90, Math.max(10, overlay.pollPercentA))
  const left = overlay.pollOptionA.trim() || "Option A"
  const right = overlay.pollOptionB.trim() || "Option B"
  ctx.font = `500 ${Math.max(9, Math.round(scale * 10))}px ui-monospace, monospace`
  ctx.textAlign = "left"
  ctx.fillText(`${left.toUpperCase()} · ${a}%`, x - cardW * 0.4, y + cardH * 0.05)
  ctx.fillText(`${right.toUpperCase()} · ${100 - a}%`, x - cardW * 0.4, y + cardH * 0.22)
}

function drawOverlaySticker(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: CanvasTextOverlayState
) {
  if (overlay.storyStickerMode !== "none") return
  if (!overlay.stickerEnabled) return
  const def = resolveCanvasSticker(overlay.stickerId)
  const x = (overlay.stickerX / 100) * width
  const y = (overlay.stickerY / 100) * height
  const scale = width / 400

  if (def.kind === "emoji") {
    const size = Math.max(28, Math.round(scale * 44))
    ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#FFFFFF"
    ctx.shadowColor = "rgba(0,0,0,0.45)"
    ctx.shadowBlur = 6
    ctx.fillText(def.glyph, x, y)
    ctx.shadowBlur = 0
    return
  }

  const label =
    def.kind === "link_pill"
      ? (overlay.stickerLabel.trim() || "Shop now").toUpperCase()
      : def.glyph
  const fontSize = Math.max(13, Math.round(scale * 15))
  ctx.font = `700 ${fontSize}px Inter, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const padX = fontSize * 0.65
  const padY = fontSize * 0.35
  const text = def.kind === "link_pill" ? `🔗 ${label}` : label
  const metrics = ctx.measureText(text)
  const boxW = metrics.width + padX * 2
  const boxH = fontSize + padY * 2
  const rx =
    def.kind === "link_pill"
      ? canvasLinkPillBorderRadius(overlay.stickerLinkShape, boxH)
      : boxH / 2

  const fill =
    def.kind === "link_pill"
      ? overlay.stickerLinkBg || "#FFFFFF"
      : "rgba(255,255,255,0.94)"
  ctx.fillStyle = fill
  ctx.strokeStyle = "rgba(0,0,0,0.12)"
  ctx.lineWidth = Math.max(1, scale * 0.5)
  ctx.beginPath()
  ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, rx)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle =
    def.kind === "link_pill"
      ? overlay.stickerLinkText || "#111111"
      : "#111111"
  ctx.shadowColor = "transparent"
  ctx.fillText(text, x, y)
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
  const fontSize = Math.max(18, Math.round(canvas.width * 0.065))
  if (input.overlay.enabled) {
    await ensureCanvasFontLoaded(input.overlay, fontSize)
    drawOverlayText(ctx, canvas.width, canvas.height, input.overlay)
  }
  drawOverlaySticker(ctx, canvas.width, canvas.height, input.overlay)
  drawEditorialStorySticker(ctx, canvas.width, canvas.height, input.overlay)

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

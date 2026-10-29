import {
  type FrameImageSlot,
  type FrameTemplate,
  type FrameTextSlot,
} from "@/lib/templates/frame-template"
import { loadImageBlob } from "@/lib/media/bake-canvas-text"

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

function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: "cover" | "contain"
) {
  const scale =
    fit === "contain"
      ? Math.min(w / img.width, h / img.height)
      : Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

async function drawImageSlot(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  slot: FrameImageSlot,
  imageUrl: string | undefined,
  entityId: string
) {
  const x = (slot.x / 100) * canvasW
  const y = (slot.y / 100) * canvasH
  const w = (slot.w / 100) * canvasW
  const h = (slot.h / 100) * canvasH
  const radius =
    ((slot.radiusPct ?? 0) / 100) * Math.min(w, h)

  ctx.save()
  if (radius > 0) {
    const r = Math.min(radius, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
    ctx.clip()
  } else {
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
  }

  if (imageUrl) {
    try {
      const bitmap = await createImageBitmap(
        await loadImageBlob(imageUrl, entityId)
      )
      drawCoverFit(ctx, bitmap, x, y, w, h, slot.fit ?? "cover")
    } catch {
      ctx.fillStyle = "rgba(232, 215, 184, 0.35)"
      ctx.fillRect(x, y, w, h)
    }
  }
  ctx.restore()
}

function drawTextSlot(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  slot: FrameTextSlot,
  text: string
) {
  const value = text.trim()
  if (!value) return

  const x = (slot.x / 100) * canvasW
  const y = (slot.y / 100) * canvasH
  const maxW = (slot.maxWidthPct / 100) * canvasW
  const fontSize = Math.max(12, canvasW * 0.028 * slot.fontScale)

  ctx.save()
  ctx.font = `700 ${fontSize}px "Courier New", Courier, monospace`
  ctx.textBaseline = "top"
  ctx.textAlign = slot.align
  const lines = wrapLines(ctx, value.toUpperCase(), maxW)
  const lineHeight = fontSize * 1.05
  const blockH = lines.length * lineHeight
  const blockW = Math.min(
    maxW,
    Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
  )

  let anchorX = x
  if (slot.align === "center") anchorX = x + maxW / 2
  if (slot.align === "right") anchorX = x + maxW

  if (slot.coverBg) {
    const padX = fontSize * 0.2
    const padY = fontSize * 0.12
    let boxX = x - padX
    if (slot.align === "center") boxX = anchorX - blockW / 2 - padX
    if (slot.align === "right") boxX = anchorX - blockW - padX
    ctx.fillStyle = slot.coverBg
    ctx.fillRect(boxX, y - padY, blockW + padX * 2, blockH + padY * 2)
  }

  ctx.fillStyle = slot.color
  lines.forEach((line, i) => {
    ctx.fillText(line, anchorX, y + i * lineHeight)
  })
  ctx.restore()
}

/**
 * Compose Canva background + slot images + editable labels → uploaded PNG URL.
 */
export async function bakeFrameTemplate(input: {
  entityId: string
  template: FrameTemplate
  imageFills: Record<string, string>
  textFills: Record<string, string>
  marketingEntityId?: string | null
}): Promise<string> {
  const bgUrl = input.template.backgroundUrl.trim()
  if (!bgUrl) throw new Error("Frame template is missing a background image.")

  const bg = await createImageBitmap(
    await loadImageBlob(bgUrl, input.entityId)
  )
  const width = input.template.canvas.width || bg.width
  const height = input.template.canvas.height || bg.height
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable.")

  // Draw background stretched to template canvas (Canva export should match).
  ctx.drawImage(bg, 0, 0, width, height)

  for (const slot of input.template.imageSlots) {
    await drawImageSlot(
      ctx,
      width,
      height,
      slot,
      input.imageFills[slot.id],
      input.entityId
    )
  }

  for (const slot of input.template.textSlots) {
    drawTextSlot(
      ctx,
      width,
      height,
      slot,
      input.textFills[slot.id] ?? slot.defaultText ?? ""
    )
  }

  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Export failed."))),
      "image/png",
      0.92
    )
  })

  const form = new FormData()
  form.append("file", outBlob, "frame-template.png")
  form.append("entityId", input.entityId)
  if (input.marketingEntityId) {
    form.append("itemId", input.marketingEntityId)
  }

  const uploadRes = await fetch("/api/media/upload-cutout", {
    method: "POST",
    body: form,
  })
  if (!uploadRes.ok) {
    throw new Error("Could not upload composed frame template.")
  }
  const payload = (await uploadRes.json()) as { transparentUrl?: string }
  if (!payload.transparentUrl) {
    throw new Error("Upload did not return a public URL.")
  }
  return payload.transparentUrl
}

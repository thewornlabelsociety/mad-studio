"use client"

import {
  canvasLinkPillShapeClass,
  resolveCanvasSticker,
  type CanvasLinkPillShape,
  type CanvasStickerId,
} from "@/lib/studio/canvas-text-types"
import { cn } from "@/lib/utils"

type Props = {
  stickerId: CanvasStickerId
  stickerLabel: string
  linkBg?: string
  linkText?: string
  linkShape?: CanvasLinkPillShape
  className?: string
}

export function CanvasStickerVisual({
  stickerId,
  stickerLabel,
  linkBg = "#FFFFFF",
  linkText = "#111111",
  linkShape = "pill",
  className,
}: Props) {
  const def = resolveCanvasSticker(stickerId)

  if (def.kind === "emoji") {
    return (
      <span
        className={cn(
          "text-[clamp(1.75rem,8vw,2.75rem)] leading-none drop-shadow-md",
          className
        )}
        aria-hidden
      >
        {def.glyph}
      </span>
    )
  }

  if (def.kind === "badge") {
    return (
      <span
        className={cn(
          "inline-flex border-2 border-mad-black bg-mad-lime px-2.5 py-1 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm",
          className
        )}
      >
        {def.glyph}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 px-3 py-1.5 text-[0.65rem] font-bold tracking-wide uppercase shadow-sm ring-1 ring-black/10",
        canvasLinkPillShapeClass(linkShape),
        className
      )}
      style={{ backgroundColor: linkBg, color: linkText }}
    >
      <span aria-hidden>🔗</span>
      <span className="truncate">{stickerLabel.trim() || "Shop now"}</span>
    </span>
  )
}

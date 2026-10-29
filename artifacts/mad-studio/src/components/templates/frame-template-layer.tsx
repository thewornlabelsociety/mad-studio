"use client"

import { useState } from "react"
import { ImagePlus } from "lucide-react"

import {
  FRAME_TEMPLATE_MIME_ASSET,
  FRAME_TEMPLATE_MIME_URL,
  type FrameTemplate,
} from "@/lib/templates/frame-template"
import { cn } from "@/lib/utils"

type Props = {
  template: FrameTemplate
  entityId: string
  imageFills: Record<string, string>
  textFills: Record<string, string>
  interactive?: boolean
  onImageFill?: (slotId: string, url: string) => void
  onTextFill?: (slotId: string, text: string) => void
  className?: string
}

function proxySrc(url: string, entityId: string): string {
  if (!url) return ""
  if (url.startsWith("blob:") || url.startsWith("data:")) return url
  return `/api/media/image-proxy?url=${encodeURIComponent(url)}&entityId=${encodeURIComponent(entityId)}`
}

/**
 * Absolute-fill compositor for Canva frame templates inside the phone preview.
 */
export function FrameTemplateLayer({
  template,
  entityId,
  imageFills,
  textFills,
  interactive = false,
  onImageFill,
  onTextFill,
  className,
}: Props) {
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const bg = template.backgroundUrl.trim()

  function acceptDrop(slotId: string, event: React.DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    setDragOverId(null)
    const url =
      event.dataTransfer.getData(FRAME_TEMPLATE_MIME_URL) ||
      event.dataTransfer.getData("text/uri-list")
    if (url && onImageFill) onImageFill(slotId, url.trim())
  }

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden bg-black", className)}
    >
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxySrc(bg, entityId)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-900" />
      )}

      {template.imageSlots.map((slot) => {
        const fill = imageFills[slot.id]
        const over = dragOverId === slot.id
        return (
          <div
            key={slot.id}
            className={cn(
              "absolute overflow-hidden",
              interactive && "cursor-copy",
              over && "ring-2 ring-mad-vermillion ring-offset-1 ring-offset-black"
            )}
            style={{
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: `${slot.w}%`,
              height: `${slot.h}%`,
              borderRadius: slot.radiusPct
                ? `${slot.radiusPct}%`
                : undefined,
            }}
            onDragOver={
              interactive
                ? (event) => {
                    if (
                      Array.from(event.dataTransfer.types).some(
                        (t) =>
                          t === FRAME_TEMPLATE_MIME_URL ||
                          t === FRAME_TEMPLATE_MIME_ASSET ||
                          t === "text/uri-list"
                      )
                    ) {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = "copy"
                      setDragOverId(slot.id)
                    }
                  }
                : undefined
            }
            onDragLeave={
              interactive
                ? () => setDragOverId((id) => (id === slot.id ? null : id))
                : undefined
            }
            onDrop={
              interactive ? (event) => acceptDrop(slot.id, event) : undefined
            }
          >
            {fill ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proxySrc(fill, entityId)}
                alt={slot.label}
                className={cn(
                  "h-full w-full",
                  slot.fit === "contain" ? "object-contain" : "object-cover"
                )}
                draggable={false}
              />
            ) : interactive ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black/25 px-1 text-center">
                <ImagePlus className="size-4 text-mad-white/80" aria-hidden />
                <span className="font-typewriter text-[0.55rem] leading-tight tracking-wider text-mad-white/90 uppercase">
                  {slot.label}
                </span>
              </div>
            ) : null}
          </div>
        )
      })}

      {template.textSlots.map((slot) => {
        const value = (textFills[slot.id] ?? slot.defaultText ?? "").trim()
        if (!interactive && !value) return null
        return (
          <div
            key={slot.id}
            className="absolute"
            style={{
              left: `${slot.x}%`,
              top: `${slot.y}%`,
              width: `${slot.maxWidthPct}%`,
              color: slot.color,
              textAlign: slot.align,
              backgroundColor: slot.coverBg || undefined,
              padding: slot.coverBg ? "0.15em 0.25em" : undefined,
            }}
          >
            {interactive ? (
              <input
                value={textFills[slot.id] ?? slot.defaultText ?? ""}
                onChange={(e) => onTextFill?.(slot.id, e.target.value)}
                aria-label={slot.label}
                className="w-full border-0 bg-transparent p-0 font-typewriter font-bold tracking-wide uppercase outline-none"
                style={{
                  color: slot.color,
                  fontSize: `${Math.max(0.55, 0.72 * slot.fontScale)}rem`,
                  textAlign: slot.align,
                }}
              />
            ) : (
              <p
                className="font-typewriter font-bold tracking-wide uppercase"
                style={{
                  fontSize: `${Math.max(0.55, 0.72 * slot.fontScale)}rem`,
                  lineHeight: 1.05,
                }}
              >
                {value}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

"use client"

import {
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { GripHorizontal } from "lucide-react"

import { CanvasStickerVisual } from "@/components/studio/canvas-sticker-visual"
import { EditorialStoryStickerOverlay } from "@/components/studio/story-stickers"
import {
  CANVAS_BRAND_SWATCHES,
  CANVAS_STICKERS,
  CANVAS_TEXT_FONTS,
  STORY_LINK_BADGE_LABELS,
  canvasOverlayHasDecor,
  canvasTextAnimationClass,
  canvasTextHighlightClass,
  canvasTextShadowClass,
  type CanvasStickerId,
  type CanvasTextAnimation,
  type CanvasTextFontId,
  type CanvasTextHighlight,
  type CanvasTextOverlayState,
  type CanvasTextShadow,
} from "@/lib/studio/canvas-text-types"
import { cn } from "@/lib/utils"

function countdownLocalInputValue(iso: string): string {
  if (!iso.trim()) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function localDatetimeToIso(local: string): string {
  if (!local.trim()) return ""
  const date = new Date(local)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString()
}

function useCanvasDrag(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlay: CanvasTextOverlayState,
  keys: {
    x: "positionX" | "stickerX"
    y: "positionY" | "stickerY"
    /** Percent clamp for drag (default text: 4–96, stickers: 1–99). */
    min?: number
    max?: number
  }
) {
  const min = keys.min ?? 4
  const max = keys.max ?? 96
  const dragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!interactive || !onChange) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: overlay[keys.x],
        originY: overlay[keys.y],
      }
    },
    [interactive, onChange, overlay, keys.x, keys.y]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !onChange) return
      const host = event.currentTarget.parentElement
      if (!host) return
      const rect = host.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const dx = ((event.clientX - dragRef.current.startX) / rect.width) * 100
      const dy = ((event.clientY - dragRef.current.startY) / rect.height) * 100
      onChange({
        ...overlay,
        [keys.x]: Math.min(max, Math.max(min, dragRef.current.originX + dx)),
        [keys.y]: Math.min(max, Math.max(min, dragRef.current.originY + dy)),
      })
    },
    [onChange, overlay, keys.min, keys.max, keys.x, keys.y, min, max]
  )

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp }
}

function CanvasDragCorner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute size-2.5 border-2 border-mad-lime bg-mad-black shadow-[0_0_0_1px_rgba(0,0,0,0.5)]",
        className
      )}
    />
  )
}

function DraggableDecor({
  interactive,
  x,
  y,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
  hint,
  showDragHandles = false,
}: {
  interactive: boolean
  x: number
  y: number
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  children: ReactNode
  hint?: string
  /** Top grip + corner brackets for on-screen text in canvas step. */
  showDragHandles?: boolean
}) {
  const handlesOn = interactive && showDragHandles

  return (
    <div
      className="absolute max-w-[88%] touch-none select-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={handlesOn ? "Drag on-screen text" : hint}
        className={cn(
          "relative",
          interactive && "pointer-events-auto cursor-grab active:cursor-grabbing",
          handlesOn &&
            "rounded-sm border-2 border-dashed border-mad-lime/90 bg-black/25 px-2 pb-2 pt-7 shadow-[0_2px_12px_rgba(0,0,0,0.35)]",
          interactive &&
            !handlesOn &&
            "ring-2 ring-transparent hover:ring-mad-vermillion/80 hover:ring-offset-1 hover:ring-offset-black/20"
        )}
      >
        {handlesOn ? (
          <>
            <div
              className="absolute top-0 right-0 left-0 flex cursor-grab items-center justify-center gap-1 border-b-2 border-mad-lime/80 bg-mad-lime/90 py-0.5 active:cursor-grabbing"
              aria-hidden
            >
              <GripHorizontal className="size-3.5 shrink-0 text-mad-black" />
              <span className="font-typewriter text-[0.4rem] font-bold tracking-wider text-mad-black uppercase">
                Drag
              </span>
            </div>
            <CanvasDragCorner className="-top-1.5 -left-1.5" />
            <CanvasDragCorner className="-top-1.5 -right-1.5" />
            <CanvasDragCorner className="-bottom-1.5 -left-1.5" />
            <CanvasDragCorner className="-bottom-1.5 -right-1.5" />
          </>
        ) : null}
        {children}
      </div>
      {interactive && hint && !handlesOn ? (
        <span className="mt-1 block text-center font-typewriter text-[0.45rem] font-bold tracking-wider text-white/80 uppercase drop-shadow-md">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

type LayerProps = {
  overlay: CanvasTextOverlayState
  isVideo?: boolean
  className?: string
  interactive?: boolean
  onOverlayChange?: (next: CanvasTextOverlayState) => void
  /** Trackable or destination URL for the link pill sticker. */
  linkHref?: string | null
  /** IG story safe-zone editorial stickers (poll, timer, link badge). */
  storyEditorialStickers?: boolean
}

export function CanvasTextOverlayLayer({
  overlay,
  className,
  interactive = false,
  onOverlayChange,
  linkHref = null,
  storyEditorialStickers = false,
}: LayerProps) {
  const textDrag = useCanvasDrag(interactive, onOverlayChange, overlay, {
    x: "positionX",
    y: "positionY",
  })
  const stickerDrag = useCanvasDrag(interactive, onOverlayChange, overlay, {
    x: "stickerX",
    y: "stickerY",
    min: 1,
    max: 99,
  })

  if (!canvasOverlayHasDecor(overlay)) return null

  const font =
    CANVAS_TEXT_FONTS.find((row) => row.id === overlay.fontId) ??
    CANVAS_TEXT_FONTS[0]
  const lines = [overlay.headline.trim(), overlay.subhead.trim()].filter(Boolean)
  const showText = overlay.enabled && lines.length > 0
  const motionClass = canvasTextAnimationClass(overlay.animation, {
    motionPreview: true,
  })

  const alignClass =
    overlay.textAlign === "left"
      ? "text-left items-start"
      : overlay.textAlign === "right"
        ? "text-right items-end"
        : "text-center items-center"

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 overflow-hidden",
        className
      )}
      aria-hidden={!interactive}
    >
      {showText ? (
        <DraggableDecor
          interactive={interactive}
          x={overlay.positionX}
          y={overlay.positionY}
          showDragHandles
          {...textDrag}
        >
          <div className={cn("flex flex-col gap-1", alignClass, motionClass)}>
            {lines.map((line, index) => (
              <p
                key={`${line}-${index}`}
                className={cn(
                  "text-[clamp(0.75rem,5.5vw,1.45rem)] leading-tight",
                  font.className,
                  canvasTextShadowClass(overlay.shadow),
                  canvasTextHighlightClass(overlay.highlight)
                )}
                style={{ ...font.style, color: overlay.color }}
              >
                {line}
              </p>
            ))}
          </div>
        </DraggableDecor>
      ) : null}

      {storyEditorialStickers && overlay.storyStickerMode !== "none" ? (
        <EditorialStoryStickerOverlay
          overlay={overlay}
          interactive={interactive}
          linkHref={linkHref}
          onPointerDown={stickerDrag.onPointerDown}
          onPointerMove={stickerDrag.onPointerMove}
          onPointerUp={stickerDrag.onPointerUp}
        />
      ) : null}

      {overlay.storyStickerMode === "none" && overlay.stickerEnabled ? (
        overlay.stickerId === "link_pill" && linkHref?.trim() && !interactive ? (
          <a
            href={linkHref.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "absolute max-w-[88%] touch-none select-none pointer-events-auto",
              motionClass
            )}
            style={{
              left: `${overlay.stickerX}%`,
              top: `${overlay.stickerY}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <CanvasStickerVisual
              stickerId={overlay.stickerId}
              stickerLabel={overlay.stickerLabel}
              linkBg={overlay.stickerLinkBg}
              linkText={overlay.stickerLinkText}
              linkShape={overlay.stickerLinkShape}
            />
          </a>
        ) : (
          <DraggableDecor
            interactive={interactive}
            x={overlay.stickerX}
            y={overlay.stickerY}
            hint={
              overlay.stickerId === "link_pill" ? "Drag link pill" : "Drag sticker"
            }
            {...stickerDrag}
          >
            <div className={motionClass}>
              <CanvasStickerVisual
                stickerId={overlay.stickerId}
                stickerLabel={overlay.stickerLabel}
                linkBg={overlay.stickerLinkBg}
                linkText={overlay.stickerLinkText}
                linkShape={overlay.stickerLinkShape}
              />
            </div>
          </DraggableDecor>
        )
      ) : null}
    </div>
  )
}

type EditorProps = {
  value: CanvasTextOverlayState
  onChange: (next: CanvasTextOverlayState) => void
  isVideo?: boolean
  className?: string
  linkHref?: string | null
}

export function CanvasTextOverlayEditor({
  value,
  onChange,
  isVideo = false,
  className,
  linkHref = null,
}: EditorProps) {
  function patch(partial: Partial<CanvasTextOverlayState>) {
    onChange({ ...value, ...partial })
  }

  return (
    <section
      className={cn(
        "space-y-2 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-typewriter text-[0.5rem] font-bold tracking-widest text-mad-vermillion uppercase">
          On-canvas text
        </p>
        <button
          type="button"
          onClick={() => patch({ enabled: !value.enabled })}
          className={cn(
            "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.45rem] font-bold uppercase",
            value.enabled ? "bg-mad-black text-mad-white" : "bg-mad-white"
          )}
        >
          {value.enabled ? "On" : "Off"}
        </button>
      </div>

      <p className="font-typewriter text-[0.45rem] leading-relaxed text-neutral-600 normal-case">
        Text and stickers render on the photo — not in the caption strip. Use the
        lime drag bar on the text box in the preview to reposition. Motion plays
        in the studio; baked PNGs use a
        still frame{isVideo ? " (Reels keep motion in-app only)" : ""}.
      </p>

      <input
        type="text"
        value={value.headline}
        onChange={(event) =>
          patch({ headline: event.target.value, enabled: true })
        }
        placeholder="Headline on image"
        className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
      />
      <input
        type="text"
        value={value.subhead}
        onChange={(event) =>
          patch({ subhead: event.target.value, enabled: true })
        }
        placeholder="Subhead (optional)"
        className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
      />

      <div className="grid grid-cols-3 gap-1">
        {(
          [
            { id: "left", label: "Left" },
            { id: "center", label: "Center" },
            { id: "right", label: "Right" },
          ] as const
        ).map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => patch({ textAlign: row.id })}
            className={cn(
              "border-2 border-mad-black py-1 font-typewriter text-[0.45rem] font-bold uppercase",
              value.textAlign === row.id
                ? "bg-mad-black text-mad-white"
                : "bg-mad-white hover:bg-mad-lime"
            )}
          >
            {row.label}
          </button>
        ))}
      </div>

      <label className="grid gap-1">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          Font
        </span>
        <select
          value={value.fontId}
          onChange={(event) =>
            patch({ fontId: event.target.value as CanvasTextFontId })
          }
          className="h-8 w-full border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.55rem] uppercase"
        >
          {CANVAS_TEXT_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          Color
        </span>
        <div className="flex flex-wrap gap-1">
          {CANVAS_BRAND_SWATCHES.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              title={swatch.label}
              onClick={() => patch({ color: swatch.hex })}
              className={cn(
                "size-6 border-2 border-mad-black",
                value.color.toLowerCase() === swatch.hex.toLowerCase() &&
                  "ring-2 ring-mad-vermillion ring-offset-1"
              )}
              style={{ background: swatch.hex }}
            />
          ))}
          <input
            type="color"
            value={value.color}
            onChange={(event) =>
              patch({ color: event.target.value.toUpperCase() })
            }
            className="size-6 border-2 border-mad-black bg-transparent"
            aria-label="Custom text color"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid min-w-0 gap-1">
          <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
            Shadow
          </span>
          <select
            value={value.shadow}
            onChange={(event) =>
              patch({ shadow: event.target.value as CanvasTextShadow })
            }
            className="h-8 min-w-0 border-2 border-mad-black bg-mad-white px-1 font-typewriter text-[0.5rem] uppercase"
          >
            <option value="none">None</option>
            <option value="soft">Soft blur</option>
            <option value="hard">Hard drop</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
            Highlight pill
          </span>
          <select
            value={value.highlight}
            onChange={(event) =>
              patch({ highlight: event.target.value as CanvasTextHighlight })
            }
            className="h-8 min-w-0 border-2 border-mad-black bg-mad-white px-1 font-typewriter text-[0.5rem] uppercase"
          >
            <option value="none">None</option>
            <option value="black_pill">Translucent black</option>
            <option value="brand_pill">Acid lime</option>
          </select>
        </label>
      </div>

      <div className="space-y-1.5 border-t border-mad-black/15 pt-2">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          Story sticker
        </span>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {(
            [
              { id: "none", label: "None" },
              { id: "link_badge", label: "Link badge" },
              { id: "editorial_poll", label: "Editorial poll" },
              { id: "countdown_timer", label: "Countdown" },
            ] as const
          ).map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() =>
                patch({
                  storyStickerMode: row.id,
                  stickerEnabled: row.id === "none" ? value.stickerEnabled : false,
                })
              }
              className={cn(
                "border-2 border-mad-black py-1 font-typewriter text-[0.4rem] font-bold uppercase",
                value.storyStickerMode === row.id
                  ? "bg-mad-black text-mad-white"
                  : "bg-mad-white hover:bg-mad-lime"
              )}
            >
              {row.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {(["noir", "linen"] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => patch({ storyStickerTheme: theme })}
              className={cn(
                "border-2 border-mad-black py-1 font-typewriter text-[0.45rem] font-bold uppercase",
                value.storyStickerTheme === theme
                  ? "bg-mad-vermillion text-mad-white"
                  : "bg-mad-white hover:bg-mad-lime"
              )}
            >
              {theme}
            </button>
          ))}
        </div>
        {value.storyStickerMode === "link_badge" ? (
          <label className="grid gap-1">
            <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
              Link label
            </span>
            <select
              value={value.linkBadgeLabel}
              onChange={(event) =>
                patch({ linkBadgeLabel: event.target.value })
              }
              className="h-8 w-full border-2 border-mad-black bg-mad-white px-2 font-mono text-[0.55rem] uppercase"
            >
              {STORY_LINK_BADGE_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            {linkHref?.trim() ? (
              <a
                href={linkHref.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit border-2 border-mad-black bg-mad-lime px-2 py-1 font-typewriter text-[0.45rem] font-bold uppercase hover:bg-mad-black hover:text-mad-white"
              >
                Test link
              </a>
            ) : null}
          </label>
        ) : null}
        {value.storyStickerMode === "editorial_poll" ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={value.pollQuestion}
              onChange={(event) =>
                patch({ pollQuestion: event.target.value.slice(0, 80) })
              }
              placeholder="Poll question"
              className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
            />
            <div className="grid grid-cols-2 gap-1">
              <input
                type="text"
                value={value.pollOptionA}
                onChange={(event) =>
                  patch({ pollOptionA: event.target.value.slice(0, 32) })
                }
                placeholder="Option A"
                className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
              />
              <input
                type="text"
                value={value.pollOptionB}
                onChange={(event) =>
                  patch({ pollOptionB: event.target.value.slice(0, 32) })
                }
                placeholder="Option B"
                className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
              />
            </div>
            <label className="grid gap-1">
              <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
                Preview split A ({value.pollPercentA}%)
              </span>
              <input
                type="range"
                min={10}
                max={90}
                value={value.pollPercentA}
                onChange={(event) =>
                  patch({ pollPercentA: Number(event.target.value) })
                }
                className="w-full"
              />
            </label>
          </div>
        ) : null}
        {value.storyStickerMode === "countdown_timer" ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={value.countdownTitle}
              onChange={(event) =>
                patch({ countdownTitle: event.target.value.slice(0, 64) })
              }
              placeholder="Drop event title"
              className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
            />
            <label className="grid gap-1">
              <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
                Target date & time
              </span>
              <input
                type="datetime-local"
                value={countdownLocalInputValue(value.countdownTargetAt)}
                onChange={(event) =>
                  patch({
                    countdownTargetAt: localDatetimeToIso(event.target.value),
                  })
                }
                className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
              />
            </label>
          </div>
        ) : null}
        {value.storyStickerMode === "none" ? (
          <>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
            Decor stickers
          </span>
          <button
            type="button"
            onClick={() => patch({ stickerEnabled: !value.stickerEnabled })}
            className={cn(
              "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.45rem] font-bold uppercase",
              value.stickerEnabled
                ? "bg-mad-black text-mad-white"
                : "bg-mad-white"
            )}
          >
            {value.stickerEnabled ? "On" : "Off"}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-4">
          {CANVAS_STICKERS.map((sticker) => {
            const active =
              value.stickerEnabled && value.stickerId === sticker.id
            return (
              <button
                key={sticker.id}
                type="button"
                title={sticker.label}
                onClick={() =>
                  patch({ stickerEnabled: true, stickerId: sticker.id })
                }
                className={cn(
                  "flex min-h-9 flex-col items-center justify-center gap-0.5 border-2 border-mad-black px-1 py-1 font-typewriter text-[0.4rem] font-bold uppercase",
                  active
                    ? "bg-mad-lime text-mad-black"
                    : "bg-mad-white hover:bg-mad-lime/50"
                )}
              >
                <span className="text-base leading-none">{sticker.glyph.slice(0, 2)}</span>
                <span className="line-clamp-1 w-full text-center">{sticker.label.split(" ")[0]}</span>
              </button>
            )
          })}
        </div>
        {value.stickerEnabled && value.stickerId === "link_pill" ? (
          <div className="space-y-2">
            <input
              type="text"
              value={value.stickerLabel}
              onChange={(event) =>
                patch({ stickerLabel: event.target.value.slice(0, 48) })
              }
              placeholder="Link pill label (e.g. View on FÜDI)"
              className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
            />
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: "pill", label: "Pill" },
                  { id: "rounded", label: "Rounded" },
                  { id: "square", label: "Square" },
                ] as const
              ).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => patch({ stickerLinkShape: row.id })}
                  className={cn(
                    "border-2 border-mad-black py-1 font-typewriter text-[0.45rem] font-bold uppercase",
                    value.stickerLinkShape === row.id
                      ? "bg-mad-black text-mad-white"
                      : "bg-mad-white hover:bg-mad-lime"
                  )}
                >
                  {row.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
                Pill colors
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 font-typewriter text-[0.45rem] uppercase">
                  Fill
                  <input
                    type="color"
                    value={value.stickerLinkBg}
                    onChange={(event) =>
                      patch({ stickerLinkBg: event.target.value.toUpperCase() })
                    }
                    className="size-6 border-2 border-mad-black bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-1 font-typewriter text-[0.45rem] uppercase">
                  Text
                  <input
                    type="color"
                    value={value.stickerLinkText}
                    onChange={(event) =>
                      patch({
                        stickerLinkText: event.target.value.toUpperCase(),
                      })
                    }
                    className="size-6 border-2 border-mad-black bg-transparent"
                  />
                </label>
                {CANVAS_BRAND_SWATCHES.slice(0, 4).map((swatch) => (
                  <button
                    key={`link-${swatch.id}`}
                    type="button"
                    title={`Fill ${swatch.label}`}
                    onClick={() => patch({ stickerLinkBg: swatch.hex })}
                    className="size-6 border-2 border-mad-black"
                    style={{ background: swatch.hex }}
                  />
                ))}
              </div>
            </div>
            {linkHref?.trim() ? (
              <a
                href={linkHref.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex border-2 border-mad-black bg-mad-lime px-2 py-1 font-typewriter text-[0.45rem] font-bold uppercase hover:bg-mad-black hover:text-mad-white"
              >
                Test link in new tab
              </a>
            ) : (
              <p className="font-typewriter text-[0.45rem] text-neutral-500 normal-case">
                Trackable link appears after the item has a destination URL.
              </p>
            )}
          </div>
        ) : null}
          </>
        ) : null}
      </div>

      <label className="grid gap-1">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          Motion (preview)
        </span>
        <select
          value={value.animation}
          onChange={(event) =>
            patch({ animation: event.target.value as CanvasTextAnimation })
          }
          className="h-8 w-full border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.5rem] uppercase"
        >
          <option value="none">None</option>
          <option value="fade">Pulse fade</option>
          <option value="pop">Pop-in bounce</option>
          <option value="slide_up">Slide up</option>
          <option value="wiggle">Wiggle</option>
          <option value="glow">Glow pulse</option>
          <option value="typewriter">Typewriter spacing</option>
        </select>
      </label>
    </section>
  )
}

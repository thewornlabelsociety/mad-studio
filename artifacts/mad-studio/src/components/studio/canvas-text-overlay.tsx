"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { GripHorizontal, RotateCw } from "lucide-react"

import {
  CANVAS_BRAND_SWATCHES,
  CANVAS_TEXT_FONTS,
  canvasOverlayHasDecor,
  normalizeCanvasTextOverlay,
  canvasTextAnimationClass,
  canvasTextHighlightClass,
  canvasTextShadowClass,
  type CanvasTextAnimation,
  type CanvasTextFontId,
  type CanvasTextHighlight,
  type CanvasTextOverlayState,
  type CanvasTextShadow,
} from "@/lib/studio/canvas-text-types"
import {
  canvasTextFontSizePx,
  canvasTextLineHeightPx,
  clampCanvasTextFontScale,
  clampCanvasTextRotationDeg,
  resolveCanvasTextFontScale,
  resolveCanvasTextRotationDeg,
} from "@/lib/studio/canvas-text-layout"
import { cn } from "@/lib/utils"

export const CANVAS_MEDIA_FRAME_ATTR = "data-canvas-media-frame"

function mediaFrameElement(from: HTMLElement): HTMLElement | null {
  return from.closest(`[${CANVAS_MEDIA_FRAME_ATTR}]`) as HTMLElement | null
}

function attachWindowPointerSession(
  event: ReactPointerEvent<HTMLElement>,
  onMove: (event: PointerEvent) => void,
  onEnd?: () => void
) {
  const pointerId = event.pointerId
  event.preventDefault()
  event.stopPropagation()

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    onMove(ev)
  }
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", end)
    window.removeEventListener("pointercancel", end)
    onEnd?.()
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", end)
  window.addEventListener("pointercancel", end)
}

function useOverlayRef(overlay: CanvasTextOverlayState) {
  const ref = useRef(overlay)
  ref.current = overlay
  return ref
}

function useCanvasDrag(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlayRef: MutableRefObject<CanvasTextOverlayState>,
  keys: {
    x: "positionX" | "stickerX"
    y: "positionY" | "stickerY"
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
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!interactive || !onChange) return
      const host = mediaFrameElement(event.currentTarget)
      if (!host) return
      const overlay = overlayRef.current
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: overlay[keys.x],
        originY: overlay[keys.y],
      }
      attachWindowPointerSession(event, (ev) => {
        if (!dragRef.current || !onChange) return
        const rect = host.getBoundingClientRect()
        if (rect.width < 1 || rect.height < 1) return
        const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100
        const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100
        onChange({
          ...overlayRef.current,
          [keys.x]: Math.min(max, Math.max(min, dragRef.current.originX + dx)),
          [keys.y]: Math.min(max, Math.max(min, dragRef.current.originY + dy)),
        })
      }, () => {
        dragRef.current = null
      })
    },
    [interactive, onChange, overlayRef, keys.x, keys.y, min, max]
  )

  return { onPointerDown }
}

function useCanvasFontScaleResize(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlayRef: MutableRefObject<CanvasTextOverlayState>
) {
  const resizeRef = useRef<{ startY: number; originScale: number } | null>(null)

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!interactive || !onChange) return
      const host = mediaFrameElement(event.currentTarget)
      if (!host) return
      resizeRef.current = {
        startY: event.clientY,
        originScale: resolveCanvasTextFontScale(overlayRef.current),
      }
      attachWindowPointerSession(event, (ev) => {
        if (!resizeRef.current || !onChange) return
        const rect = host.getBoundingClientRect()
        if (rect.height < 1) return
        const dy = (ev.clientY - resizeRef.current.startY) / rect.height
        const nextScale = clampCanvasTextFontScale(
          resizeRef.current.originScale + dy * 2.4
        )
        onChange({ ...overlayRef.current, fontScale: nextScale })
      }, () => {
        resizeRef.current = null
      })
    },
    [interactive, onChange, overlayRef]
  )

  return { onResizePointerDown }
}

function useCanvasTextRotation(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlayRef: MutableRefObject<CanvasTextOverlayState>,
  boxRef: RefObject<HTMLDivElement | null>
) {
  const rotateRef = useRef<{
    centerX: number
    centerY: number
    startAngle: number
    originDeg: number
  } | null>(null)

  const onRotatePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!interactive || !onChange) return
      const box = boxRef.current
      if (!box) return
      const rect = box.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const startAngle =
        (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
        Math.PI
      rotateRef.current = {
        centerX,
        centerY,
        startAngle,
        originDeg: resolveCanvasTextRotationDeg(overlayRef.current),
      }
      attachWindowPointerSession(event, (ev) => {
        if (!rotateRef.current || !onChange) return
        const { centerX: cx, centerY: cy, startAngle: sa, originDeg } =
          rotateRef.current
        const angle =
          (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI
        const delta = angle - sa
        onChange({
          ...overlayRef.current,
          rotationDeg: clampCanvasTextRotationDeg(originDeg + delta),
        })
      }, () => {
        rotateRef.current = null
      })
    },
    [interactive, onChange, overlayRef, boxRef]
  )

  return { onRotatePointerDown }
}

function DraggableDecor({
  interactive,
  x,
  y,
  rotationDeg = 0,
  onPointerDown,
  children,
  hint,
  showDragHandles = false,
  onResizePointerDown,
  onRotatePointerDown,
  boxRef,
}: {
  interactive: boolean
  x: number
  y: number
  rotationDeg?: number
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  children: ReactNode
  hint?: string
  showDragHandles?: boolean
  onResizePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onRotatePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  boxRef?: RefObject<HTMLDivElement | null>
}) {
  const handlesOn = interactive && showDragHandles
  const localBoxRef = useRef<HTMLDivElement>(null)
  const textBoxRef = boxRef ?? localBoxRef

  return (
    <div
      className="absolute inline-block w-max max-w-[92%] touch-none select-none overflow-visible"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {handlesOn ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag on-screen text"
          onPointerDown={onPointerDown}
          className="pointer-events-auto absolute bottom-full left-1/2 z-20 mb-1 flex -translate-x-1/2 cursor-grab items-center justify-center gap-1 border-2 border-mad-lime/80 bg-mad-lime/90 px-2 py-0.5 shadow-keycap-sm active:cursor-grabbing"
        >
          <GripHorizontal className="size-3.5 shrink-0 text-mad-black" />
          <span className="font-typewriter text-[0.4rem] font-bold tracking-wider text-mad-black uppercase">
            Drag
          </span>
        </div>
      ) : null}
      <div
        ref={textBoxRef}
        className="inline-flex w-max max-w-full flex-col items-center justify-center overflow-visible"
        style={{
          transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
          transformOrigin: "center center",
        }}
      >
        <div
          role={interactive && !handlesOn ? "button" : undefined}
          tabIndex={interactive && !handlesOn ? 0 : undefined}
          onPointerDown={interactive && !handlesOn ? onPointerDown : undefined}
          className={cn(
            "relative inline-flex w-max max-w-full flex-col items-center justify-center overflow-visible",
            handlesOn &&
              "rounded-sm border-2 border-dashed border-mad-lime/90 bg-black/25 p-0.5 shadow-[0_2px_12px_rgba(0,0,0,0.35)]",
            interactive && !handlesOn && "pointer-events-auto cursor-grab active:cursor-grabbing",
            interactive &&
              !handlesOn &&
              "ring-2 ring-transparent hover:ring-mad-vermillion/80 hover:ring-offset-1 hover:ring-offset-black/20"
          )}
        >
          {handlesOn ? (
            <>
              {onRotatePointerDown ? (
                <button
                  type="button"
                  aria-label="Rotate on-screen text"
                  onPointerDown={onRotatePointerDown}
                  className="absolute -top-1 -left-1 z-30 flex size-5 cursor-grab items-center justify-center border-2 border-mad-black bg-mad-white text-mad-black shadow-keycap-sm touch-none active:cursor-grabbing"
                >
                  <RotateCw className="size-3" />
                </button>
              ) : null}
              {onResizePointerDown ? (
                <button
                  type="button"
                  aria-label="Resize on-screen text"
                  onPointerDown={onResizePointerDown}
                  className="absolute -bottom-1 -right-1 z-30 size-5 cursor-nwse-resize border-2 border-mad-vermillion bg-mad-lime shadow-keycap-sm touch-none"
                />
              ) : null}
            </>
          ) : null}
          {children}
        </div>
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
  /** When false, text is rendered by Remotion preview (handles only). */
  renderCanvasText?: boolean
}

export function CanvasTextOverlayLayer({
  overlay,
  className,
  interactive = false,
  onOverlayChange,
  renderCanvasText = true,
}: LayerProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const textBoxRef = useRef<HTMLDivElement>(null)
  const overlayRef = useOverlayRef(overlay)
  const [frameWidthPx, setFrameWidthPx] = useState(0)

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const measure = () => {
      const rect = node.getBoundingClientRect()
      setFrameWidthPx(Math.max(0, Math.round(rect.width)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const textDrag = useCanvasDrag(interactive, onOverlayChange, overlayRef, {
    x: "positionX",
    y: "positionY",
  })
  const textResize = useCanvasFontScaleResize(
    interactive,
    onOverlayChange,
    overlayRef
  )
  const textRotate = useCanvasTextRotation(
    interactive,
    onOverlayChange,
    overlayRef,
    textBoxRef
  )
  if (!canvasOverlayHasDecor(overlay)) return null

  const font =
    CANVAS_TEXT_FONTS.find((row) => row.id === overlay.fontId) ??
    CANVAS_TEXT_FONTS[0]
  const lines = [overlay.headline.trim(), overlay.subhead.trim()].filter(Boolean)
  const showText = renderCanvasText && overlay.enabled && lines.length > 0
  const motionClass = interactive
    ? ""
    : canvasTextAnimationClass(overlay.animation, {
        motionPreview: true,
      })

  const alignClass =
    overlay.textAlign === "left"
      ? "text-left items-start"
      : overlay.textAlign === "right"
        ? "text-right items-end"
        : "text-center items-center"

  const fontSizePx =
    frameWidthPx > 0
      ? canvasTextFontSizePx(frameWidthPx, resolveCanvasTextFontScale(overlay))
      : null
  const lineHeightPx =
    fontSizePx != null ? canvasTextLineHeightPx(fontSizePx) : undefined
  return (
    <div
      ref={frameRef}
      {...{ [CANVAS_MEDIA_FRAME_ATTR]: "" }}
      className={cn(
        "pointer-events-none absolute inset-0 z-20",
        interactive ? "overflow-visible" : "overflow-hidden",
        className
      )}
      aria-hidden={!interactive}
    >
      {showText ? (
        <DraggableDecor
          interactive={interactive}
          x={overlay.positionX}
          y={overlay.positionY}
          rotationDeg={resolveCanvasTextRotationDeg(overlay)}
          showDragHandles
          boxRef={textBoxRef}
          {...textDrag}
          {...textResize}
          {...textRotate}
        >
          <div
            className={cn(
              "inline-flex w-max max-w-full flex-col",
              alignClass,
              motionClass
            )}
            style={{ gap: fontSizePx != null ? fontSizePx * 0.15 : 4 }}
          >
            {lines.map((line, index) => (
              <span
                key={`${line}-${index}`}
                className={cn(
                  "block w-max max-w-full leading-none",
                  overlay.textAlign === "center" && "mx-auto",
                  overlay.textAlign === "right" && "ml-auto",
                  font.className,
                  canvasTextShadowClass(overlay.shadow),
                  canvasTextHighlightClass(overlay.highlight)
                )}
                style={{
                  ...font.style,
                  color: overlay.color,
                  fontSize: fontSizePx ?? undefined,
                  lineHeight: lineHeightPx,
                  marginTop: index > 0 ? (fontSizePx != null ? fontSizePx * 0.15 : 4) : 0,
                }}
              >
                {line}
              </span>
            ))}
          </div>
        </DraggableDecor>
      ) : null}
    </div>
  )
}

type EditorProps = {
  value: CanvasTextOverlayState
  onChange: (next: CanvasTextOverlayState) => void
  isVideo?: boolean
  className?: string
}

export function CanvasTextOverlayEditor({
  value,
  onChange,
  isVideo = false,
  className,
}: EditorProps) {
  useEffect(() => {
    if (value.storyStickerMode === "none" && !value.stickerEnabled) return
    onChange(normalizeCanvasTextOverlay(value))
  }, [onChange, value])

  function patch(partial: Partial<CanvasTextOverlayState>) {
    onChange(normalizeCanvasTextOverlay({ ...value, ...partial }))
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
        Headline and subhead render on the photo — not in the caption strip.
        Platforms no longer allow fake poll, countdown, or decor stickers in
        exported media; add those natively on your phone at post time. Drag the
        lime bar to move; bottom-right handle (or size slider) to scale; top-left
        handle (or rotation slider) to tilt. Preview matches the baked PNG on IG,
        TikTok, and Facebook. Motion plays in the studio; baked PNGs use a still
        frame{isVideo ? " (Reels keep motion in-app only)" : ""}.
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

      <label className="grid gap-1">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          On-screen size ({Math.round(resolveCanvasTextFontScale(value) * 100)}%)
        </span>
        <input
          type="range"
          min={0.5}
          max={2.5}
          step={0.05}
          value={resolveCanvasTextFontScale(value)}
          onChange={(event) =>
            patch({
              fontScale: clampCanvasTextFontScale(Number(event.target.value)),
            })
          }
          className="w-full"
        />
      </label>

      <label className="grid gap-1">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          Rotation ({Math.round(resolveCanvasTextRotationDeg(value))}°)
        </span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={resolveCanvasTextRotationDeg(value)}
          onChange={(event) =>
            patch({
              rotationDeg: clampCanvasTextRotationDeg(Number(event.target.value)),
            })
          }
          className="w-full"
        />
      </label>

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

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => patch({ positionX: 50, positionY: 50 })}
          className="border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.4rem] font-bold uppercase hover:bg-mad-lime"
        >
          Center frame
        </button>
        <button
          type="button"
          onClick={() => patch({ positionX: 50, positionY: 72 })}
          className="border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.4rem] font-bold uppercase hover:bg-mad-lime"
        >
          Lower third
        </button>
        <button
          type="button"
          onClick={() => patch({ fontScale: 1, rotationDeg: 0 })}
          className="border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.4rem] font-bold uppercase hover:bg-mad-lime"
        >
          Reset size & tilt
        </button>
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

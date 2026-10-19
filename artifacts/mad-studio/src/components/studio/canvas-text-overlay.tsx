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
import { RotateCw } from "lucide-react"

import {
  CANVAS_BRAND_SWATCHES,
  CANVAS_TEXT_FONTS,
  canvasOverlayHasDecor,
  clearCanvasTextOverlay,
  normalizeCanvasTextOverlay,
  canvasTextShadowClass,
  type CanvasTextFontId,
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
import {
  CANVAS_NATIVE_POST_FEATURES,
  TEAM_POSTING_TRACK_SOPS,
} from "@/lib/studio/studio-wizard-sop"
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
      className="absolute inline-block w-fit max-w-[92%] touch-none select-none overflow-visible"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        ref={textBoxRef}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={interactive ? onPointerDown : undefined}
        className={cn(
          "relative inline-block w-max max-w-full overflow-visible align-top",
          handlesOn &&
            "pointer-events-auto cursor-grab border-2 border-dashed border-mad-lime active:cursor-grabbing",
          interactive && !handlesOn && "pointer-events-auto cursor-grab active:cursor-grabbing",
          interactive &&
            !handlesOn &&
            "ring-2 ring-transparent hover:ring-mad-vermillion/80 hover:ring-offset-1 hover:ring-offset-black/20"
        )}
        style={{
          transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
          transformOrigin: "center center",
        }}
      >
        {handlesOn ? (
          <>
            {onRotatePointerDown ? (
              <button
                type="button"
                aria-label="Rotate on-screen text"
                onPointerDown={onRotatePointerDown}
                className="absolute top-0 left-0 z-30 flex size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center border-2 border-mad-black bg-mad-white text-mad-black shadow-keycap-sm touch-none active:cursor-grabbing"
              >
                <RotateCw className="size-2.5" />
              </button>
            ) : null}
            {onResizePointerDown ? (
              <button
                type="button"
                aria-label="Resize on-screen text"
                onPointerDown={onResizePointerDown}
                className="absolute bottom-0 right-0 z-30 size-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize border-2 border-mad-vermillion bg-mad-lime shadow-keycap-sm touch-none"
              />
            ) : null}
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
  const motionClass = ""

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
              "flex w-max max-w-full shrink-0 flex-col",
              alignClass,
              motionClass
            )}
            style={{ gap: fontSizePx != null ? fontSizePx * 0.12 : 3 }}
          >
            {lines.map((line, index) => (
              <span
                key={`${line}-${index}`}
                className={cn(
                  "block w-max max-w-full whitespace-pre-wrap",
                  overlay.textAlign === "center" && "mx-auto",
                  overlay.textAlign === "right" && "ml-auto",
                  font.className,
                  canvasTextShadowClass(overlay.shadow)
                )}
                style={{
                  ...font.style,
                  color: overlay.color,
                  fontSize: fontSizePx ?? undefined,
                  lineHeight: lineHeightPx,
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

function CanvasNativePostPanel({
  destinationUrl,
  isVideo,
  btnClass,
}: {
  destinationUrl?: string | null
  isVideo?: boolean
  btnClass: string
}) {
  const [copied, setCopied] = useState(false)
  const track2 = TEAM_POSTING_TRACK_SOPS.find((row) => row.id === "draft_drop")

  async function copyLink() {
    const url = destinationUrl?.trim()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border-t border-neutral-200 pt-5 lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold tracking-wide text-neutral-900 uppercase">
            Add on your phone after publish
          </h3>
          <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
            {track2?.intro ??
              "Instagram and TikTok require native stickers in-app — MAD Studio bakes on-image text only."}
            {isVideo
              ? " Leave the lower third clear for link stickers on Story/Reels."
              : null}
          </p>
        </div>
        {destinationUrl?.trim() ? (
          <button
            type="button"
            onClick={() => void copyLink()}
            className={cn(btnClass, "shrink-0 bg-mad-lime hover:bg-mad-black hover:text-mad-white")}
          >
            {copied ? "Copied" : "Copy link for sticker"}
          </button>
        ) : null}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CANVAS_NATIVE_POST_FEATURES.map((feature) => (
          <li
            key={feature.id}
            className="border border-neutral-200 bg-neutral-50/80 p-3 md:p-4"
          >
            <p className="text-sm font-semibold text-neutral-900">{feature.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              {feature.detail}
            </p>
            <p className="mt-2 font-typewriter text-[0.55rem] font-bold tracking-wide text-neutral-500 uppercase">
              {feature.platforms.join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

type EditorProps = {
  value: CanvasTextOverlayState
  onChange: (next: CanvasTextOverlayState) => void
  isVideo?: boolean
  className?: string
  /** Studio Canvas step — larger type, two-column layout, tips collapsed. */
  wizardCompact?: boolean
  destinationUrl?: string | null
}

export function CanvasTextOverlayEditor({
  value,
  onChange,
  isVideo = false,
  className,
  wizardCompact = false,
  destinationUrl = null,
}: EditorProps) {
  useEffect(() => {
    if (value.highlight === "none" && value.animation === "none") return
    onChange(
      normalizeCanvasTextOverlay({
        ...value,
        highlight: "none",
        animation: "none",
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- strip legacy pill/motion once on mount

  useEffect(() => {
    if (value.storyStickerMode === "none" && !value.stickerEnabled) return
    onChange(normalizeCanvasTextOverlay(value))
  }, [
    onChange,
    value.storyStickerMode,
    value.stickerEnabled,
    value.stickerId,
    value.stickerLabel,
  ])

  function patch(partial: Partial<CanvasTextOverlayState>) {
    onChange(
      normalizeCanvasTextOverlay({
        ...value,
        ...partial,
        highlight: "none",
        animation: "none",
      })
    )
  }

  const labelClass = wizardCompact
    ? "text-xs font-semibold tracking-wide text-neutral-600 uppercase"
    : "font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase"
  const inputClass = wizardCompact
    ? "h-11 w-full border-2 border-mad-black px-3 py-2 text-base outline-none focus:bg-mad-lime/20"
    : "w-full border-2 border-mad-black px-2 py-1 text-base outline-none focus:bg-mad-lime/20 md:text-xs"
  const sectionTitleClass = wizardCompact
    ? "text-xs font-semibold tracking-[0.14em] text-neutral-800 uppercase"
    : labelClass
  const btnClass = wizardCompact
    ? "border-2 border-mad-black px-3 py-2 text-xs font-semibold uppercase"
    : "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.4rem] font-bold uppercase"
  const selectClass = wizardCompact
    ? "h-10 w-full border-2 border-mad-black bg-mad-white px-2 text-sm"
    : "h-8 w-full border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.55rem] uppercase"

  const tipsCopy = (
    <>
      Headline and subhead render on the photo — not in the caption strip.
      Platforms no longer allow fake poll, countdown, or decor stickers in
      exported media; add those natively on your phone at post time. Drag the
      dashed box to move; bottom-right handle (or Size slider) to scale;
      top-left handle (or Tilt slider) to rotate. Preview matches the baked PNG on IG,
      TikTok, and Facebook. Motion plays in the studio; baked PNGs use a still
      frame{isVideo ? " (Reels keep motion in-app only)" : ""}.
    </>
  )

  return (
    <section
      className={cn(
        wizardCompact
          ? "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto"
          : "space-y-2 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm",
        className
      )}
    >
      {wizardCompact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <details className="min-w-0 flex-1 text-sm leading-relaxed text-neutral-600">
            <summary className="cursor-pointer font-medium text-neutral-800">
              Tips — drag, scale, and bake on export
            </summary>
            <p className="mt-2 max-w-2xl">{tipsCopy}</p>
          </details>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(clearCanvasTextOverlay())}
              className={cn(
                btnClass,
                "hover:bg-mad-vermillion hover:text-mad-white"
              )}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => patch({ enabled: !value.enabled })}
              className={cn(
                btnClass,
                value.enabled ? "bg-mad-black text-mad-white" : "bg-mad-white"
              )}
            >
              {value.enabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-typewriter text-[0.5rem] font-bold tracking-widest text-mad-vermillion uppercase">
              On-canvas text
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onChange(clearCanvasTextOverlay())}
                className={cn(
                  btnClass,
                  "hover:bg-mad-vermillion hover:text-mad-white"
                )}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => patch({ enabled: !value.enabled })}
                className={cn(
                  btnClass,
                  value.enabled ? "bg-mad-black text-mad-white" : "bg-mad-white"
                )}
              >
                {value.enabled ? "On" : "Off"}
              </button>
            </div>
          </div>
          <p className="font-typewriter text-[0.45rem] leading-relaxed text-neutral-600 normal-case">
            {tipsCopy}
          </p>
        </>
      )}

      <div
        className={cn(
          wizardCompact
            ? "grid min-w-0 gap-6 lg:grid-cols-3 lg:gap-8"
            : "space-y-3"
        )}
      >
        <div className={cn(wizardCompact ? "space-y-4" : "space-y-3")}>
          {wizardCompact ? (
            <p className={sectionTitleClass}>On-image copy</p>
          ) : null}
          <label className="grid gap-1.5">
            <span className={labelClass}>Headline on image</span>
            <input
              type="text"
              value={value.headline}
              onChange={(event) =>
                patch({ headline: event.target.value, enabled: true })
              }
              placeholder="e.g. Friday flatbread drop"
              className={inputClass}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>Subhead (optional)</span>
            <input
              type="text"
              value={value.subhead}
              onChange={(event) =>
                patch({ subhead: event.target.value, enabled: true })
              }
              placeholder="Supporting line under headline"
              className={inputClass}
            />
          </label>
        </div>

        <div className={cn(wizardCompact ? "space-y-4" : "space-y-3")}>
          {wizardCompact ? (
            <p className={sectionTitleClass}>Position & scale</p>
          ) : null}
          <div className="space-y-2">
            <span className={labelClass}>Alignment</span>
            <div className="grid grid-cols-3 gap-1.5">
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
                    btnClass,
                    wizardCompact && "py-2.5",
                    value.textAlign === row.id
                      ? "bg-mad-black text-mad-white"
                      : "bg-mad-white hover:bg-mad-lime"
                  )}
                >
                  {row.label}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-2">
            <span className={labelClass}>
              Size ({Math.round(resolveCanvasTextFontScale(value) * 100)}%)
            </span>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.05}
              value={resolveCanvasTextFontScale(value)}
              onChange={(event) =>
                patch({
                  fontScale: clampCanvasTextFontScale(
                    Number(event.target.value)
                  ),
                })
              }
              className="w-full"
            />
          </label>
          <label className="grid gap-2">
            <span className={labelClass}>
              Tilt ({Math.round(resolveCanvasTextRotationDeg(value))}°)
            </span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={resolveCanvasTextRotationDeg(value)}
              onChange={(event) =>
                patch({
                  rotationDeg: clampCanvasTextRotationDeg(
                    Number(event.target.value)
                  ),
                })
              }
              className="w-full"
            />
          </label>
        </div>

        <div className={cn(wizardCompact ? "space-y-4" : "space-y-3")}>
          {wizardCompact ? (
            <p className={sectionTitleClass}>Typography</p>
          ) : null}
          <label className="grid gap-1.5">
            <span className={labelClass}>Font</span>
            <select
              value={value.fontId}
              onChange={(event) =>
                patch({ fontId: event.target.value as CanvasTextFontId })
              }
              className={selectClass}
            >
              {CANVAS_TEXT_FONTS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className={labelClass}>Color</span>
            <div className="flex flex-wrap gap-2.5">
              {CANVAS_BRAND_SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  title={swatch.label}
                  onClick={() => patch({ color: swatch.hex })}
                  className={cn(
                    wizardCompact ? "size-9" : "size-6",
                    "border-2 border-mad-black",
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
                className={cn(
                  wizardCompact ? "size-9" : "size-6",
                  "border-2 border-mad-black bg-transparent"
                )}
                aria-label="Custom text color"
              />
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className={labelClass}>Shadow</span>
            <select
              value={value.shadow}
              onChange={(event) =>
                patch({ shadow: event.target.value as CanvasTextShadow })
              }
              className={selectClass}
            >
              <option value="none">None</option>
              <option value="soft">Soft blur</option>
              <option value="hard">Hard drop</option>
            </select>
          </label>
        </div>

        {wizardCompact ? (
          <CanvasNativePostPanel
            destinationUrl={destinationUrl}
            isVideo={isVideo}
            btnClass={btnClass}
          />
        ) : null}
      </div>
    </section>
  )
}

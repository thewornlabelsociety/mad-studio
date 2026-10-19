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
  canvasTextLayers,
  CANVAS_TEXT_LAYER_FIELDS,
  CANVAS_TEXT_BG_PAD_X,
  CANVAS_TEXT_BG_PAD_Y,
  type CanvasTextLayerId,
  CANVAS_TAGS,
  canvasTagItems,
  type CanvasTagPositionKey,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
    x: "positionX" | "stickerX" | "subPositionX" | CanvasTagPositionKey
    y: "positionY" | "stickerY" | "subPositionY" | CanvasTagPositionKey
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
  overlayRef: MutableRefObject<CanvasTextOverlayState>,
  scaleKey: "fontScale" | "subFontScale" | "tagFontScale" = "fontScale"
) {
  const resizeRef = useRef<{ startY: number; originScale: number } | null>(null)

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!interactive || !onChange) return
      const host = mediaFrameElement(event.currentTarget)
      if (!host) return
      resizeRef.current = {
        startY: event.clientY,
        originScale: clampCanvasTextFontScale(overlayRef.current[scaleKey]),
      }
      attachWindowPointerSession(event, (ev) => {
        if (!resizeRef.current || !onChange) return
        const rect = host.getBoundingClientRect()
        if (rect.height < 1) return
        const dy = (ev.clientY - resizeRef.current.startY) / rect.height
        const nextScale = clampCanvasTextFontScale(
          resizeRef.current.originScale + dy * 2.4
        )
        onChange({ ...overlayRef.current, [scaleKey]: nextScale })
      }, () => {
        resizeRef.current = null
      })
    },
    [interactive, onChange, overlayRef, scaleKey]
  )

  return { onResizePointerDown }
}

function useCanvasTextRotation(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlayRef: MutableRefObject<CanvasTextOverlayState>,
  boxRef: RefObject<HTMLDivElement | null>,
  rotationKey: "rotationDeg" | "subRotationDeg" | "tagRotationDeg" = "rotationDeg"
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
        originDeg: clampCanvasTextRotationDeg(overlayRef.current[rotationKey]),
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
          [rotationKey]: clampCanvasTextRotationDeg(originDeg + delta),
        })
      }, () => {
        rotateRef.current = null
      })
    },
    [interactive, onChange, overlayRef, boxRef, rotationKey]
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
  const hasDecor = canvasOverlayHasDecor(overlay)

  // The frame only mounts once there's text, so measure again when it appears;
  // without a width the text falls back to a fixed size and Size does nothing.
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
  }, [hasDecor])

  const subBoxRef = useRef<HTMLDivElement>(null)
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
  // The subhead moves, scales and tilts on its own.
  const subDrag = useCanvasDrag(interactive, onOverlayChange, overlayRef, {
    x: "subPositionX",
    y: "subPositionY",
  })
  const subResize = useCanvasFontScaleResize(
    interactive,
    onOverlayChange,
    overlayRef,
    "subFontScale"
  )
  const subRotate = useCanvasTextRotation(
    interactive,
    onOverlayChange,
    overlayRef,
    subBoxRef,
    "subRotationDeg"
  )
  // Each tag box (New, Brand, Size, Price, Vibe) moves on its own; they
  // share one size, and tilt comes from the Tags slider.
  const tagResize = useCanvasFontScaleResize(
    interactive,
    onOverlayChange,
    overlayRef,
    "tagFontScale"
  )
  const tagNewDrag = useCanvasDrag(interactive, onOverlayChange, overlayRef, { x: "tagNewX", y: "tagNewY" })
  const tagBrandDrag = useCanvasDrag(interactive, onOverlayChange, overlayRef, { x: "tagBrandX", y: "tagBrandY" })
  const tagSizeDrag = useCanvasDrag(interactive, onOverlayChange, overlayRef, { x: "tagSizeX", y: "tagSizeY" })
  const tagPriceDrag = useCanvasDrag(interactive, onOverlayChange, overlayRef, { x: "tagPriceX", y: "tagPriceY" })
  const tagVibeDrag = useCanvasDrag(interactive, onOverlayChange, overlayRef, { x: "tagVibeX", y: "tagVibeY" })
  if (!hasDecor) return null

  const layers = renderCanvasText ? canvasTextLayers(overlay) : []
  const handlesFor = {
    headline: { boxRef: textBoxRef, ...textDrag, ...textResize, ...textRotate },
    subhead: { boxRef: subBoxRef, ...subDrag, ...subResize, ...subRotate },
    tag_new: { ...tagNewDrag, ...tagResize },
    tag_brand: { ...tagBrandDrag, ...tagResize },
    tag_size: { ...tagSizeDrag, ...tagResize },
    tag_price: { ...tagPriceDrag, ...tagResize },
    tag_vibe: { ...tagVibeDrag, ...tagResize },
  }

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
      {layers.map((layer) => {
        const font =
          CANVAS_TEXT_FONTS.find((row) => row.id === layer.fontId) ??
          CANVAS_TEXT_FONTS[0]
        const fontSizePx =
          frameWidthPx > 0
            ? canvasTextFontSizePx(frameWidthPx, layer.fontScale)
            : null
        const lineHeightPx =
          fontSizePx != null ? canvasTextLineHeightPx(fontSizePx) : null
        return (
          <DraggableDecor
            key={layer.id}
            interactive={interactive}
            x={layer.positionX}
            y={layer.positionY}
            rotationDeg={layer.rotationDeg}
            showDragHandles
            {...handlesFor[layer.id]}
          >
            <span
              className={cn(
                "block w-max max-w-full whitespace-pre-wrap",
                overlay.textAlign === "left" && "text-left",
                overlay.textAlign === "center" && "text-center",
                overlay.textAlign === "right" && "text-right",
                font.className,
                !layer.bgColor && canvasTextShadowClass(overlay.shadow)
              )}
              style={{
                ...font.style,
                color: layer.color,
                fontSize: fontSizePx ?? undefined,
                ...(layer.bgColor
                  ? {
                      backgroundColor: layer.bgColor,
                      padding: `${CANVAS_TEXT_BG_PAD_Y}em ${CANVAS_TEXT_BG_PAD_X}em`,
                    }
                  : null),
                // Pixels — a bare number would be read as a multiplier.
                lineHeight:
                  lineHeightPx != null ? `${lineHeightPx}px` : undefined,
              }}
            >
              {layer.text}
            </span>
          </DraggableDecor>
        )
      })}
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
    <div className="border-t-2 border-mad-black/10 pt-5 lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
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
            className="border-2 border-mad-black bg-mad-white p-3 md:p-4"
          >
            <p className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase">
              {feature.title}
            </p>
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
  /** This brand's colours (Brand Brain palette); falls back to MAD swatches. */
  swatches?: ReadonlyArray<{ hex: string; label: string }>
  /** This brand's headline font, listed first. */
  brandFontId?: string | null
  /** Facts about the item being posted, used to fill the tags line. */
  itemFacts?: CanvasItemFacts | null
}

export type CanvasItemFacts = {
  brand?: string | null
  size?: string | null
  price?: string | null
  vibe?: string | null
  /** Wording for the "new" pill, e.g. "New consignment" or "New on the menu". */
  newLabel?: string | null
}

const LAYER_LABELS: Record<CanvasTextLayerId, string> = {
  headline: "Headline",
  subhead: "Subhead",
  tags: "Tags",
}

const TAG_ROWS = [
  { show: "tagShowNew", text: "tagNewLabel", fact: "newLabel", label: "New pill", placeholder: "New consignment" },
  { show: "tagShowBrand", text: "tagBrand", fact: "brand", label: "Brand", placeholder: "e.g. Zimmermann" },
  { show: "tagShowSize", text: "tagSize", fact: "size", label: "Size", placeholder: "e.g. 10 or M" },
  { show: "tagShowPrice", text: "tagPrice", fact: "price", label: "Price", placeholder: "e.g. 180" },
  { show: "tagShowVibe", text: "tagVibe", fact: "vibe", label: "Vibe", placeholder: "e.g. Coastal boho" },
] as const

export function CanvasTextOverlayEditor({
  value,
  onChange,
  isVideo = false,
  className,
  wizardCompact = false,
  destinationUrl = null,
  swatches = CANVAS_BRAND_SWATCHES,
  brandFontId = null,
  itemFacts = null,
}: EditorProps) {
  const fontOptions = brandFontId
    ? [
        ...CANVAS_TEXT_FONTS.filter((font) => font.id === brandFontId),
        ...CANVAS_TEXT_FONTS.filter((font) => font.id !== brandFontId),
      ]
    : CANVAS_TEXT_FONTS
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

  // Wizard styles match the Intent step: typewriter labels, 2px black frames.
  // Which line the size / tilt / font / colour controls edit.
  const [layer, setLayer] = useState<CanvasTextLayerId>("headline")
  const fields = CANVAS_TEXT_LAYER_FIELDS[layer]
  const layerFontId = value[fields.fontId]
  const layerColor = value[fields.color]
  const layerBg = value[fields.bgColor] ?? ""
  const layerScale = clampCanvasTextFontScale(value[fields.fontScale])
  const layerRotation = clampCanvasTextRotationDeg(value[fields.rotationDeg])

  const labelClass = wizardCompact
    ? "font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase"
    : "font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase"
  const inputClass = wizardCompact
    ? "h-10 w-full border-2 border-mad-black bg-mad-white px-3 text-sm outline-none placeholder:text-neutral-400 focus:bg-mad-lime/20"
    : "w-full border-2 border-mad-black px-2 py-1 text-base outline-none focus:bg-mad-lime/20 md:text-xs"
  const sectionTitleClass = wizardCompact
    ? "border-b-2 border-mad-black/10 pb-1.5 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase"
    : labelClass
  const btnClass = wizardCompact
    ? "border-2 border-mad-black px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase"
    : "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.4rem] font-bold uppercase"
  const selectClass = wizardCompact
    ? "h-10 w-full min-w-0 rounded-none border-2 border-mad-black bg-mad-white text-sm shadow-none"
    : "h-8 w-full min-w-0 rounded-none border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.55rem] uppercase shadow-none"
  const rangeClass = "w-full cursor-pointer accent-mad-black"

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
            <summary className="cursor-pointer font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase">
              Tips — drag, scale & bake on export
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

      <fieldset className={cn("grid gap-x-4 gap-y-2", wizardCompact && "sm:grid-cols-2 xl:grid-cols-3")}>
        <legend className={cn(sectionTitleClass, "mb-3 w-full")}>
          Add to image
        </legend>
        {TAG_ROWS.map((row) => {
          const on = value[row.show]
          return (
            <div key={row.show} className="flex items-center gap-2">
              <label className="flex w-20 shrink-0 cursor-pointer items-center gap-2 text-sm text-mad-black">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(event) => {
                    const checked = event.target.checked
                    const current = value[row.text].trim()
                    const fact = itemFacts?.[row.fact]?.trim() ?? ""
                    // A newly ticked tag drops in under the ones already showing.
                    const tag = CANVAS_TAGS.find((t) => t.show === row.show)!
                    const shown = canvasTagItems(value)
                    const nextY = shown.length
                      ? Math.min(92, Math.max(...shown.map((t) => t.y)) + 9)
                      : 8
                    patch({
                      [row.show]: checked,
                      [row.text]: current || fact,
                      ...(checked
                        ? {
                            enabled: true,
                            [tag.x]: shown[shown.length - 1]?.x ?? 50,
                            [tag.y]: nextY,
                          }
                        : null),
                    })
                    if (checked) setLayer("tags")
                  }}
                  className="size-4 cursor-pointer accent-mad-black"
                />
                {row.label}
              </label>
              <input
                type="text"
                value={value[row.text]}
                onChange={(event) =>
                  patch({
                    [row.text]: event.target.value,
                    [row.show]: true,
                    enabled: true,
                  })
                }
                onFocus={() => setLayer("tags")}
                placeholder={itemFacts?.[row.fact] || row.placeholder}
                aria-label={`${row.label} on image`}
                className={cn(inputClass, "min-w-0 flex-1", wizardCompact && "h-9", !on && "opacity-60")}
              />
            </div>
          )
        })}
      </fieldset>

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
              placeholder="e.g. New in this week"
              onFocus={() => setLayer("headline")}
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
              onFocus={() => setLayer("subhead")}
              placeholder="Supporting line under headline"
              className={inputClass}
            />
          </label>
        </div>

        <div className={cn(wizardCompact ? "space-y-4" : "space-y-3")}>
          {wizardCompact ? (
            <p className={sectionTitleClass}>Position & scale</p>
          ) : null}
          {wizardCompact ? (
            <div
              className="grid grid-cols-3 border-2 border-mad-black"
              role="tablist"
              aria-label="Which line to style"
            >
              {(["headline", "subhead", "tags"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={layer === id}
                  onClick={() => setLayer(id)}
                  className={cn(
                    "px-2 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase",
                    layer === id
                      ? "bg-mad-black text-mad-white"
                      : "bg-mad-white text-mad-black hover:bg-mad-lime"
                  )}
                >
                  {LAYER_LABELS[id]}
                </button>
              ))}
            </div>
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
              Size ({Math.round(layerScale * 100)}%)
            </span>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.05}
              value={layerScale}
              onChange={(event) =>
                patch({
                  [fields.fontScale]: clampCanvasTextFontScale(
                    Number(event.target.value)
                  ),
                })
              }
              className={rangeClass}
            />
          </label>
          <label className="grid gap-2">
            <span className={labelClass}>
              Tilt ({Math.round(layerRotation)}°)
            </span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={layerRotation}
              onChange={(event) =>
                patch({
                  [fields.rotationDeg]: clampCanvasTextRotationDeg(
                    Number(event.target.value)
                  ),
                })
              }
              className={rangeClass}
            />
          </label>
        </div>

        <div className={cn(wizardCompact ? "space-y-4" : "space-y-3")}>
          {wizardCompact ? (
            <p className={sectionTitleClass}>
              Typography · {LAYER_LABELS[layer]}
            </p>
          ) : null}
          <label className="grid gap-1.5">
            <span className={labelClass}>Font</span>
            <Select
              value={layerFontId}
              onValueChange={(next) =>
                patch({ [fields.fontId]: next as CanvasTextFontId })
              }
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-mad-black">
                {fontOptions.map((font) => (
                  <SelectItem key={font.id} value={font.id}>
                    <span style={font.style}>{font.label}</span>
                    {font.id === brandFontId ? (
                      <span className="ml-1.5 text-xs text-neutral-500">· brand</span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="space-y-2">
            <span className={labelClass}>Color</span>
            <div className="flex flex-wrap gap-2.5">
              {swatches.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  title={swatch.label}
                  onClick={() => patch({ [fields.color]: swatch.hex })}
                  className={cn(
                    wizardCompact ? "size-9" : "size-6",
                    "border-2 border-mad-black",
                    layerColor.toLowerCase() === swatch.hex.toLowerCase() &&
                      "ring-2 ring-mad-vermillion ring-offset-1"
                  )}
                  style={{ background: swatch.hex }}
                />
              ))}
              <label
                title="Pick any colour"
                className={cn(
                  "relative flex cursor-pointer items-center gap-1.5 border-2 border-dashed border-mad-black px-2 hover:bg-mad-lime/30",
                  wizardCompact ? "h-9" : "h-6"
                )}
              >
                <span
                  aria-hidden
                  className="size-4 border border-mad-black"
                  style={{ background: layerColor }}
                />
                {wizardCompact ? (
                  <span className="font-typewriter text-[0.55rem] font-bold uppercase">
                    Custom
                  </span>
                ) : null}
                <input
                  type="color"
                  value={layerColor}
                  onChange={(event) =>
                    patch({ [fields.color]: event.target.value.toUpperCase() })
                  }
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  aria-label="Custom text colour"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <span className={labelClass}>Background</span>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => patch({ [fields.bgColor]: "" })}
                className={cn(
                  "flex items-center border-2 border-mad-black px-2 font-typewriter text-[0.55rem] font-bold uppercase",
                  wizardCompact ? "h-9" : "h-6",
                  !layerBg
                    ? "bg-mad-black text-mad-white"
                    : "bg-mad-white hover:bg-mad-lime"
                )}
              >
                None
              </button>
              {swatches.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  title={`${swatch.label} background`}
                  onClick={() => patch({ [fields.bgColor]: swatch.hex })}
                  className={cn(
                    wizardCompact ? "size-9" : "size-6",
                    "border-2 border-mad-black",
                    layerBg.toLowerCase() === swatch.hex.toLowerCase() &&
                      "ring-2 ring-mad-vermillion ring-offset-1"
                  )}
                  style={{ background: swatch.hex }}
                />
              ))}
              <label
                title="Pick any background colour"
                className={cn(
                  "relative flex cursor-pointer items-center gap-1.5 border-2 border-dashed border-mad-black px-2 hover:bg-mad-lime/30",
                  wizardCompact ? "h-9" : "h-6"
                )}
              >
                <span
                  aria-hidden
                  className="size-4 border border-mad-black"
                  style={{ background: layerBg || "transparent" }}
                />
                {wizardCompact ? (
                  <span className="font-typewriter text-[0.55rem] font-bold uppercase">
                    Custom
                  </span>
                ) : null}
                <input
                  type="color"
                  value={layerBg || "#000000"}
                  onChange={(event) =>
                    patch({ [fields.bgColor]: event.target.value.toUpperCase() })
                  }
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  aria-label="Custom text background colour"
                />
              </label>
            </div>
          </div>

          <label className="grid gap-1.5">
            <span className={labelClass}>Shadow</span>
            <Select
              value={value.shadow}
              onValueChange={(next) => patch({ shadow: next as CanvasTextShadow })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-mad-black">
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="soft">Soft blur</SelectItem>
                <SelectItem value="hard">Hard drop</SelectItem>
              </SelectContent>
            </Select>
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

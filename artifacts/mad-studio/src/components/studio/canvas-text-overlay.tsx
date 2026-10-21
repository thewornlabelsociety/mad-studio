"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react"
import {
  ImageIcon,
  Layers,
  Loader2,
  Palette,
  RotateCw,
  SquareDashed,
  Tags,
  Type,
} from "lucide-react"
import { requestCutout } from "@/lib/media/request-cutout"
import { toast } from "sonner"

import {
  CANVAS_BRAND_SWATCHES,
  CANVAS_TEXT_FONTS,
  canvasBackdropOn,
  canvasLogoOn,
  canvasOverlayHasDecor,
  canvasPositionKeys,
  canvasSelectableLabel,
  canvasTextLayers,
  canvasTextOnly,
  CANVAS_TEXT_BG_PAD_X,
  CANVAS_TEXT_BG_PAD_Y,
  CANVAS_TAGS,
  canvasTagItems,
  isCanvasTagId,
  layerStylePatch,
  matchAllTagsPatch,
  readLayerStyle,
  type CanvasLayerStyle,
  type CanvasSelectable,
  type CanvasStyleTarget,
  type CanvasTextLayer,
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

type NumericOverlayKey = {
  [K in keyof CanvasTextOverlayState]: CanvasTextOverlayState[K] extends number
    ? K
    : never
}[keyof CanvasTextOverlayState]

function useCanvasDrag(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlayRef: MutableRefObject<CanvasTextOverlayState>,
  keys: {
    x: NumericOverlayKey
    y: NumericOverlayKey
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

/** Corner handle: text boxes change font size, the logo changes width. */
function useCanvasResize(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlayRef: MutableRefObject<CanvasTextOverlayState>,
  target: CanvasSelectable
) {
  const resizeRef = useRef<{ startY: number; origin: number } | null>(null)

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!interactive || !onChange) return
      const host = mediaFrameElement(event.currentTarget)
      if (!host) return
      const current = overlayRef.current
      resizeRef.current = {
        startY: event.clientY,
        origin:
          target === "logo"
            ? current.logoScale
            : clampCanvasTextFontScale(readLayerStyle(current, target).fontScale),
      }
      attachWindowPointerSession(event, (ev) => {
        if (!resizeRef.current || !onChange) return
        const rect = host.getBoundingClientRect()
        if (rect.height < 1) return
        const dy = (ev.clientY - resizeRef.current.startY) / rect.height
        const now = overlayRef.current
        if (target === "logo") {
          const logoScale = Math.min(60, Math.max(6, resizeRef.current.origin + dy * 60))
          onChange({ ...now, logoScale })
          return
        }
        const fontScale = clampCanvasTextFontScale(resizeRef.current.origin + dy * 2.4)
        onChange({ ...now, ...layerStylePatch(now, target, { fontScale }) })
      }, () => {
        resizeRef.current = null
      })
    },
    [interactive, onChange, overlayRef, target]
  )

  return { onResizePointerDown }
}

function useCanvasTextRotation(
  interactive: boolean,
  onChange: ((next: CanvasTextOverlayState) => void) | undefined,
  overlayRef: MutableRefObject<CanvasTextOverlayState>,
  boxRef: RefObject<HTMLDivElement | null>,
  target: CanvasStyleTarget
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
        originDeg: clampCanvasTextRotationDeg(
          readLayerStyle(overlayRef.current, target).rotationDeg
        ),
      }
      attachWindowPointerSession(event, (ev) => {
        if (!rotateRef.current || !onChange) return
        const { centerX: cx, centerY: cy, startAngle: sa, originDeg } =
          rotateRef.current
        const angle =
          (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI
        const now = overlayRef.current
        onChange({
          ...now,
          ...layerStylePatch(now, target, {
            rotationDeg: clampCanvasTextRotationDeg(originDeg + angle - sa),
          }),
        })
      }, () => {
        rotateRef.current = null
      })
    },
    [interactive, onChange, overlayRef, boxRef, target]
  )

  return { onRotatePointerDown }
}

// Which box on the image is being styled. Shared by the preview (click a box)
// and the editor (its controls follow the selection).
let canvasSelected: CanvasSelectable = "headline"
const selectionListeners = new Set<() => void>()

export function selectCanvasItem(next: CanvasSelectable) {
  if (next === canvasSelected) return
  canvasSelected = next
  selectionListeners.forEach((listener) => listener())
}

export function useCanvasSelection(): CanvasSelectable {
  return useSyncExternalStore(
    (listener) => {
      selectionListeners.add(listener)
      return () => {
        selectionListeners.delete(listener)
      }
    },
    () => canvasSelected,
    () => canvasSelected
  )
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
  label,
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
  label?: string
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
      <div
        ref={textBoxRef}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive && label ? `Select ${label}` : undefined}
        aria-pressed={interactive ? handlesOn : undefined}
        title={interactive && label && !handlesOn ? `Click to style ${label}` : undefined}
        onPointerDown={interactive ? onPointerDown : undefined}
        className={cn(
          "relative inline-block w-max max-w-full overflow-visible align-top",
          handlesOn &&
            "pointer-events-auto cursor-grab border-2 border-dashed border-mad-lime active:cursor-grabbing",
          interactive && !handlesOn && "pointer-events-auto cursor-pointer",
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
                aria-label="Rotate"
                onPointerDown={onRotatePointerDown}
                className="absolute top-0 left-0 z-30 flex size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center border-2 border-mad-black bg-mad-white text-mad-black shadow-keycap-sm touch-none active:cursor-grabbing"
              >
                <RotateCw className="size-2.5" />
              </button>
            ) : null}
            {onResizePointerDown ? (
              <button
                type="button"
                aria-label="Resize"
                onPointerDown={onResizePointerDown}
                className="absolute bottom-0 right-0 z-30 size-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize border-2 border-mad-vermillion bg-mad-lime shadow-keycap-sm touch-none"
              />
            ) : null}
          </>
        ) : null}
        {children}
      </div>
      {interactive && hint && !handlesOn ? (
        <span className="mt-1 block text-center font-typewriter text-[0.68rem] font-bold tracking-wider text-white/80 uppercase drop-shadow-md">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

type BoxProps = {
  overlay: CanvasTextOverlayState
  overlayRef: MutableRefObject<CanvasTextOverlayState>
  interactive: boolean
  onOverlayChange?: (next: CanvasTextOverlayState) => void
  selected: boolean
  frameWidthPx: number
}

/** One text box on the image: click to select it, drag, resize and tilt. */
function CanvasTextBox({
  layer,
  overlay,
  overlayRef,
  interactive,
  onOverlayChange,
  selected,
  frameWidthPx,
}: BoxProps & { layer: CanvasTextLayer }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const keys = canvasPositionKeys(layer.id)
  const drag = useCanvasDrag(interactive, onOverlayChange, overlayRef, {
    x: keys.x as NumericOverlayKey,
    y: keys.y as NumericOverlayKey,
  })
  const resize = useCanvasResize(interactive, onOverlayChange, overlayRef, layer.id)
  const rotate = useCanvasTextRotation(
    interactive,
    onOverlayChange,
    overlayRef,
    boxRef,
    layer.id
  )
  const font =
    CANVAS_TEXT_FONTS.find((row) => row.id === layer.fontId) ??
    CANVAS_TEXT_FONTS[0]
  const fontSizePx =
    frameWidthPx > 0 ? canvasTextFontSizePx(frameWidthPx, layer.fontScale) : null
  const lineHeightPx =
    fontSizePx != null ? canvasTextLineHeightPx(fontSizePx) : null

  return (
    <DraggableDecor
      interactive={interactive}
      x={layer.positionX}
      y={layer.positionY}
      rotationDeg={layer.rotationDeg}
      showDragHandles={selected}
      label={canvasSelectableLabel(layer.id)}
      boxRef={boxRef}
      onPointerDown={(event) => {
        selectCanvasItem(layer.id)
        drag.onPointerDown(event)
      }}
      onResizePointerDown={resize.onResizePointerDown}
      onRotatePointerDown={rotate.onRotatePointerDown}
    >
      <span
        className={cn(
          "block w-max max-w-full whitespace-pre-wrap",
          overlay.textAlign === "left" && "text-left",
          overlay.textAlign === "center" && "text-center",
          overlay.textAlign === "right" && "text-right",
          font.className,
          // No text shadow on a solid block — it just blurs the edges.
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
          lineHeight: lineHeightPx != null ? `${lineHeightPx}px` : undefined,
        }}
      >
        {layer.text}
      </span>
    </DraggableDecor>
  )
}

/** The brand logo on the image: click to select, drag, resize from the corner. */
function CanvasLogoBox({
  overlay,
  overlayRef,
  interactive,
  onOverlayChange,
  selected,
  frameWidthPx,
}: BoxProps) {
  const drag = useCanvasDrag(interactive, onOverlayChange, overlayRef, {
    x: "logoX",
    y: "logoY",
  })
  const resize = useCanvasResize(interactive, onOverlayChange, overlayRef, "logo")
  const widthPx = frameWidthPx > 0 ? (frameWidthPx * overlay.logoScale) / 100 : 48
  return (
    <DraggableDecor
      interactive={interactive}
      x={overlay.logoX}
      y={overlay.logoY}
      showDragHandles={selected}
      label="Logo"
      onPointerDown={(event) => {
        selectCanvasItem("logo")
        drag.onPointerDown(event)
      }}
      onResizePointerDown={resize.onResizePointerDown}
    >
      <img
        src={overlay.logoUrl}
        alt=""
        draggable={false}
        className="block h-auto max-w-none"
        style={{ width: widthPx }}
      />
    </DraggableDecor>
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
  /** Text boxes only — no backdrop or logo (Story card, video). */
  textOnly?: boolean
}

export function CanvasTextOverlayLayer({
  overlay: rawOverlay,
  isVideo = false,
  className,
  interactive = false,
  onOverlayChange,
  renderCanvasText = true,
  textOnly = false,
}: LayerProps) {
  const overlay =
    textOnly || isVideo ? canvasTextOnly(rawOverlay) : rawOverlay
  const frameRef = useRef<HTMLDivElement>(null)
  const overlayRef = useOverlayRef(rawOverlay)
  const [frameWidthPx, setFrameWidthPx] = useState(0)
  const hasDecor = canvasOverlayHasDecor(overlay)
  const selected = useCanvasSelection()

  // The frame only mounts once there's something to show, so measure again
  // when it appears; without a width the text falls back to a fixed size.
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

  if (!hasDecor) return null

  const layers = renderCanvasText ? canvasTextLayers(overlay) : []
  const boxProps = {
    overlay,
    overlayRef,
    interactive,
    onOverlayChange,
    frameWidthPx,
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
      {canvasBackdropOn(overlay) ? (
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden"
          style={{ background: overlay.backdropColor }}
        >
          <img
            src={overlay.cutoutUrl}
            alt=""
            draggable={false}
            className="absolute left-1/2 object-contain"
            style={{
              width: `${overlay.subjectScale * 100}%`,
              height: `${overlay.subjectScale * 100}%`,
              top: `${50 + overlay.subjectOffsetY}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      ) : null}
      {canvasLogoOn(overlay) ? (
        <CanvasLogoBox {...boxProps} selected={selected === "logo"} />
      ) : null}
      {layers.map((layer) => (
        <CanvasTextBox
          key={layer.id}
          layer={layer}
          {...boxProps}
          selected={selected === layer.id}
        />
      ))}
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
          <h3 className="font-typewriter text-[0.75rem] font-bold tracking-widest text-mad-vermillion uppercase">
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
            <p className="font-typewriter text-[0.75rem] font-bold tracking-wider text-mad-black uppercase">
              {feature.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              {feature.detail}
            </p>
            <p className="mt-2 font-typewriter text-[0.7rem] font-bold tracking-wide text-neutral-500 uppercase">
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
  /** Brand logo (Brand Brain); enables the Logo option. */
  logoUrl?: string | null
  /** Photo on this slide — what the Backdrop cutout is made from. */
  sourceUrl?: string | null
  entityId?: string | null
  /**
   * Cut out this slide or every photo in the carousel. When given, the
   * workspace owns cutouts so each slide keeps its own.
   */
  onCutout?: (scope: "slide" | "all", on: boolean) => void | Promise<void>
  cutoutBusy?: boolean
  /** Photos in the post — shows "Cut out all" when there's more than one. */
  photoCount?: number
}

export type CanvasItemFacts = {
  brand?: string | null
  size?: string | null
  price?: string | null
  vibe?: string | null
  /** Wording for the "new" pill, e.g. "New consignment" or "New on the menu". */
  newLabel?: string | null
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
  logoUrl = null,
  sourceUrl = null,
  entityId = null,
  onCutout,
  cutoutBusy: externalCutoutBusy = false,
  photoCount = 1,
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
  const selected = useCanvasSelection()
  const shownTags = canvasTagItems(value)
  // The logo has no text style; text controls then edit the headline.
  const layer: CanvasStyleTarget =
    selected === "logo" ||
    (isCanvasTagId(selected) && !shownTags.some((t) => t.id === selected))
      ? "headline"
      : selected
  type EditorTab = "words" | "tags" | "logo" | "style"
  const [tab, setTab] = useState<EditorTab>("words")
  const selectedFromEditor = useRef(false)
  const firstSelection = useRef(true)
  const setLayer = (target: CanvasSelectable) => {
    selectedFromEditor.current = true
    selectCanvasItem(target)
  }
  // A box clicked on the image (not from these controls) opens its Style tab.
  useEffect(() => {
    if (firstSelection.current) {
      firstSelection.current = false
      return
    }
    if (selectedFromEditor.current) {
      selectedFromEditor.current = false
      return
    }
    if (wizardCompact) setTab(selected === "logo" ? "logo" : "style")
  }, [selected, wizardCompact])
  const show = (which: EditorTab) => !wizardCompact || tab === which
  const style = readLayerStyle(value, layer)
  const layerFontId = style.fontId
  const layerColor = style.color
  const layerBg = style.bgColor
  const layerScale = clampCanvasTextFontScale(style.fontScale)
  const layerRotation = clampCanvasTextRotationDeg(style.rotationDeg)
  function patchStyle(next: Partial<CanvasLayerStyle>) {
    patch(layerStylePatch(value, layer, next))
  }
  const selectableTabs: CanvasSelectable[] = [
    "headline",
    "subhead",
    ...shownTags.map((t) => t.id),
    ...(canvasLogoOn(value) ? (["logo"] as const) : []),
  ]
  const [localCutoutBusy, setCutoutBusy] = useState(false)
  const cutoutBusy = localCutoutBusy || externalCutoutBusy

  async function makeBackdrop(on: boolean) {
    if (onCutout) {
      await onCutout("slide", on)
      return
    }
    if (!on) {
      patch({ backdropEnabled: false })
      return
    }
    // Reuse the cutout if it was made from this same photo.
    if (value.cutoutUrl && value.cutoutSourceUrl === sourceUrl) {
      patch({ backdropEnabled: true, enabled: true })
      return
    }
    if (!sourceUrl || !entityId) {
      toast.error("Add a photo first.")
      return
    }
    setCutoutBusy(true)
    try {
      const cutoutUrl = await requestCutout({ imageUrl: sourceUrl, entityId })
      patch({
        backdropEnabled: true,
        enabled: true,
        cutoutUrl,
        cutoutSourceUrl: sourceUrl,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't cut out the item.")
    } finally {
      setCutoutBusy(false)
    }
  }

  const labelClass = wizardCompact
    ? "font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-black uppercase"
    : "font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase"
  const inputClass = wizardCompact
    ? "h-10 w-full border-2 border-mad-black bg-mad-white px-3 text-sm outline-none placeholder:text-neutral-400 focus:bg-mad-lime/20"
    : "w-full border-2 border-mad-black px-2 py-1 text-base outline-none focus:bg-mad-lime/20 md:text-xs"
  const sectionTitleClass = wizardCompact
    ? "border-b-2 border-mad-black/10 pb-1.5 font-typewriter text-[0.75rem] font-bold tracking-widest text-mad-vermillion uppercase"
    : labelClass
  const btnClass = wizardCompact
    ? "border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase"
    : "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.68rem] font-bold uppercase"
  const selectClass = wizardCompact
    ? "h-10 w-full min-w-0 rounded-none border-2 border-mad-black bg-mad-white text-sm shadow-none"
    : "h-8 w-full min-w-0 rounded-none border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.7rem] uppercase shadow-none"
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
          ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
          : "space-y-2 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm",
        className
      )}
    >
      {wizardCompact ? (
        <div className="sticky top-0 z-10 -mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto bg-mad-white px-1 pb-1.5">
          <div
            role="tablist"
            aria-label="Canvas tools"
            className="flex min-w-0 flex-1 flex-nowrap border-2 border-mad-black"
          >
            {(
              [
                { id: "words", label: "Words", icon: Type },
                { id: "tags", label: "Tags", icon: Tags },
                { id: "logo", label: "Logo", icon: ImageIcon },
                { id: "style", label: "Style", icon: Palette },
              ] as const
            ).map((row) => {
              const Icon = row.icon
              return (
                <button
                  key={row.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === row.id}
                  title={row.id === "logo" ? "Logo & backdrop" : row.label}
                  onClick={() => setTab(row.id)}
                  className={cn(
                    "inline-flex min-w-0 flex-1 items-center justify-center gap-1 border-r-2 border-mad-black px-1.5 py-1.5 font-typewriter text-[0.65rem] font-bold tracking-wider uppercase last:border-r-0 sm:px-2 sm:text-[0.7rem]",
                    tab === row.id
                      ? "bg-mad-black text-mad-white"
                      : "bg-mad-white hover:bg-mad-lime"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{row.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onChange(clearCanvasTextOverlay())}
              className={cn(
                "border-2 border-mad-black px-2 py-1.5 font-typewriter text-[0.65rem] font-bold tracking-wider uppercase hover:bg-mad-vermillion hover:text-mad-white"
              )}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => patch({ enabled: !value.enabled })}
              className={cn(
                "border-2 border-mad-black px-2 py-1.5 font-typewriter text-[0.65rem] font-bold tracking-wider uppercase",
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
            <p className="font-typewriter text-[0.68rem] font-bold tracking-widest text-mad-vermillion uppercase">
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
          <p className="font-typewriter text-[0.68rem] leading-relaxed text-neutral-600 normal-case">
            {tipsCopy}
          </p>
        </>
      )}

      {show("tags") ? (
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
                    if (checked) setLayer(tag.id)
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
                onFocus={() =>
                  setLayer(CANVAS_TAGS.find((t) => t.show === row.show)!.id)
                }
                placeholder={itemFacts?.[row.fact] || row.placeholder}
                aria-label={`${row.label} on image`}
                className={cn(inputClass, "min-w-0 flex-1", wizardCompact && "h-9", !on && "opacity-60")}
              />
            </div>
          )
        })}
      </fieldset>
      ) : null}

      {show("logo") ? (
      <section className={cn("grid gap-4", wizardCompact && "lg:grid-cols-2")}>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-mad-black">
            <input
              type="checkbox"
              checked={value.logoEnabled}
              disabled={!logoUrl}
              onChange={(event) => {
                patch({
                  logoEnabled: event.target.checked,
                  logoUrl: logoUrl ?? "",
                  ...(event.target.checked ? { enabled: true } : null),
                })
                if (event.target.checked) setLayer("logo")
              }}
              className="size-4 cursor-pointer accent-mad-black"
            />
            <ImageIcon className="size-4" aria-hidden />
            Logo
          </label>
          {!logoUrl ? (
            <p className="text-xs text-neutral-500">
              Upload a logo in Brand Brain → Visual presets to use it here.
            </p>
          ) : value.logoEnabled ? (
            <label className="grid gap-1">
              <span className={labelClass}>Logo size ({Math.round(value.logoScale)}%)</span>
              <input
                type="range"
                min={6}
                max={60}
                step={1}
                value={value.logoScale}
                onChange={(event) => patch({ logoScale: Number(event.target.value) })}
                className={rangeClass}
              />
            </label>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-mad-black">
            <input
              type="checkbox"
              checked={value.backdropEnabled}
              disabled={cutoutBusy || isVideo}
              onChange={(event) => void makeBackdrop(event.target.checked)}
              className="size-4 cursor-pointer accent-mad-black"
            />
            {cutoutBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <SquareDashed className="size-4" aria-hidden />
            )}
            {cutoutBusy ? "Cutting out…" : "Cut out item on a colour"}
          </label>
          {onCutout && photoCount > 1 ? (
            <button
              type="button"
              disabled={cutoutBusy}
              onClick={() => void onCutout("all", true)}
              className={cn(btnClass, "inline-flex items-center gap-1.5 bg-mad-white hover:bg-mad-lime disabled:opacity-40")}
            >
              <Layers className="size-3.5" aria-hidden />
              Cut out all {photoCount} photos
            </button>
          ) : null}
          {value.backdropEnabled ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {swatches.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={`${swatch.label} background`}
                    aria-label={`Background ${swatch.label}`}
                    onClick={() => patch({ backdropColor: swatch.hex })}
                    className={cn(
                      "size-8 border-2 border-mad-black",
                      value.backdropColor.toLowerCase() === swatch.hex.toLowerCase() &&
                        "ring-2 ring-mad-vermillion ring-offset-1"
                    )}
                    style={{ background: swatch.hex }}
                  />
                ))}
                <label
                  title="Pick any background colour"
                  className="relative flex h-8 cursor-pointer items-center gap-1.5 border-2 border-dashed border-mad-black px-2 hover:bg-mad-lime/30"
                >
                  <span
                    aria-hidden
                    className="size-4 border border-mad-black"
                    style={{ background: value.backdropColor }}
                  />
                  <span className="font-typewriter text-[0.7rem] font-bold uppercase">
                    Custom
                  </span>
                  <input
                    type="color"
                    value={value.backdropColor}
                    onChange={(event) =>
                      patch({ backdropColor: event.target.value.toUpperCase() })
                    }
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label="Custom backdrop colour"
                  />
                </label>
              </div>
              <label className="grid gap-1">
                <span className={labelClass}>
                  Item size ({Math.round(value.subjectScale * 100)}%)
                </span>
                <input
                  type="range"
                  min={0.3}
                  max={1.8}
                  step={0.05}
                  value={value.subjectScale}
                  onChange={(event) => patch({ subjectScale: Number(event.target.value) })}
                  className={rangeClass}
                />
              </label>
              <label className="grid gap-1">
                <span className={labelClass}>Item position</span>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={value.subjectOffsetY}
                  onChange={(event) => patch({ subjectOffsetY: Number(event.target.value) })}
                  className={rangeClass}
                  aria-label="Move the item up or down"
                />
              </label>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      <div
        className={cn(
          wizardCompact
            ? tab === "style"
              ? "grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-8"
              : "grid min-w-0 gap-4"
            : "space-y-3"
        )}
      >
        {show("words") ? (
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
          {wizardCompact ? (
            <p className="text-xs text-neutral-600">
              Click any text on the photo to style it, drag to move it, and use
              the corner handles to resize or tilt.
            </p>
          ) : null}
        </div>
        ) : null}

        {show("style") ? (
        <div className={cn(wizardCompact ? "space-y-4" : "space-y-3")}>
          {wizardCompact ? (
            <p className={sectionTitleClass}>Position & scale</p>
          ) : null}
          {wizardCompact ? (
            <div
              className="flex flex-wrap gap-1"
              role="tablist"
              aria-label="Which box to style — or click it on the image"
            >
              {selectableTabs.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected === id}
                  onClick={() => setLayer(id)}
                  className={cn(
                    "border-2 border-mad-black px-2 py-1.5 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase",
                    selected === id
                      ? "bg-mad-black text-mad-white"
                      : "bg-mad-white text-mad-black hover:bg-mad-lime"
                  )}
                >
                  {canvasSelectableLabel(id)}
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
              min={0.15}
              max={2.5}
              step={0.05}
              value={layerScale}
              onChange={(event) =>
                patchStyle({
                  fontScale: clampCanvasTextFontScale(Number(event.target.value)),
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
                patchStyle({
                  rotationDeg: clampCanvasTextRotationDeg(Number(event.target.value)),
                })
              }
              className={rangeClass}
            />
          </label>
        </div>
        ) : null}

        {show("style") ? (
        <div className={cn(wizardCompact ? "space-y-4" : "space-y-3")}>
          {wizardCompact ? (
            <p className={sectionTitleClass}>
              Typography · {canvasSelectableLabel(layer)}
            </p>
          ) : null}
          {isCanvasTagId(layer) && shownTags.length > 1 ? (
            <button
              type="button"
              onClick={() => patch(matchAllTagsPatch(value, layer))}
              className={cn(btnClass, "bg-mad-white hover:bg-mad-lime")}
            >
              Use this style on all tags
            </button>
          ) : null}
          <label className="grid gap-1.5">
            <span className={labelClass}>Font</span>
            <Select
              value={layerFontId}
              onValueChange={(next) =>
                patchStyle({ fontId: next as CanvasTextFontId })
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
                  onClick={() => patchStyle({ color: swatch.hex })}
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
                  <span className="font-typewriter text-[0.7rem] font-bold uppercase">
                    Custom
                  </span>
                ) : null}
                <input
                  type="color"
                  value={layerColor}
                  onChange={(event) =>
                    patchStyle({ color: event.target.value.toUpperCase() })
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
                onClick={() => patchStyle({ bgColor: "" })}
                className={cn(
                  "flex items-center border-2 border-mad-black px-2 font-typewriter text-[0.7rem] font-bold uppercase",
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
                  onClick={() => patchStyle({ bgColor: swatch.hex })}
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
                  <span className="font-typewriter text-[0.7rem] font-bold uppercase">
                    Custom
                  </span>
                ) : null}
                <input
                  type="color"
                  value={layerBg || "#000000"}
                  onChange={(event) =>
                    patchStyle({ bgColor: event.target.value.toUpperCase() })
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
        ) : null}

        {wizardCompact && tab === "words" ? (
          <details className="border-2 border-mad-black">
            <summary className="cursor-pointer px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-lime/30">
              Add on your phone: link stickers, polls, music
            </summary>
            <div className="border-t-2 border-mad-black p-3">
              <CanvasNativePostPanel
                destinationUrl={destinationUrl}
                isVideo={isVideo}
                btnClass={btnClass}
              />
            </div>
          </details>
        ) : null}
      </div>
    </section>
  )
}

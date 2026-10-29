"use client"

import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"

/** A hand placement on top of a layer's automatic spot. */
export type LayerAdjust = {
  /** Percent of the parent area. */
  dx: number
  dy: number
  scale: number
  /** Degrees added to the automatic tilt. */
  rotate: number
  /** Stacking order; falls back to the automatic order. */
  z?: number
}

export const NO_ADJUST: LayerAdjust = { dx: 0, dy: 0, scale: 1, rotate: 0 }

export function isAdjusted(adjust: LayerAdjust | undefined): boolean {
  return Boolean(
    adjust &&
      (adjust.dx !== 0 || adjust.dy !== 0 || adjust.scale !== 1 || adjust.rotate !== 0 || adjust.z !== undefined)
  )
}

type Base = { left: number; top: number; width: number; height: number; rotate?: number }

type Gesture =
  | { kind: "move"; x: number; y: number; start: LayerAdjust; area: DOMRect }
  | { kind: "scale"; cx: number; cy: number; distance: number; start: LayerAdjust }
  | { kind: "rotate"; cx: number; cy: number; angle: number; start: LayerAdjust }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * An absolutely placed layer that can be dragged, resized from its corner and
 * tilted from its top handle. Handles and the selection outline are marked
 * data-export-ignore, so they never appear in the baked image.
 */
export function AdjustableLayer({
  base,
  adjust = NO_ADJUST,
  zIndex,
  editable,
  selected,
  label,
  onSelect,
  onChange,
  children,
}: {
  base: Base
  adjust?: LayerAdjust
  zIndex: number
  editable: boolean
  selected: boolean
  label: string
  onSelect?: () => void
  onChange?: (next: LayerAdjust) => void
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)

  function centre(): { cx: number; cy: number } {
    const rect = box.current!.getBoundingClientRect()
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
  }

  function begin(event: PointerEvent<HTMLElement>, kind: Gesture["kind"]) {
    if (!editable || !box.current) return
    event.preventDefault()
    event.stopPropagation()
    onSelect?.()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (kind === "move") {
      const area = box.current.parentElement!.getBoundingClientRect()
      gesture.current = { kind, x: event.clientX, y: event.clientY, start: adjust, area }
    } else {
      const { cx, cy } = centre()
      gesture.current =
        kind === "scale"
          ? { kind, cx, cy, distance: Math.hypot(event.clientX - cx, event.clientY - cy) || 1, start: adjust }
          : { kind, cx, cy, angle: Math.atan2(event.clientY - cy, event.clientX - cx), start: adjust }
    }
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || !onChange) return
    if (current.kind === "move") {
      onChange({
        ...current.start,
        dx: clamp(current.start.dx + ((event.clientX - current.x) / current.area.width) * 100, -base.left - base.width * 0.7, 100 - base.left - base.width * 0.3),
        dy: clamp(current.start.dy + ((event.clientY - current.y) / current.area.height) * 100, -base.top - base.height * 0.7, 100 - base.top - base.height * 0.3),
      })
    } else if (current.kind === "scale") {
      const distance = Math.hypot(event.clientX - current.cx, event.clientY - current.cy)
      onChange({ ...current.start, scale: clamp(current.start.scale * (distance / current.distance), 0.35, 2.6) })
    } else {
      const angle = Math.atan2(event.clientY - current.cy, event.clientX - current.cx)
      const degrees = ((angle - current.angle) * 180) / Math.PI
      onChange({ ...current.start, rotate: Math.round(current.start.rotate + degrees) })
    }
  }

  function end() {
    gesture.current = null
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!editable || !onChange) return
    const step = event.shiftKey ? 5 : 1
    const next = { ...adjust }
    switch (event.key) {
      case "ArrowLeft":
        next.dx -= step
        break
      case "ArrowRight":
        next.dx += step
        break
      case "ArrowUp":
        next.dy -= step
        break
      case "ArrowDown":
        next.dy += step
        break
      case "+":
      case "=":
        next.scale = clamp(next.scale * 1.05, 0.35, 2.6)
        break
      case "-":
        next.scale = clamp(next.scale / 1.05, 0.35, 2.6)
        break
      case "[":
        next.rotate -= 3
        break
      case "]":
        next.rotate += 3
        break
      default:
        return
    }
    event.preventDefault()
    onChange(next)
  }

  // A 28px grab area around a small visible dot, so it is easy to hit on a phone.
  const handle =
    "absolute flex size-7 items-center justify-center after:block after:size-3 after:rounded-full after:border-2 after:border-white after:bg-mad-black after:shadow"

  return (
    <div
      ref={box}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? `${label}: drag to move, arrow keys to nudge` : undefined}
      onPointerDown={(event) => begin(event, "move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      onFocus={() => editable && onSelect?.()}
      style={{
        position: "absolute",
        left: `${base.left + adjust.dx}%`,
        top: `${base.top + adjust.dy}%`,
        width: `${base.width}%`,
        height: `${base.height}%`,
        transform: `rotate(${(base.rotate ?? 0) + adjust.rotate}deg) scale(${adjust.scale})`,
        zIndex: adjust.z ?? zIndex,
        cursor: editable ? "grab" : undefined,
        touchAction: editable ? "none" : undefined,
        outline: "none",
      }}
    >
      {children}
      {editable && selected ? (
        <>
          <div
            data-export-ignore="true"
            className="pointer-events-none absolute inset-0 border border-dashed border-white mix-blend-difference"
          />
          <div
            data-export-ignore="true"
            role="presentation"
            title="Drag to resize"
            onPointerDown={(event) => begin(event, "scale")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className={`${handle} -bottom-3.5 -right-3.5 cursor-nwse-resize`}
            style={{ touchAction: "none" }}
          />
          <div
            data-export-ignore="true"
            role="presentation"
            title="Drag to tilt"
            onPointerDown={(event) => begin(event, "rotate")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className={`${handle} -top-8 left-1/2 -translate-x-1/2 cursor-grab`}
            style={{ touchAction: "none" }}
          />
        </>
      ) : null}
    </div>
  )
}

"use client"

import {
  CANVAS_BRAND_SWATCHES,
  CANVAS_TEXT_FONTS,
  canvasTextAnimationClass,
  canvasTextHighlightClass,
  canvasTextShadowClass,
  type CanvasTextAnimation,
  type CanvasTextFontId,
  type CanvasTextHighlight,
  type CanvasTextOverlayState,
  type CanvasTextShadow,
} from "@/lib/studio/canvas-text-types"
import { cn } from "@/lib/utils"

type LayerProps = {
  overlay: CanvasTextOverlayState
  isVideo?: boolean
  className?: string
}

export function CanvasTextOverlayLayer({
  overlay,
  isVideo = false,
  className,
}: LayerProps) {
  if (!overlay.enabled) return null
  const font =
    CANVAS_TEXT_FONTS.find((row) => row.id === overlay.fontId) ??
    CANVAS_TEXT_FONTS[0]
  const lines = [overlay.headline.trim(), overlay.subhead.trim()].filter(Boolean)
  if (lines.length === 0) return null

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex flex-col justify-end p-[8%]",
        className
      )}
    >
      <div
        className={cn(
          "space-y-1 text-left",
          canvasTextAnimationClass(overlay.animation, isVideo)
        )}
      >
        {lines.map((line, index) => (
          <p
            key={`${line}-${index}`}
            className={cn(
              "text-[clamp(0.85rem,4.5vw,1.35rem)] leading-tight",
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

      <input
        type="text"
        value={value.headline}
        onChange={(event) => patch({ headline: event.target.value, enabled: true })}
        placeholder="Headline on canvas"
        className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
      />
      <input
        type="text"
        value={value.subhead}
        onChange={(event) => patch({ subhead: event.target.value, enabled: true })}
        placeholder="Subhead (optional)"
        className="w-full border-2 border-mad-black px-2 py-1 text-xs outline-none focus:bg-mad-lime/20"
      />

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
            onChange={(event) => patch({ color: event.target.value.toUpperCase() })}
            className="size-6 border-2 border-mad-black bg-transparent"
            aria-label="Custom text color"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
            Shadow
          </span>
          <select
            value={value.shadow}
            onChange={(event) =>
              patch({ shadow: event.target.value as CanvasTextShadow })
            }
            className="h-8 border-2 border-mad-black bg-mad-white px-1 font-typewriter text-[0.5rem] uppercase"
          >
            <option value="none">None</option>
            <option value="soft">Soft blur</option>
            <option value="hard">Hard drop</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
            Highlight pill
          </span>
          <select
            value={value.highlight}
            onChange={(event) =>
              patch({ highlight: event.target.value as CanvasTextHighlight })
            }
            className="h-8 border-2 border-mad-black bg-mad-white px-1 font-typewriter text-[0.5rem] uppercase"
          >
            <option value="none">None</option>
            <option value="black_pill">Translucent black</option>
            <option value="brand_pill">Acid lime</option>
          </select>
        </label>
      </div>

      {isVideo ? (
        <label className="grid gap-1">
          <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
            Video motion
          </span>
          <select
            value={value.animation}
            onChange={(event) =>
              patch({ animation: event.target.value as CanvasTextAnimation })
            }
            className="h-8 w-full border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.5rem] uppercase"
          >
            <option value="none">None</option>
            <option value="fade">Fade</option>
            <option value="pop">Pop-in</option>
            <option value="typewriter">Typewriter</option>
            <option value="slide_up">Slide-up</option>
          </select>
        </label>
      ) : null}
    </section>
  )
}

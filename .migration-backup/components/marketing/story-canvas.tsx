"use client"

import { forwardRef } from "react"

import {
  conciseProductLabel,
  isDarkCanvas,
  STORY_FORMAT_OPTIONS,
  type StoryCanvasModel,
  type StoryFormat,
  type StoryStylePreset,
} from "@/lib/marketing/story-presets"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { cssFontStack } from "@/lib/brands/visual-presets"
import { cn } from "@/lib/utils"

export type CutoutMode = "original" | "css_blend" | "transparent"

type StoryCanvasProps = {
  model: StoryCanvasModel
  stylePreset: StoryStylePreset
  format?: StoryFormat
  /** Live background override from the color picker */
  canvasColor?: string | null
  /** @deprecated prefer cutoutMode */
  floatCutout?: boolean
  cutoutMode?: CutoutMode
  visualPresets?: VisualPresets | null
  className?: string
}

export const StoryCanvas = forwardRef<HTMLDivElement, StoryCanvasProps>(
  function StoryCanvas(
    {
      model,
      stylePreset,
      format = "story_9_16",
      canvasColor = null,
      floatCutout,
      cutoutMode,
      visualPresets = null,
      className,
    },
    ref
  ) {
    const formatMeta =
      STORY_FORMAT_OPTIONS.find((option) => option.id === format) ??
      STORY_FORMAT_OPTIONS[0]

    const resolvedCutout: CutoutMode =
      cutoutMode ??
      (floatCutout === false ? "original" : floatCutout ? "css_blend" : "original")

    const floating =
      resolvedCutout === "css_blend" || resolvedCutout === "transparent"

    return (
      <div
        ref={ref}
        data-story-canvas="true"
        data-style-preset={stylePreset}
        data-format={format}
        data-cutout-mode={resolvedCutout}
        data-floating={floating ? "true" : "false"}
        className={cn(
          "relative w-full overflow-hidden",
          formatMeta.aspectClass,
          className
        )}
        style={{
          width: "100%",
          maxWidth: "100%",
          fontFamily: visualPresets
            ? cssFontStack(visualPresets.font_family)
            : undefined,
          transition: "aspect-ratio 300ms ease",
        }}
      >
        {stylePreset === "moody_noir" ? (
          <MoodyNoir
            model={model}
            cutoutMode={resolvedCutout}
            canvasColor={canvasColor}
            visualPresets={visualPresets}
          />
        ) : null}
        {stylePreset === "magazine_editorial" ? (
          <MagazineEditorial
            model={model}
            cutoutMode={resolvedCutout}
            canvasColor={canvasColor}
            visualPresets={visualPresets}
          />
        ) : null}
      </div>
    )
  }
)

function ProductImage({
  src,
  alt,
  fit = "contain",
  cutoutMode = "original",
  className,
}: {
  src: string | null
  alt: string
  fit?: "contain" | "cover"
  cutoutMode?: CutoutMode
  className?: string
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-transparent text-center text-xs text-neutral-500",
          className
        )}
      >
        Add a product image
      </div>
    )
  }

  if (cutoutMode === "transparent" || cutoutMode === "css_blend") {
    const useBlend = cutoutMode === "css_blend"
    return (
      <div
        className={cn(
          "relative flex size-full items-center justify-center",
          className
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[6%] left-1/2 h-[8%] w-[58%] -translate-x-1/2 rounded-[100%] bg-black/20 blur-md"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={cn(
            "relative z-10 max-h-full max-w-full object-contain",
            useBlend && "mix-blend-multiply dark:mix-blend-screen"
          )}
          style={{
            filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.15))",
            ...(useBlend
              ? { mixBlendMode: "multiply" as const }
              : undefined),
          }}
        />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(
        "size-full",
        fit === "cover" ? "object-cover" : "object-contain",
        className
      )}
    />
  )
}

function StickerPill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[0.65rem] font-bold tracking-wide text-neutral-900 uppercase shadow-sm ring-1 ring-black/10">
      <span aria-hidden>🔗</span>
      {label}
    </div>
  )
}

function resolveTheme(
  stylePreset: StoryStylePreset,
  canvasColor: string | null | undefined,
  visualPresets?: VisualPresets | null
): { canvas: string; text: string; accent: string } {
  const defaults: Record<
    StoryStylePreset,
    { canvas: string; text: string; accent: string }
  > = {
    moody_noir: {
      canvas: "#121211",
      text: "#EDECE8",
      accent: "#0F3B2E",
    },
    magazine_editorial: {
      canvas: "#FFFFFF",
      text: "#1B1714",
      accent: "#1B1714",
    },
  }

  const base = defaults[stylePreset]
  const canvas =
    canvasColor?.trim() ||
    visualPresets?.canvas_color ||
    base.canvas
  const dark = isDarkCanvas(canvas)

  return {
    canvas,
    text: visualPresets?.text_color || (dark ? "#EDECE8" : base.text),
    accent:
      visualPresets?.accent_color ||
      (dark ? base.accent || "#EDECE8" : base.accent),
  }
}

/** Shared caption for Clean style: Brand · Category · Size only. */
function StoryCopyBlock({
  model,
  visualPresets,
  className,
}: {
  model: StoryCanvasModel
  visualPresets?: VisualPresets | null
  className?: string
}) {
  const category =
    model.productLabel ||
    conciseProductLabel(model.headline || model.title, model.designer)
  const sizeLine = model.sizeLabel ? `Size ${model.sizeLabel}` : null

  return (
    <div className={cn("space-y-1 text-center", className)}>
      <p className="text-[0.6rem] font-semibold tracking-[0.2em] uppercase opacity-70">
        {model.designer}
      </p>
      {category ? (
        <h3
          className="text-base leading-snug"
          style={{
            fontFamily: visualPresets
              ? cssFontStack(visualPresets.font_family)
              : "Georgia, 'Fraunces', serif",
          }}
        >
          {category}
        </h3>
      ) : null}
      {sizeLine ? (
        <p className="text-[0.65rem] tracking-[0.14em] uppercase opacity-70">
          {sizeLine}
        </p>
      ) : null}
    </div>
  )
}

function MoodyNoir({
  model,
  cutoutMode,
  canvasColor,
  visualPresets,
}: {
  model: StoryCanvasModel
  cutoutMode: CutoutMode
  canvasColor?: string | null
  visualPresets?: VisualPresets | null
}) {
  const { canvas, text } = resolveTheme(
    "moody_noir",
    canvasColor,
    visualPresets
  )

  return (
    <div
      className="absolute inset-0 flex flex-col px-5 pt-16 pb-20"
      style={{ background: canvas, color: text }}
    >
      <div className="mt-5 min-h-0 flex-1">
        <ProductImage
          src={model.imageUrl}
          alt={model.title}
          fit="contain"
          cutoutMode={cutoutMode}
        />
      </div>

      <StoryCopyBlock
        model={model}
        visualPresets={visualPresets}
        className="mt-3"
      />

      <div className="mt-4 flex justify-center">
        <StickerPill label={model.stickerLabel || "Shop the look"} />
      </div>
    </div>
  )
}

function MagazineEditorial({
  model,
  cutoutMode,
  canvasColor,
  visualPresets,
}: {
  model: StoryCanvasModel
  cutoutMode: CutoutMode
  canvasColor?: string | null
  visualPresets?: VisualPresets | null
}) {
  const { canvas, text, accent } = resolveTheme(
    "magazine_editorial",
    canvasColor,
    visualPresets
  )
  const floating = cutoutMode !== "original"
  const font = visualPresets
    ? cssFontStack(visualPresets.font_family)
    : "Georgia, serif"
  const category =
    model.productLabel ||
    conciseProductLabel(model.headline || model.title, model.designer)

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: canvas, color: text }}
    >
      <div className="grid min-h-0 flex-1 grid-cols-[0.95fr_1.05fr] gap-0">
        <div
          className="flex flex-col justify-between border-r px-4 pt-10 pb-6"
          style={{ borderColor: `${text}26` }}
        >
          <div className="space-y-3">
            <p
              className="text-[0.55rem] font-semibold tracking-[0.2em] uppercase"
              style={{ color: accent }}
            >
              {model.designer}
            </p>
            <h3
              className="text-[1.55rem] leading-[1.05] tracking-tight"
              style={{ fontFamily: font }}
            >
              {category}
            </h3>
          </div>
          {model.sizeLabel ? (
            <p className="text-[0.58rem] tracking-[0.14em] uppercase opacity-70">
              Size {model.sizeLabel}
            </p>
          ) : (
            <span />
          )}
        </div>
        <div
          className={cn("relative", floating ? "p-3" : undefined)}
          style={{ background: floating ? canvas : `${text}14` }}
        >
          <ProductImage
            src={model.imageUrl}
            alt={model.title}
            fit={floating ? "contain" : "cover"}
            cutoutMode={cutoutMode}
          />
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-3 border-t px-4 py-4"
        style={{ borderColor: `${text}26` }}
      >
        <StickerPill label={model.stickerLabel || "Shop the look"} />
      </div>
    </div>
  )
}

"use client"

import { forwardRef } from "react"
import { Link2 } from "lucide-react"

import {
  conciseProductLabel,
  isDarkCanvas,
  STORY_FORMAT_OPTIONS,
  type StoryCanvasModel,
  type StoryFormat,
  type StoryStylePreset,
} from "@/lib/marketing/story-presets"
import type { LogoCorner, VisualPresets } from "@/lib/entities/dna-schema"
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
  /** Stamp the brand's own logo (from Brand Brain) in its chosen corner. */
  showLogo?: boolean
  /** Brand / product lines on the card (off when there's no Library item). */
  showCopy?: boolean
  /** Dashed "add link sticker on phone" guide (never exported). */
  showStickerGuide?: boolean
  /** Item size (1 = fit) and vertical nudge (% of its area) on the Cutout card. */
  subjectScale?: number
  subjectOffsetY?: number
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
      showLogo = false,
      showCopy = true,
      showStickerGuide = true,
      subjectScale = 1,
      subjectOffsetY = 0,
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
            showCopy={showCopy}
            showStickerGuide={showStickerGuide}
            subjectScale={subjectScale}
            subjectOffsetY={subjectOffsetY}
          />
        ) : null}
        {stylePreset === "full_page" ? (
          <FullPage
            model={model}
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
        {showLogo && visualPresets?.logo_url ? (
          <BrandLogo
            src={visualPresets.logo_url}
            corner={visualPresets.logo_corner ?? "top_left"}
          />
        ) : null}
      </div>
    )
  }
)

const LOGO_CORNER_CLASS: Record<LogoCorner, string> = {
  top_left: "left-[5%] top-[4%]",
  top_right: "right-[5%] top-[4%]",
  bottom_left: "bottom-[4%] left-[5%]",
  bottom_right: "bottom-[4%] right-[5%]",
}

/** The brand's own logo, small and clear of Instagram's top bar. */
function BrandLogo({ src, corner }: { src: string; corner: LogoCorner }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      className={cn(
        "pointer-events-none absolute z-20 h-[6%] max-w-[30%] object-contain",
        LOGO_CORNER_CLASS[corner]
      )}
    />
  )
}

/**
 * Where the real link sticker goes once the story is on the phone. Preview
 * only: exports skip anything marked data-export-ignore, so no fake sticker
 * is baked into the image.
 */
function LinkStickerGuide({ label, color }: { label: string; color: string }) {
  return (
    <div
      data-export-ignore="true"
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-[0.6rem] font-semibold tracking-wide uppercase"
      style={{ borderColor: `${color}99`, color }}
    >
      <Link2 className="size-3" aria-hidden />
      {label} · add on phone
    </div>
  )
}

/** Export filter for html-to-image: drop preview-only guides. */
export function storyExportFilter(node: HTMLElement): boolean {
  return node.dataset?.exportIgnore !== "true"
}

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
    full_page: {
      canvas: "#121211",
      text: "#FFFFFF",
      accent: "#FFFFFF",
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

/** Shared caption for the Cutout style: Brand · Category · Size only. */
function StoryCopyBlock({
  model,
  visualPresets,
  accent,
  className,
}: {
  model: StoryCanvasModel
  visualPresets?: VisualPresets | null
  accent: string
  className?: string
}) {
  const category =
    model.productLabel ||
    conciseProductLabel(model.headline || model.title, model.designer)
  const sizeLine = model.sizeLabel ? `Size ${model.sizeLabel}` : null

  return (
    <div className={cn("space-y-1 text-center", className)}>
      <span
        aria-hidden
        className="mx-auto mb-2 block h-px w-8"
        style={{ background: accent }}
      />
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
  showCopy = true,
  showStickerGuide = true,
  subjectScale = 1,
  subjectOffsetY = 0,
}: {
  model: StoryCanvasModel
  cutoutMode: CutoutMode
  canvasColor?: string | null
  visualPresets?: VisualPresets | null
  showCopy?: boolean
  showStickerGuide?: boolean
  subjectScale?: number
  subjectOffsetY?: number
}) {
  const { canvas, text, accent } = resolveTheme(
    "moody_noir",
    canvasColor,
    visualPresets
  )

  return (
    <div
      // Proportional insets keep clear of Instagram's top bar and reply bar
      // at any card size, leaving most of the height for the item.
      className="absolute inset-0 flex flex-col px-[7%] pt-[18%] pb-[16%]"
      style={{ background: canvas, color: text }}
    >
      <div
        className="mt-2 min-h-0 flex-1"
        style={{
          transform: `translateY(${subjectOffsetY}%) scale(${subjectScale})`,
          transformOrigin: "center center",
        }}
      >
        <ProductImage
          src={model.imageUrl}
          alt={model.title}
          fit="contain"
          cutoutMode={cutoutMode}
        />
      </div>

      {showCopy ? (
        <StoryCopyBlock
          model={model}
          visualPresets={visualPresets}
          accent={accent}
          className="mt-3"
        />
      ) : null}

      {showStickerGuide ? (
        <div className="mt-4 flex justify-center">
          <LinkStickerGuide
            label={model.stickerLabel || "Shop the look"}
            color={text}
          />
        </div>
      ) : null}
    </div>
  )
}

/** Photo fills the frame; a band in the brand's colours carries brand · size. */
function FullPage({
  model,
  canvasColor,
  visualPresets,
}: {
  model: StoryCanvasModel
  canvasColor?: string | null
  visualPresets?: VisualPresets | null
}) {
  const { canvas, text, accent } = resolveTheme(
    "full_page",
    canvasColor,
    visualPresets
  )
  const font = visualPresets
    ? cssFontStack(visualPresets.font_family)
    : "Georgia, serif"
  const category =
    model.productLabel ||
    conciseProductLabel(model.headline || model.title, model.designer)

  return (
    <div className="absolute inset-0" style={{ background: canvas }}>
      <ProductImage
        src={model.imageUrl}
        alt={model.title}
        fit="cover"
        className="absolute inset-0"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[45%]"
        style={{
          background: `linear-gradient(to top, ${canvas}F2 0%, ${canvas}B3 45%, transparent 100%)`,
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 px-5 pb-24"
        style={{ color: text }}
      >
        <span
          aria-hidden
          className="mb-1 block h-0.5 w-8"
          style={{ background: accent }}
        />
        <p className="text-[0.6rem] font-semibold tracking-[0.22em] uppercase opacity-80">
          {model.designer}
        </p>
        {category ? (
          <h3
            className="text-xl leading-tight"
            style={{ fontFamily: font }}
          >
            {category}
          </h3>
        ) : null}
        {model.sizeLabel ? (
          <p className="text-[0.65rem] tracking-[0.16em] uppercase opacity-80">
            Size {model.sizeLabel}
          </p>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-[6%] flex justify-center">
        <LinkStickerGuide
          label={model.stickerLabel || "Shop the look"}
          color={text}
        />
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
        <LinkStickerGuide
          label={model.stickerLabel || "Shop the look"}
          color={text}
        />
      </div>
    </div>
  )
}

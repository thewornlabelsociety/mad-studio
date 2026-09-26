"use client"

import { useMemo, useState } from "react"
import { LayoutTemplate, Palette, Sparkles } from "lucide-react"

import { StoryCanvas } from "@/components/marketing/story-canvas"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import {
  CANVAS_BG_PRESETS,
  STORY_FORMAT_OPTIONS,
  STORY_STYLE_OPTIONS,
  type StoryCanvasModel,
  type StoryFormat,
  type StoryStylePreset,
} from "@/lib/marketing/story-presets"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { cn } from "@/lib/utils"

type Props = {
  brandName: string
  headline: string
  industry?: string | null
  visualPresets?: VisualPresets | null
  imageUrl?: string | null
  className?: string
}

export function StoryStylePreview({
  brandName,
  headline,
  industry = null,
  visualPresets = null,
  imageUrl = null,
  className,
}: Props) {
  const [format, setFormat] = useState<StoryFormat>("story_9_16")
  const [stylePreset, setStylePreset] =
    useState<StoryStylePreset>("moody_noir")
  const [canvasColor, setCanvasColor] = useState("#121211")
  const [bgPresetId, setBgPresetId] = useState("moody_obsidian")
  const [floatCutout, setFloatCutout] = useState(true)

  const resolvedPresets = useMemo(
    () =>
      resolveVisualPresets({
        brandName,
        industry,
        brandIdentity: visualPresets
          ? { visual_presets: visualPresets }
          : null,
      }),
    [brandName, industry, visualPresets]
  )

  const model = useMemo<StoryCanvasModel>(
    () => ({
      brandName,
      title: headline || brandName,
      headline: headline || brandName,
      category: "Campaign Drop",
      designer: brandName,
      priceLabel: "—",
      sizeLabel: null,
      colorLabel: null,
      productLabel: headline || brandName,
      vibeTag: "Quiet Luxury",
      provenance: null,
      stickerLabel: "Shop the look",
      footerLine: `IN STORE AT ${brandName.toUpperCase()} // ONLINE`,
      specsLine: `${brandName.toUpperCase()} // ${(headline || "NEW DROP").toUpperCase()}`,
      imageUrl,
    }),
    [brandName, headline, imageUrl]
  )

  return (
    <section
      className={cn(
        "space-y-3 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm",
        className
      )}
    >
      <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
        Story styles
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Select
          value={format}
          onValueChange={(value) => setFormat(value as StoryFormat)}
        >
          <SelectTrigger className="h-8 rounded-none border-2 border-mad-black font-typewriter text-[0.55rem] uppercase">
            <LayoutTemplate className="size-3 opacity-70" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            {STORY_FORMAT_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stylePreset}
          onValueChange={(value) => setStylePreset(value as StoryStylePreset)}
        >
          <SelectTrigger className="h-8 rounded-none border-2 border-mad-black font-typewriter text-[0.55rem] uppercase">
            <Sparkles className="size-3 opacity-70" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            {STORY_STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={bgPresetId}
          onValueChange={(value) => {
            const preset = CANVAS_BG_PRESETS.find((row) => row.id === value)
            if (!preset) return
            setBgPresetId(preset.id)
            setCanvasColor(preset.hex)
          }}
        >
          <SelectTrigger className="h-8 rounded-none border-2 border-mad-black font-typewriter text-[0.55rem] uppercase">
            <Palette className="size-3 opacity-70" />
            <span
              className="size-3 rounded-full border border-black/20"
              style={{ background: canvasColor }}
            />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            {CANVAS_BG_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id} className="text-xs">
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setFloatCutout((value) => !value)}
          className={cn(
            "h-8 border-2 border-mad-black px-2 font-typewriter text-[0.5rem] font-bold uppercase",
            floatCutout ? "bg-mad-lime" : "bg-mad-white hover:bg-mad-lime"
          )}
        >
          {floatCutout ? "Cutout on" : "Cutout off"}
        </button>
      </div>

      <div className="mx-auto w-full max-w-[280px]">
        <StoryCanvas
          model={model}
          stylePreset={stylePreset}
          format={format}
          canvasColor={canvasColor}
          cutoutMode={floatCutout ? "css_blend" : "original"}
          visualPresets={resolvedPresets}
          className="border-2 border-mad-black"
        />
      </div>
    </section>
  )
}

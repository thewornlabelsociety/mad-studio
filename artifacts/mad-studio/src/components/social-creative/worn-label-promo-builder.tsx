"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { WornLabelPromoLayout } from "@/components/social-creative/worn-label-promo-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { exportPromoPng } from "@/lib/social-creative/export-promo-png"
import { defaultWornLabelDotSpecialConfig } from "@/lib/social-creative/resolve-entity-type"
import {
  WORN_LABEL_TAG_COLORS,
  WLS_PROMO_THEME,
} from "@/lib/social-creative/worn-label-promo-theme"
import type {
  AspectRatio,
  DateStyle,
  WornLabelCampaignConfig,
  WornLabelTagColorName,
} from "@/types/social-creative"
import { cn } from "@/lib/utils"

const TAG_COLOR_NAMES = Object.keys(
  WORN_LABEL_TAG_COLORS
) as WornLabelTagColorName[]

const DATE_STYLE_OPTIONS: { id: DateStyle; label: string }[] = [
  { id: "gold_pill", label: "Gold pill" },
  { id: "stamp", label: "Stamp" },
  { id: "ribbon", label: "Ribbon" },
  { id: "minimal", label: "Minimal" },
]

const DATE_PRESETS = [
  { label: "This weekend", value: "⚡ THIS WEEKEND ONLY" },
  { label: "Fri–Sun dates", value: "FRI 16 — SUN 18 OCT" },
] as const

type Props = {
  initialAspectRatio?: AspectRatio
}

export function WornLabelPromoBuilder({
  initialAspectRatio = "9:16",
}: Props) {
  const [config, setConfig] = useState<WornLabelCampaignConfig>(() =>
    defaultWornLabelDotSpecialConfig(initialAspectRatio)
  )
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const previewWrapRef = useRef<HTMLDivElement>(null)

  const previewScale = useMemo(() => {
    if (config.aspectRatio === "1:1") return 0.72
    return 0.42
  }, [config.aspectRatio])

  function patch(partial: Partial<WornLabelCampaignConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }))
  }

  function selectColor(name: WornLabelTagColorName) {
    patch({
      colorName: name,
      colorHex: WORN_LABEL_TAG_COLORS[name].hex,
    })
  }

  function setAspectRatio(aspectRatio: AspectRatio) {
    patch({ aspectRatio })
  }

  const onExport = useCallback(async () => {
    const node = exportRef.current
    if (!node) {
      toast.error("Preview not ready.")
      return
    }
    setExporting(true)
    try {
      await exportPromoPng(node, config)
      toast.success("High-res PNG downloaded (3× retina).")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.")
    } finally {
      setExporting(false)
    }
  }, [config])

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-8">
      <aside className="space-y-5 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
        <div>
          <h2 className="font-typewriter text-xs font-bold tracking-wider uppercase">
            Color dot special
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            Weekly tag promo — obsidian + champagne gold (isolated from listing
            story themes).
          </p>
        </div>

        <div className="space-y-2">
          <Label className="font-typewriter text-[0.65rem] uppercase">
            Aspect ratio
          </Label>
          <div className="flex gap-2">
            {(["1:1", "9:16"] as const).map((ratio) => (
              <Button
                key={ratio}
                type="button"
                variant="outline"
                className={cn(
                  "flex-1 rounded-none border-2 font-typewriter text-xs uppercase",
                  config.aspectRatio === ratio
                    ? "border-mad-black bg-mad-black text-mad-white"
                    : "border-mad-black bg-mad-white"
                )}
                onClick={() => setAspectRatio(ratio)}
              >
                {ratio}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-typewriter text-[0.65rem] uppercase">
            Tag color
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {TAG_COLOR_NAMES.map((name) => {
              const spec = WORN_LABEL_TAG_COLORS[name]
              const active = config.colorName === name
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => selectColor(name)}
                  className={cn(
                    "flex flex-col items-center gap-1 border-2 p-2 transition-colors",
                    active
                      ? "border-mad-black bg-neutral-100"
                      : "border-neutral-200 hover:border-mad-black"
                  )}
                >
                  <span
                    className="size-6 rounded-full"
                    style={{
                      background: spec.hex,
                      boxShadow: spec.borderHighlight
                        ? "inset 0 0 0 2px rgba(255,255,255,0.5)"
                        : undefined,
                    }}
                  />
                  <span className="font-typewriter text-[0.5rem] uppercase">
                    {name.slice(0, 3)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="discount" className="font-typewriter text-[0.65rem] uppercase">
            Discount
          </Label>
          <Input
            id="discount"
            value={config.discountText}
            onChange={(e) => patch({ discountText: e.target.value })}
            className="rounded-none border-2 border-mad-black"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="headline" className="font-typewriter text-[0.65rem] uppercase">
            Headline
          </Label>
          <Input
            id="headline"
            value={config.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            className="rounded-none border-2 border-mad-black"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateLabel" className="font-typewriter text-[0.65rem] uppercase">
            Date / validity
          </Label>
          <Input
            id="dateLabel"
            value={config.dateLabel}
            onChange={(e) => patch({ dateLabel: e.target.value })}
            className="rounded-none border-2 border-mad-black"
          />
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-none border border-mad-black font-typewriter text-[0.55rem] uppercase"
                onClick={() => patch({ dateLabel: preset.value })}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-typewriter text-[0.65rem] uppercase">
            Date style
          </Label>
          <Select
            value={config.dateStyle}
            onValueChange={(value) => patch({ dateStyle: value as DateStyle })}
          >
            <SelectTrigger className="rounded-none border-2 border-mad-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_STYLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          className="w-full rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-xs uppercase hover:bg-neutral-800"
          disabled={exporting}
          onClick={() => void onExport()}
        >
          {exporting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Download high-res PNG
        </Button>
        <p className="text-center text-[0.65rem] text-neutral-500">
          1080×{config.aspectRatio === "1:1" ? "1080" : "1920"} @ 3× capture
        </p>
      </aside>

      <div
        ref={previewWrapRef}
        className="flex min-h-[420px] items-start justify-center overflow-auto border-2 border-mad-black p-4"
        style={{ background: WLS_PROMO_THEME.bg }}
      >
        <div
          style={{
            transform: `scale(${previewScale})`,
            transformOrigin: "top center",
          }}
        >
          <WornLabelPromoLayout ref={exportRef} config={config} />
        </div>
      </div>
    </div>
  )
}

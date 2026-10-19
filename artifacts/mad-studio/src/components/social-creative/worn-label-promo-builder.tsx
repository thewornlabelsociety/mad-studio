"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, FileText, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { PromoPlatformPreview } from "@/components/social-creative/promo-platform-preview"
import { WornLabelPromoLayout } from "@/components/social-creative/worn-label-promo-layout"
import { WornLabelPromoPrintLayout } from "@/components/social-creative/worn-label-promo-print-layout"
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
import { exportPromoPdf } from "@/lib/social-creative/export-promo-pdf"
import { exportPromoPng } from "@/lib/social-creative/export-promo-png"
import {
  PROMO_PREVIEW_CHANNELS,
  promoChannelMeta,
  type PromoPreviewChannel,
} from "@/lib/social-creative/promo-preview-channels"
import { defaultWornLabelDotSpecialConfig } from "@/lib/social-creative/resolve-entity-type"
import { WORN_LABEL_TAG_COLORS } from "@/lib/social-creative/worn-label-promo-theme"
import type {
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
  { label: "This week only", value: "THIS WEEK ONLY" },
  { label: "Today only", value: "TODAY ONLY" },
] as const

type PreviewSurface = "social" | "print"

type Props = {
  initialAspectRatio?: import("@/types/social-creative").AspectRatio
}

export function WornLabelPromoBuilder({
  initialAspectRatio = "9:16",
}: Props) {
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>("social")
  const [channel, setChannel] = useState<PromoPreviewChannel>("instagram_story")
  const [config, setConfig] = useState<WornLabelCampaignConfig>(() =>
    defaultWornLabelDotSpecialConfig(initialAspectRatio)
  )
  const [exporting, setExporting] = useState(false)
  const socialExportRef = useRef<HTMLDivElement>(null)
  const printExportRef = useRef<HTMLDivElement>(null)

  const channelMeta = promoChannelMeta(channel)

  useEffect(() => {
    setConfig((prev) => {
      if (prev.aspectRatio === channelMeta.aspectRatio) return prev
      return { ...prev, aspectRatio: channelMeta.aspectRatio }
    })
  }, [channelMeta.aspectRatio])

  function patch(partial: Partial<WornLabelCampaignConfig>) {
    setConfig((prev) => ({ ...prev, ...partial }))
  }

  function selectColor(name: WornLabelTagColorName) {
    patch({
      colorName: name,
      colorHex: WORN_LABEL_TAG_COLORS[name].hex,
    })
  }

  const onExportSocial = useCallback(async () => {
    const node = socialExportRef.current
    if (!node) {
      toast.error("Preview not ready.")
      return
    }
    setExporting(true)
    try {
      await exportPromoPng(node, config)
      toast.success(`${channelMeta.label} PNG downloaded (3× retina).`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.")
    } finally {
      setExporting(false)
    }
  }, [config, channelMeta.label])

  const onExportPrint = useCallback(async () => {
    const node = printExportRef.current
    if (!node) {
      toast.error("Print layout not ready.")
      return
    }
    setExporting(true)
    try {
      await exportPromoPdf(node, config)
      toast.success("A4 print PDF downloaded.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF export failed.")
    } finally {
      setExporting(false)
    }
  }, [config])

  const printPreviewScale = 0.52

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-8">
      <aside className="space-y-5 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
        <div>
          <h2 className="font-typewriter text-xs font-bold tracking-wider uppercase">
            Weekly color dot special
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            Preview social channels, then switch to A4 print for boutique /
            office posting.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="font-typewriter text-[0.65rem] uppercase">
            Preview mode
          </Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "flex-1 gap-1.5 rounded-none border-2 font-typewriter text-[0.6rem] uppercase",
                previewSurface === "social"
                  ? "border-mad-black bg-mad-black text-mad-white"
                  : "border-mad-black bg-mad-white"
              )}
              onClick={() => setPreviewSurface("social")}
            >
              <Smartphone className="size-3.5" />
              Social
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "flex-1 gap-1.5 rounded-none border-2 font-typewriter text-[0.6rem] uppercase",
                previewSurface === "print"
                  ? "border-mad-black bg-mad-black text-mad-white"
                  : "border-mad-black bg-mad-white"
              )}
              onClick={() => setPreviewSurface("print")}
            >
              <FileText className="size-3.5" />
              A4 print
            </Button>
          </div>
        </div>

        {previewSurface === "social" ? (
          <div className="space-y-2">
            <Label className="font-typewriter text-[0.65rem] uppercase">
              Channel
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {PROMO_PREVIEW_CHANNELS.map((row) => (
                <Button
                  key={row.id}
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-auto min-h-9 rounded-none border-2 px-2 py-2 font-typewriter text-[0.55rem] leading-tight uppercase",
                    channel === row.id
                      ? "border-mad-black bg-mad-lime text-mad-black"
                      : "border-neutral-300 bg-mad-white"
                  )}
                  onClick={() => setChannel(row.id)}
                >
                  {row.shortLabel}
                  <span className="mt-0.5 block text-[0.5rem] font-normal normal-case text-neutral-600">
                    {row.aspectRatio}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-[0.6rem] text-neutral-500">{channelMeta.captionHint}</p>
          </div>
        ) : (
          <p className="rounded border border-neutral-200 bg-neutral-50 p-2 text-[0.65rem] leading-relaxed text-neutral-600">
            A4 portrait · white flyer · large color dot and bold black type for
            boutique window / counter posting (not the dark social graphic).
          </p>
        )}

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

        {previewSurface === "social" ? (
          <Button
            type="button"
            className="w-full rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-xs uppercase hover:bg-neutral-800"
            disabled={exporting}
            onClick={() => void onExportSocial()}
          >
            {exporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Download {channelMeta.shortLabel} PNG
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-xs uppercase hover:bg-neutral-800"
            disabled={exporting}
            onClick={() => void onExportPrint()}
          >
            {exporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileText className="mr-2 size-4" />
            )}
            Download A4 PDF
          </Button>
        )}

        <p className="text-center text-[0.65rem] text-neutral-500">
          {previewSurface === "social"
            ? `1080×${config.aspectRatio === "1:1" ? "1080" : "1920"} social asset`
            : "210×297mm print sheet · white background"}
        </p>
      </aside>

      <div
        className={cn(
          "flex min-h-[480px] items-start justify-center overflow-auto border-2 border-mad-black p-6",
          previewSurface === "print" ? "bg-neutral-100" : "bg-neutral-200"
        )}
      >
        {previewSurface === "social" ? (
          <PromoPlatformPreview channel={channel} config={config}>
            <WornLabelPromoLayout config={config} animate />
          </PromoPlatformPreview>
        ) : (
          <div
            className="shadow-keycap ring-1 ring-black/10"
            style={{
              transform: `scale(${printPreviewScale})`,
              transformOrigin: "top center",
            }}
          >
            <WornLabelPromoPrintLayout config={config} />
          </div>
        )}
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed -left-[10000px] top-0 opacity-0"
      >
        <WornLabelPromoLayout
          ref={socialExportRef}
          config={config}
          animate={false}
        />
        <WornLabelPromoPrintLayout ref={printExportRef} config={config} />
      </div>
    </div>
  )
}

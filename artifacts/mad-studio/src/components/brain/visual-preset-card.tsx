"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { saveVisualPresets } from "@/lib/actions"
import { readApiJson } from "@/lib/api-json"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StoryKitField } from "@/components/brain/story-kit-field"
import { resolveStoryKit } from "@/lib/brands/story-kit"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import type { LogoCorner, VisualPresets } from "@/lib/entities/dna-schema"
import { CANVAS_TEXT_FONTS } from "@/lib/studio/canvas-text-types"
import { cn } from "@/lib/utils"

type Props = {
  entity: StudioEntityDna
  className?: string
}


export function VisualPresetCard({ entity, className }: Props) {
  const [pending, startTransition] = useTransition()
  const resolved = resolveVisualPresets({
    brandName: entity.name,
    industry: entity.industry,
    brandIdentity: entity.brand_identity,
  })
  const [draft, setDraft] = useState<VisualPresets>(resolved)
  const isWornLabel = isWornLabelFashionEntity({
    name: entity.name,
    industry: entity.industry,
  })
  const storyKit = resolveStoryKit({ presets: draft, isWornLabel })
  const startingKit = resolveStoryKit({
    presets: { ...draft, story_kit: undefined },
    isWornLabel,
  })
  const rowSwatches = [
    ...new Set(
      [...(draft.palette ?? []), "#000000", "#FFFFFF"].map((hex) =>
        hex.toUpperCase()
      )
    ),
  ]

  useEffect(() => {
    setDraft(
      resolveVisualPresets({
        brandName: entity.name,
        industry: entity.industry,
        brandIdentity: entity.brand_identity,
      })
    )
  }, [entity])

  function onSave() {
    startTransition(async () => {
      const result = await saveVisualPresets({
        entityId: entity.id,
        visualPresets: draft,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Visual presets saved — Story & Carousel will use these.")
    })
  }

  return (
    <section
      className={cn(
        "space-y-4 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Visual presets
          </p>
          <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
            Colors & type from brand DNA
          </h2>
          <p className="mt-1 max-w-xl text-xs text-neutral-600">
            Tap a swatch or pick a custom color — Story and Carousel bind to
            these tokens.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={pending}
          className="rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.72rem] uppercase text-mad-white shadow-keycap-sm hover:bg-mad-vermillion"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <Save className="size-3.5" data-icon="inline-start" />
          )}
          Save presets
        </Button>
      </div>

      <div
        className="grid gap-3 border-2 border-mad-black p-4 sm:grid-cols-[120px_1fr]"
        style={{
          background: draft.canvas_color,
          color: draft.text_color,
          fontFamily:
            draft.font_family === "serif"
              ? "Georgia, Times, serif"
              : draft.font_family === "mono"
                ? "ui-monospace, monospace"
                : "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          className="flex aspect-square items-end justify-start border-2 p-2 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase"
          style={{
            borderColor: draft.text_color,
            background: draft.accent_color,
            color: draft.canvas_color,
          }}
        >
          Accent
        </div>
        <div className="space-y-1 self-center">
          <p className="font-typewriter text-[0.7rem] tracking-[0.18em] uppercase opacity-70">
            Live preview
          </p>
          <p className="text-lg font-semibold leading-tight">{entity.name}</p>
          <p className="text-sm opacity-80">
            {entity.brand_identity.tagline ||
              entity.brand_identity.core_mission ||
              "Brand visual tokens"}
          </p>
          {entity.brand_identity.visual_vibe ? (
            <p className="mt-2 text-xs leading-relaxed opacity-90">
              {entity.brand_identity.visual_vibe}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ColorSwatchField
          swatches={rowSwatches}
          label="Canvas"
          value={draft.canvas_color}
          onChange={(value) =>
            setDraft((current) => ({ ...current, canvas_color: value }))
          }
        />
        <ColorSwatchField
          swatches={rowSwatches}
          label="Accent"
          value={draft.accent_color}
          onChange={(value) =>
            setDraft((current) => ({ ...current, accent_color: value }))
          }
        />
        <ColorSwatchField
          swatches={rowSwatches}
          label="Text"
          value={draft.text_color}
          onChange={(value) =>
            setDraft((current) => ({ ...current, text_color: value }))
          }
        />
        <div className="grid gap-1.5">
          <Label
            htmlFor="font_family"
            className="font-typewriter text-[0.72rem] font-bold tracking-widest uppercase"
          >
            Font family
          </Label>
          <Select
            value={
              ["serif", "sans", "mono"].includes(
                String(draft.font_family).toLowerCase()
              )
                ? String(draft.font_family).toLowerCase()
                : "sans"
            }
            onValueChange={(value) =>
              setDraft((current) => ({ ...current, font_family: value }))
            }
          >
            <SelectTrigger
              id="font_family"
              className="rounded-none border-2 border-mad-black"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2 border-mad-black">
              <SelectItem value="serif">Serif</SelectItem>
              <SelectItem value="sans">Sans</SelectItem>
              <SelectItem value="mono">Mono</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <BrandPaletteField
        palette={draft.palette ?? []}
        onChange={(palette) => setDraft((current) => ({ ...current, palette }))}
      />

      <HeadlineFontField
        value={draft.heading_font_id ?? CANVAS_TEXT_FONTS[0].id}
        sample={entity.name}
        onChange={(heading_font_id) =>
          setDraft((current) => ({ ...current, heading_font_id }))
        }
      />

      <LogoField
        entityId={entity.id}
        logoUrl={draft.logo_url ?? null}
        corner={draft.logo_corner ?? "top_left"}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />

      <StoryKitField
        kit={storyKit}
        defaults={startingKit}
        onChange={(story_kit) =>
          setDraft((current) => ({ ...current, story_kit }))
        }
      />
    </section>
  )
}

/** This brand's colours — offered for on-image text and story backgrounds. */
function BrandPaletteField({
  palette,
  onChange,
}: {
  palette: string[]
  onChange: (palette: string[]) => void
}) {
  const [adding, setAdding] = useState("#C5A46D")

  function add(hex: string) {
    const value = hex.toUpperCase()
    if (palette.some((row) => row.toUpperCase() === value)) return
    onChange([...palette, value].slice(0, 12))
  }

  return (
    <div className="grid gap-2 border-t border-neutral-200 pt-4">
      <div>
        <Label className="font-typewriter text-[0.72rem] font-bold tracking-widest uppercase">
          Brand palette
        </Label>
        <p className="mt-1 text-xs text-neutral-600">
          The colours Studio offers for on-image text and story backgrounds.
          Click a colour to remove it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {palette.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(palette.filter((row) => row !== hex))}
            className="group relative size-9 border-2 border-mad-black"
            style={{ background: hex }}
            title={`${hex} — click to remove`}
            aria-label={`Remove ${hex} from the brand palette`}
          >
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-xs font-bold text-white group-hover:flex">
              ×
            </span>
          </button>
        ))}
        <div className="flex h-9 items-stretch border-2 border-dashed border-mad-black">
          <label className="relative flex w-9 cursor-pointer items-center justify-center hover:bg-mad-lime/30">
            <span
              className="size-5 border border-mad-black"
              style={{ background: adding }}
              aria-hidden
            />
            <input
              type="color"
              value={adding}
              onChange={(event) => setAdding(event.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="Pick a colour to add to the brand palette"
            />
          </label>
          <button
            type="button"
            onClick={() => add(adding)}
            className="border-l-2 border-dashed border-mad-black px-2 font-typewriter text-[0.72rem] font-bold uppercase hover:bg-mad-lime/30"
          >
            Add {adding.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Default font for on-image headlines in Canvas. */
function HeadlineFontField({
  value,
  sample,
  onChange,
}: {
  value: string
  sample: string
  onChange: (fontId: string) => void
}) {
  const active =
    CANVAS_TEXT_FONTS.find((font) => font.id === value) ?? CANVAS_TEXT_FONTS[0]
  return (
    <div className="grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center">
      <div className="grid gap-1.5">
        <Label className="font-typewriter text-[0.72rem] font-bold tracking-widest uppercase">
          Headline font
        </Label>
        <Select value={active.id} onValueChange={onChange}>
          <SelectTrigger className="rounded-none border-2 border-mad-black">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            {CANVAS_TEXT_FONTS.map((font) => (
              <SelectItem key={font.id} value={font.id}>
                <span style={font.style}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p
        className={cn("truncate text-2xl text-mad-black", active.className)}
        style={active.style}
      >
        {sample}
      </p>
    </div>
  )
}

const LOGO_CORNERS: Array<{ id: LogoCorner; label: string }> = [
  { id: "top_left", label: "Top left" },
  { id: "top_right", label: "Top right" },
  { id: "bottom_left", label: "Bottom left" },
  { id: "bottom_right", label: "Bottom right" },
]

/** Optional: this brand's logo, offered as an "Add logo" switch on stories. */
function LogoField({
  entityId,
  logoUrl,
  corner,
  onChange,
}: {
  entityId: string
  logoUrl: string | null
  corner: LogoCorner
  onChange: (patch: Partial<VisualPresets>) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function upload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      form.set("entityId", entityId)
      const response = await fetch("/api/media/upload-logo", {
        method: "POST",
        body: form,
      })
      const payload = await readApiJson<{
        logoUrl?: string
        error?: string
      }>(response)
      if (!response.ok || !payload.logoUrl) {
        throw new Error(payload.error || "Logo upload failed.")
      }
      onChange({ logo_url: payload.logoUrl })
      toast.success("Logo uploaded — press Save presets to keep it.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo upload failed.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-[120px_1fr]">
      <div className="flex aspect-square items-center justify-center border-2 border-dashed border-neutral-300 bg-neutral-50 p-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Brand logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-center text-[0.75rem] text-neutral-400">
            No logo
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <Label className="font-typewriter text-[0.72rem] font-bold tracking-widest uppercase">
            Logo (optional)
          </Label>
          <p className="mt-1 text-xs text-neutral-600">
            Stories can add it in a corner when you switch on &quot;Add
            logo&quot;. A transparent PNG works best.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 border-2 border-mad-black bg-mad-white px-3 py-1.5 font-typewriter text-[0.72rem] font-bold uppercase hover:bg-mad-lime/50">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {logoUrl ? "Replace" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
                event.target.value = ""
              }}
            />
          </label>
          {logoUrl ? (
            <button
              type="button"
              onClick={() => onChange({ logo_url: undefined })}
              className="font-typewriter text-[0.72rem] font-bold uppercase text-neutral-500 underline hover:text-mad-black"
            >
              Remove
            </button>
          ) : null}
        </div>
        {logoUrl ? (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Logo corner">
            {LOGO_CORNERS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={corner === option.id}
                onClick={() => onChange({ logo_corner: option.id })}
                className={cn(
                  "border-2 px-2 py-1 font-typewriter text-[0.7rem] font-bold uppercase",
                  corner === option.id
                    ? "border-mad-black bg-mad-black text-mad-white"
                    : "border-neutral-300 text-neutral-600 hover:border-mad-black"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ColorSwatchField({
  swatches,
  label,
  value,
  onChange,
}: {
  swatches: string[]
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000"

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-typewriter text-[0.72rem] font-bold tracking-widest uppercase">
          {label}
        </Label>
        <span className="font-mono text-[0.75rem] uppercase text-neutral-500">
          {normalized}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((swatch) => {
          const active = swatch.toUpperCase() === normalized.toUpperCase()
          return (
            <button
              key={`${label}-${swatch}`}
              type="button"
              onClick={() => onChange(swatch.toUpperCase())}
              className={cn(
                "size-7 border-2 border-mad-black transition",
                active
                  ? "ring-2 ring-mad-vermillion ring-offset-1"
                  : "hover:bg-mad-lime/30"
              )}
              style={{ background: swatch }}
              aria-label={`${label} ${swatch}`}
              title={swatch}
            />
          )
        })}
        <label className="relative size-7 cursor-pointer overflow-hidden border-2 border-dashed border-mad-black">
          <span className="sr-only">Custom {label} color</span>
          <input
            type="color"
            value={normalized}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span
            className="block size-full"
            style={{ background: normalized }}
            aria-hidden
          />
        </label>
      </div>
    </div>
  )
}

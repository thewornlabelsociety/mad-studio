"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { saveVisualPresets } from "@/app/actions/brain"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { cn } from "@/lib/utils"

type Props = {
  entity: StudioEntityDna
  className?: string
}

/** MAD studio palette first, then brand-friendly neutrals. */
const SWATCH_PRESETS = [
  "#000000",
  "#FFFFFF",
  "#CCFF00",
  "#FF3B00",
  "#121211",
  "#0F3B2E",
  "#EDECE8",
  "#FBF8F3",
  "#E05A36",
  "#241C18",
]

export function VisualPresetCard({ entity, className }: Props) {
  const [pending, startTransition] = useTransition()
  const resolved = resolveVisualPresets({
    brandName: entity.name,
    industry: entity.industry,
    brandIdentity: entity.brand_identity,
  })
  const [draft, setDraft] = useState<VisualPresets>(resolved)

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
          <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
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
          className="rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] uppercase text-mad-white shadow-keycap-sm hover:bg-mad-vermillion"
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
          className="flex aspect-square items-end justify-start border-2 p-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase"
          style={{
            borderColor: draft.text_color,
            background: draft.accent_color,
            color: draft.canvas_color,
          }}
        >
          Accent
        </div>
        <div className="space-y-1 self-center">
          <p className="font-typewriter text-[0.55rem] tracking-[0.18em] uppercase opacity-70">
            Live preview
          </p>
          <p className="text-lg font-semibold leading-tight">{entity.name}</p>
          <p className="text-sm opacity-80">
            {entity.brand_identity.tagline ||
              entity.brand_identity.core_mission ||
              "Brand visual tokens"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ColorSwatchField
          label="Canvas"
          value={draft.canvas_color}
          onChange={(value) =>
            setDraft((current) => ({ ...current, canvas_color: value }))
          }
        />
        <ColorSwatchField
          label="Accent"
          value={draft.accent_color}
          onChange={(value) =>
            setDraft((current) => ({ ...current, accent_color: value }))
          }
        />
        <ColorSwatchField
          label="Text"
          value={draft.text_color}
          onChange={(value) =>
            setDraft((current) => ({ ...current, text_color: value }))
          }
        />
        <div className="grid gap-1.5">
          <Label
            htmlFor="font_family"
            className="font-typewriter text-[0.6rem] font-bold tracking-widest uppercase"
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
    </section>
  )
}

function ColorSwatchField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000"

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-typewriter text-[0.6rem] font-bold tracking-widest uppercase">
          {label}
        </Label>
        <span className="font-mono text-[0.65rem] uppercase text-neutral-500">
          {normalized}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCH_PRESETS.map((swatch) => {
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

"use client"

import { useState, useTransition } from "react"
import { Loader2, RefreshCw, Sparkles, Type } from "lucide-react"
import { toast } from "sonner"

import {
  reseedDropIntakeCaption,
  updateIntakeCaptionDefault,
} from "@/lib/actions"
import {
  defaultIntakeCaptionForItem,
  INTAKE_CAPTION_DEFAULT_LABELS,
  type IntakeCaptionDefaultSource,
} from "@/lib/inventory/intake-caption-default"
import type { MarketingEntity } from "@/lib/inventory/types"
import { generateIntakeCaptionForItem } from "@/lib/today/generate-intake-caption"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  defaultSource: IntakeCaptionDefaultSource
  onDefaultSourceChange: (source: IntakeCaptionDefaultSource) => void
  items: MarketingEntity[]
  onItemPatched?: (itemId: string, patch: Partial<MarketingEntity>) => void
}

export function IntakeCaptionMerchandiserTools({
  entityId,
  defaultSource,
  onDefaultSourceChange,
  items,
  onItemPatched,
}: Props) {
  const [savingDefault, startSaveDefault] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function setDefault(source: IntakeCaptionDefaultSource) {
    startSaveDefault(async () => {
      const result = await updateIntakeCaptionDefault({ entityId, source })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onDefaultSourceChange(source)
      toast.success(
        `New pulls will use ${INTAKE_CAPTION_DEFAULT_LABELS[source].toLowerCase()} as the starting caption.`
      )
    })
  }

  async function runGenerate(
    item: MarketingEntity,
    regenerate: boolean
  ) {
    setBusyId(item.id)
    try {
      const copy = await generateIntakeCaptionForItem({
        entityId,
        item,
        defaultSource,
        regenerate,
      })
      onItemPatched?.(item.id, {
        copy_draft: {
          ...item.copy_draft,
          headline: copy.headline,
          caption: copy.caption,
        },
      })
      toast.success(regenerate ? "New caption suggested." : "Caption generated from photo + listing.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not generate caption."
      )
    } finally {
      setBusyId(null)
    }
  }

  async function applyDefault(item: MarketingEntity) {
    setBusyId(item.id)
    try {
      const result = await reseedDropIntakeCaption({
        entityId,
        itemId: item.id,
      })
      if (!result.ok) {
        throw new Error(result.error)
      }
      onItemPatched?.(item.id, {
        copy_draft: {
          ...item.copy_draft,
          headline: result.data.headline,
          caption: result.data.caption,
        },
      })
      toast.success("Reset to default caption.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not apply default."
      )
    } finally {
      setBusyId(null)
    }
  }

  const sample = items.slice(0, 5)

  return (
    <div className="space-y-3 border-t border-neutral-200 pt-3">
      <div>
        <p className="font-typewriter text-[0.68rem] font-bold tracking-widest text-neutral-500 uppercase">
          Default caption on pull
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(
            Object.keys(INTAKE_CAPTION_DEFAULT_LABELS) as IntakeCaptionDefaultSource[]
          ).map((key) => (
            <button
              key={key}
              type="button"
              disabled={savingDefault}
              onClick={() => setDefault(key)}
              className={cn(
                "border-2 border-mad-black px-2 py-1 font-typewriter text-[0.65rem] font-bold tracking-wide uppercase",
                defaultSource === key
                  ? "bg-mad-black text-mad-white"
                  : "bg-white hover:bg-mad-lime/40"
              )}
            >
              {INTAKE_CAPTION_DEFAULT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {sample.length > 0 ? (
        <ul className="space-y-2">
          {sample.map((item) => {
            const preview = defaultIntakeCaptionForItem(item, defaultSource)
            const busy = busyId === item.id
            return (
              <li
                key={item.id}
                className="border border-neutral-200 bg-neutral-50/80 p-2"
              >
                <p className="truncate text-xs font-semibold text-mad-black">
                  {item.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug text-neutral-600">
                  {item.copy_draft?.caption?.trim() || preview.caption}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void applyDefault(item)}
                    className="inline-flex items-center gap-1 border border-mad-black bg-white px-1.5 py-0.5 font-typewriter text-[0.62rem] font-bold uppercase hover:bg-mad-lime/30 disabled:opacity-50"
                  >
                    <Type className="size-3" aria-hidden />
                    Use default
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runGenerate(item, false)}
                    className="inline-flex items-center gap-1 border border-mad-black bg-mad-black px-1.5 py-0.5 font-typewriter text-[0.62rem] font-bold text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="size-3" aria-hidden />
                    )}
                    Generate
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runGenerate(item, true)}
                    className="inline-flex items-center gap-1 border border-mad-black bg-white px-1.5 py-0.5 font-typewriter text-[0.62rem] font-bold uppercase hover:bg-mad-lime/30 disabled:opacity-50"
                  >
                    <RefreshCw className="size-3" aria-hidden />
                    Suggest new
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { saveAudienceSegments } from "@/lib/actions"
import {
  enrichSegmentForSave,
  resolveAudienceSegmentUi,
} from "@/lib/brain/audience-segment-display"
import { audienceSegmentPresetsForEntity } from "@/lib/brain/audience-segment-presets"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import type { AudienceSegment } from "@/lib/entities/dna-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const MAX_AUDIENCE_SEGMENTS = 5

function emptySegment(): AudienceSegment {
  return {
    name: "",
    role: "",
    pain: "",
    desire: "",
    trigger: "",
    winning_rebuttal: "",
  }
}

function segmentsFromEntity(entity: StudioEntityDna): AudienceSegment[] {
  return entity.audience_segments.length > 0
    ? entity.audience_segments
    : [emptySegment()]
}

type Props = {
  entity: StudioEntityDna
}

export function AudienceSegmentsEditor({ entity }: Props) {
  const [pending, startTransition] = useTransition()
  const [segments, setSegments] = useState<AudienceSegment[]>(() =>
    segmentsFromEntity(entity)
  )
  const [dirty, setDirty] = useState(false)
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set())
  const segmentPresets = useMemo(
    () =>
      audienceSegmentPresetsForEntity({
        name: entity.name,
        industry: entity.industry,
      }),
    [entity.name, entity.industry]
  )

  useEffect(() => {
    setSegments(segmentsFromEntity(entity))
    setDirty(false)
    setOpenKeys(new Set())
  }, [entity.id])

  function segmentKey(segment: AudienceSegment, index: number) {
    return `${index}-${segment.name || "new"}`
  }

  function toggleOpen(key: string, open: boolean) {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function patchSegment(index: number, patch: Partial<AudienceSegment>) {
    setDirty(true)
    setSegments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  function addPreset(preset: AudienceSegment) {
    setSegments((prev) => {
      if (prev.some((row) => row.name === preset.name)) return prev
      if (prev.length >= MAX_AUDIENCE_SEGMENTS) {
        toast.error(
          `Maximum ${MAX_AUDIENCE_SEGMENTS} audience segments. Remove one or save before adding.`
        )
        return prev
      }
      const next = [...prev, preset]
      const newIndex = next.length - 1
      setOpenKeys((keys) => new Set(keys).add(segmentKey(preset, newIndex)))
      return next
    })
    setDirty(true)
  }

  function addEmptySegment() {
    setSegments((prev) => {
      if (prev.length >= MAX_AUDIENCE_SEGMENTS) {
        toast.error(
          `Maximum ${MAX_AUDIENCE_SEGMENTS} audience segments. Remove one or save before adding.`
        )
        return prev
      }
      const draft = emptySegment()
      const newIndex = prev.length
      setOpenKeys((keys) => new Set(keys).add(segmentKey(draft, newIndex)))
      return [...prev, draft]
    })
    setDirty(true)
  }

  function onSave() {
    const cleaned = segments
      .filter((row) => row.name.trim().length > 0)
      .map(enrichSegmentForSave)
    const skipped = segments.length - cleaned.length
    if (cleaned.length === 0) {
      toast.error("Add at least one audience segment with a name.")
      return
    }
    if (cleaned.length > MAX_AUDIENCE_SEGMENTS) {
      toast.error(
        `Maximum ${MAX_AUDIENCE_SEGMENTS} audience segments. Remove extras before saving.`
      )
      return
    }
    startTransition(async () => {
      try {
        const result = await saveAudienceSegments({
          entityId: entity.id,
          audienceSegments: cleaned,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        const persisted = result.data?.segments ?? cleaned
        setSegments(persisted)
        setDirty(false)
        if (skipped > 0) {
          toast.warning(
            `Saved ${persisted.length} segment(s). ${skipped} unnamed row(s) were not saved — add a segment name and save again.`
          )
        } else {
          toast.success(`Saved ${persisted.length} audience segment(s).`)
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Audience save failed. Check that the API server is running."
        )
      }
    })
  }

  return (
    <section className="space-y-4 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <div>
        <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Target audiences
        </p>
        <h3 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
          Accordion segments
        </h3>
        <p className="mt-1 text-xs text-neutral-600">
          One authoritative list — expand a row to edit pains, hooks, and
          forecasting tags. Every segment needs a{" "}
          <span className="font-semibold">segment name</span> before save (up to{" "}
          {MAX_AUDIENCE_SEGMENTS} per brand). Use{" "}
          <span className="font-semibold">Save all audiences</span> after adding
          rows — other Brain saves no longer wipe unsaved segments.
        </p>
      </div>

      {segmentPresets.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase">
            Quick add · {entity.name}
          </p>
          <div className="flex flex-wrap gap-2">
            {segmentPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => addPreset(preset)}
                className="border-2 border-mad-black bg-[#CCFF00]/40 px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase hover:bg-[#CCFF00]"
              >
                + {preset.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {segments.map((segment, index) => {
          const ui = resolveAudienceSegmentUi(segment)
          const key = segmentKey(segment, index)
          const open = openKeys.has(key)
          const kindLabel =
            ui.kind === "b2b" ? "B2B PARTNER" : "B2C CONSUMER"
          const kindStyle =
            ui.kind === "b2b"
              ? "bg-[#FF5500] text-mad-white"
              : "bg-[#CCFF00] text-mad-black"

          return (
            <li key={key}>
              <Collapsible
                open={open}
                onOpenChange={(next) => toggleOpen(key, next)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-2 border-mad-black bg-mad-white px-3 py-3 text-left transition hover:bg-neutral-50",
                      open && "border-b-0"
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 border border-mad-black px-1.5 py-0.5 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase",
                          kindStyle
                        )}
                      >
                        [{kindLabel}]
                      </span>
                      <span className="truncate font-mono text-sm font-bold text-mad-black">
                        {segment.name.trim() || `Segment ${index + 1}`}
                      </span>
                    </span>

                    <span className="hidden items-center gap-2 sm:flex">
                      <span className="font-mono text-xs text-neutral-600">
                        {ui.ageBracket}
                      </span>
                      <span className="border border-mad-black bg-mad-white px-2 py-0.5 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase">
                        {ui.primaryFeature}
                      </span>
                    </span>

                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      {ui.channelPills.map((pill) => (
                        <span
                          key={pill}
                          className="border border-mad-black/60 px-1.5 py-0.5 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase"
                        >
                          [{pill}]
                        </span>
                      ))}
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 transition-transform",
                          open && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </span>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <article className="space-y-4 border-2 border-t-0 border-mad-black bg-mad-white p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-typewriter text-[0.7rem] font-bold tracking-widest text-neutral-500 uppercase">
                        Segment detail
                      </p>
                      {segments.length > 1 ? (
                        <button
                          type="button"
                          aria-label="Remove segment"
                          onClick={() => {
                            setDirty(true)
                            setSegments((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }}
                          className="border border-mad-black p-1 hover:bg-mad-vermillion hover:text-white"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 sm:col-span-2">
                        <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                          Segment name
                        </span>
                        <input
                          value={segment.name}
                          onChange={(event) =>
                            patchSegment(index, { name: event.target.value })
                          }
                          className="w-full border-2 border-mad-black px-2 py-1.5 font-mono text-sm font-bold"
                          placeholder="e.g. Unified Local Food Enthusiasts"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                          Role
                        </span>
                        <input
                          value={segment.role}
                          onChange={(event) =>
                            patchSegment(index, { role: event.target.value })
                          }
                          className="w-full border-2 border-mad-black px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                          Primary conversion goal
                        </span>
                        <input
                          value={
                            segment.conversion_goal ?? ui.conversionGoal
                          }
                          onChange={(event) =>
                            patchSegment(index, {
                              conversion_goal: event.target.value,
                            })
                          }
                          className="w-full border-2 border-mad-black px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>

                    <label className="grid gap-1">
                      <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                        Acute pain point
                      </span>
                      <textarea
                        value={segment.pain}
                        onChange={(event) =>
                          patchSegment(index, { pain: event.target.value })
                        }
                        rows={3}
                        className="w-full resize-none border-2 border-mad-black px-2 py-1.5 text-sm leading-relaxed"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                        What they really want
                      </span>
                      <textarea
                        value={segment.desire}
                        onChange={(event) =>
                          patchSegment(index, { desire: event.target.value })
                        }
                        rows={3}
                        className="w-full resize-none border-2 border-mad-black px-2 py-1.5 text-sm leading-relaxed"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                          Purchase trigger
                        </span>
                        <input
                          value={segment.trigger}
                          onChange={(event) =>
                            patchSegment(index, {
                              trigger: event.target.value,
                            })
                          }
                          className="w-full border-2 border-mad-black px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                          Winning rebuttal / hook
                        </span>
                        <input
                          value={segment.winning_rebuttal}
                          onChange={(event) =>
                            patchSegment(index, {
                              winning_rebuttal: event.target.value,
                            })
                          }
                          className="w-full border-2 border-mad-black px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>

                    <label className="grid gap-1 border-t border-mad-black/20 pt-4">
                      <span className="font-typewriter text-[0.7rem] tracking-wider text-neutral-500 uppercase">
                        Forecasting &amp; analytics tag
                      </span>
                      <p className="text-xs text-neutral-600">
                        Ledger / campaign grouping slug (letters, numbers,
                        underscores). Saved campaigns from Studio attach this
                        when that persona is selected. Leave blank to auto-fill
                        on save:{" "}
                        <span className="font-mono text-[0.7rem]">
                          {ui.forecastingTag.replace(/^#/, "")}
                        </span>
                      </p>
                      <input
                        value={segment.forecasting_tag ?? ""}
                        onChange={(event) =>
                          patchSegment(index, {
                            forecasting_tag: event.target.value
                              .replace(/^#/, "")
                              .replace(/[^a-zA-Z0-9_]/g, "_")
                              .slice(0, 48),
                          })
                        }
                        className="w-full max-w-md border-2 border-mad-black px-2 py-1.5 font-mono text-sm"
                        placeholder={ui.forecastingTag.replace(/^#/, "")}
                        spellCheck={false}
                      />
                    </label>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={onSave}
                      className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
                    >
                      {pending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      [ Save Audiences ]
                    </button>
                  </article>
                </CollapsibleContent>
              </Collapsible>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-mad-black/20 pt-4">
        <button
          type="button"
          onClick={addEmptySegment}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-[#CCFF00]"
        >
          <Plus className="size-3.5" />
          Add segment
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          [ Save all audiences ]
        </button>
      </div>
    </section>
  )
}

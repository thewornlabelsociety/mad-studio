"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Loader2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "@/lib/next-compat"
import { toast } from "sonner"

import { saveEntityDna } from "@/lib/actions"
import {
  enrichSegmentForSave,
  resolveAudienceSegmentUi,
} from "@/lib/brain/audience-segment-display"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import type { AudienceSegment } from "@/lib/entities/dna-schema"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

const SEGMENT_PRESETS: AudienceSegment[] = [
  {
    name: "Unified Local Food Enthusiasts",
    role: "Local diners & weekend planners",
    audience_type: "b2c",
    age_bracket: "18–34",
    primary_feature: "Deals",
    target_channels: ["tiktok", "instagram_story"],
    forecasting_tag: "consumer_spontaneous_drops",
    conversion_goal: "App Search & Table Tap",
    pain:
      "Fragmented platform overload: bouncing between Google (outdated PDF menus), Instagram (non-shoppable photos), Facebook (buried flyers), and UberEats (marked-up fees). Disjointed apps cluttered with non-food noise.",
    desire:
      "One single place for everything local food: visual dish feeds, live mid-week deals, weekend event tickets, pantry marketplace, and instant tap-and-pay at the table.",
    trigger:
      "A concrete dish drop, limited deal, or weekend event from a venue they trust — surfaced on one map.",
    winning_rebuttal:
      "Stop app-hopping. FÜDI puts every dish, drop, event, and table menu in your town onto one live map.",
  },
  {
    name: "18–27 Gen Z Quick Casual",
    role: "Students & young professionals",
    audience_type: "b2c",
    age_bracket: "18–27",
    primary_feature: "Deals",
    target_channels: ["tiktok", "instagram_story"],
    forecasting_tag: "consumer_spontaneous_drops",
    conversion_goal: "App Search & Table Tap",
    pain: "Decision fatigue on where to eat or shop on a budget",
    desire: "Fast discovery, aesthetic vibes, honest value",
    trigger: "Midweek lunch or late-night scroll",
    winning_rebuttal: "Show real plates, real prices, zero corporate fluff",
  },
  {
    name: "28–42 Food Enthusiasts & Date Nights",
    role: "Curated millennial diners or shoppers",
    audience_type: "b2c",
    age_bracket: "28–42",
    primary_feature: "Events",
    target_channels: ["instagram_feed", "facebook"],
    forecasting_tag: "consumer_weekend_events",
    conversion_goal: "Event RSVP & map saves",
    pain: "Tired of generic chains and bait-and-switch promos",
    desire: "Editorial quality, story, and a reason to share",
    trigger: "Weekend plans or special occasion",
    winning_rebuttal: "Lead with craft, provenance, and limited drops",
  },
  {
    name: "35–60+ Local Community",
    role: "Neighbourhood regulars and loyal locals",
    audience_type: "b2c",
    age_bracket: "35–60+",
    primary_feature: "Events",
    target_channels: ["facebook", "instagram_feed"],
    forecasting_tag: "consumer_weekend_events",
    conversion_goal: "Event RSVP & map saves",
    pain: "Hard to trust noisy social ads and hidden fees",
    desire: "Warm, clear details — hours, location, who runs the place",
    trigger: "Community events, school holidays, local news",
    winning_rebuttal: "Plain language, familiar faces, Facebook-friendly clarity",
  },
]

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

type Props = {
  entity: StudioEntityDna
}

export function AudienceSegmentsEditor({ entity }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [segments, setSegments] = useState<AudienceSegment[]>(
    entity.audience_segments.length > 0
      ? entity.audience_segments
      : [emptySegment()]
  )
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set())

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
    setSegments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  function addPreset(preset: AudienceSegment) {
    setSegments((prev) => {
      if (prev.some((row) => row.name === preset.name)) return prev
      return [...prev, preset]
    })
  }

  function onSave() {
    const cleaned = segments
      .filter((row) => row.name.trim().length > 0)
      .map(enrichSegmentForSave)
    if (cleaned.length === 0) {
      toast.error("Add at least one audience segment with a name.")
      return
    }
    startTransition(async () => {
      const result = await saveEntityDna({
        entityId: entity.id,
        brandIdentity: entity.brand_identity,
        audienceSegments: cleaned,
        industry: entity.industry,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Audience segments saved.")
      router.refresh()
    })
  }

  return (
    <section className="space-y-4 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <div>
        <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Target audiences
        </p>
        <h3 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
          Accordion segments
        </h3>
        <p className="mt-1 text-xs text-neutral-600">
          One authoritative list — expand a row to edit pains, hooks, and
          forecasting tags for Studio dispatch.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEGMENT_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => addPreset(preset)}
            className="border-2 border-mad-black bg-[#CCFF00]/40 px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase hover:bg-[#CCFF00]"
          >
            + {preset.name}
          </button>
        ))}
      </div>

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
                          "shrink-0 border border-mad-black px-1.5 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase",
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
                      <span className="border border-mad-black bg-mad-white px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase">
                        {ui.primaryFeature}
                      </span>
                    </span>

                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      {ui.channelPills.map((pill) => (
                        <span
                          key={pill}
                          className="border border-mad-black/60 px-1.5 py-0.5 font-typewriter text-[0.45rem] font-bold tracking-wider uppercase"
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
                      <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
                        Segment detail
                      </p>
                      {segments.length > 1 ? (
                        <button
                          type="button"
                          aria-label="Remove segment"
                          onClick={() =>
                            setSegments((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="border border-mad-black p-1 hover:bg-mad-vermillion hover:text-white"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 sm:col-span-2">
                        <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
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
                        <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
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
                        <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
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
                      <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
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
                      <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
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
                        <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
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
                        <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
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

                    <div className="flex flex-wrap items-center gap-3 border-t border-mad-black/20 pt-4">
                      <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
                        Forecasting &amp; analytics tag
                      </span>
                      <code className="border-2 border-mad-black bg-neutral-100 px-2 py-1 font-mono text-xs">
                        {ui.forecastingTag}
                      </code>
                    </div>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={onSave}
                      className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSegments((prev) => [...prev, emptySegment()])}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase hover:bg-[#CCFF00]"
        >
          <Plus className="size-3.5" />
          Add segment
        </button>
      </div>
    </section>
  )
}

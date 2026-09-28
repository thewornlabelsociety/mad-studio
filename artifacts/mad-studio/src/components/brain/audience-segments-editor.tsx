"use client"

import { useState, useTransition } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "@/lib/next-compat"
import { toast } from "sonner"

import { saveEntityDna } from "@/lib/actions"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import type { AudienceSegment } from "@/lib/entities/dna-schema"

const SEGMENT_PRESETS: AudienceSegment[] = [
  {
    name: "Unified Local Food Enthusiasts",
    role: "Local diners & weekend planners",
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
    pain: "Decision fatigue on where to eat or shop on a budget",
    desire: "Fast discovery, aesthetic vibes, honest value",
    trigger: "Midweek lunch or late-night scroll",
    winning_rebuttal: "Show real plates, real prices, zero corporate fluff",
  },
  {
    name: "28–42 Food Enthusiasts & Date Nights",
    role: "Curated millennial diners or shoppers",
    pain: "Tired of generic chains and bait-and-switch promos",
    desire: "Editorial quality, story, and a reason to share",
    trigger: "Weekend plans or special occasion",
    winning_rebuttal: "Lead with craft, provenance, and limited drops",
  },
  {
    name: "35–60+ Local Community",
    role: "Neighbourhood regulars and loyal locals",
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
    const cleaned = segments.filter((row) => row.name.trim().length > 0)
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
          Demographics, pains & desires
        </h3>
        <p className="mt-1 text-xs text-neutral-600">
          Used by Brand Director chat and Studio generation — no JSON editing.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEGMENT_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => addPreset(preset)}
            className="border-2 border-mad-black bg-mad-lime/40 px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase hover:bg-mad-lime"
          >
            + {preset.name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {segments.map((segment, index) => (
          <article
            key={`seg-${index}-${segment.name}`}
            className="space-y-2 border border-mad-black/30 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-typewriter text-[0.6rem] font-bold tracking-widest uppercase">
                Segment {index + 1}
              </p>
              {segments.length > 1 ? (
                <button
                  type="button"
                  aria-label="Remove segment"
                  onClick={() =>
                    setSegments((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="border border-mad-black p-1 hover:bg-mad-vermillion hover:text-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
            <label className="grid gap-1">
              <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
                Name & age bracket
              </span>
              <input
                value={segment.name}
                onChange={(event) =>
                  patchSegment(index, { name: event.target.value })
                }
                className="w-full border-2 border-mad-black px-2 py-1.5 text-sm"
                placeholder="e.g. 28–42 Food Enthusiasts"
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
                Pain we solve
              </span>
              <textarea
                value={segment.pain}
                onChange={(event) =>
                  patchSegment(index, { pain: event.target.value })
                }
                rows={2}
                className="w-full resize-none border-2 border-mad-black px-2 py-1.5 text-sm"
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
                rows={2}
                className="w-full resize-none border-2 border-mad-black px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
                Buy trigger
              </span>
              <input
                value={segment.trigger}
                onChange={(event) =>
                  patchSegment(index, { trigger: event.target.value })
                }
                className="w-full border-2 border-mad-black px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1">
              <span className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
                Objection / winning rebuttal
              </span>
              <textarea
                value={segment.winning_rebuttal}
                onChange={(event) =>
                  patchSegment(index, { winning_rebuttal: event.target.value })
                }
                rows={2}
                className="w-full resize-none border-2 border-mad-black px-2 py-1.5 text-sm"
              />
            </label>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSegments((prev) => [...prev, emptySegment()])}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
        >
          <Plus className="size-3.5" />
          Add segment
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save audiences
        </button>
      </div>
    </section>
  )
}

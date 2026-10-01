"use client"

import { useMemo, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  OPTIMIZATION_TAG_MAX,
  formatTagsForCaption,
  normalizeOptTag,
} from "@/lib/inventory/optimization-tags"
import { cleanHashtags } from "@/lib/copy/caption-hygiene"
import { requestFieldAssist } from "@/lib/studio/field-assist-client"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  marketingEntityId?: string | null
  tags: string[]
  suggestedTags: string[]
  headline: string
  caption: string
  listingVibe?: string | null
  visualDescription?: string | null
  bannedTagSeeds?: string[]
  onTagsChange: (tags: string[]) => void
  className?: string
}

export function OptimizationTagsEditor({
  entityId,
  marketingEntityId = null,
  tags,
  suggestedTags,
  headline,
  caption,
  listingVibe = null,
  visualDescription = null,
  bannedTagSeeds = [],
  onTagsChange,
  className,
}: Props) {
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [customDraft, setCustomDraft] = useState("")
  const [aiBusy, setAiBusy] = useState(false)

  const chipPool = useMemo(() => {
    const merged = [...suggestedTags, ...aiSuggestions, ...tags]
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of merged) {
      const tag = normalizeOptTag(raw)
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      out.push(tag)
    }
    return out
  }, [suggestedTags, aiSuggestions, tags])

  function setTags(next: string[]) {
    onTagsChange(
      cleanHashtags(next, {
        max: OPTIMIZATION_TAG_MAX,
        bannedSeeds: bannedTagSeeds,
      })
    )
  }

  function toggleTag(tag: string) {
    const normalized = normalizeOptTag(tag)
    if (!normalized) return
    const exists = tags.includes(normalized)
    if (exists) {
      setTags(tags.filter((row) => row !== normalized))
      return
    }
    if (tags.length >= OPTIMIZATION_TAG_MAX) {
      toast.message(`Max ${OPTIMIZATION_TAG_MAX} tags on publish. Remove one to add another.`)
      return
    }
    setTags([...tags, normalized])
  }

  function addCustomTag() {
    const normalized = normalizeOptTag(customDraft)
    if (!normalized) {
      toast.message("Use letters and numbers only (2–40 chars).")
      return
    }
    if (!cleanHashtags([normalized], { bannedSeeds: bannedTagSeeds }).length) {
      toast.message("That tag is blocked for this listing.")
      return
    }
    if (tags.includes(normalized)) {
      toast.message("Tag already selected.")
      setCustomDraft("")
      return
    }
    if (tags.length >= OPTIMIZATION_TAG_MAX) {
      toast.message(`Max ${OPTIMIZATION_TAG_MAX} tags. Remove one first.`)
      return
    }
    setTags([...tags, normalized])
    setCustomDraft("")
  }

  async function suggestTagsWithAi() {
    setAiBusy(true)
    try {
      const result = await requestFieldAssist({
        entityId,
        marketingEntityId,
        field: "tags",
        headline,
        caption,
        visualDescription,
        listingVibe,
        existingTags: tags,
      })
      const incoming = cleanHashtags(result.tags ?? [], {
        max: OPTIMIZATION_TAG_MAX,
        bannedSeeds: bannedTagSeeds,
      })
      if (incoming.length === 0) {
        throw new Error("No tags returned.")
      }
      setAiSuggestions(incoming)
      const before = new Set(tags)
      const merged = cleanHashtags([...tags, ...incoming], {
        max: OPTIMIZATION_TAG_MAX,
        bannedSeeds: bannedTagSeeds,
      })
      const added = merged.filter((tag) => !before.has(tag)).length
      setTags(merged)
      toast.success(
        added > 0
          ? `Added ${added} AI tag(s). Tap chips to adjust.`
          : `${incoming.length} AI suggestion(s) ready — tap to select.`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not suggest tags."
      )
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
          Optimisation tags
        </span>
        <button
          type="button"
          disabled={aiBusy}
          onClick={() => void suggestTagsWithAi()}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
        >
          {aiBusy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          AI suggest
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {chipPool.map((tag) => {
          const active = tags.includes(tag)
          const fromAi = aiSuggestions.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider lowercase",
                active
                  ? "bg-mad-black text-mad-white"
                  : "bg-mad-white text-mad-black hover:bg-mad-lime",
                fromAi && !active && "border-dashed"
              )}
            >
              #{tag}
            </button>
          )
        })}
      </div>

      <div className="flex gap-1">
        <input
          type="text"
          dir="ltr"
          value={customDraft}
          onChange={(event) => setCustomDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCustomTag()
            }
          }}
          placeholder="Add custom tag…"
          className="min-w-0 flex-1 border-2 border-mad-black bg-mad-white px-2 py-1 font-sans text-sm tracking-normal outline-none focus:bg-mad-lime/20"
        />
        <button
          type="button"
          onClick={addCustomTag}
          className="shrink-0 border-2 border-mad-black bg-mad-lime px-2 py-1 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase hover:bg-mad-black hover:text-mad-white"
        >
          Add
        </button>
      </div>

      {tags.length > 0 ? (
        <p className="font-typewriter text-[0.55rem] leading-relaxed text-neutral-600 normal-case">
          Live footer · {formatTagsForCaption(tags)}
        </p>
      ) : (
        <p className="font-typewriter text-[0.55rem] text-neutral-500 uppercase">
          Tap chips, type a tag, or use AI suggest (max {OPTIMIZATION_TAG_MAX})
        </p>
      )}
    </div>
  )
}

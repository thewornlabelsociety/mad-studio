"use client"

import { useRef, useState } from "react"
import { Check, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import {
  colourLabel,
  DotSpecialArt,
  dotSpecialCaption,
  DotSpecialFields,
  useDotSpecial,
  type DotSpecial,
} from "@/components/templates/dot-special"
import { WLS_STORY_KIT } from "@/lib/brands/story-kit"
import type { Json } from "@/lib/database.types"
import { updateDraftArtwork } from "@/lib/planner/day-drafts"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { bakeStoryPng } from "@/lib/templates/use-kit-stories"
import { cn } from "@/lib/utils"

type DraftData = { special?: Partial<DotSpecial>; backgroundId?: string | null }

function draftDataOf(value: unknown): DraftData {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as DraftData) : {}
}

/**
 * The dot special draft, edited in the calendar drawer: the same fields as the
 * Sale rack screen, a live Story, and Update draft to swap the draft's image.
 */
export function DotSpecialDraftEditor({
  entityId,
  brandName,
  ids,
  draftData,
  onSaved,
}: {
  entityId: string
  brandName: string
  /** The draft's rows (one per platform). */
  ids: string[]
  draftData: unknown
  onSaved: () => void
}) {
  // The device's current dot special, so a change here shows on the Sale rack screen too.
  const [shared, setSharedSpecial] = useDotSpecial(entityId)
  const saved = draftDataOf(draftData)
  // The draft's own wording; drafts made before it was saved with them start from this device's.
  const [special, setSpecial] = useState<DotSpecial>(() => ({ ...shared, ...(saved.special ?? {}) }))
  const [backgroundId, setBackgroundId] = useState(() => saved.backgroundId ?? "charcoal")
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const storyRef = useRef<HTMLDivElement>(null)
  const background = WLS_STORY_KIT.find((bg) => bg.id === backgroundId) ?? WLS_STORY_KIT[0]

  async function save() {
    if (!storyRef.current) return
    setBusy(true)
    try {
      const { blob } = await bakeStoryPng(storyRef.current)
      const url = await uploadRenderedPng(blob, entityId)
      await updateDraftArtwork({
        entityId,
        ids,
        mediaUrl: url,
        title: `${colourLabel(special.color)} dot special`,
        caption: dotSpecialCaption(special),
        data: { special, backgroundId: background.id } as Json,
      })
      setSharedSpecial(special)
      setDirty(false)
      toast.success("Draft updated")
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the draft.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3 border-2 border-mad-black p-3">
      <p className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">Edit the dot special</p>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
        <DotSpecialFields
          special={special}
          onChange={(next) => {
            setSpecial(next)
            setDirty(true)
          }}
        />
        <div className="grid content-start gap-2">
          <DotSpecialArt
            ref={storyRef}
            special={special}
            background={background}
            brandName={brandName}
            aspect="story"
            className="rounded-sm shadow-md"
          />
          <div className="flex flex-wrap gap-1" role="group" aria-label="Background">
            {WLS_STORY_KIT.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => {
                  setBackgroundId(bg.id)
                  setDirty(true)
                }}
                title={bg.name}
                aria-label={`Use ${bg.name}`}
                aria-pressed={bg.id === background.id}
                className={cn(
                  "relative size-6 rounded-full border border-black/15",
                  bg.id === background.id && "ring-2 ring-mad-black ring-offset-1"
                )}
                style={{ background: bg.color }}
              >
                {bg.id === background.id ? (
                  <Check className="absolute inset-0 m-auto size-3" style={{ color: bg.text_color }} aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled={busy || !dirty}
        onClick={() => void save()}
        className="inline-flex items-center justify-center gap-2 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
        {busy ? "Updating…" : dirty ? "Update draft" : "No changes yet"}
      </button>
    </div>
  )
}

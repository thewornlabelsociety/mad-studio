"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, Loader2, Plus, Save, Share2, X } from "lucide-react"
import { toast } from "sonner"

import { WantsCard, WantsStory } from "@/components/templates/wants-slides"
import { Button } from "@/components/ui/button"
import { saveWantsList } from "@/lib/actions"
import { resolveStoryKit } from "@/lib/brands/story-kit"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { VisualPresets, WantsItem } from "@/lib/entities/dna-schema"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { bakeStoryPng, shareOrDownloadStory } from "@/lib/templates/use-kit-stories"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { cn } from "@/lib/utils"

const MAX_LINES = 10

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: {
    visual_presets?: VisualPresets | null
    wants_list?: WantsItem[] | null
    wants_note?: string | null
  } | null
}

function newLine(): WantsItem {
  return { id: `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, label: "", detail: "" }
}

/** "We're searching for": the stock the shop wants consigned, as a Story and a feed card. */
export function WlsWantsWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  const storyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const saved = brandIdentity?.wants_list?.length ? brandIdentity.wants_list : null
  const [items, setItems] = useState<WantsItem[]>(saved ?? [newLine(), newLine(), newLine()])
  const [note, setNote] = useState(brandIdentity?.wants_note ?? "Bring them in, or book a drop-off")
  const [dirty, setDirty] = useState(false)
  const [backgroundId, setBackgroundId] = useState<string | null>(null)
  const [busy, setBusy] = useState<"story" | "studio" | null>(null)
  const [saving, startSaving] = useTransition()

  const kit = useMemo(
    () =>
      resolveStoryKit({
        presets: resolveVisualPresets({ brandName: entityName, industry, brandIdentity: brandIdentity as never }),
        isWornLabel: isWls,
      }),
    [entityName, industry, brandIdentity, isWls]
  )
  // Charcoal suits a type-only card best when the kit has it.
  const background =
    kit.find((bg) => bg.id === backgroundId) ?? kit.find((bg) => bg.id === "charcoal") ?? kit[0]
  const filled = items.filter((item) => item.label.trim())

  function update(index: number, patch: Partial<WantsItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    setDirty(true)
  }

  function save(then?: () => void) {
    startSaving(async () => {
      const result = await saveWantsList({
        entityId,
        items: filled.map((item) => ({ ...item, label: item.label.trim(), detail: item.detail.trim() })),
        note,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDirty(false)
      toast.success("Wants list saved.")
      then?.()
    })
  }

  async function saveStory() {
    if (!storyRef.current) return
    setBusy("story")
    try {
      const baked = await bakeStoryPng(storyRef.current)
      const result = await shareOrDownloadStory({ ...baked, filename: "wls-searching-for.png" })
      if (result === "downloaded") toast.success("Story image saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setBusy(null)
    }
  }

  async function sendCard() {
    if (!cardRef.current) return
    setBusy("studio")
    try {
      const { blob } = await bakeStoryPng(cardRef.current)
      const url = await uploadRenderedPng(blob, entityId)
      const caption = [
        "We're searching for:",
        "",
        ...filled.map((item) => `${item.label}${item.detail ? ` (${item.detail})` : ""}`),
        "",
        `${note.trim() || "Bring them in"}. We sell on consignment and do the work for you.`,
      ].join("\n")
      saveStudioSlidesHandoff(entityId, { urls: [url], caption })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the card.")
      setBusy(null)
    }
  }

  if (!isWls) {
    return (
      <div className="border-2 border-mad-black bg-white p-6 font-typewriter text-sm">
        The wants list is only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Saturday post and Story · consignments
          </p>
          <h1 className="brand-typewriter text-xl">We&apos;re searching for</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Keep this list current and it&apos;s ready whenever you want to
            ask for stock. It&apos;s saved with the brand.
          </p>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Background">
          {kit.map((bg) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => setBackgroundId(bg.id)}
              title={bg.name}
              aria-label={`Use ${bg.name}`}
              aria-pressed={bg.id === background.id}
              className={cn(
                "relative size-8 rounded-full border border-black/15",
                bg.id === background.id && "ring-2 ring-mad-black ring-offset-2"
              )}
              style={{ background: bg.color }}
            >
              {bg.id === background.id ? (
                <Check className="absolute inset-0 m-auto size-3.5" style={{ color: bg.text_color }} aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section aria-labelledby="wants-list" className="grid content-start gap-3">
          <h2 id="wants-list" className="font-typewriter text-xs uppercase tracking-widest">
            The list
          </h2>
          <ol className="grid gap-2">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  id={`wants-label-${item.id}`}
                  type="text"
                  value={item.label}
                  maxLength={60}
                  placeholder={index === 0 ? "e.g. Levi's 501s" : index === 1 ? "e.g. Leather jackets" : "Brand or piece"}
                  onChange={(event) => update(index, { label: event.target.value })}
                  aria-label={`Line ${index + 1}`}
                  className="h-9 min-w-0 flex-1 border-2 border-mad-black bg-white px-2 text-sm"
                />
                <input
                  id={`wants-detail-${item.id}`}
                  type="text"
                  value={item.detail}
                  maxLength={40}
                  placeholder={index === 0 ? "All sizes" : "Sizes"}
                  onChange={(event) => update(index, { detail: event.target.value })}
                  aria-label={`Sizes for line ${index + 1}`}
                  className="h-9 w-28 border-2 border-mad-black/40 bg-white px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setItems((current) => current.filter((_, i) => i !== index))
                    setDirty(true)
                  }}
                  title="Remove this line"
                  aria-label={`Remove line ${index + 1}`}
                  className="flex size-9 shrink-0 items-center justify-center text-mad-black/60 hover:text-mad-black"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          {items.length < MAX_LINES ? (
            <button
              type="button"
              onClick={() => setItems((current) => [...current, newLine()])}
              className="flex items-center gap-1.5 self-start border border-dashed border-mad-black/40 px-3 py-1.5 text-xs text-mad-black/70 hover:border-mad-black hover:text-mad-black"
            >
              <Plus className="size-3.5" aria-hidden /> Add a line
            </button>
          ) : null}
          <label className="grid gap-1.5">
            <span className="font-typewriter text-xs uppercase tracking-widest">Sign-off</span>
            <input
              id="wants-note"
              type="text"
              value={note}
              maxLength={80}
              onChange={(event) => {
                setNote(event.target.value)
                setDirty(true)
              }}
              className="h-9 border-2 border-mad-black bg-white px-2 text-sm"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="justify-self-start border-2 border-mad-black"
            disabled={!dirty || saving}
            onClick={() => save()}
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            {dirty ? "Save list" : "Saved"}
          </Button>
        </section>

        <section aria-labelledby="wants-previews" className="grid content-start gap-3">
          <h2 id="wants-previews" className="font-typewriter text-xs uppercase tracking-widest">
            Story and feed card
          </h2>
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex w-[230px] flex-col gap-2">
              <WantsStory ref={storyRef} background={background} brandName={entityName} items={items} note={note} className="rounded-md shadow-md" />
              <Button
                type="button"
                className="border-2 border-mad-black bg-mad-black text-mad-white"
                disabled={filled.length === 0 || busy != null}
                onClick={() => void saveStory()}
              >
                {busy === "story" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
                Save Story image
              </Button>
            </div>
            <div className="flex w-[280px] flex-col gap-2">
              <WantsCard ref={cardRef} background={background} brandName={entityName} items={items} note={note} className="rounded-sm shadow-md" />
              <Button
                type="button"
                variant="outline"
                className="border-2 border-mad-black"
                disabled={filled.length === 0 || busy != null || saving}
                onClick={() => (dirty ? save(() => void sendCard()) : void sendCard())}
                title="Open the card in Studio to schedule it"
              >
                {busy === "studio" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
                Send card to Studio
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

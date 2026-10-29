"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"

import {
  AnnouncementCard,
  AnnouncementStory,
  type Announcement,
} from "@/components/templates/announcement-slides"
import { Button } from "@/components/ui/button"
import { resolveStoryKit } from "@/lib/brands/story-kit"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { bakeStoryPng, shareOrDownloadStory } from "@/lib/templates/use-kit-stories"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

type Preset = { id: string; label: string; background: string; value: Announcement }

/** Starting points; every word is editable. */
const PRESETS: Preset[] = [
  {
    id: "sale",
    label: "Sale starts",
    background: "worn_taupe",
    value: { tag: "Sale", kicker: "This Friday", headline: "Winter sale starts", details: ["Up to 50% off the racks", "In store and online", ""] },
  },
  {
    id: "late",
    label: "Late night",
    background: "charcoal",
    value: { tag: "News", kicker: "This Thursday", headline: "Late night shopping", details: ["Open till 7pm", "Come try on the new drop", ""] },
  },
  {
    id: "drop",
    label: "New drop",
    background: "deep_green",
    value: { tag: "New in", kicker: "Saturday 10am", headline: "Fresh drop on the racks", details: ["Over 40 new pieces", "First in, best dressed", ""] },
  },
  {
    id: "closed",
    label: "Closed",
    background: "vintage_beige",
    value: { tag: "Notice", kicker: "Public holiday", headline: "Closed Monday", details: ["Back Tuesday from 10am", "Shop online anytime", ""] },
  },
  {
    id: "event",
    label: "Event",
    background: "faded_olive",
    value: { tag: "Event", kicker: "Save the date", headline: "Styling night", details: ["Friday from 6pm", "Drinks, styling and 10% off", ""] },
  },
]

const BLANK: Announcement = { tag: "News", kicker: "", headline: "", details: ["", "", "", ""] }

function padDetails(details: string[]): string[] {
  const out = details.slice(0, 4)
  while (out.length < 4) out.push("")
  return out
}

function editorialPreset(
  id: string,
  label: string,
  background: string,
  value: Partial<Announcement>
): Preset {
  return {
    id,
    label,
    background,
    value: {
      tag: "",
      kicker: "",
      headline: "",
      script: "",
      headlineFont: "serif",
      accent: "brush",
      align: "center",
      ...value,
      style: "editorial",
      details: padDetails(value.details ?? []),
    },
  }
}

/** Editorial cards from the brand moodboard: launch and announcement lines. */
const EDITORIAL_PRESETS: Preset[] = [
  editorialPreset("new_look", "A new look", "charcoal", { headline: "A new\nlook", script: "for Worn Label Society", accent: "none", align: "left" }),
  editorialPreset("online", "Now online", "deep_green", { headline: "We are\nnow\nonline!!", details: ["Shop", "preloved", "NZ"], accent: "oval" }),
  editorialPreset("same_good", "Same good stuff", "vintage_beige", { headline: "Same\ngood\nstuff", details: ["Quality", "preloved fashion", "now easier", "than ever"], accent: "none" }),
  editorialPreset("shop_nz", "Shop preloved NZ", "faded_olive", { headline: "Shop\npreloved\nNZ", details: ["Womens", "Mens", "Kids"], accent: "arrow" }),
  editorialPreset("buy_sell", "Buy sell discover", "worn_taupe", { kicker: "Same vibe\nBigger possibilities", headline: "Buy\nsell\ndiscover", details: ["All in one place"] }),
  editorialPreset("marketplace", "Marketplace is here", "vintage_beige", { headline: "Your\nnew\npreloved\nmarketplace\nis here", details: ["Fashion", "Brands", "Bargains", "NZ only"] }),
  editorialPreset("more_ways", "More ways to shop", "charcoal", { headline: "Same\ncommunity\nmore\nways to shop", details: ["In-store", "Online", "NZ wide"] }),
  editorialPreset("go_further", "Good clothes", "deep_green", { headline: "Good\nclothes\ngo further.", headlineFont: "script", details: ["Shop preloved", "Support local", "Keep fashion circular"] }),
  editorialPreset("real_people", "Real people", "vintage_beige", { headline: "Real\npeople\nreal\nfashion", details: ["New arrivals", "every day", "online now"], align: "left" }),
  editorialPreset("same_heart", "Same heart", "charcoal", { headline: "Same heart,\nbigger reach.", headlineFont: "script", details: ["Local style", "Circular fashion", "NZ wide"] }),
]

function draftKey(entityId: string): string {
  return `mad.announcement.${entityId}`
}

function readDraft(entityId: string): { value: Announcement; backgroundId: string | null } | null {
  try {
    const raw = window.localStorage.getItem(draftKey(entityId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { value?: Announcement; backgroundId?: string | null }
    if (!parsed.value || typeof parsed.value.headline !== "string") return null
    const details = padDetails(Array.isArray(parsed.value.details) ? parsed.value.details : [])
    return { value: { ...BLANK, ...parsed.value, details }, backgroundId: parsed.backgroundId ?? null }
  } catch {
    return null
  }
}

/** Sales, opening hours, events: a type-only Story and feed card in the kit. */
export function WlsAnnouncementWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const storyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [initial] = useState(() => readDraft(entityId))
  const [value, setValue] = useState<Announcement>(initial?.value ?? EDITORIAL_PRESETS[0].value)
  const [backgroundId, setBackgroundId] = useState<string | null>(
    initial?.backgroundId ?? EDITORIAL_PRESETS[0].background
  )
  const editorial = value.style === "editorial"
  const presets = editorial ? EDITORIAL_PRESETS : PRESETS
  const [linkSpace, setLinkSpace] = useState(true)
  const [busy, setBusy] = useState<"story" | "studio" | null>(null)

  const kit = useMemo(
    () =>
      resolveStoryKit({
        presets: resolveVisualPresets({ brandName: entityName, industry, brandIdentity: brandIdentity as never }),
        isWornLabel: true,
      }),
    [entityName, industry, brandIdentity]
  )
  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(entityId), JSON.stringify({ value, backgroundId }))
    } catch {
      /* the draft just isn't remembered */
    }
  }, [entityId, value, backgroundId])

  function set<K extends keyof Announcement>(key: K, next: Announcement[K]) {
    setValue((current) => ({ ...current, [key]: next }))
  }

  function setDetail(index: number, text: string) {
    setValue((current) => ({
      ...current,
      details: current.details.map((line, i) => (i === index ? text : line)),
    }))
  }

  async function saveStory() {
    if (!storyRef.current) return
    setBusy("story")
    try {
      const baked = await bakeStoryPng(storyRef.current)
      const result = await shareOrDownloadStory({ ...baked, filename: "wls-announcement.png" })
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
      const lines = value.details.map((line) => line.trim()).filter(Boolean)
      const oneLine = (text: string) =>
        text.split(/\n/).map((part) => part.trim()).filter(Boolean).join(" ")
      const caption = [
        [oneLine(value.kicker), oneLine(value.headline), value.script?.trim()].filter(Boolean).join(" "),
        "",
        ...lines,
      ].join("\n").trim()
      saveStudioSlidesHandoff(entityId, { urls: [url], caption })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the card.")
      setBusy(null)
    }
  }

  const ready = value.headline.trim().length > 0
  const field = "h-9 w-full border-2 border-mad-black bg-white px-2 text-sm"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Sales, hours and events · Story and feed card
          </p>
          <h1 className="brand-typewriter text-xl">Announcement</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Pick a starting point and change any of the words. Kit uses your
            website capitals; Editorial is the serif and script look.
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
        <section aria-labelledby="announce-words" className="grid content-start gap-3">
          <div className="flex border-2 border-mad-black" role="group" aria-label="Style">
            {(["editorial", "kit"] as const).map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={(value.style ?? "kit") === style}
                onClick={() => {
                  const first = (style === "editorial" ? EDITORIAL_PRESETS : PRESETS)[0]
                  setValue({ ...first.value, details: padDetails(first.value.details) })
                  setBackgroundId(first.background)
                }}
                className={cn(
                  "flex-1 px-3 py-1.5 font-typewriter text-xs uppercase tracking-widest",
                  (value.style ?? "kit") === style
                    ? "bg-mad-black text-mad-white"
                    : "bg-white hover:bg-mad-lime/40"
                )}
              >
                {style === "editorial" ? "Editorial" : "Kit"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Start from">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setValue({ ...preset.value, details: padDetails(preset.value.details) })
                  setBackgroundId(preset.background)
                }}
                className="border border-mad-black/30 px-2.5 py-1 text-xs hover:border-mad-black"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setValue(
                  editorial
                    ? { ...EDITORIAL_PRESETS[0].value, kicker: "", headline: "", script: "", details: padDetails([]) }
                    : BLANK
                )
              }
              className="border border-dashed border-mad-black/40 px-2.5 py-1 text-xs text-mad-black/70 hover:border-mad-black"
            >
              Blank
            </button>
          </div>

          <h2 id="announce-words" className="sr-only">Words</h2>
          {editorial ? (
            <label className="grid gap-1 text-xs">
              <span className="font-typewriter uppercase tracking-widest">Small line above (optional)</span>
              <textarea
                id="announce-kicker"
                rows={2}
                className="w-full resize-none border-2 border-mad-black bg-white px-2 py-1.5 text-sm"
                value={value.kicker}
                maxLength={60}
                placeholder="e.g. Same vibe"
                onChange={(e) => set("kicker", e.target.value)}
              />
            </label>
          ) : (
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <label className="grid gap-1 text-xs">
                <span className="font-typewriter uppercase tracking-widest">Tag</span>
                <input id="announce-tag" className={field} value={value.tag} maxLength={14} onChange={(e) => set("tag", e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-typewriter uppercase tracking-widest">Above the headline</span>
                <input id="announce-kicker" className={field} value={value.kicker} maxLength={30} placeholder="e.g. This Friday" onChange={(e) => set("kicker", e.target.value)} />
              </label>
            </div>
          )}
          <label className="grid gap-1 text-xs">
            <span className="font-typewriter uppercase tracking-widest">
              Headline{editorial ? " (Enter starts a new line)" : ""}
            </span>
            <textarea
              id="announce-headline"
              rows={editorial ? 4 : 2}
              className={cn(
                "min-h-16 w-full resize-y border-2 border-mad-black bg-white px-2 py-1.5 text-sm tracking-wider",
                (!editorial || value.headlineFont !== "script") && "uppercase"
              )}
              value={value.headline}
              maxLength={editorial ? 80 : 60}
              placeholder="e.g. Winter sale starts"
              onChange={(e) => set("headline", e.target.value)}
            />
          </label>
          {editorial ? (
            <>
              <Choice
                label="Headline in"
                value={value.headlineFont ?? "serif"}
                options={[["serif", "Serif"], ["script", "Script"]]}
                onChange={(next) => set("headlineFont", next)}
              />
              <label className="grid gap-1 text-xs">
                <span className="font-typewriter uppercase tracking-widest">Script line (optional)</span>
                <input
                  id="announce-script"
                  className={field}
                  value={value.script ?? ""}
                  maxLength={40}
                  placeholder="e.g. for Worn Label Society"
                  onChange={(e) => set("script", e.target.value)}
                />
              </label>
            </>
          ) : null}
          <fieldset className="grid gap-1.5 text-xs">
            <legend className="mb-1 font-typewriter uppercase tracking-widest">Details</legend>
            {value.details.slice(0, editorial ? 4 : 3).map((line, index) => (
              <input
                key={index}
                id={`announce-detail-${index}`}
                className={field}
                value={line}
                maxLength={40}
                placeholder={
                  editorial
                    ? ["e.g. Shop preloved", "Support local", "", ""][index]
                    : ["When", "Where", "What's on"][index]
                }
                aria-label={`Detail line ${index + 1}`}
                onChange={(e) => setDetail(index, e.target.value)}
              />
            ))}
          </fieldset>
          {editorial ? (
            <>
              <Choice
                label="Finish with"
                value={value.accent ?? "brush"}
                options={[["brush", "Gold brush"], ["oval", "Oval"], ["arrow", "Arrow"], ["none", "Nothing"]]}
                onChange={(next) => set("accent", next)}
              />
              <Choice
                label="Line up"
                value={value.align ?? "center"}
                options={[["center", "Centre"], ["left", "Left"]]}
                onChange={(next) => set("align", next)}
              />
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input id="announce-link-space" type="checkbox" checked={linkSpace} onChange={(e) => setLinkSpace(e.target.checked)} />
            Leave space on the Story for a link sticker
          </label>
        </section>

        <section aria-labelledby="announce-previews" className="grid content-start gap-3">
          <h2 id="announce-previews" className="font-typewriter text-xs uppercase tracking-widest">
            Story and feed card
          </h2>
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex w-[230px] flex-col gap-2">
              <AnnouncementStory
                ref={storyRef}
                background={background}
                brandName={entityName}
                announcement={value}
                linkSpace={linkSpace}
                className="rounded-md shadow-md"
              />
              <Button
                type="button"
                className="border-2 border-mad-black bg-mad-black text-mad-white"
                disabled={!ready || busy != null}
                onClick={() => void saveStory()}
              >
                {busy === "story" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
                Save Story image
              </Button>
            </div>
            <div className="flex w-[280px] flex-col gap-2">
              <AnnouncementCard
                ref={cardRef}
                background={background}
                brandName={entityName}
                announcement={value}
                className="rounded-sm shadow-md"
              />
              <Button
                type="button"
                variant="outline"
                className="border-2 border-mad-black"
                disabled={!ready || busy != null}
                onClick={() => void sendCard()}
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

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<[T, string]>
  onChange: (next: T) => void
}) {
  return (
    <div className="grid gap-1 text-xs">
      <span className="font-typewriter uppercase tracking-widest">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={cn(
              "border px-2.5 py-1 text-xs",
              value === id
                ? "border-mad-black bg-mad-black text-mad-white"
                : "border-mad-black/30 hover:border-mad-black"
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, Globe, Loader2, Plus, Share2, X } from "lucide-react"
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
import { ANNOUNCEMENT_PREFILL_KEY } from "@/components/campaigns/campaign-planner"
import { completeActiveStep } from "@/lib/planner/campaign-progress"
import { findMoment, type MomentCard } from "@/lib/planner/nz-moments"
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

type CardDraft = { id: string; value: Announcement; backgroundId: string | null }

const MAX_CARDS = 10

function newCardId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function cleanCard(raw: { value?: Announcement; backgroundId?: string | null; id?: string }): CardDraft | null {
  if (!raw.value || typeof raw.value.headline !== "string") return null
  const details = padDetails(Array.isArray(raw.value.details) ? raw.value.details : [])
  return {
    id: raw.id ?? newCardId(),
    value: { ...BLANK, ...raw.value, details },
    backgroundId: raw.backgroundId ?? null,
  }
}

function readDraft(entityId: string): CardDraft[] | null {
  try {
    const raw = window.localStorage.getItem(draftKey(entityId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      cards?: Array<{ id?: string; value?: Announcement; backgroundId?: string | null }>
      value?: Announcement
      backgroundId?: string | null
    }
    const list = Array.isArray(parsed.cards) ? parsed.cards : [parsed]
    const cards = list.map(cleanCard).filter((card): card is CardDraft => card != null)
    return cards.length > 0 ? cards.slice(0, MAX_CARDS) : null
  } catch {
    return null
  }
}

function fromPreset(preset: Preset): CardDraft {
  return {
    id: newCardId(),
    value: { ...preset.value, details: padDetails(preset.value.details) },
    backgroundId: preset.background,
  }
}

/** A campaign step's card, handed over by Make it on the Campaigns page. */
function prefilledCard(): MomentCard | null {
  try {
    const raw = window.sessionStorage.getItem(ANNOUNCEMENT_PREFILL_KEY)
    window.sessionStorage.removeItem(ANNOUNCEMENT_PREFILL_KEY)
    const parsed = raw ? (JSON.parse(raw) as MomentCard) : null
    return parsed && typeof parsed.headline === "string" ? parsed : null
  } catch {
    return null
  }
}

/** The card for `?moment=` (an NZ date) or `?prefill=1` (a campaign step), or null. */
function cardForMoment(): CardDraft | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const id = params.get("moment")
  const moment = id ? findMoment(id, new Date()) : null
  const card = params.get("prefill") === "1" ? prefilledCard() : moment?.card ?? null
  if (!card) return null
  const base = EDITORIAL_PRESETS[0].value
  return {
    id: newCardId(),
    value: {
      ...base,
      kicker: card.kicker ?? "",
      headline: card.headline,
      script: card.script ?? "",
      headlineFont: card.headlineFont ?? "serif",
      accent: "brush",
      align: "center",
      details: padDetails(card.details),
    },
    backgroundId: card.background,
  }
}

/** The headline as one line, for captions and file names. */
function oneLine(text: string): string {
  return text.split(/\n/).map((part) => part.trim()).filter(Boolean).join(" ")
}

/** Sales, opening hours, events: a type-only Story and feed card in the kit. */
export function WlsAnnouncementWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  // Every card renders off screen too, so all of them can be saved at once.
  const storyRefs = useRef(new Map<string, HTMLDivElement>())
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  // Opened from Coming up: the moment's card joins the set, ready to edit.
  const [momentCard] = useState(() => cardForMoment())
  const [cards, setCards] = useState<CardDraft[]>(() => {
    const saved = readDraft(entityId) ?? []
    const list = momentCard ? [...saved, momentCard] : saved
    return list.length > 0 ? list.slice(-MAX_CARDS) : [fromPreset(EDITORIAL_PRESETS[0])]
  })
  const [activeId, setActiveId] = useState(() => momentCard?.id ?? cards[0].id)

  useEffect(() => {
    if (!momentCard) return
    // Drop ?moment= so a reload doesn't add the card again.
    const url = new URL(window.location.href)
    url.searchParams.delete("moment")
    url.searchParams.delete("prefill")
    window.history.replaceState(window.history.state, "", url.toString())
  }, [momentCard])
  const active = cards.find((card) => card.id === activeId) ?? cards[0]
  const value = active.value
  const backgroundId = active.backgroundId

  function updateActive(patch: (card: CardDraft) => CardDraft) {
    setCards((current) => current.map((card) => (card.id === active.id ? patch(card) : card)))
  }
  function setValue(next: Announcement | ((current: Announcement) => Announcement)) {
    updateActive((card) => ({ ...card, value: typeof next === "function" ? next(card.value) : next }))
  }
  function setBackgroundId(next: string | null) {
    updateActive((card) => ({ ...card, backgroundId: next }))
  }
  const editorial = value.style === "editorial"
  const presets = editorial ? EDITORIAL_PRESETS : PRESETS
  const [linkSpace, setLinkSpace] = useState(true)
  const [busy, setBusy] = useState<"story" | "studio" | "website" | null>(null)
  const [siteLink, setSiteLink] = useState("")
  const [siteUntil, setSiteUntil] = useState(() => {
    const until = new Date()
    until.setDate(until.getDate() + 14)
    return until.toISOString().slice(0, 10)
  })

  const kit = useMemo(
    () =>
      resolveStoryKit({
        presets: resolveVisualPresets({ brandName: entityName, industry, brandIdentity: brandIdentity as never }),
        isWornLabel: true,
      }),
    [entityName, industry, brandIdentity]
  )
  const backgroundFor = (id: string | null) => kit.find((bg) => bg.id === id) ?? kit[0]
  const background = backgroundFor(backgroundId)

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(entityId), JSON.stringify({ cards }))
    } catch {
      /* the draft just isn't remembered */
    }
  }, [entityId, cards])

  /** A new card in the same style: the next starting point, so the set varies. */
  function addCard() {
    const list = editorial ? EDITORIAL_PRESETS : PRESETS
    const used = new Set(cards.map((card) => oneLine(card.value.headline)))
    const preset = list.find((row) => !used.has(oneLine(row.value.headline))) ?? list[cards.length % list.length]
    const card = fromPreset(preset)
    setCards((current) => [...current, card].slice(0, MAX_CARDS))
    setActiveId(card.id)
  }

  function removeCard(id: string) {
    if (cards.length <= 1) return
    const index = cards.findIndex((card) => card.id === id)
    const next = cards.filter((card) => card.id !== id)
    setCards(next)
    if (id === active.id) setActiveId(next[Math.max(0, index - 1)].id)
  }

  function set<K extends keyof Announcement>(key: K, next: Announcement[K]) {
    setValue((current) => ({ ...current, [key]: next }))
  }

  function setDetail(index: number, text: string) {
    setValue((current) => ({
      ...current,
      details: current.details.map((line, i) => (i === index ? text : line)),
    }))
  }

  const readyCards = cards.filter((card) => card.value.headline.trim())

  async function saveStory() {
    setBusy("story")
    try {
      const baked: Array<{ dataUrl: string; blob: Blob; filename: string }> = []
      for (const [index, card] of readyCards.entries()) {
        const node = storyRefs.current.get(card.id)
        if (!node) continue
        baked.push({ ...(await bakeStoryPng(node)), filename: `wls-announcement-${index + 1}.png` })
      }
      if (baked.length === 0) return
      // Phone: one share sheet with every Story. Desktop: one download each.
      const files = baked.map((row) => new File([row.blob], row.filename, { type: "image/png" }))
      if (baked.length > 1 && navigator.canShare?.({ files })) {
        try {
          await navigator.share({ files })
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) throw error
        }
        return
      }
      let downloaded = 0
      for (const row of baked) {
        if ((await shareOrDownloadStory(row)) === "downloaded") downloaded++
      }
      if (downloaded > 0) toast.success(downloaded === 1 ? "Story image saved." : `${downloaded} Story images saved.`)
      void completeActiveStep(entityId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setBusy(null)
    }
  }

  async function sendCard() {
    setBusy("studio")
    try {
      const urls: string[] = []
      for (const card of readyCards) {
        const node = cardRefs.current.get(card.id)
        if (!node) continue
        const { blob } = await bakeStoryPng(node)
        urls.push(await uploadRenderedPng(blob, entityId))
      }
      if (urls.length === 0) throw new Error("Add a headline first.")
      // The caption follows the first card; more cards make a carousel.
      const first = readyCards[0].value
      const lines = first.details.map((line) => line.trim()).filter(Boolean)
      const caption = [
        [oneLine(first.kicker), oneLine(first.headline), first.script?.trim()].filter(Boolean).join(" "),
        "",
        ...lines,
      ].join("\n").trim()
      saveStudioSlidesHandoff(entityId, { urls, caption })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the card.")
      setBusy(null)
    }
  }

  /** The card being edited goes on the website home page until the date set. */
  async function putOnWebsite() {
    const node = cardRefs.current.get(active.id)
    if (!node || !value.headline.trim()) return
    setBusy("website")
    try {
      const { blob } = await bakeStoryPng(node)
      const imageUrl = await uploadRenderedPng(blob, entityId)
      const ends = siteUntil ? new Date(`${siteUntil}T23:59:59`) : null
      const response = await fetch("/api/website/announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          externalId: `announcement-${active.id}`,
          imageUrl,
          headline: [oneLine(value.headline), value.script?.trim()].filter(Boolean).join(" "),
          body: value.details.map((line) => line.trim()).filter(Boolean).join(" · ") || undefined,
          linkUrl: siteLink.trim() || undefined,
          endsAt: ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : undefined,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "Couldn't reach the website.")
      toast.success("On the website home page.")
      void completeActiveStep(entityId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't put it on the website.")
    } finally {
      setBusy(null)
    }
  }

  const ready = readyCards.length > 0
  const count = readyCards.length
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
          <ol className="flex flex-wrap items-start gap-2" aria-label="Cards">
            {cards.map((card, index) => (
              <li key={card.id} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveId(card.id)}
                  aria-pressed={card.id === active.id}
                  aria-label={`Edit card ${index + 1}`}
                  title={oneLine(card.value.headline) || `Card ${index + 1}`}
                  className={cn(
                    "block w-14 overflow-hidden rounded-sm border-2",
                    card.id === active.id ? "border-mad-black" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <AnnouncementCard background={backgroundFor(card.backgroundId)} brandName={entityName} announcement={card.value} />
                </button>
                {cards.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    title="Remove this card"
                    aria-label={`Remove card ${index + 1}`}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-mad-black bg-white text-mad-black hover:bg-mad-black hover:text-mad-white"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
            {cards.length < MAX_CARDS ? (
              <li>
                <button
                  type="button"
                  onClick={addCard}
                  title="Add another card"
                  aria-label="Add another card"
                  className="flex h-[4.4rem] w-14 items-center justify-center rounded-sm border-2 border-dashed border-mad-black/40 text-mad-black/70 hover:border-mad-black hover:text-mad-black"
                >
                  <Plus className="size-5" aria-hidden />
                </button>
              </li>
            ) : null}
          </ol>
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex w-[230px] flex-col gap-2">
              <AnnouncementStory
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
                {count > 1 ? `Save ${count} Story images` : "Save Story image"}
              </Button>
            </div>
            <div className="flex w-[280px] flex-col gap-2">
              <AnnouncementCard
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
                title={count > 1 ? "Open the cards in Studio as a carousel" : "Open the card in Studio to schedule it"}
              >
                {busy === "studio" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
                {count > 1 ? `Send ${count} cards to Studio` : "Send card to Studio"}
              </Button>
            </div>
          </div>
          <div className="grid max-w-[535px] gap-2 border-2 border-mad-black/15 bg-white p-3">
            <h3 className="flex items-center gap-1.5 font-typewriter text-xs uppercase tracking-widest">
              <Globe className="size-3.5" aria-hidden />
              Website home page
            </h3>
            <p className="text-xs text-mad-black/65">
              Shows the card you&apos;re editing on wornlabelsociety.co.nz until the date below.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="grid gap-1 text-xs">
                <span className="font-typewriter uppercase tracking-widest">Link to (optional)</span>
                <input
                  id="announce-site-link"
                  className={field}
                  value={siteLink}
                  maxLength={500}
                  placeholder="e.g. /shop or a product link"
                  onChange={(e) => setSiteLink(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-typewriter uppercase tracking-widest">Show until</span>
                <input
                  id="announce-site-until"
                  type="date"
                  className={field}
                  value={siteUntil}
                  onChange={(e) => setSiteUntil(e.target.value)}
                />
              </label>
            </div>
            <Button
              type="button"
              variant="outline"
              className="justify-self-start border-2 border-mad-black"
              disabled={!value.headline.trim() || busy != null}
              onClick={() => void putOnWebsite()}
            >
              {busy === "website" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Globe className="mr-2 size-4" />}
              Put on website
            </Button>
          </div>
        </section>
      </div>

      {/* Full-size copies of every card for saving; never shown. */}
      <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0" data-export-ignore="true">
        {cards.map((card) => (
          <div key={card.id} className="flex gap-4">
            <div className="w-[230px]">
              <AnnouncementStory
                ref={(node) => {
                  if (node) storyRefs.current.set(card.id, node)
                  else storyRefs.current.delete(card.id)
                }}
                background={backgroundFor(card.backgroundId)}
                brandName={entityName}
                announcement={card.value}
                linkSpace={linkSpace}
              />
            </div>
            <div className="w-[280px]">
              <AnnouncementCard
                ref={(node) => {
                  if (node) cardRefs.current.set(card.id, node)
                  else cardRefs.current.delete(card.id)
                }}
                background={backgroundFor(card.backgroundId)}
                brandName={entityName}
                announcement={card.value}
              />
            </div>
          </div>
        ))}
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

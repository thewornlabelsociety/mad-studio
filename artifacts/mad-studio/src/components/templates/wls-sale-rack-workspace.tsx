"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useSearch } from "wouter"
import { ArrowRight, CalendarPlus, Check, Link2, Loader2, RefreshCw, Scissors, Share2, Tag, X } from "lucide-react"
import { toast } from "sonner"

import { useDayDraftTarget, useSlidesOut } from "@/components/planner/day-draft-target"

import { colourLabel, DotSpecialPanel, dotSpecialCaption, useDotSpecial } from "@/components/templates/dot-special"
import { dayLabel, nextDraftDay, parseYmd, saveDayDrafts, type DayDraft } from "@/lib/planner/day-drafts"
import { StoryCardStyleMenu } from "@/components/templates/card-style-controls"
import { KitStoryCanvas } from "@/components/templates/kit-story-canvas"
import { SaleCoverSlide } from "@/components/templates/sale-slides"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { percentOff } from "@/lib/inventory/listing-markdown"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import {
  bakeStoryPng,
  copyStoryLink,
  shareOrDownloadStory,
  useKitStories,
  type KitStory,
} from "@/lib/templates/use-kit-stories"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { useRememberedState } from "@/lib/use-remembered-state"
import { pieceType, useStoryCardStyle } from "@/lib/templates/story-card-style"
import { cn } from "@/lib/utils"

/** A carousel takes the cover plus nine pieces. */
const SALE_SLIDES_MAX = 9

/** Quick picks for the line under the week on the cover. */
const COVER_NOTES = ["Menswear edit", "Womenswear edit", "Surf vibes", "Last chance"]

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

function money(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`
}

/** "WEEK OF 27 OCT": the Monday of this week. */
function thisWeekLabel(today = new Date()): string {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return `Week of ${monday.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}`.toUpperCase()
}

type SaleStory = KitStory & { was: number; now: number }

/** This week's sale rack from shop markdowns: a carousel for the feed and a Story per piece. */
export function WlsSaleRackWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  // Studio on its own screen; the day being filled when opened from the planner.
  const out = useSlidesOut(entityId)
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  const slideNodes = useRef<Array<HTMLDivElement | null>>([])
  const storyNodes = useRef<Record<string, HTMLDivElement | null>>({})
  // Ticked pieces are kept for the week, so leaving the screen keeps the carousel
  // and a new week starts from that week's latest markdowns.
  const [picked, setPicked] = useRememberedState<string[] | null>(`mad.saleRack.${entityId}.picked.${thisWeekLabel()}`, null)
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`mad.saleRack.${entityId}.background`, null)
  const [pieceBackgroundId, setPieceBackgroundId] = useRememberedState<string | null>(
    `mad.saleRack.${entityId}.pieceBackground`,
    null
  )
  // The line under the week on the cover, kept for the week like the picks.
  const [coverNote, setCoverNote] = useRememberedState<string>(`mad.saleRack.${entityId}.coverNote.${thisWeekLabel()}`, "")
  const note = coverNote.trim()
  // The same card look as every other Story.
  const [cardStyle, setCardStyle] = useStoryCardStyle(entityId)
  const [sending, setSending] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [special] = useDotSpecial(entityId)
  const dotStoryNode = useRef<HTMLDivElement | null>(null)
  // From the planner: ?day=2026-11-17 is the day to draft for, and ?draft=1
  // drafts straight away once the slides are ready.
  const search = useSearch()
  const query = useMemo(() => new URLSearchParams(search), [search])
  // In the planner's drawer, the day being filled wins.
  const target = useDayDraftTarget()
  const pickedDay = target?.day ?? parseYmd(query.get("day"))
  const draftDay = pickedDay ?? nextDraftDay()
  const autoDraft = query.get("draft") === "1"
  const autoDrafted = useRef(false)

  // Marked-down items, newest markdown first (needs the list before cutouts).
  const [saleIds, setSaleIds] = useState<string[]>([])
  const { kit, eligible, loaded, loading, reload, stories, cuttingId, cutoutFailed } = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: isWls,
    cutoutIds: saleIds,
  })

  useEffect(() => {
    const ids = eligible
      .filter((row) => row.wasPrice != null && row.price != null)
      .sort((a, b) => (b.discountedAt ?? "").localeCompare(a.discountedAt ?? ""))
      .map((row) => row.marketingEntityId)
    setSaleIds((current) => (current.join() === ids.join() ? current : ids))
  }, [eligible])

  useEffect(() => {
    if (picked === null && saleIds.length > 0) setPicked(saleIds.slice(0, SALE_SLIDES_MAX))
  }, [picked, saleIds])

  const sale = useMemo(
    () =>
      saleIds.flatMap((id) => {
        const story = stories.get(id)
        if (!story || story.row.wasPrice == null || story.row.price == null) return []
        return [{ ...story, was: story.row.wasPrice, now: Number(story.row.price) } as SaleStory]
      }),
    [saleIds, stories]
  )
  const chosen = sale.filter((item) => picked?.includes(item.row.marketingEntityId))
  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]
  // Every piece on one colour; until one is picked, the cover's.
  const pieceBackground = kit.find((bg) => bg.id === pieceBackgroundId) ?? background
  const waiting = chosen.filter((item) => !item.cutoutUrl && !cutoutFailed[item.row.marketingEntityId])

  function toggle(id: string) {
    setPicked((current) => {
      const list = current ?? []
      if (list.includes(id)) return list.filter((row) => row !== id)
      if (list.length >= SALE_SLIDES_MAX) {
        toast.message(`A carousel takes ${SALE_SLIDES_MAX} pieces after the cover.`)
        return list
      }
      return [...list, id]
    })
  }

  // No piece-by-piece list: brand, size and was/now are already on every slide.
  function caption(): string {
    return [
      note ? `This week on the sale rack: ${note}.` : "This week on the sale rack.",
      "",
      "One of each, so be quick. Shop through the link in our bio or come try on in store.",
    ].join("\n")
  }

  /** The cover and every picked piece as uploaded images, in carousel order. */
  async function bakeSlides(): Promise<string[]> {
    const urls: string[] = []
    for (const node of slideNodes.current.slice(0, chosen.length + 1)) {
      if (!node) continue
      const { blob } = await bakeStoryPng(node)
      urls.push(await uploadRenderedPng(blob, entityId))
    }
    return urls
  }

  /** The carousel and the dot special Story go on the day as drafts, then back to the planner. */
  async function draftForDay() {
    setDrafting(true)
    try {
      const drafts: DayDraft[] = []
      if (chosen.length > 0) {
        const urls = await bakeSlides()
        if (urls.length >= 2) {
          drafts.push({
            kind: "sale_rack",
            platforms: ["instagram_feed", "facebook"],
            title: note ? `Sale rack: ${note}` : "Sale rack",
            caption: caption(),
            mediaUrls: urls,
            hour: 11,
          })
        }
      }
      if (dotStoryNode.current) {
        const { blob } = await bakeStoryPng(dotStoryNode.current)
        const url = await uploadRenderedPng(blob, entityId)
        drafts.push({
          kind: "dot_special",
          platforms: ["instagram_story"],
          title: `${colourLabel(special.color)} dot special`,
          caption: dotSpecialCaption(special),
          mediaUrls: [url],
          hour: 9,
          data: { special, backgroundId: dotStoryNode.current.dataset.backgroundId ?? null },
        })
      }
      if (drafts.length === 0) throw new Error("Nothing to draft yet: pick some pieces first.")
      const { saved, skipped } = await saveDayDrafts({ entityId, day: draftDay, drafts })
      const name = (kind: string) => (kind === "sale_rack" ? "carousel" : "dot special Story")
      if (saved.length > 0) {
        toast.success(
          `${saved.length === 2 ? "Carousel and Story" : name(saved[0]).replace(/^./, (c) => c.toUpperCase())} drafted for ${dayLabel(draftDay)}. Approve in the planner.`
        )
      }
      if (skipped.length > 0) {
        toast.message(
          `${dayLabel(draftDay)}'s ${skipped.map(name).join(" and ")} ${skipped.length === 1 ? "is" : "are"} already approved, so ${skipped.length === 1 ? "it was" : "they were"} left as ${skipped.length === 1 ? "it is" : "they are"}. Unschedule in the planner to redraft.`
        )
      }
      if (target) target.onDrafted()
      else navigate(`/planner?eid=${encodeURIComponent(entityId)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the drafts.")
      setDrafting(false)
    }
  }

  // ?draft=1: draft once the markdowns are in and every picked piece is cut out.
  const hasMarkdowns = eligible.some((row) => row.wasPrice != null && row.price != null)
  useEffect(() => {
    if (!autoDraft || autoDrafted.current || !loaded || drafting) return
    // Markdowns found: wait for the list, the picks, their slides, and their cutouts.
    if (hasMarkdowns && (saleIds.length === 0 || picked === null || (picked.length > 0 && chosen.length === 0) || waiting.length > 0)) return
    autoDrafted.current = true
    setDrafting(true)
    // A beat for the slides' photos to paint before they're baked. Not cleared
    // on re-render: the screen keeps updating while it waits.
    window.setTimeout(() => void draftForDay(), 1200)
  })

  async function sendToStudio() {
    setSending(true)
    try {
      const urls = await bakeSlides()
      if (urls.length < 2) throw new Error("Pick at least one piece first.")
      await out.sendOut({ urls, caption: caption() })
      // Back from the finish panel: saved, or closed without saving.
      setSending(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the slides.")
      setSending(false)
    }
  }

  async function saveStory(item: SaleStory) {
    const node = storyNodes.current[item.row.marketingEntityId]
    if (!node) return
    setSavingId(item.row.marketingEntityId)
    try {
      const baked = await bakeStoryPng(node)
      const result = await shareOrDownloadStory({ ...baked, filename: `wls-sale-${item.row.websiteItemId}.png` })
      if (result === "downloaded") toast.success("Story image saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setSavingId(null)
    }
  }

  if (!isWls) {
    return (
      <div className="border-2 border-mad-black bg-white p-6 font-typewriter text-sm">
        The sale rack is only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Tuesday carousel and Stories · {thisWeekLabel()}
          </p>
          <h1 className="brand-typewriter text-xl">Sale rack</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Everything marked down in the shop, with the old price struck
            through. Untick anything you don&apos;t want in the carousel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StoryCardStyleMenu style={cardStyle} onChange={setCardStyle} background={background} className="size-9" />
          {/* The cover can stand apart; every piece shares one colour. */}
          {[
            { label: "Cover", current: background, set: setBackgroundId },
            { label: "Pieces", current: pieceBackground, set: setPieceBackgroundId },
          ].map((group) => (
            <div key={group.label} className="flex items-center gap-1.5" role="group" aria-label={`${group.label} colour`}>
              <span className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">{group.label}</span>
              {kit.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => group.set(bg.id)}
                  title={`${bg.name} for the ${group.label.toLowerCase()}`}
                  aria-label={`Use ${bg.name} for the ${group.label.toLowerCase()}`}
                  aria-pressed={bg.id === group.current.id}
                  className={cn(
                    "relative size-7 rounded-full border border-black/15",
                    bg.id === group.current.id && "ring-2 ring-mad-black ring-offset-2"
                  )}
                  style={{ background: bg.color }}
                >
                  {bg.id === group.current.id ? (
                    <Check className="absolute inset-0 m-auto size-3" style={{ color: bg.text_color }} aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="border-2 border-mad-black"
            disabled={loading}
            onClick={() => void reload()}
            title="Check the shop for markdowns"
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Reload
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-2 border-mad-black"
            disabled={waiting.length > 0 || sending || drafting || !loaded}
            onClick={() => void draftForDay()}
            title={
              waiting.length > 0
                ? "Waiting for cutouts"
                : `Put the carousel and the dot special Story on ${dayLabel(draftDay)} to approve`
            }
          >
            {drafting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CalendarPlus className="mr-2 size-4" />}
            {drafting ? "Drafting…" : `Draft for ${draftDay.toLocaleDateString("en-NZ", { weekday: "long" })}`}
          </Button>
          {/* In the drawer, Draft for <day> already adds the carousel (and the dot Story). */}
          {out.inDrawer ? null : (
            <Button
              type="button"
              className="border-2 border-mad-black bg-mad-black text-mad-white"
              disabled={chosen.length === 0 || waiting.length > 0 || sending || drafting}
              onClick={() => void sendToStudio()}
              title={waiting.length > 0 ? "Waiting for cutouts" : "Open the carousel in Studio"}
            >
              {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
              {sending ? "Preparing slides…" : out.label}
            </Button>
          )}
        </div>
      </header>

      {autoDraft && (drafting || !autoDrafted.current) ? (
        <p role="status" className="flex items-center gap-2 border-2 border-mad-black bg-mad-lime/30 px-3 py-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {drafting
            ? `Saving the drafts for ${dayLabel(draftDay)}…`
            : waiting.length > 0
              ? `Cutting out ${waiting.length} piece${waiting.length === 1 ? "" : "s"}, then drafting for ${dayLabel(draftDay)}…`
              : `Getting the slides ready to draft for ${dayLabel(draftDay)}…`}
        </p>
      ) : null}

      {!loaded ? (
        <p className="flex items-center gap-2 text-sm text-mad-black/60">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking the shop for markdowns…
        </p>
      ) : sale.length === 0 ? (
        <div className="max-w-xl border-2 border-dashed border-mad-black/40 bg-white p-5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Tag className="size-4" aria-hidden /> Nothing is marked down in the shop right now.
          </p>
          <p className="mt-2 text-mad-black/70">
            Mark pieces down in your shop admin, then press Refresh feed on{" "}
            <Link href={`/today?eid=${encodeURIComponent(entityId)}`} className="underline">
              Today
            </Link>
            . They&apos;ll show up here with the old and new price.
          </p>
        </div>
      ) : (
        <>
          <section aria-labelledby="sale-carousel" className="grid gap-3">
            <h2 id="sale-carousel" className="font-typewriter text-xs uppercase tracking-widest">
              Carousel · {chosen.length + 1} slides
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs">
                <span className="font-typewriter uppercase tracking-widest">Text under the week (optional)</span>
                <input
                  id="sale-cover-note"
                  className="h-9 w-64 border-2 border-mad-black bg-white px-2 text-sm"
                  value={coverNote}
                  maxLength={40}
                  placeholder="e.g. Menswear edit"
                  onChange={(event) => setCoverNote(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ideas for the text under the week">
                {COVER_NOTES.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setCoverNote(idea)}
                    aria-pressed={note.toLowerCase() === idea.toLowerCase()}
                    className={cn(
                      "h-9 border border-mad-black/30 px-2.5 text-xs hover:border-mad-black",
                      note.toLowerCase() === idea.toLowerCase() && "border-mad-black bg-mad-lime"
                    )}
                  >
                    {idea}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCoverNote("")}
                  disabled={!note}
                  title="Clear the text under the week"
                  aria-label="Clear the text under the week"
                  className="flex size-9 items-center justify-center border border-mad-black/30 hover:border-mad-black disabled:opacity-40"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
            <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <li className="min-w-0">
                <SaleCoverSlide
                  ref={(node) => {
                    slideNodes.current[0] = node
                  }}
                  background={background}
                  brandName={entityName}
                  weekLabel={thisWeekLabel(pickedDay ?? undefined)}
                  note={note}
                  className="rounded-sm shadow-md"
                />
              </li>
              {chosen.map((item, index) => (
                <li key={item.row.marketingEntityId} className="min-w-0">
                  {/* The Today Story card at feed size, in the shared card style, every piece on one colour with its % off dot. */}
                  <KitStoryCanvas
                    ref={(node) => {
                      slideNodes.current[index + 1] = node
                    }}
                    story={false}
                    background={pieceBackground}
                    percentOff={percentOff(item.was, item.now)}
                    brandName={entityName}
                    tag="Sale"
                    imageUrl={item.cutoutUrl ? item.imageUrl : null}
                    vibe={item.vibe}
                    designer={item.designer}
                    sizeLabel={item.sizeLabel}
                    categoryLabel={pieceType(item.row.title, item.row.brand)}
                    priceLine={{ was: money(item.was), now: money(item.now) }}
                    cardStyle={cardStyle}
                    showLinkGuide={false}
                    className="rounded-sm shadow-md"
                  />
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="sale-pieces" className="grid gap-3">
            <h2 id="sale-pieces" className="font-typewriter text-xs uppercase tracking-widest">
              Marked down · {sale.length}
            </h2>
            <ul className="flex snap-x gap-4 overflow-x-auto pb-2">
              {sale.map((item) => {
                const id = item.row.marketingEntityId
                const inCarousel = Boolean(picked?.includes(id))
                const ready = Boolean(item.cutoutUrl) || Boolean(cutoutFailed[id])
                return (
                  <li key={id} className="flex w-[200px] shrink-0 snap-start flex-col gap-2">
                    <div className="relative overflow-hidden rounded-md shadow-md">
                      <KitStoryCanvas
                        ref={(node) => {
                          storyNodes.current[id] = node
                        }}
                        background={item.background}
                        brandName={entityName}
                        tag="Sale"
                        imageUrl={ready ? item.imageUrl : null}
                        vibe={item.vibe}
                        designer={item.designer}
                        sizeLabel={item.sizeLabel}
                        categoryLabel={pieceType(item.row.title, item.row.brand)}
                        priceLine={{ was: money(item.was), now: money(item.now) }}
                        cardStyle={cardStyle}
                        showLinkGuide={false}
                      />
                      {!ready ? (
                        <div
                          className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-1 text-[11px]"
                          style={{ color: item.background.text_color }}
                        >
                          <Scissors className={cn("size-4", cuttingId === id && "animate-pulse")} aria-hidden />
                          {cuttingId === id ? "Cutting out…" : "Waiting to cut out"}
                        </div>
                      ) : null}
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        id={`sale-pick-${id}`}
                        type="checkbox"
                        checked={inCarousel}
                        onChange={() => toggle(id)}
                      />
                      In the carousel
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => void saveStory(item)}
                        disabled={!ready || savingId != null}
                        className="flex h-8 items-center justify-center gap-1.5 bg-mad-black text-xs text-mad-white disabled:opacity-40"
                      >
                        {savingId === id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
                        Story
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyStoryLink(item.row.destinationUrl)}
                        disabled={!item.row.destinationUrl}
                        className="flex h-8 items-center justify-center gap-1.5 border-2 border-mad-black text-xs disabled:opacity-40"
                      >
                        <Link2 className="size-3.5" aria-hidden /> Link
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      <DotSpecialPanel
        entityId={entityId}
        entityName={entityName}
        kit={kit}
        ready={loaded}
        onStoryNode={(node) => {
          dotStoryNode.current = node
        }}
        draft={{
          label: `Draft for ${draftDay.toLocaleDateString("en-NZ", { weekday: "long" })}`,
          busy: drafting,
          disabled: waiting.length > 0 || sending || !loaded,
          onClick: () => void draftForDay(),
        }}
      />
    </div>
  )
}

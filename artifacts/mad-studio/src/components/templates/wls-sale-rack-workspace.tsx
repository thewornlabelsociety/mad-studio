"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation } from "wouter"
import { ArrowRight, Check, Link2, Loader2, RefreshCw, Scissors, Share2, Tag } from "lucide-react"
import { toast } from "sonner"

import { KitStoryCanvas } from "@/components/templates/kit-story-canvas"
import { SaleCoverSlide, SaleItemSlide } from "@/components/templates/sale-slides"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { percentOff } from "@/lib/inventory/listing-markdown"
import { formatSizeForText } from "@/lib/studio/canvas-size-tag-label"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import {
  bakeStoryPng,
  copyStoryLink,
  shareOrDownloadStory,
  useKitStories,
  type KitStory,
} from "@/lib/templates/use-kit-stories"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { useRememberedState } from "@/lib/use-remembered-state"
import { cn } from "@/lib/utils"

/** A carousel takes the cover plus nine pieces. */
const SALE_SLIDES_MAX = 9

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
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  const slideNodes = useRef<Array<HTMLDivElement | null>>([])
  const storyNodes = useRef<Record<string, HTMLDivElement | null>>({})
  // Ticked pieces and background are kept, so leaving the screen keeps the carousel.
  const [picked, setPicked] = useRememberedState<string[] | null>(`mad.saleRack.${entityId}.picked`, null)
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`mad.saleRack.${entityId}.background`, null)
  const [sending, setSending] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

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

  function caption(): string {
    const lines = chosen.map((item) => {
      const size = formatSizeForText(item.row.size)
      return `${item.designer}${size ? ` (${size})` : ""}: was ${money(item.was)}, now ${money(item.now)}`
    })
    return [
      "This week on the sale rack.",
      "",
      ...lines,
      "",
      "One of each, so be quick. Shop through the link in our bio or come see them in store.",
    ].join("\n")
  }

  async function sendToStudio() {
    setSending(true)
    try {
      const urls: string[] = []
      for (const node of slideNodes.current.slice(0, chosen.length + 1)) {
        if (!node) continue
        const { blob } = await bakeStoryPng(node)
        urls.push(await uploadRenderedPng(blob, entityId))
      }
      if (urls.length < 2) throw new Error("Pick at least one piece first.")
      saveStudioSlidesHandoff(entityId, { urls, caption: caption() })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
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
            Thursday carousel and Stories · {thisWeekLabel()}
          </p>
          <h1 className="brand-typewriter text-xl">Sale rack</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Everything marked down in the shop, with the old price struck
            through. Untick anything you don&apos;t want in the carousel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Carousel background">
            {kit.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackgroundId(bg.id)}
                title={bg.name}
                aria-label={`Use ${bg.name} for the carousel`}
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
            className="border-2 border-mad-black bg-mad-black text-mad-white"
            disabled={chosen.length === 0 || waiting.length > 0 || sending}
            onClick={() => void sendToStudio()}
            title={waiting.length > 0 ? "Waiting for cutouts" : "Open the carousel in Studio"}
          >
            {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
            {sending ? "Preparing slides…" : "Send to Studio"}
          </Button>
        </div>
      </header>

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
            <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <li className="min-w-0">
                <SaleCoverSlide
                  ref={(node) => {
                    slideNodes.current[0] = node
                  }}
                  background={background}
                  brandName={entityName}
                  weekLabel={thisWeekLabel()}
                  className="rounded-sm shadow-md"
                />
              </li>
              {chosen.map((item, index) => (
                <li key={item.row.marketingEntityId} className="min-w-0">
                  <SaleItemSlide
                    ref={(node) => {
                      slideNodes.current[index + 1] = node
                    }}
                    background={background}
                    brandName={entityName}
                    imageUrl={item.cutoutUrl ? item.imageUrl : null}
                    designer={item.designer}
                    sizeLabel={item.sizeLabel}
                    wasLabel={money(item.was)}
                    nowLabel={money(item.now)}
                    percentOff={percentOff(item.was, item.now)}
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
                        priceLine={{ was: money(item.was), now: money(item.now) }}
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
    </div>
  )
}

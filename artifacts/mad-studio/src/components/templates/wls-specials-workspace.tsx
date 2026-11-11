"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, Link2, Loader2, RefreshCw, Scissors, Share2, X } from "lucide-react"
import { toast } from "sonner"

import { StoryCardStyleMenu } from "@/components/templates/card-style-controls"
import { colourLabel, DotSpecialArt, DotSpecialFields, useDotSpecial } from "@/components/templates/dot-special"
import { KitStoryCanvas } from "@/components/templates/kit-story-canvas"
import { PiecePicker, type PickerOption } from "@/components/templates/piece-picker"
import { SaleItemSlide } from "@/components/templates/sale-slides"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { percentOff } from "@/lib/inventory/listing-markdown"
import { WORN_LABEL_TAG_COLORS } from "@/lib/social-creative/worn-label-promo-theme"
import { formatSizeForText } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { parseDotDiscount, specialPrice } from "@/lib/templates/dot-specials"
import { dotSpecialsForWeek, mondayOf, nzToday, type DotSpecialWeek } from "@/lib/templates/dot-rotation"
import type { WornLabelTagColorName } from "@/types/social-creative"
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
const SPECIALS_MAX = 9

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

function money(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`
}

/** A piece on the special: its price now, and with the dot taken off. */
type SpecialStory = KitStory & { was: number; now: number | null }

/** This week's dot special: the dot card, then a card per piece with the price before and after. */
export function WlsSpecialsWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  const slideNodes = useRef<Array<HTMLDivElement | null>>([])
  const storyNodes = useRef<Record<string, HTMLDivElement | null>>({})
  // The same dot as the Colour dot special on the sale rack, so the two always match.
  const [special, setSpecial] = useDotSpecial(entityId)
  // The website's own rotation: this week's 25% dot, then its 50% dot.
  const weekSpecials = useMemo(() => dotSpecialsForWeek(), [])
  const [appliedWeek, setAppliedWeek] = useRememberedState<string | null>(`mad.specials.${entityId}.week`, null)
  function applyWebsiteDot(row: DotSpecialWeek) {
    setSpecial((current) => ({
      ...current,
      color: row.colour.toUpperCase() as WornLabelTagColorName,
      discount: `${row.percent}% off`,
      when: "This week only",
    }))
  }
  // A new week: start from the dot the website has on special.
  useEffect(() => {
    const monday = mondayOf(nzToday())
    if (appliedWeek === monday || weekSpecials.length === 0) return
    setAppliedWeek(monday)
    applyWebsiteDot(weekSpecials[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedWeek, weekSpecials])
  const [pieceIds, setPieceIds] = useRememberedState<string[]>(`mad.specials.${entityId}.pieces`, [])
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`mad.specials.${entityId}.background`, null)
  const [cardStyle, setCardStyle] = useStoryCardStyle(entityId)
  const [sending, setSending] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const { kit, eligible, loaded, loading, reload, stories, cuttingId, cutoutFailed } = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: isWls,
    cutoutIds: pieceIds,
  })

  // Kept pieces may have sold since: drop them.
  useEffect(() => {
    if (!loaded || loading || eligible.length === 0) return
    const inStock = new Set(eligible.map((row) => row.marketingEntityId))
    if (pieceIds.every((id) => inStock.has(id))) return
    setPieceIds(pieceIds.filter((id) => inStock.has(id)))
  }, [loaded, loading, eligible, pieceIds, setPieceIds])

  const discount = parseDotDiscount(special.discount)
  const dotSpec = WORN_LABEL_TAG_COLORS[special.color]
  const dot = { hex: dotSpec.hex, text: dotSpec.contrastText }
  const dotName = `${colourLabel(special.color)} dot`
  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]

  const pieces = useMemo(
    () =>
      pieceIds.flatMap((id) => {
        const story = stories.get(id)
        if (!story || story.row.price == null) return []
        // Already marked down on the website: its sale price is the special
        // price, so don't take the discount off a second time.
        if (story.row.wasPrice != null) {
          return [{ ...story, was: Number(story.row.wasPrice), now: Number(story.row.price) } as SpecialStory]
        }
        const was = Number(story.row.price)
        return [{ ...story, was, now: discount ? specialPrice(was, discount) : null } as SpecialStory]
      }),
    [pieceIds, stories, discount?.kind, discount?.value]
  )
  const waiting = pieces.filter((item) => !item.cutoutUrl && !cutoutFailed[item.row.marketingEntityId])

  // The website sends each piece's tag dot; older syncs don't, so fall back
  // to "marked down" until the next sync brings the dots in.
  const activeDot = colourLabel(special.color)
  const stockHasDots = useMemo(() => eligible.some((row) => row.dotColour), [eligible])
  const inFilter = (row: (typeof eligible)[number]) =>
    stockHasDots ? row.dotColour === activeDot : row.wasPrice != null

  /** Priced stock not already on the special, for the search panel. */
  const options: PickerOption[] = useMemo(
    () =>
      // This dot's pieces first, then other markdowns (newest first), then the rest.
      [...eligible]
        .sort((a, b) => {
          const aDot = inFilter(a)
          const bDot = inFilter(b)
          if (aDot !== bDot) return aDot ? -1 : 1
          const aDown = a.wasPrice != null
          const bDown = b.wasPrice != null
          if (aDown !== bDown) return aDown ? -1 : 1
          return (b.discountedAt ?? "").localeCompare(a.discountedAt ?? "")
        })
        .flatMap((row) => {
        if (pieceIds.includes(row.marketingEntityId) || row.price == null) return []
        const story = stories.get(row.marketingEntityId)
        if (!story) return []
        const image = story.cutoutUrl ?? row.sourceImageUrls[0] ?? null
        return [
          {
            id: row.marketingEntityId,
            brand: story.designer,
            title: row.title,
            detail: [
              formatSizeForText(row.size),
              row.wasPrice != null
                ? `${money(Number(row.price))} (was ${money(row.wasPrice)})`
                : money(Number(row.price)),
              row.dotColour ? `${row.dotColour} dot` : null,
              row.vibe,
            ]
              .filter(Boolean)
              .join(" · "),
            thumb: image ? proxiedImageUrl(image, entityId) : null,
            searchText: [row.title, row.brand, row.description, row.category, row.vibe, row.size, row.dotColour ? `${row.dotColour} dot` : null]
              .filter(Boolean)
              .join(" "),
            markedDown: inFilter(row),
          },
        ]
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligible, pieceIds, stories, entityId, activeDot, stockHasDots]
  )

  function addPiece(id: string) {
    if (pieceIds.length >= SPECIALS_MAX) {
      toast.message(`A carousel takes ${SPECIALS_MAX} pieces after the dot card.`)
      return
    }
    setPieceIds([...pieceIds, id])
  }

  function caption(): string {
    const lines = pieces.map((item) => {
      const size = formatSizeForText(item.row.size)
      const price = item.now == null ? money(item.was) : `was ${money(item.was)}, now ${money(item.now)}`
      return `${item.designer}${size ? ` (${size})` : ""}: ${price}`
    })
    return [
      `${dotName}: ${special.discount}. ${special.when}.`.replace(/\.\./g, "."),
      `Look for the ${colourLabel(special.color).toLowerCase()} dot on the tag.`,
      "",
      ...lines,
      "",
      "Shop through the link in our bio or come see them in store.",
      special.footer,
    ]
      .join("\n")
      .trim()
  }

  async function sendToStudio() {
    setSending(true)
    try {
      const urls: string[] = []
      for (const node of slideNodes.current.slice(0, pieces.length + 1)) {
        if (!node) continue
        const { blob } = await bakeStoryPng(node)
        urls.push(await uploadRenderedPng(blob, entityId))
      }
      if (urls.length < 2) throw new Error("Add at least one piece first.")
      saveStudioSlidesHandoff(entityId, { urls, caption: caption() })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the slides.")
      setSending(false)
    }
  }

  async function saveStory(item: SpecialStory) {
    const node = storyNodes.current[item.row.marketingEntityId]
    if (!node) return
    setSavingId(item.row.marketingEntityId)
    try {
      const baked = await bakeStoryPng(node)
      const result = await shareOrDownloadStory({
        ...baked,
        filename: `wls-${special.color.toLowerCase()}-dot-${item.row.websiteItemId}.png`,
      })
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
        Specials are only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Carousel and Stories · {dotName}
          </p>
          <h1 className="brand-typewriter text-xl">This week&apos;s specials</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Pick the dot and the discount, then add the pieces from the website
            that carry it. Each card shows the price before and after.
          </p>
          {weekSpecials.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="This week's dot specials on the website">
              <span className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
                On the website this week
              </span>
              {weekSpecials.map((row) => {
                const name = row.colour.toUpperCase() as WornLabelTagColorName
                const active = special.color === name && discount?.kind === "percent" && discount.value === row.percent
                return (
                  <button
                    key={`${row.colour}-${row.percent}`}
                    type="button"
                    onClick={() => applyWebsiteDot(row)}
                    aria-pressed={active}
                    title={`Use the ${row.colour.toLowerCase()} dot at ${row.percent}% off (tagged ${row.taggedFrom} to ${row.taggedTo})`}
                    className={cn(
                      "flex h-7 items-center gap-1.5 border-2 border-mad-black px-2 text-xs",
                      active ? "bg-mad-black text-mad-white" : "bg-white hover:bg-[#F4EFE6]"
                    )}
                  >
                    <span
                      className="size-3 rounded-full ring-1 ring-white/70"
                      style={{ background: WORN_LABEL_TAG_COLORS[name]?.hex }}
                      aria-hidden
                    />
                    {row.colour} dot · {row.percent}% off
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StoryCardStyleMenu style={cardStyle} onChange={setCardStyle} background={background} className="size-9" />
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
            title="Check the website for stock"
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Reload
          </Button>
          <Button
            type="button"
            className="border-2 border-mad-black bg-mad-black text-mad-white"
            disabled={pieces.length === 0 || waiting.length > 0 || !discount || sending}
            onClick={() => void sendToStudio()}
            title={
              !discount
                ? "Type the discount as 25% off or $10 off"
                : waiting.length > 0
                  ? "Waiting for cutouts"
                  : "Open the carousel in Studio"
            }
          >
            {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
            {sending ? "Preparing slides…" : "Send to Studio"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <DotSpecialFields special={special} onChange={setSpecial} />
          {!discount ? (
            <p className="text-xs text-[#9B2C2C]">
              Type the discount as a percentage (25% off) or dollars off ($10 off) to work out the prices.
            </p>
          ) : null}

          <section aria-labelledby="specials-pieces" className="grid gap-2">
            <h2 id="specials-pieces" className="font-typewriter text-xs uppercase tracking-widest">
              On the special · {pieces.length}
            </h2>
            {pieces.length > 0 ? (
              <ul className="grid gap-1.5">
                {pieces.map((item) => (
                  <li key={item.row.marketingEntityId} className="flex items-center gap-2 border border-mad-black/20 bg-white px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{item.designer}</span>
                      {item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {item.now == null ? (
                        money(item.was)
                      ) : (
                        <>
                          <span className="text-mad-black/50 line-through">{money(item.was)}</span> {money(item.now)}
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPieceIds(pieceIds.filter((id) => id !== item.row.marketingEntityId))}
                      title={`Take ${item.designer} off the special`}
                      aria-label={`Take ${item.designer} off the special`}
                      className="grid size-6 shrink-0 place-items-center hover:bg-[#F4EFE6]"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : loaded ? (
              <p className="text-xs text-mad-black/60">Nothing on the special yet. Search the stock to add pieces.</p>
            ) : (
              <p className="flex items-center gap-2 text-xs text-mad-black/60">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading stock from the website…
              </p>
            )}
            {loaded && pieces.length < SPECIALS_MAX ? (
              <div>
                <PiecePicker label="piece" adding addText="Add a piece" options={options}
                  onPick={addPiece}
                  markedDownOnly
                  filterLabel={stockHasDots ? `${activeDot} dot` : "Marked down"}
                />
              </div>
            ) : null}
          </section>
        </div>

        <div className="grid content-start gap-6">
          <section aria-labelledby="specials-carousel" className="grid gap-3">
            <h2 id="specials-carousel" className="font-typewriter text-xs uppercase tracking-widest">
              Carousel · {pieces.length + 1} slides
            </h2>
            <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              <li className="min-w-0">
                <DotSpecialArt
                  ref={(node) => {
                    slideNodes.current[0] = node
                  }}
                  special={special}
                  background={background}
                  brandName={entityName}
                  aspect="card"
                  className="rounded-sm shadow-md"
                />
              </li>
              {pieces.map((item, index) => (
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
                    wasLabel={item.now == null ? "" : money(item.was)}
                    nowLabel={money(item.now ?? item.was)}
                    percentOff={item.now == null ? 0 : percentOff(item.was, item.now)}
                    kicker={`${dotName} special`}
                    dot={dot}
                    className="rounded-sm shadow-md"
                  />
                </li>
              ))}
            </ol>
          </section>

          {pieces.length > 0 ? (
            <section aria-labelledby="specials-stories" className="grid gap-3">
              <h2 id="specials-stories" className="font-typewriter text-xs uppercase tracking-widest">
                Stories · one per piece
              </h2>
              <ul className="flex snap-x gap-4 overflow-x-auto pb-2">
                {pieces.map((item) => {
                  const id = item.row.marketingEntityId
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
                          tag={dotName}
                          imageUrl={ready ? item.imageUrl : null}
                          vibe={item.vibe}
                          designer={item.designer}
                          sizeLabel={item.sizeLabel}
                          categoryLabel={pieceType(item.row.title, item.row.brand)}
                          priceLabel={item.now == null ? money(item.was) : null}
                          priceLine={item.now == null ? null : { was: money(item.was), now: money(item.now) }}
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
                          title="Copy the website link for the Story's link sticker"
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
          ) : null}
        </div>
      </div>
    </div>
  )
}

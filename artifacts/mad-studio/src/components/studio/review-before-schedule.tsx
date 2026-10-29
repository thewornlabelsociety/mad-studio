"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Loader2, Smartphone } from "lucide-react"

import { StoryCanvas } from "@/components/marketing/story-canvas"
import type { StoryPreviewState } from "@/components/marketing/multi-platform-simulator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import {
  bakeCanvasTextOnImage,
  bakeStoryFrame,
} from "@/lib/media/bake-canvas-text"
import { canvasBackdropOn, canvasTextOnly } from "@/lib/studio/canvas-text-types"
import {
  SQUARE_FEED_SHAPE,
  STORY_SHAPE,
  fitImageToShape,
  fitImageToShapeCover,
} from "@/lib/media/fit-to-platform"
import { buildBasicStoryModel } from "@/lib/marketing/story-presets"
import {
  CHANNEL_META,
  formatSlotLabel,
  type ChannelSlot,
  type SchedulerChannel,
} from "@/lib/scheduling/brain-timing"
import { packPayloadFor } from "@/lib/scheduling/pack-payload"
import {
  isTikTokVideoUrl,
  tikTokMediaGuardError,
} from "@/lib/social/tiktok-media-guard"
import {
  partitionFormulaSlotGaps,
  unfilledFormulaSlots,
} from "@/lib/studio/formula-bank"
import type { CanvasTextOverlayState } from "@/lib/studio/canvas-text-types"
import {
  imageAspectRatio,
  proxiedImageUrl,
  renderStoryCardToUrl,
} from "@/lib/studio/final-artwork"
import { cn } from "@/lib/utils"

export type MediaByChannel = Partial<Record<SchedulerChannel, string>>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  brandName: string
  pack: CampaignPack
  /** Enabled channel slots, in the order they'll be queued. */
  slots: ChannelSlot[]
  /** The public photo Studio would otherwise send to every channel. */
  photoUrl: string
  textOverlay: CanvasTextOverlayState
  storyPreview: StoryPreviewState
  /** Studio renders a story card (cutout on the brand canvas) for IG Story. */
  useStoryCard: boolean
  storyHeadline: string
  visualPresets: VisualPresets | null
  slugSeed?: string | null
  /**
   * Every photo in the tray, in order, with that photo's own on-image text.
   * With 2+, Instagram feed, Facebook and TikTok post them as one carousel
   * (each slide baked with its own text); Story posts every tray still as
   * consecutive frames when 2+; email uses the selected photo.
   */
  carouselSlides?: Array<{
    url: string
    overlay: CanvasTextOverlayState | null
  }>
  onDropChannel: (channel: SchedulerChannel) => void
  onConfirm: (
    mediaByChannel: MediaByChannel,
    carouselUrls: string[] | null,
    storyUrls: string[] | null
  ) => void
  confirming: boolean
}

type Artwork = {
  feed: string
  story: string
  slides: string[]
  storySlides: string[]
}

const CAROUSEL_CHANNELS: SchedulerChannel[] = ["instagram_feed", "facebook", "tiktok"]
const CAROUSEL_MAX = 10

/** Instagram's caption ceiling; TikTok's API caption uses the same. */
const CAPTION_LIMIT = 2200
const HASHTAG_LIMIT = 30

const FRAME: Record<SchedulerChannel, string> = {
  instagram_story: "aspect-[9/16]",
  tiktok: "aspect-[9/16]",
  instagram_feed: "aspect-square",
  facebook: "aspect-[4/5]",
  email: "aspect-[16/10]",
}

function channelNote(
  channel: SchedulerChannel,
  carousel: boolean
): {
  auto: boolean
  text: string
} {
  if (channel === "tiktok" && carousel) {
    return {
      auto: true,
      text: "Posts as a TikTok photo carousel if TikTok is connected in Socials, with a sound TikTok picks — swap it for a trending one in the app.",
    }
  }
  switch (channel) {
    case "instagram_story":
      return {
        auto: true,
        text: "Posts automatically as consecutive Story frames when the tray has 2+ photos (same order as the carousel). No link sticker via API — add links on your phone if needed.",
      }
    case "tiktok":
      return {
        auto: true,
        text: "Sends to TikTok if it's connected in Socials. Add trending sounds in the TikTok app.",
      }
    case "email":
      return { auto: true, text: "Sends to your VIP email list." }
    default:
      return { auto: true, text: "Posts automatically." }
  }
}

function problemsFor(input: {
  channel: SchedulerChannel
  caption: string
  mediaUrl: string | null
  /** Slides this channel posts as one carousel, if any. */
  slides: string[] | null
  aspect: number | null
  slot: ChannelSlot
}): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = []
  const warnings: string[] = []
  const { channel, caption, aspect, slot } = input

  if (slot.mode === "scheduled" && Date.parse(slot.scheduledAt) < Date.now()) {
    blocking.push("This time has passed — pick a new time on the Schedule step.")
  }
  const gaps = unfilledFormulaSlots(caption)
  const formulaGaps = partitionFormulaSlotGaps(gaps)
  if (formulaGaps.blocking.length) {
    blocking.push(
      `Fill in ${formulaGaps.blocking.join(", ")} in the formula fields (or Fine-tune) before posting.`
    )
  }
  if (formulaGaps.warnings.length) {
    warnings.push(
      `Formula placeholders ${formulaGaps.warnings.join(", ")} — OK for preview; fill on Schedule (Formula bank) or Fine-tune before a live post.`
    )
  }
  if (channel === "tiktok" && input.mediaUrl) {
    const tiktok = tikTokMediaGuardError(input.mediaUrl, input.slides)
    if (tiktok) blocking.push(tiktok)
  }
  if (channel !== "email" && caption.length > CAPTION_LIMIT) {
    blocking.push(
      `Caption is ${caption.length} characters — the limit is ${CAPTION_LIMIT}.`
    )
  }
  const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0
  if (channel === "instagram_feed" || channel === "instagram_story") {
    if (hashtags > HASHTAG_LIMIT) {
      blocking.push(`${hashtags} hashtags — Instagram allows ${HASHTAG_LIMIT}.`)
    }
  }
  if (channel === "instagram_feed" && aspect != null) {
    if (aspect < 0.79) {
      blocking.push(
        "Image is taller than 4:5 — Instagram rejects feed photos this tall. Crop it first."
      )
    } else if (aspect > 1.92) {
      blocking.push(
        "Image is wider than 1.91:1 — Instagram rejects feed photos this wide."
      )
    }
  }
  if (channel === "instagram_story" && aspect != null && Math.abs(aspect - 9 / 16) > 0.05) {
    warnings.push(
      "Not a 9:16 image — Instagram will show it with bars above and below."
    )
  }
  return { blocking, warnings }
}

/**
 * Last stop before scheduling: prepares the finished artwork for each channel
 * (on-image text baked in, story card rendered) and shows exactly what each
 * one will post — image, caption and time — with anything that would fail.
 */
export function ReviewBeforeSchedule({
  open,
  onOpenChange,
  entityId,
  brandName,
  pack,
  slots,
  photoUrl,
  textOverlay,
  storyPreview,
  useStoryCard,
  storyHeadline,
  visualPresets,
  slugSeed = null,
  carouselSlides = [],
  onDropChannel,
  onConfirm,
  confirming,
}: Props) {
  const storyRef = useRef<HTMLDivElement>(null)
  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [aspects, setAspects] = useState<Record<string, number | null>>({})
  const [slideAspects, setSlideAspects] = useState<Array<number | null>>([])
  const isCarousel = carouselSlides.length >= 2
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const preparedKey = useRef<string | null>(null)

  const hasStory = slots.some((slot) => slot.channel === "instagram_story")
  const storyCardImage =
    storyPreview.cutoutMode !== "original" && storyPreview.cutoutImageUrl
      ? storyPreview.cutoutImageUrl
      : photoUrl
  const renderStoryCard = useStoryCard && hasStory

  const inputsKey = JSON.stringify([
    photoUrl,
    carouselSlides,
    textOverlay,
    renderStoryCard ? [storyPreview, storyHeadline, visualPresets] : null,
  ])

  useEffect(() => {
    if (!open || preparedKey.current === inputsKey) return
    let cancelled = false
    setPreparing(true)
    setError(null)
    setArtwork(null)
    void (async () => {
      try {
        const baked = await bakeCanvasTextOnImage({
          entityId,
          sourceUrl: photoUrl,
          overlay: textOverlay,
        })
        const feed = await fitImageToShapeCover({
          entityId,
          sourceUrl: baked,
          shape: SQUARE_FEED_SHAPE,
        })
        let story = await fitImageToShape({
          entityId,
          sourceUrl: baked,
          shape: STORY_SHAPE,
          fillColor: "#000000",
        })
        if (renderStoryCard) {
          // Let the offscreen card's images finish loading before capture.
          await new Promise((resolve) => setTimeout(resolve, 400))
          const node = storyRef.current
          if (!node) throw new Error("Story card isn't ready yet.")
          await Promise.all(
            [...node.querySelectorAll("img")].map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise((resolve) => {
                    img.onload = img.onerror = () => resolve(null)
                  })
            )
          )
          // The preview draws Canvas text over the card, so bake it on too.
          story = await bakeCanvasTextOnImage({
            entityId,
            sourceUrl: await renderStoryCardToUrl(node, entityId),
            // The card has its own cutout and logo; only the text goes on top.
            overlay: canvasTextOnly(textOverlay),
          })
        }
        // Each slide gets its own Canvas text baked in, then fitted to 1:1
        // (carousels must share one aspect ratio on Instagram).
        const slides = isCarousel
          ? await Promise.all(
              carouselSlides.map(async (slide) => {
                const bakedSlide = slide.overlay
                  ? await bakeCanvasTextOnImage({
                      entityId,
                      sourceUrl: slide.url,
                      overlay: slide.overlay,
                    })
                  : slide.url
                return fitImageToShapeCover({
                  entityId,
                  sourceUrl: bakedSlide,
                  shape: SQUARE_FEED_SHAPE,
                })
              })
            )
          : []
        const storySlides = isCarousel
          ? await Promise.all(
              carouselSlides.map(async (slide) => {
                const bakedSlide = slide.overlay
                  ? await bakeCanvasTextOnImage({
                      entityId,
                      sourceUrl: slide.url,
                      overlay: slide.overlay,
                    })
                  : slide.url
                return fitImageToShape({
                  entityId,
                  sourceUrl: bakedSlide,
                  shape: STORY_SHAPE,
                  fillColor: "#000000",
                })
              })
            )
          : [story]
        const [feedAspect, storyAspect, ...perSlide] = await Promise.all([
          imageAspectRatio(feed),
          imageAspectRatio(storySlides[0] ?? story),
          ...slides.map((url) => imageAspectRatio(url)),
        ])
        if (cancelled) return
        preparedKey.current = inputsKey
        setArtwork({ feed, story, slides, storySlides })
        setSlideAspects(perSlide)
        setAspects({ feed: feedAspect, story: story === feed ? feedAspect : storyAspect })
      } catch (cause) {
        if (cancelled) return
        setError(
          cause instanceof Error ? cause.message : "Couldn't prepare the artwork."
        )
      } finally {
        if (!cancelled) setPreparing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    open,
    inputsKey,
    entityId,
    photoUrl,
    textOverlay,
    renderStoryCard,
    isCarousel,
    carouselSlides,
  ])

  const cards = useMemo(
    () =>
      slots.map((slot) => {
        const mediaUrl = artwork
          ? slot.channel === "instagram_story"
            ? artwork.storySlides[0] ?? artwork.story
            : slot.channel === "tiktok"
              ? artwork.story
              : artwork.feed
          : null
        const payload = packPayloadFor(slot.channel, pack, {
          media_url: mediaUrl,
          destination_url: null,
          slug_seed: slugSeed,
        })
        const caption = payload.caption ?? ""
        const aspect =
          slot.channel === "instagram_story" || slot.channel === "tiktok"
            ? (aspects.story ?? null)
            : (aspects.feed ?? null)
        // TikTok photo mode is photos only; with a video in the tray it posts the selected video.
        const takesCarousel =
          isCarousel &&
          CAROUSEL_CHANNELS.includes(slot.channel) &&
          !(
            slot.channel === "tiktok" &&
            carouselSlides.some((slide) => isTikTokVideoUrl(slide.url))
          )
        const slides =
          isCarousel && slot.channel === "instagram_story" && artwork
            ? artwork.storySlides
            : takesCarousel && artwork
              ? artwork.slides
              : null
        const problems = problemsFor({
          channel: slot.channel,
          caption,
          mediaUrl,
          slides: takesCarousel ? slides : null,
          aspect: takesCarousel ? null : aspect,
          slot,
        })
        if (slides) {
          if (slides.length > CAROUSEL_MAX) {
            problems.blocking.push(
              `${slides.length} photos — ${slot.channel === "instagram_story" ? "Story sequences" : "Carousels"} take at most ${CAROUSEL_MAX}.`
            )
          }
          if (slot.channel === "instagram_feed") {
            const badSlide = slideAspects.findIndex(
              (ratio) => ratio != null && (ratio < 0.79 || ratio > 1.92)
            )
            if (badSlide >= 0) {
              problems.blocking.push(
                `Photo ${badSlide + 1} is outside Instagram's 4:5 to 1.91:1 shape — crop it or remove it from the tray.`
              )
            }
          }
        } else if (isCarousel && slot.channel === "tiktok") {
          problems.warnings.push(
            "Only the selected photo or video posts here — TikTok photo carousels can't include a video."
          )
        }
        return {
          slot,
          slides,
          mediaUrl,
          payload,
          caption,
          note: channelNote(slot.channel, Boolean(slides)),
          ...problems,
        }
      }),
    [slots, artwork, aspects, slideAspects, isCarousel, carouselSlides, pack, slugSeed]
  )

  const blockingCount = cards.reduce(
    (total, card) => total + card.blocking.length,
    0
  )
  const ready = Boolean(artwork) && !preparing && blockingCount === 0

  function confirm() {
    if (!artwork) return
    const mediaByChannel: MediaByChannel = {}
    for (const card of cards) {
      if (card.mediaUrl) mediaByChannel[card.slot.channel] = card.mediaUrl
    }
    const carouselUrls =
      isCarousel && artwork.slides.length >= 2 ? artwork.slides : null
    const storyUrls =
      isCarousel && artwork.storySlides.length >= 2
        ? artwork.storySlides
        : null
    onConfirm(mediaByChannel, carouselUrls, storyUrls)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-neutral-200 px-5 py-4">
          <DialogTitle>Review before scheduling</DialogTitle>
          <DialogDescription>
            This is exactly what each channel will post — the finished image,
            the caption, and when.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-4 rounded-md border border-mad-vermillion bg-mad-vermillion/10 px-3 py-2 text-sm">
              {error}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <article
                key={card.slot.channel}
                className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-mad-black">
                      {CHANNEL_META[card.slot.channel].label}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {card.slot.mode === "immediate"
                        ? "Posts as soon as you confirm"
                        : formatSlotLabel(card.slot.scheduledAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.75rem] font-semibold uppercase tracking-wide",
                      card.blocking.length
                        ? "bg-mad-vermillion/15 text-mad-vermillion"
                        : "bg-emerald-100 text-emerald-800"
                    )}
                  >
                    {card.blocking.length ? "Won't post" : "Ready"}
                  </span>
                </header>

                <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
                  <div
                    className={cn(
                      "flex items-center justify-center overflow-hidden rounded-lg bg-neutral-900",
                      FRAME[card.slot.channel]
                    )}
                  >
                    {card.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.mediaUrl}
                        alt={`${CHANNEL_META[card.slot.channel].label} artwork`}
                        className="size-full object-cover object-center"
                      />
                    ) : (
                      <Loader2 className="size-5 animate-spin text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    {card.slides ? (
                      <div className="mb-2">
                        <p className="mb-1 text-[0.75rem] font-semibold tracking-wide text-neutral-500 uppercase">
                          {card.slot.channel === "instagram_story"
                            ? `Story sequence · ${card.slides.length} frames`
                            : `Carousel · ${card.slides.length} photos`}
                        </p>
                        <div className="flex gap-1 overflow-x-auto">
                          {card.slides.map((url, index) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={`${url}-${index}`}
                              src={url}
                              alt={`Slide ${index + 1}`}
                              className="size-10 shrink-0 rounded border border-neutral-200 object-cover"
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {card.slot.channel === "email" && card.payload.headline ? (
                      <p className="text-xs font-semibold text-mad-black">
                        Subject: {card.payload.headline}
                      </p>
                    ) : null}
                    <p className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-neutral-800">
                      {card.caption || (
                        <span className="text-neutral-400">No caption</span>
                      )}
                    </p>
                    {card.slot.channel !== "email" ? (
                      <p className="text-[0.75rem] text-neutral-400">
                        {card.caption.length} / {CAPTION_LIMIT} characters
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="flex items-start gap-1.5 text-xs text-neutral-600">
                  {card.slot.channel === "instagram_story" ? (
                    <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                  )}
                  {card.note.text}
                </p>

                {[...card.blocking, ...card.warnings].map((message) => (
                  <p
                    key={message}
                    className={cn(
                      "flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
                      card.blocking.includes(message)
                        ? "bg-mad-vermillion/10 text-mad-black"
                        : "bg-amber-50 text-amber-900"
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {message}
                  </p>
                ))}
                {card.blocking.length ? (
                  <button
                    type="button"
                    onClick={() => onDropChannel(card.slot.channel)}
                    className="self-start text-xs font-medium text-neutral-700 underline hover:text-mad-black"
                  >
                    Leave {CHANNEL_META[card.slot.channel].short} out
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3 sm:justify-between">
          <p className="text-xs text-neutral-500">
            {preparing
              ? "Preparing the finished artwork…"
              : blockingCount
                ? `Fix or leave out ${blockingCount === 1 ? "the channel" : "channels"} marked "Won't post".`
                : `${cards.length} post${cards.length === 1 ? "" : "s"} ready.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!ready || confirming || cards.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-mad-black px-4 py-2 text-sm font-medium text-mad-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {confirming || preparing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {cards.some((card) => card.slot.mode === "immediate")
                ? "Confirm & post"
                : "Confirm & schedule"}
            </button>
          </div>
        </DialogFooter>

        {renderStoryCard ? (
          // Offscreen story card, rendered to the PNG the IG Story will post.
          <div
            aria-hidden
            className="pointer-events-none fixed top-0 -left-[10000px] w-[360px]"
          >
            <StoryCanvas
              ref={storyRef}
              model={buildBasicStoryModel({
                brandName,
                headline: storyHeadline,
                imageUrl: proxiedImageUrl(storyCardImage, entityId),
              })}
              stylePreset={storyPreview.stylePreset}
              format="story_9_16"
              canvasColor={storyPreview.canvasColor}
              cutoutMode={storyPreview.cutoutMode}
              visualPresets={visualPresets}
              showCopy={false}
              showStickerGuide={false}
              subjectScale={storyPreview.subjectScale ?? 1}
              subjectOffsetY={storyPreview.subjectOffsetY ?? 0}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

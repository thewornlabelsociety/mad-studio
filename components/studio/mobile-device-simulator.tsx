"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BatteryFull,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Heart,
  MessageCircle,
  Share2,
  Signal,
} from "lucide-react"

import { resolveVisualPresets, cssFontStack } from "@/lib/brands/visual-presets"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import { stripMarkdown } from "@/lib/campaigns/pack-schema"
import {
  resolveIndustryProfile,
  type BrandColorTheme,
} from "@/lib/brands/industry-templates"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { cn } from "@/lib/utils"

export type SimulatorMode = "reel" | "carousel" | "caption" | "email" | "dm"

type MobileDeviceSimulatorProps = {
  pack: CampaignPack
  brandName: string
  imageUrl?: string | null
  className?: string
  mode?: SimulatorMode
  onModeChange?: (mode: SimulatorMode) => void
  visualPresets?: VisualPresets | null
  industry?: string | null
}

const MODES: Array<{ id: SimulatorMode; label: string }> = [
  { id: "reel", label: "9:16 Reel" },
  { id: "carousel", label: "Carousel" },
  { id: "caption", label: "Caption" },
  { id: "email", label: "Email" },
  { id: "dm", label: "B2B DM" },
]

export function MobileDeviceSimulator({
  pack,
  brandName,
  imageUrl = null,
  className,
  mode: controlledMode,
  onModeChange,
  visualPresets = null,
  industry = null,
}: MobileDeviceSimulatorProps) {
  const [uncontrolledMode, setUncontrolledMode] =
    useState<SimulatorMode>("reel")
  const [slideIndex, setSlideIndex] = useState(0)

  const mode = controlledMode ?? uncontrolledMode

  function setMode(next: SimulatorMode) {
    if (controlledMode == null) setUncontrolledMode(next)
    onModeChange?.(next)
  }

  const slides = pack.carousel.slides
  const safeSlideIndex = Math.min(slideIndex, Math.max(slides.length - 1, 0))
  const activeSlide = slides[safeSlideIndex]
  const profile = resolveIndustryProfile({ name: brandName, industry })
  const presets = useMemo(
    () =>
      resolveVisualPresets({
        brandName,
        industry,
        brandIdentity: visualPresets
          ? { visual_presets: visualPresets }
          : null,
      }),
    [brandName, industry, visualPresets]
  )

  useEffect(() => {
    setSlideIndex(0)
  }, [pack.carousel.slides.length, pack.carousel.title])

  const emailBody = useMemo(
    () => stripMarkdown(pack.email_drop.body_markdown),
    [pack.email_drop.body_markdown]
  )

  function goPrev() {
    setSlideIndex((current) =>
      current <= 0 ? slides.length - 1 : current - 1
    )
  }

  function goNext() {
    setSlideIndex((current) =>
      current >= slides.length - 1 ? 0 : current + 1
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="flex flex-wrap justify-center gap-2">
        {MODES.map((item) => {
          const active = mode === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                "border-2 px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-wider uppercase shadow-keycap-sm transition-colors",
                active ? "text-white" : "bg-mad-white hover:opacity-90"
              )}
              style={{
                borderColor: profile.theme.ink,
                background: active ? profile.theme.accent : undefined,
                color: active ? profile.theme.onAccent : profile.theme.ink,
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="w-full max-w-[380px] rounded-[40px] border-[3px] border-mad-black bg-mad-black p-2 shadow-keycap-lg">
        <div className="overflow-hidden rounded-[32px] bg-mad-white">
          <div className="relative flex items-center justify-between bg-mad-white px-5 pt-3 pb-2">
            <div className="absolute top-2 left-1/2 h-5 w-24 -translate-x-1/2 rounded-full bg-mad-black" />
            <span className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black">
              9:41
            </span>
            <div className="flex items-center gap-1 text-mad-black">
              <Signal className="size-3.5" />
              <span className="font-typewriter text-[0.55rem] font-bold">
                5G
              </span>
              <BatteryFull className="size-3.5" />
            </div>
          </div>

          {mode === "reel" ? (
            <ReelScreen
              pack={pack}
              imageUrl={imageUrl}
              brandName={brandName}
              shopLabel={profile.shopLinkLabel}
              accent={profile.theme.accent}
              footer={profile.locationFooter}
            />
          ) : null}

          {mode === "carousel" && activeSlide ? (
            <CarouselScreen
              brandName={brandName}
              title={pack.carousel.title}
              slide={activeSlide}
              index={safeSlideIndex}
              total={slides.length}
              imageUrl={imageUrl}
              captionBody={pack.seo_caption.caption_body}
              theme={profile.theme}
              visualPresets={presets}
              onPrev={goPrev}
              onNext={goNext}
            />
          ) : null}

          {mode === "caption" ? (
            <CaptionScreen
              brandName={brandName}
              caption={pack.seo_caption.caption_body}
              tags={pack.seo_caption.search_optimized_tags}
              imageUrl={imageUrl}
            />
          ) : null}

          {mode === "email" ? (
            <EmailScreen
              brandName={brandName}
              subject={pack.email_drop.subject_line}
              preview={pack.email_drop.preview_text}
              body={emailBody}
              imageUrl={imageUrl}
            />
          ) : null}

          {mode === "dm" ? (
            <DmScreen
              brandName={brandName}
              platform={pack.b2b_dm.platform}
              message={pack.b2b_dm.message_text}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function VisualBackdrop({
  imageUrl,
  className,
}: {
  imageUrl?: string | null
  className?: string
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "absolute inset-0 bg-[linear-gradient(145deg,#111_0%,#333_45%,#ff3b00_100%)]",
        className
      )}
    >
      <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(90deg,transparent,transparent_11px,#ccff00_11px,#ccff00_12px)]" />
    </div>
  )
}

function ReelScreen({
  pack,
  imageUrl,
  brandName,
  shopLabel,
  accent,
  footer,
}: {
  pack: CampaignPack
  imageUrl?: string | null
  brandName: string
  shopLabel: string
  accent: string
  footer: string | null
}) {
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden bg-mad-black">
      <VisualBackdrop imageUrl={imageUrl} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/75" />

      <div className="absolute top-4 right-14 left-4 z-10">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-white uppercase drop-shadow">
          {brandName}
        </p>
      </div>

      <div className="absolute top-1/3 right-3 z-10 flex flex-col items-center gap-4 text-mad-white">
        <RailIcon icon={<Heart className="size-5 fill-mad-white" />} label="Like" />
        <RailIcon icon={<MessageCircle className="size-5" />} label="42" />
        <RailIcon icon={<Share2 className="size-5" />} label="Share" />
        <RailIcon
          icon={
            <Disc3 className="size-5 animate-spin [animation-duration:4s]" />
          }
          label="Sound"
        />
      </div>

      <div className="absolute right-3 bottom-6 left-3 z-10 space-y-2">
        <span className="inline-block border-2 border-mad-black bg-mad-vermillion px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm">
          0-3s Spoken Hook
        </span>
        <p className="text-sm font-bold leading-snug text-mad-white drop-shadow">
          {pack.algorithmic_signals.spoken_hook}
        </p>

        <span className="inline-block border-2 border-mad-black bg-mad-lime px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-tight text-mad-black uppercase shadow-keycap-sm">
          {pack.algorithmic_signals.on_screen_text}
        </span>

        <div className="mt-2 border-2 border-mad-white/40 bg-mad-black/70 px-2 py-2">
          <p className="font-typewriter text-[0.5rem] tracking-widest text-mad-lime uppercase">
            Teleprompter
          </p>
          <div className="mt-1 max-h-20 space-y-1 overflow-hidden">
            {pack.short_video_script.spoken_lines.slice(0, 3).map((line) => (
              <p
                key={line}
                className="truncate text-[0.7rem] leading-snug text-mad-white"
              >
                {line}
              </p>
            ))}
          </div>
          <p className="mt-2 text-[0.65rem] font-bold text-mad-lime">
            CTA · {pack.short_video_script.cta_spoken}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 pt-1">
          <span
            className="rounded-full px-4 py-1.5 text-[0.7rem] font-semibold tracking-wide text-white"
            style={{ background: accent }}
          >
            {shopLabel}
          </span>
          {footer ? (
            <p className="text-center text-[0.55rem] tracking-wide text-white/70 uppercase">
              {footer}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RailIcon({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex size-9 items-center justify-center rounded-full bg-mad-black/35 backdrop-blur-sm">
        {icon}
      </div>
      <span className="font-typewriter text-[0.5rem] font-bold tracking-wider uppercase drop-shadow">
        {label}
      </span>
    </div>
  )
}

function CarouselScreen({
  brandName,
  title,
  slide,
  index,
  total,
  imageUrl,
  captionBody,
  theme,
  visualPresets,
  onPrev,
  onNext,
}: {
  brandName: string
  title: string
  slide: { slide_number: number; headline: string; body_text: string }
  index: number
  total: number
  imageUrl?: string | null
  captionBody: string
  theme: BrandColorTheme
  visualPresets: VisualPresets
  onPrev: () => void
  onNext: () => void
}) {
  const isHeroSlide = index === 0
  const bodyText = slide.body_text.trim()
  // Slide 1 = product frame. Slides 2+ = dedicated editorial cards (never over photo).
  const showEditorialCard = !isHeroSlide || !imageUrl
  const captionPreview = [title, slide.headline.trim(), bodyText, captionBody]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 160)

  return (
    <div className="flex w-full flex-col bg-mad-white">
      {/* Exact 4:5 export frame — chrome lives outside this box */}
      <div
        className="relative aspect-[4/5] w-full overflow-hidden"
        data-carousel-export-frame="true"
        data-slide-index={index + 1}
      >
        {showEditorialCard ? (
          <EditorialSlideCard
            brandName={brandName}
            slideNumber={index + 1}
            total={total}
            headline={slide.headline}
            bodyText={bodyText}
            theme={theme}
            visualPresets={visualPresets}
          />
        ) : (
          <ProductHeroSlide brandName={brandName} imageUrl={imageUrl} />
        )}
      </div>

      <div className="space-y-2 border-t-2 border-mad-black bg-mad-white px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-2 py-1.5 font-typewriter text-[0.6rem] font-bold uppercase hover:bg-mad-lime"
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </button>
          <div className="flex flex-col items-center gap-1">
            <p className="font-typewriter text-[0.5rem] font-bold tracking-widest text-neutral-500 uppercase">
              Slide {index + 1} / {total} · 4:5
            </p>
            <div className="flex gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full border border-mad-black",
                    i === index ? "bg-mad-black" : "bg-mad-white"
                  )}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-2 py-1.5 font-typewriter text-[0.6rem] font-bold uppercase hover:bg-mad-lime"
          >
            Next
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {isHeroSlide && bodyText ? (
          <p className="border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[0.65rem] leading-relaxed text-neutral-600">
            <span className="font-typewriter font-bold tracking-wider text-neutral-500 uppercase">
              Caption ·{" "}
            </span>
            Long slide copy stays in the Instagram caption — not over the
            garment. {captionPreview}
            {captionPreview.length >= 160 ? "…" : ""}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Slide 1: clean product photo — no CTA boxes burned onto the garment. */
function ProductHeroSlide({
  brandName,
  imageUrl,
}: {
  brandName: string
  imageUrl?: string | null
  headline?: string
  useLowerThird?: boolean
  theme?: BrandColorTheme
  visualPresets?: VisualPresets
}) {
  return (
    <div className="absolute inset-0 bg-mad-black">
      <VisualBackdrop imageUrl={imageUrl} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/40" />
      <div className="absolute top-0 right-0 left-0 z-10 px-4 pt-4">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-[0.22em] text-white/90 uppercase drop-shadow">
          {brandName}
        </p>
      </div>
    </div>
  )
}

/** Slides 2+: dedicated editorial card — never a glass box over the dress. */
function EditorialSlideCard({
  brandName,
  slideNumber,
  total,
  headline,
  bodyText,
  theme,
  visualPresets,
}: {
  brandName: string
  slideNumber: number
  total: number
  headline: string
  bodyText: string
  theme: BrandColorTheme
  visualPresets: VisualPresets
}) {
  const canvas = visualPresets.canvas_color || theme.canvas
  const accent = visualPresets.accent_color || theme.accent
  const text = visualPresets.text_color || theme.onCanvas
  const font = cssFontStack(visualPresets.font_family)

  return (
    <div
      className="absolute inset-0 flex flex-col justify-between p-5"
      style={{
        background: `linear-gradient(165deg, ${canvas} 0%, ${canvas}ee 55%, ${canvas} 100%)`,
        color: text,
        fontFamily: font,
      }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p
            className="text-[0.55rem] font-bold tracking-[0.22em] uppercase"
            style={{ color: accent }}
          >
            {brandName}
          </p>
          <p className="text-[0.5rem] font-bold tracking-widest uppercase opacity-60">
            {slideNumber}/{total}
          </p>
        </div>
        <div className="h-px w-12" style={{ background: accent }} />
        <h3 className="text-xl font-bold leading-tight tracking-tight uppercase sm:text-2xl">
          {headline}
        </h3>
      </div>

      <div className="space-y-4">
        {bodyText ? (
          <p className="text-[0.95rem] leading-relaxed opacity-90">{bodyText}</p>
        ) : null}
        <div
          className="inline-block border-2 px-3 py-2 text-[0.55rem] font-bold tracking-widest uppercase"
          style={{
            borderColor: text,
            color: text,
            background: "transparent",
          }}
        >
          Editorial · Feed Ready
        </div>
      </div>
    </div>
  )
}

function CaptionScreen({
  brandName,
  caption,
  tags,
  imageUrl,
}: {
  brandName: string
  caption: string
  tags: string[]
  imageUrl?: string | null
}) {
  return (
    <div className="flex aspect-[4/5] w-full flex-col bg-mad-white">
      <div className="relative aspect-square w-full overflow-hidden border-b-2 border-mad-black">
        <VisualBackdrop imageUrl={imageUrl} />
      </div>
      <div className="space-y-3 px-4 py-4">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
          {brandName}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-mad-black">
          {caption}
        </p>
        <p className="text-xs leading-relaxed text-neutral-500">
          {tags
            .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
            .join(" ")}
        </p>
      </div>
    </div>
  )
}

function EmailScreen({
  brandName,
  subject,
  preview,
  body,
  imageUrl,
}: {
  brandName: string
  subject: string
  preview: string
  body: string
  imageUrl?: string | null
}) {
  return (
    <div className="flex aspect-[9/16] w-full flex-col bg-mad-white">
      <div className="border-b-2 border-mad-black px-4 py-3">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
          Inbox · VIP
        </p>
        <p className="mt-2 text-xs text-mad-black">
          <span className="font-bold">From:</span> {brandName}
        </p>
        <p className="mt-1 text-sm font-bold leading-snug text-mad-black">
          Subject: {subject}
        </p>
        <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{preview}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="aspect-[16/10] w-full border-b-2 border-mad-black object-cover"
          />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center border-b-2 border-mad-black bg-mad-lime">
            <span className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase">
              Featured Drop
            </span>
          </div>
        )}

        <div className="space-y-4 px-4 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-mad-black">
            {body}
          </p>
          <button
            type="button"
            className="w-full border-2 border-mad-black bg-mad-vermillion px-3 py-3 font-typewriter text-[0.7rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm"
          >
            Shop Drop Now
          </button>
        </div>
      </div>
    </div>
  )
}

function DmScreen({
  brandName,
  platform,
  message,
}: {
  brandName: string
  platform: string
  message: string
}) {
  return (
    <div className="flex aspect-[9/16] w-full flex-col bg-neutral-100">
      <div className="border-b-2 border-mad-black bg-mad-white px-4 py-3">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
          {platform || "Direct Message"}
        </p>
        <p className="mt-1 font-typewriter text-xs font-bold tracking-tight text-mad-black uppercase">
          To · Partner / Buyer
        </p>
        <p className="mt-0.5 text-[0.65rem] text-neutral-500">From {brandName}</p>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-4">
        <div className="ml-8 rounded-2xl rounded-br-sm border-2 border-mad-black bg-mad-lime px-3 py-3 shadow-keycap-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-mad-black">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

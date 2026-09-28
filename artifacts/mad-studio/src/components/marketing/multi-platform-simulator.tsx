"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Disc3,
  Download,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Rocket,
  Scissors,
  Share2,
  Undo2,
} from "lucide-react"
import { toPng } from "html-to-image"
import { toast } from "sonner"

import { ensureInventoryTrackableLink } from "@/lib/actions"
import {
  StoryCanvas,
  type CutoutMode,
} from "@/components/marketing/story-canvas"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import {
  buildStoryCanvasModel,
  CANVAS_BG_PRESETS,
  conciseProductLabel,
  type StoryStylePreset,
} from "@/lib/marketing/story-presets"
import type { MarketingEntity } from "@/lib/inventory/types"
import type { ActiveMedia } from "@/components/marketing/media-tray"
import { detectMediaKindFromUrl } from "@/components/marketing/media-tray"
import { tikTokMediaGuardError } from "@/lib/social/tiktok-media-guard"
import { trackableUrl } from "@/lib/social/types"
import { cn } from "@/lib/utils"

export type SimulatorPlatform =
  | "ig_story"
  | "ig_feed"
  | "tiktok"
  | "facebook"
  | "email"

export type SimulatorContent = {
  brandName: string
  handle?: string
  headline: string
  caption: string
  imageUrl: string | null
  stickerLabel?: string
  emailSubject?: string
  emailPreview?: string
}

const PLATFORM_OPTIONS: Array<{
  id: SimulatorPlatform
  label: string
  dimensions: string
  ratio: string
  aspect: "story" | "feed" | "email"
}> = [
  {
    id: "ig_story",
    label: "IG Story",
    dimensions: "1080 × 1920",
    ratio: "9:16",
    aspect: "story",
  },
  {
    id: "ig_feed",
    label: "IG Feed",
    dimensions: "1080 × 1350",
    ratio: "4:5",
    aspect: "feed",
  },
  {
    id: "tiktok",
    label: "TikTok",
    dimensions: "1080 × 1920",
    ratio: "9:16",
    aspect: "story",
  },
  {
    id: "facebook",
    label: "Facebook",
    dimensions: "1080 × 1350",
    ratio: "4:5",
    aspect: "feed",
  },
  {
    id: "email",
    label: "Email",
    dimensions: "1200 × 675",
    ratio: "16:9",
    aspect: "email",
  },
]

type ActionContext = {
  entityId: string
  marketingEntityId: string
  websiteItemId?: string | null
  websiteUrl?: string | null
  trackableSlug?: string | null
  destinationUrl?: string | null
  /** Preferred slug seed, e.g. fudi-friday-special or partner-cafe-name. */
  slugSeed?: string | null
}

export type SimulatorCarouselItem = {
  id?: string
  url: string
  type?: "image" | "video"
  publicUrl?: string | null
}

export type StoryPreviewState = {
  stylePreset: StoryStylePreset
  canvasColor: string
  bgPresetId: string
  cutoutMode: CutoutMode
  cutoutImageUrl: string | null
}

export const DEFAULT_STORY_PREVIEW: StoryPreviewState = {
  stylePreset: "moody_noir",
  canvasColor: "#121211",
  bgPresetId: "moody_obsidian",
  cutoutMode: "original",
  cutoutImageUrl: null,
}

type Props = {
  content: SimulatorContent
  /** Preferred media source — supports image + vertical video reels. */
  activeMedia?: ActiveMedia | null
  /** Multi-image carousel source (inventory tray / studio media). */
  carouselMedia?: SimulatorCarouselItem[] | null
  /** Optional controlled per-slide overlay copy. */
  slideTexts?: string[] | null
  onSlideTextsChange?: (texts: string[]) => void
  platform?: SimulatorPlatform
  onPlatformChange?: (platform: SimulatorPlatform) => void
  /** Inventory creative controls */
  item?: MarketingEntity | null
  industry?: string | null
  visualPresets?: VisualPresets | null
  showCreativeControls?: boolean
  showActionDock?: boolean
  /** When false, hide the primary Dispatch CTA (schedule UI owns it). */
  showPublishCta?: boolean
  /** Smaller phone chrome for side-by-side SOP layouts (laptop Step 3). */
  compact?: boolean
  /** Phone on top with controls below, for narrow (~380px) side columns. */
  stacked?: boolean
  /** Optional media tray / extras rendered in the Styling column. */
  mediaSlot?: ReactNode
  /** Lifted story preview (style + cutout) so Continue keeps the same phone. */
  storyPreview?: StoryPreviewState
  onStoryPreviewChange?: (next: StoryPreviewState) => void
  actionContext?: ActionContext | null
  /** Limit switcher to IG Story, IG Feed, and Facebook. */
  metaChannelsOnly?: boolean
  /** Parent owns platform tabs (e.g. pack editor). */
  hidePlatformSwitcher?: boolean
  /** Fixed 360×700 preview — no layout jump between channels. */
  lockedViewport?: boolean
  className?: string
}

function slugifyHandle(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "brand"
  )
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) return `${response.status} ${body.error}`
  } catch {
    // non-JSON body (e.g. platform error page)
  }
  return `HTTP ${response.status}`
}

export function MultiPlatformSimulator({
  content,
  activeMedia = null,
  carouselMedia = null,
  slideTexts: controlledSlideTexts = null,
  onSlideTextsChange,
  platform: controlledPlatform,
  onPlatformChange,
  item = null,
  industry = null,
  visualPresets = null,
  showCreativeControls = false,
  showActionDock = false,
  showPublishCta = true,
  compact = false,
  stacked = false,
  mediaSlot = null,
  storyPreview: controlledPreview,
  onStoryPreviewChange,
  actionContext = null,
  metaChannelsOnly = false,
  hidePlatformSwitcher = false,
  lockedViewport = false,
  className,
}: Props) {
  const captureRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const [uncontrolledPlatform, setUncontrolledPlatform] =
    useState<SimulatorPlatform>("ig_story")
  const platform = controlledPlatform ?? uncontrolledPlatform

  function setPlatform(next: SimulatorPlatform) {
    if (controlledPlatform == null) setUncontrolledPlatform(next)
    onPlatformChange?.(next)
  }

  const isPreviewControlled = controlledPreview != null
  const [localPreview, setLocalPreview] =
    useState<StoryPreviewState>(DEFAULT_STORY_PREVIEW)
  const preview = controlledPreview ?? localPreview

  function patchPreview(patch: Partial<StoryPreviewState>) {
    if (isPreviewControlled && onStoryPreviewChange) {
      onStoryPreviewChange({ ...controlledPreview, ...patch })
      return
    }
    setLocalPreview((prev) => ({ ...prev, ...patch }))
  }

  const stylePreset = preview.stylePreset
  const canvasColor = preview.canvasColor
  const bgPresetId = preview.bgPresetId
  const cutoutMode = preview.cutoutMode
  const displayImageUrl =
    cutoutMode !== "original" && preview.cutoutImageUrl
      ? preview.cutoutImageUrl
      : content.imageUrl
  const [originalImageUrl, setOriginalImageUrl] = useState(content.imageUrl)
  const [trackableSlug, setTrackableSlug] = useState(
    actionContext?.trackableSlug ?? null
  )
  const [busy, setBusy] = useState<
    "link" | "publish" | "download" | "cutout" | null
  >(null)
  const [copied, setCopied] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [localSlideTexts, setLocalSlideTexts] = useState<string[]>([])

  const slides = useMemo((): SimulatorCarouselItem[] => {
    if (carouselMedia && carouselMedia.length > 0) {
      return carouselMedia
        .map((row, index) => ({
          id: row.id ?? `slide-${index}`,
          url: (row.publicUrl || row.url || "").trim(),
          type:
            row.type ??
            detectMediaKindFromUrl(row.publicUrl || row.url || ""),
          publicUrl: row.publicUrl ?? null,
        }))
        .filter((row) => Boolean(row.url))
    }
    if (item?.images?.length) {
      return item.images
        .filter((url) => typeof url === "string" && url.trim())
        .map((url, index) => ({
          id: `item-${index}`,
          url,
          type: detectMediaKindFromUrl(url),
        }))
    }
    const fallback =
      activeMedia?.url || content.imageUrl || displayImageUrl || null
    if (!fallback) return []
    return [
      {
        id: "single",
        url: fallback,
        type: activeMedia?.type ?? detectMediaKindFromUrl(fallback),
      },
    ]
  }, [
    carouselMedia,
    item?.images,
    activeMedia?.url,
    activeMedia?.type,
    content.imageUrl,
    displayImageUrl,
  ])

  const isCarousel = slides.length > 1
  const safeSlideIndex = Math.min(
    Math.max(slideIndex, 0),
    Math.max(slides.length - 1, 0)
  )
  const activeSlide = slides[safeSlideIndex] ?? null

  useEffect(() => {
    setSlideIndex(0)
  }, [slides.map((row) => row.url).join("|")])

  useEffect(() => {
    if (controlledSlideTexts) {
      setLocalSlideTexts(controlledSlideTexts)
      return
    }
    setLocalSlideTexts((current) => {
      const next = slides.map((_, index) => current[index] ?? "")
      return next
    })
  }, [controlledSlideTexts, slides.length])

  const slideTexts = controlledSlideTexts ?? localSlideTexts
  const activeSlideText =
    slideTexts[safeSlideIndex]?.trim() ||
    (safeSlideIndex === 0 ? content.headline : "")

  function updateSlideText(index: number, value: string) {
    const next = slides.map((_, i) =>
      i === index ? value : slideTexts[i] ?? ""
    )
    if (onSlideTextsChange) onSlideTextsChange(next)
    else setLocalSlideTexts(next)
  }

  function goSlide(delta: number) {
    if (slides.length <= 1) return
    setSlideIndex((current) => {
      const next = current + delta
      if (next < 0) return slides.length - 1
      if (next >= slides.length) return 0
      return next
    })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isCarousel) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goSlide(-1)
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goSlide(1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const resolvedMedia: ActiveMedia | null = (() => {
    if (activeSlide) {
      const kind =
        activeSlide.type === "video" ||
        detectMediaKindFromUrl(activeSlide.url) === "video"
          ? "video"
          : "image"
      return { url: activeSlide.url, type: kind }
    }
    if (activeMedia) {
      const kind =
        activeMedia.type === "video" ||
        detectMediaKindFromUrl(activeMedia.url) === "video"
          ? "video"
          : "image"
      return { url: activeMedia.url, type: kind }
    }
    if (content.imageUrl) {
      return {
        url: content.imageUrl,
        type: detectMediaKindFromUrl(content.imageUrl),
      }
    }
    return null
  })()
  const isVideo = resolvedMedia?.type === "video"

  useEffect(() => {
    if (resolvedMedia?.type !== "image") return
    setOriginalImageUrl(resolvedMedia.url)
    // Controlled preview is owned by the parent (survives Continue / remount).
    // Only reset cutout when this instance manages its own state.
    if (!isPreviewControlled) {
      setLocalPreview((prev) => ({
        ...prev,
        cutoutMode: "original",
        cutoutImageUrl: null,
      }))
    }
  }, [resolvedMedia?.url, resolvedMedia?.type, isPreviewControlled])

  useEffect(() => {
    setTrackableSlug(actionContext?.trackableSlug ?? null)
  }, [actionContext?.trackableSlug])

  const handle =
    content.handle?.replace(/^@/, "") || slugifyHandle(content.brandName)

  const resolvedPresets = useMemo(
    () =>
      resolveVisualPresets({
        brandName: content.brandName,
        industry,
        brandIdentity: visualPresets
          ? { visual_presets: visualPresets }
          : null,
      }),
    [content.brandName, industry, visualPresets]
  )

  const imageForCanvas =
    !isVideo && (cutoutMode !== "original" ? displayImageUrl : resolvedMedia?.url)
      ? cutoutMode !== "original"
        ? displayImageUrl
        : resolvedMedia?.url ?? null
      : resolvedMedia?.type === "image"
        ? resolvedMedia.url
        : null

  const storyModel = useMemo(() => {
    const headline = activeSlideText || content.headline
    if (!item) {
      return {
        brandName: content.brandName,
        title: headline,
        headline,
        category: "New Arrival",
        designer: content.brandName,
        priceLabel: "—",
        sizeLabel: null,
        colorLabel: null,
        productLabel: conciseProductLabel(headline, content.brandName),
        vibeTag: null,
        provenance: null,
        stickerLabel: content.stickerLabel || "Shop the look",
        footerLine: `IN STORE AT ${content.brandName.toUpperCase()} // ONLINE`,
        specsLine: `${content.brandName.toUpperCase()} // ${headline.toUpperCase()}`,
        imageUrl: imageForCanvas,
      }
    }
    return buildStoryCanvasModel({
      item,
      brandName: content.brandName,
      industry,
      headline,
      imageUrl: imageForCanvas,
    })
  }, [item, content, industry, imageForCanvas, activeSlideText])

  const platformOptions = useMemo(
    () =>
      metaChannelsOnly
        ? PLATFORM_OPTIONS.filter((row) =>
            ["ig_story", "ig_feed", "facebook"].includes(row.id)
          )
        : PLATFORM_OPTIONS,
    [metaChannelsOnly]
  )

  const pillMeta =
    platformOptions.find((row) => row.id === platform) ?? platformOptions[0]
  // Compact shells sit in shrink-to-fit columns, so they need a fixed width.
  const shellMax = lockedViewport
    ? "h-[700px] w-[360px] shrink-0"
    : compact
    ? pillMeta.aspect === "email"
      ? "w-[280px] max-w-full"
      : pillMeta.aspect === "feed"
        ? "w-[240px] max-w-full"
        : "w-[220px] max-w-full"
    : pillMeta.aspect === "email"
      ? "max-w-[360px]"
      : pillMeta.aspect === "feed"
        ? "max-w-[320px]"
        : "max-w-[300px]"

  async function onIsolate() {
    if (isVideo) return
    const source = originalImageUrl || resolvedMedia?.url
    if (!source || !actionContext) {
      patchPreview({ cutoutMode: "css_blend" })
      return
    }
    patchPreview({ cutoutMode: "css_blend" })
    setBusy("cutout")
    toast.message("Cutting out subject…")
    const ctx = actionContext
    const sourceUrl = source
    const failures: string[] = []

    async function loadSourceBlob(src: string): Promise<Blob> {
      try {
        const direct = await fetch(src, { mode: "cors", cache: "no-store" })
        if (direct.ok) return await direct.blob()
        failures.push(`direct ${direct.status}`)
      } catch {
        failures.push("direct blocked")
      }
      // Proxy covers hosts without CORS headers.
      const proxyUrl = `/api/media/image-proxy?url=${encodeURIComponent(src)}&entityId=${encodeURIComponent(ctx.entityId)}`
      const proxied = await fetch(proxyUrl)
      if (!proxied.ok) {
        throw new Error(`image load: ${await readError(proxied)}`)
      }
      return proxied.blob()
    }

    async function serverFallback(): Promise<string | null> {
      try {
        const response = await fetch("/api/media/remove-bg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: sourceUrl,
            entityId: ctx.entityId,
            itemId: ctx.marketingEntityId,
          }),
        })
        if (!response.ok) {
          failures.push(`server: ${await readError(response)}`)
          return null
        }
        const payload = (await response.json()) as { transparentUrl?: string }
        return payload.transparentUrl ?? null
      } catch (error) {
        failures.push(`server: ${errorText(error)}`)
        return null
      }
    }

    function applyCutout(url: string) {
      patchPreview({ cutoutImageUrl: url, cutoutMode: "transparent" })
      toast.success("Subject cut out.")
    }

    async function browserCutout(): Promise<string | null> {
      try {
        const imageBlob = await loadSourceBlob(sourceUrl)

        const { removeBackground } = await import("@imgly/background-removal")
        const cutoutBlob = await removeBackground(imageBlob, {
          output: { format: "image/png" },
        })

        const form = new FormData()
        form.append("file", cutoutBlob, "cutout.png")
        form.append("entityId", ctx.entityId)
        if (ctx.marketingEntityId) {
          form.append("itemId", ctx.marketingEntityId)
        }

        const uploadRes = await fetch("/api/media/upload-cutout", {
          method: "POST",
          body: form,
        })
        if (uploadRes.ok) {
          const uploadPayload = (await uploadRes.json()) as {
            transparentUrl?: string
          }
          if (uploadPayload.transparentUrl) return uploadPayload.transparentUrl
        }
        failures.push(`upload: ${await readError(uploadRes)}`)
      } catch (error) {
        console.warn("[cutout]", error)
        failures.push(errorText(error))
      }
      return null
    }

    try {
      const browserUrl = await browserCutout()
      if (browserUrl) {
        applyCutout(browserUrl)
        return
      }
      const fallbackUrl = await serverFallback()
      if (fallbackUrl) {
        applyCutout(fallbackUrl)
        return
      }
      console.warn("[cutout] failed:", failures)
      toast.error("Cutout unavailable — showing blend fallback.", {
        description: failures.join(" · ").slice(0, 240),
      })
    } finally {
      setBusy(null)
    }
  }

  async function ensureLink() {
    if (!actionContext) throw new Error("Missing action context.")
    const result = await ensureInventoryTrackableLink({
      entityId: actionContext.entityId,
      marketingEntityId: actionContext.marketingEntityId,
      destinationUrl: actionContext.destinationUrl,
      titleSeed: actionContext.slugSeed ?? undefined,
    })
    if (!result.ok) throw new Error(result.error)
    setTrackableSlug(result.data.slug)
    return result.data
  }

  async function onCopyLink() {
    if (!actionContext) return
    setBusy("link")
    try {
      const short =
        trackableSlug != null
          ? trackableUrl(trackableSlug)
          : (await ensureLink()).shortUrl
      await navigator.clipboard.writeText(short)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      toast.success("Link sticker copied.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed.")
    } finally {
      setBusy(null)
    }
  }

  async function onPublish() {
    if (!actionContext) return
    const media =
      resolvedMedia?.url ||
      displayImageUrl ||
      originalImageUrl
    if (!media) {
      toast.error("Add media before dispatch.")
      return
    }
    if (media.startsWith("blob:")) {
      toast.error(
        "Media is still uploading — wait for the public HTTPS URL, then dispatch."
      )
      return
    }
    setBusy("publish")
    try {
      if (platform === "tiktok") {
        const tiktokMediaError = tikTokMediaGuardError(media)
        if (tiktokMediaError) {
          toast.error(tiktokMediaError)
          return
        }
      }
      if (platform !== "email" && platform !== "tiktok") {
        await ensureLink()
      }
      const apiPlatform =
        platform === "facebook"
          ? "facebook"
          : platform === "tiktok"
            ? "tiktok"
            : platform === "email"
              ? "email"
              : "instagram"
      const response = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: actionContext.entityId,
          marketingEntityId: actionContext.marketingEntityId,
          platform: apiPlatform,
          placement: platform === "ig_story" ? "story" : "feed",
          mediaUrl: media,
          caption: activeSlideText || content.caption || content.headline,
          destinationUrl: actionContext.destinationUrl,
          slugSeed: actionContext.slugSeed,
          emailSubject: content.emailSubject,
          emailPreview: content.emailPreview,
          onScreenText: activeSlideText || content.headline,
          spokenHook: content.caption,
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        slug?: string
        linkSticker?: string | null
        message?: string
      }
      if (!response.ok) throw new Error(payload.error || "Publish failed.")
      if (payload.slug) setTrackableSlug(payload.slug)
      toast.success(
        payload.message ||
          (payload.linkSticker
            ? `Dispatched. Add link sticker: ${payload.linkSticker}`
            : "Approved & dispatched.")
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed.")
    } finally {
      setBusy(null)
    }
  }

  async function onDownload() {
    const node = captureRef.current
    if (!node) return
    if (isVideo) {
      toast.message("Download PNG captures a frame — pause-friendly stills work best for images.")
    }
    setBusy("download")
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2.5,
        width: node.offsetWidth,
        height: node.offsetHeight,
      })
      const anchor = document.createElement("a")
      anchor.download = `${content.brandName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}-${platform}.png`
      anchor.href = dataUrl
      anchor.click()
      toast.success("PNG downloaded.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.")
    } finally {
      setBusy(null)
    }
  }

  const cutoutActive = cutoutMode !== "original"
  const mediaUrl = resolvedMedia?.url ?? null
  const workbench = !compact

  const phoneShell = (
    <div
      className={cn(
        lockedViewport ? "" : "transition-[max-width,width] duration-300 ease-out",
        compact || lockedViewport ? "shrink-0" : "w-full",
        shellMax
      )}
    >
      <div className="group relative">
        <div
          ref={captureRef}
          className="relative overflow-hidden border-2 border-mad-black bg-[#0b0b0c] p-[9px] shadow-keycap"
          style={{ borderRadius: 44 }}
        >
          <div className="pointer-events-none absolute top-[16px] left-1/2 z-30 h-[22px] w-[96px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />

          <div
            className="relative overflow-hidden bg-black"
            style={{ borderRadius: 35 }}
          >
            {isCarousel ? (
              <span className="pointer-events-none absolute top-3 right-3 z-40 border border-mad-black bg-mad-black px-2 py-0.5 font-typewriter text-[0.55rem] font-bold text-mad-white">
                {safeSlideIndex + 1} / {slides.length}
              </span>
            ) : null}

            {platform === "ig_story" ? (
              <IgStoryChrome handle={handle}>
                {isVideo && mediaUrl ? (
                  <VideoFill src={mediaUrl} />
                ) : (
                  <StoryCanvas
                    model={storyModel}
                    stylePreset={stylePreset}
                    format="story_9_16"
                    canvasColor={canvasColor}
                    cutoutMode={cutoutMode}
                    visualPresets={resolvedPresets}
                    className="!aspect-auto absolute inset-0 h-full max-w-none"
                  />
                )}
              </IgStoryChrome>
            ) : null}

            {platform === "ig_feed" || platform === "facebook" ? (
              <FeedChrome
                brandName={content.brandName}
                handle={handle}
                network={platform === "facebook" ? "facebook" : "instagram"}
              >
                <FeedBody
                  mediaUrl={mediaUrl}
                  mediaType={isVideo ? "video" : "image"}
                  headline={activeSlideText || content.headline}
                  caption={content.caption}
                />
              </FeedChrome>
            ) : null}

            {platform === "tiktok" ? (
              <TikTokChrome
                handle={handle}
                caption={
                  activeSlideText || content.caption || content.headline
                }
                mediaUrl={mediaUrl}
                mediaType={isVideo ? "video" : "image"}
              />
            ) : null}

            {platform === "email" ? (
              <EmailChrome
                brandName={content.brandName}
                subject={
                  content.emailSubject || content.headline || "New arrival"
                }
                preview={
                  content.emailPreview ||
                  content.caption.slice(0, 90) ||
                  "View the piece"
                }
                mediaUrl={mediaUrl}
                mediaType={isVideo ? "video" : "image"}
                cta={content.stickerLabel || "Shop now"}
              />
            ) : null}
          </div>
        </div>

        {isCarousel ? (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => goSlide(-1)}
              className="absolute top-1/2 left-1 z-40 flex size-8 -translate-y-1/2 items-center justify-center border-2 border-mad-black bg-mad-white text-mad-black shadow-keycap-sm"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => goSlide(1)}
              className="absolute top-1/2 right-1 z-40 flex size-8 -translate-y-1/2 items-center justify-center border-2 border-mad-black bg-mad-white text-mad-black shadow-keycap-sm"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute inset-x-0 bottom-3 z-40 flex justify-center gap-1.5">
              {slides.map((slide, index) => (
                <button
                  key={slide.id ?? slide.url}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => setSlideIndex(index)}
                  className={cn(
                    "size-2 border border-mad-black transition",
                    index === safeSlideIndex
                      ? "bg-mad-lime"
                      : "bg-mad-white/40 hover:bg-mad-white/70"
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {isCarousel ? (
        <div className="mt-2 space-y-1 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm">
          <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
            Slide caption · {safeSlideIndex + 1}/{slides.length}
          </p>
          <textarea
            value={slideTexts[safeSlideIndex] ?? ""}
            onChange={(event) =>
              updateSlideText(safeSlideIndex, event.target.value)
            }
            rows={2}
            placeholder={`Caption for slide ${safeSlideIndex + 1}…`}
            className="w-full resize-none border-2 border-mad-black bg-mad-white px-2 py-1.5 font-typewriter text-xs text-mad-black outline-none focus:bg-mad-lime/20"
          />
        </div>
      ) : null}
    </div>
  )

  const platformColumn = (
    <section className="min-w-0 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm">
      <p className="mb-1.5 font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
        Platform
      </p>
      <ul className="space-y-1">
        {platformOptions.map((option) => {
          const active = platform === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setPlatform(option.id)}
                className={cn(
                  "flex w-full flex-col border-2 border-mad-black px-2 py-1.5 text-left transition",
                  active
                    ? "bg-mad-black text-mad-white shadow-keycap-sm"
                    : "bg-mad-white text-mad-black hover:bg-mad-lime"
                )}
              >
                <span className="font-typewriter text-[0.65rem] font-bold tracking-wider uppercase">
                  {option.label}
                </span>
                <span
                  className={cn(
                    "font-typewriter text-[0.55rem] tracking-wide",
                    active ? "text-mad-lime" : "text-neutral-500"
                  )}
                >
                  {option.dimensions} · {option.ratio}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )

  const stylingColumn = (
    <section className="min-w-0 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm">
      <p className="mb-1.5 font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
        Styling
      </p>

      <div className="space-y-2">
        <label className="grid gap-1">
          <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
            Story style
          </span>
          <Select
            value={stylePreset}
            onValueChange={(value) => {
              const next = value as StoryStylePreset
              if (next === "moody_noir") {
                patchPreview({
                  stylePreset: next,
                  bgPresetId: "moody_obsidian",
                  canvasColor: "#121211",
                })
                if (
                  (showCreativeControls || platform === "ig_story") &&
                  cutoutMode === "original" &&
                  !isVideo
                ) {
                  void onIsolate()
                }
              } else {
                patchPreview({
                  stylePreset: next,
                  bgPresetId: "pure_paper",
                  canvasColor: "#FFFFFF",
                })
              }
            }}
            disabled={platform !== "ig_story"}
          >
            <SelectTrigger className="h-8 rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-[0.65rem] uppercase shadow-keycap-sm disabled:opacity-40">
              <SelectValue placeholder="Style" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2 border-mad-black">
              <SelectItem value="moody_noir">Clean</SelectItem>
              <SelectItem value="magazine_editorial">Editorial</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="grid gap-1">
          <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
            Canvas
          </span>
          <Select
            value={bgPresetId}
            onValueChange={(value) => {
              if (value === "custom") {
                patchPreview({ bgPresetId: "custom" })
                colorInputRef.current?.click()
                return
              }
              const preset = CANVAS_BG_PRESETS.find((row) => row.id === value)
              if (!preset) return
              patchPreview({
                bgPresetId: preset.id,
                canvasColor: preset.hex,
              })
            }}
            disabled={platform !== "ig_story"}
          >
            <SelectTrigger className="h-8 rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-[0.65rem] uppercase shadow-keycap-sm disabled:opacity-40">
              <span
                className="size-3 border border-mad-black"
                style={{ background: canvasColor }}
              />
              <SelectValue placeholder="Canvas" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2 border-mad-black">
              {CANVAS_BG_PRESETS.slice(0, 4).map((preset) => (
                <SelectItem
                  key={preset.id}
                  value={preset.id}
                  className="font-typewriter text-[0.65rem] uppercase"
                >
                  {preset.label}
                </SelectItem>
              ))}
              <SelectItem
                value="custom"
                className="font-typewriter text-[0.65rem] uppercase"
              >
                Custom…
              </SelectItem>
            </SelectContent>
          </Select>
          <input
            ref={colorInputRef}
            type="color"
            value={canvasColor}
            onChange={(event) => {
              patchPreview({
                bgPresetId: "custom",
                canvasColor: event.target.value.toUpperCase(),
              })
            }}
            className="sr-only"
            aria-label="Custom canvas color"
          />
        </label>

        {!isVideo ? (
          <button
            type="button"
            onClick={() =>
              cutoutActive
                ? patchPreview({
                    cutoutMode: "original",
                    cutoutImageUrl: null,
                  })
                : void onIsolate()
            }
            disabled={busy === "cutout" || platform !== "ig_story"}
            className={cn(
              "inline-flex h-8 w-full items-center justify-center gap-1.5 border-2 border-mad-black px-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm transition",
              cutoutActive
                ? "bg-mad-black text-mad-white"
                : "bg-mad-white text-mad-black hover:bg-mad-lime",
              platform !== "ig_story" && "opacity-40"
            )}
          >
            {busy === "cutout" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : cutoutActive ? (
              <Undo2 className="size-3.5" />
            ) : (
              <Scissors className="size-3.5" />
            )}
            {busy === "cutout"
              ? "Cutting…"
              : cutoutActive
                ? "Undo cutout"
                : "Cut out subject"}
          </button>
        ) : null}

        {platform !== "ig_story" ? (
          <p className="font-typewriter text-[0.5rem] leading-relaxed tracking-wide text-neutral-500 uppercase">
            Story styles apply on IG Story
          </p>
        ) : null}

        {mediaSlot ? (
          <div className="border-t-2 border-mad-black pt-2">{mediaSlot}</div>
        ) : null}
      </div>
    </section>
  )

  const actionDock =
    showActionDock && actionContext ? (
            <div className="mt-2 flex w-full flex-col gap-1.5">
              {showPublishCta ? (
                <button
                  type="button"
                  onClick={() => void onPublish()}
                  disabled={busy != null}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-60"
                >
                  {busy === "publish" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Rocket className="size-3.5" />
                  )}
                  Dispatch
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => void onCopyLink()}
                  disabled={busy != null}
                  className="inline-flex h-8 items-center justify-center gap-1 border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime disabled:opacity-60"
                >
                  {busy === "link" ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : copied ? (
                    <Check className="size-3" />
                  ) : (
                    <ClipboardCopy className="size-3" />
                  )}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => void onDownload()}
                  disabled={busy != null}
                  className="inline-flex h-8 items-center justify-center gap-1 border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime disabled:opacity-60"
                >
                  {busy === "download" ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Download className="size-3" />
                  )}
                  PNG
                </button>
              </div>
            </div>
          ) : null

  const stylingDock =
    showCreativeControls || platform === "ig_story" ? (
      <div className="flex w-full max-w-[360px] flex-wrap items-center gap-1.5 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm">
        <Select
          value={bgPresetId}
          onValueChange={(value) => {
            if (value === "custom") {
              patchPreview({ bgPresetId: "custom" })
              colorInputRef.current?.click()
              return
            }
            const preset = CANVAS_BG_PRESETS.find((row) => row.id === value)
            if (!preset) return
            patchPreview({
              bgPresetId: preset.id,
              canvasColor: preset.hex,
            })
          }}
          disabled={platform !== "ig_story" || isVideo}
        >
          <SelectTrigger className="h-8 min-w-[7rem] flex-1 rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-[0.6rem] uppercase shadow-keycap-sm disabled:opacity-40">
            <span
              className="size-3 border border-mad-black"
              style={{ background: canvasColor }}
            />
            <SelectValue placeholder="Canvas" />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            {CANVAS_BG_PRESETS.slice(0, 4).map((preset) => (
              <SelectItem
                key={preset.id}
                value={preset.id}
                className="font-typewriter text-[0.65rem] uppercase"
              >
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value="custom" className="font-typewriter text-[0.65rem] uppercase">
              Custom…
            </SelectItem>
          </SelectContent>
        </Select>
        <input
          ref={colorInputRef}
          type="color"
          value={canvasColor}
          onChange={(event) => {
            patchPreview({
              bgPresetId: "custom",
              canvasColor: event.target.value.toUpperCase(),
            })
          }}
          className="sr-only"
          aria-label="Custom canvas color"
        />
        {!isVideo ? (
          <button
            type="button"
            onClick={() =>
              cutoutActive
                ? patchPreview({
                    cutoutMode: "original",
                    cutoutImageUrl: null,
                  })
                : void onIsolate()
            }
            disabled={busy === "cutout" || platform !== "ig_story"}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1 border-2 border-mad-black px-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm",
              cutoutActive
                ? "bg-mad-black text-mad-white"
                : "bg-mad-white text-mad-black hover:bg-mad-lime",
              platform !== "ig_story" && "opacity-40"
            )}
          >
            {busy === "cutout" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : cutoutActive ? (
              <Undo2 className="size-3.5" />
            ) : (
              <Scissors className="size-3.5" />
            )}
            Cutout
          </button>
        ) : null}
      </div>
    ) : null

  if (workbench && stacked && lockedViewport) {
    return (
      <div className={cn("flex w-full flex-col items-center gap-2", className)}>
        {stylingDock}
        {phoneShell}
        {actionDock}
      </div>
    )
  }

  if (workbench && stacked) {
    return (
      <div className={cn("flex w-full flex-col gap-3", className)}>
        <div className="mx-auto w-full max-w-[360px] shrink-0">
          {phoneShell}
          {actionDock}
        </div>
        {hidePlatformSwitcher ? null : (
        <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
          {platformOptions.map((option) => {
            const active = platform === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPlatform(option.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-2 border-mad-black px-2 py-1",
                  active
                    ? "bg-mad-black text-mad-white"
                    : "bg-mad-white text-mad-black hover:bg-mad-lime"
                )}
              >
                <span className="font-typewriter text-[0.6rem] font-bold tracking-wider uppercase">
                  {option.label}
                </span>
                <span className="font-typewriter text-[0.5rem] opacity-70">
                  {option.ratio}
                </span>
              </button>
            )
          })}
        </div>
        )}
        {hidePlatformSwitcher ? null : stylingColumn}
      </div>
    )
  }

  if (workbench) {
    return (
      <div
        className={cn(
          "flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-4",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {hidePlatformSwitcher ? null : platformColumn}
          {hidePlatformSwitcher ? stylingDock : stylingColumn}
        </div>
        <div className="mx-auto w-full max-w-[300px] shrink-0 sm:mx-0">
          {phoneShell}
          {actionDock}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="flex w-[280px] max-w-full flex-wrap justify-center gap-1">
        {hidePlatformSwitcher
          ? null
          : platformOptions.map((option) => {
              const active = platform === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPlatform(option.id)}
                  className={cn(
                    "flex items-center gap-1.5 border-2 border-mad-black px-2 py-1 text-left",
                    active
                      ? "bg-mad-black text-mad-white"
                      : "bg-mad-white text-mad-black hover:bg-mad-lime"
                  )}
                >
                  <span className="font-typewriter text-[0.6rem] font-bold tracking-wider uppercase">
                    {option.label}
                  </span>
                  <span className="font-typewriter text-[0.5rem] opacity-70">
                    {option.ratio}
                  </span>
                </button>
              )
            })}
      </div>
      {phoneShell}
    </div>
  )
}

function IgStoryChrome({
  handle,
  children,
}: {
  handle: string
  children: ReactNode
}) {
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-950">
      {children}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 px-3 pt-3">
        <div className="flex gap-1">
          <span className="h-[2px] flex-1 rounded-full bg-white" />
          <span className="h-[2px] flex-1 rounded-full bg-white/35" />
          <span className="h-[2px] flex-1 rounded-full bg-white/35" />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-rose-400 text-[0.55rem] font-bold text-white">
            {handle.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[0.7rem] font-semibold text-white drop-shadow">
            @{handle}
          </span>
          <span className="text-[0.65rem] text-white/70">3h</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/50 to-transparent px-3 pt-8 pb-4">
        <div className="flex-1 rounded-full border border-white/40 px-3 py-2 text-[0.7rem] text-white/80">
          Send message
        </div>
        <Heart className="size-5 text-white" />
        <Share2 className="size-5 text-white" />
      </div>
    </div>
  )
}

function FeedChrome({
  brandName,
  handle,
  network,
  children,
}: {
  brandName: string
  handle: string
  network: "instagram" | "facebook"
  children: ReactNode
}) {
  return (
    <div className="flex aspect-[4/5] w-full flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-neutral-100 px-3 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-[0.65rem] font-bold text-white">
          {brandName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.75rem] font-semibold text-neutral-900">
            {network === "facebook" ? brandName : handle}
          </p>
          <p className="text-[0.6rem] text-neutral-500">
            {network === "facebook" ? "Sponsored · Whangārei" : "Whangārei"}
          </p>
        </div>
        <MoreHorizontal className="size-4 text-neutral-500" />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-3.5">
          <Heart className="size-5 text-neutral-900" />
          <MessageCircle className="size-5 text-neutral-900" />
          <Share2 className="size-5 text-neutral-900" />
        </div>
        <Bookmark className="size-5 text-neutral-900" />
      </div>
    </div>
  )
}

function VideoFill({ src }: { src: string }) {
  const [muted, setMuted] = useState(true)
  return (
    <div className="absolute inset-0">
      <video
        src={src}
        className="h-full w-full object-cover"
        autoPlay
        loop
        muted={muted}
        playsInline
      />
      <button
        type="button"
        onClick={() => setMuted((value) => !value)}
        className="absolute right-2 bottom-2 z-30 border border-white/40 bg-black/55 px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider text-white uppercase"
      >
        {muted ? "Sound off" : "Sound on"}
      </button>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    </div>
  )
}

function FeedBody({
  mediaUrl,
  mediaType,
  headline,
  caption,
}: {
  mediaUrl: string | null
  mediaType: "image" | "video"
  headline: string
  caption: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-100">
        {mediaUrl && mediaType === "video" ? (
          <VideoFill src={mediaUrl} />
        ) : mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-neutral-400">
            Add media
          </div>
        )}
      </div>
      <div className="shrink-0 space-y-1 px-3 py-2">
        <p className="line-clamp-1 text-[0.75rem] font-semibold text-neutral-900">
          {headline}
        </p>
        <p className="line-clamp-2 text-[0.7rem] leading-relaxed text-neutral-600">
          {caption}
        </p>
      </div>
    </div>
  )
}

function TikTokChrome({
  handle,
  caption,
  mediaUrl,
  mediaType,
}: {
  handle: string
  caption: string
  mediaUrl: string | null
  mediaType: "image" | "video"
}) {
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-950">
      {mediaUrl && mediaType === "video" ? (
        <VideoFill src={mediaUrl} />
      ) : mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
      )}
      {mediaType === "image" ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      ) : null}

      <div className="absolute top-1/3 right-3 z-10 flex flex-col items-center gap-4 text-white">
        <div className="flex flex-col items-center gap-1">
          <Heart className="size-7 fill-white" />
          <span className="text-[0.6rem]">24.1K</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <MessageCircle className="size-7" />
          <span className="text-[0.6rem]">312</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Bookmark className="size-7" />
          <span className="text-[0.6rem]">Save</span>
        </div>
        <Disc3 className="size-8 animate-spin [animation-duration:4s]" />
      </div>

      <div className="absolute right-14 bottom-8 left-4 z-10 space-y-1.5">
        <p className="text-sm font-semibold text-white">@{handle}</p>
        <p className="line-clamp-3 text-[0.75rem] leading-snug text-white/95">
          {caption}
        </p>
      </div>
    </div>
  )
}

function EmailChrome({
  brandName,
  subject,
  preview,
  mediaUrl,
  mediaType,
  cta,
}: {
  brandName: string
  subject: string
  preview: string
  mediaUrl: string | null
  mediaType: "image" | "video"
  cta: string
}) {
  return (
    <div className="aspect-[9/16] w-full overflow-y-auto bg-[#f2f2f7]">
      <div className="border-b border-neutral-200 bg-white px-4 pb-3 pt-12">
        <p className="text-[0.65rem] font-medium tracking-wide text-neutral-500 uppercase">
          Inbox
        </p>
        <p className="mt-1 text-base font-semibold text-neutral-900">{subject}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {brandName} · {preview}
        </p>
      </div>
      <div className="m-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {mediaUrl && mediaType === "video" ? (
          <video
            src={mediaUrl}
            className="aspect-[16/10] w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt=""
            className="aspect-[16/10] w-full object-cover"
          />
        ) : (
          <div className="aspect-[16/10] bg-neutral-100" />
        )}
        <div className="space-y-3 p-4">
          <p className="text-sm font-semibold text-neutral-900">{subject}</p>
          <p className="text-xs leading-relaxed text-neutral-600">{preview}</p>
          <button
            type="button"
            className="w-full rounded-full bg-neutral-900 py-2.5 text-xs font-semibold text-white"
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  )
}

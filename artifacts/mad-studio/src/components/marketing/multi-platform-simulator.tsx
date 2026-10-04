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
import { trackableUrl, type VideoAudioMode } from "@/lib/social/types"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"
import {
  CanvasTextOverlayEditor,
  CanvasTextOverlayLayer,
} from "@/components/studio/canvas-text-overlay"
import {
  canvasOverlayHasDecor,
  DEFAULT_CANVAS_TEXT_OVERLAY,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"
import {
  bakeCanvasTextOnImage,
  canvasOverlayNeedsBake,
} from "@/lib/media/bake-canvas-text"
import {
  RemotionCanvas,
  type RemotionCanvasProps,
} from "@/components/studio/remotion-canvas"
import {
  buildRemotionBadgeOverlay,
  buildRemotionTextOverlays,
  remotionCompositionSize,
} from "@/lib/studio/remotion-overlays"
import {
  AUTOPILOT_SOP_HELPER,
  DRAFT_DROP_SOP_HELPER,
  TIKTOK_API_SOP_HELPER,
  dispatchTrackForPlatform,
} from "@/lib/studio/dispatch-sop"
import { cn } from "@/lib/utils"

export type SimulatorPlatform =
  | "ig_story"
  | "ig_feed"
  | "tiktok"
  | "facebook"
  | "email"

export type SimulatorContent = {
  brandName: string
  /** When set, feed/story handle row uses this instead of slugified brand. */
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
  marketingEntityId?: string | null
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
  publishCtaLabel?: string
  onDispatchSuccess?: () => void
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
  /** Controlled carousel slide (sync with Media Tray selection). */
  slideIndex?: number
  onSlideIndexChange?: (index: number) => void
  textOverlay?: CanvasTextOverlayState | null
  onTextOverlayChange?: (next: CanvasTextOverlayState) => void
  showTextStyler?: boolean
  /** Hide Story Style / canvas styling row (cutout lives in Step Media controls). */
  hideStylingDock?: boolean
  /** Increment to trigger subject isolation from outside the simulator. */
  externalCutoutRequestId?: number
  /** Drag on-canvas text inside the media frame (Customize step). */
  textOverlayInteractive?: boolean
  /** Today quick preview — phone, platform pills, and action dock only. */
  previewMinimal?: boolean
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

function carouselItemUrl(row: SimulatorCarouselItem): string {
  return (row.publicUrl || row.url || "").trim()
}

function mediaUrlsMatch(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return false
  if (left === right) return true
  return left.replace(/\/$/, "") === right.replace(/\/$/, "")
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

function buildRemotionPreviewInput({
  mediaUrl,
  mediaType,
  mediaFit,
  aspect,
  textOverlay,
  includeOverlays,
}: {
  mediaUrl: string
  mediaType: "video" | "image"
  mediaFit: "cover" | "contain"
  aspect: "story" | "feed"
  textOverlay: CanvasTextOverlayState
  includeOverlays: boolean
}): RemotionCanvasProps {
  const { width, height } = remotionCompositionSize(aspect)
  return {
    mediaUrl: mediaUrl.trim(),
    mediaType,
    mediaFit,
    compositionWidth: width,
    compositionHeight: height,
    textOverlays: includeOverlays
      ? buildRemotionTextOverlays(textOverlay)
      : [],
    badge: includeOverlays ? buildRemotionBadgeOverlay(textOverlay) : null,
  }
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
  publishCtaLabel = "Confirm & Publish Live",
  onDispatchSuccess,
  compact = false,
  stacked = false,
  mediaSlot = null,
  storyPreview: controlledPreview,
  onStoryPreviewChange,
  actionContext = null,
  metaChannelsOnly = false,
  hidePlatformSwitcher = false,
  lockedViewport = false,
  slideIndex: controlledSlideIndex,
  onSlideIndexChange,
  textOverlay: controlledTextOverlay = null,
  onTextOverlayChange,
  showTextStyler = false,
  hideStylingDock = false,
  externalCutoutRequestId = 0,
  textOverlayInteractive = false,
  previewMinimal = false,
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
  const [videoAudioMode, setVideoAudioMode] =
    useState<VideoAudioMode>("preserve")
  const [uncontrolledSlideIndex, setUncontrolledSlideIndex] = useState(0)
  const [localSlideTexts, setLocalSlideTexts] = useState<string[]>([])
  const [localTextOverlay, setLocalTextOverlay] =
    useState<CanvasTextOverlayState>(DEFAULT_CANVAS_TEXT_OVERLAY)
  const textOverlay = controlledTextOverlay ?? localTextOverlay

  function setTextOverlay(next: CanvasTextOverlayState) {
    if (controlledTextOverlay == null) setLocalTextOverlay(next)
    onTextOverlayChange?.(next)
  }

  const slideIndex = controlledSlideIndex ?? uncontrolledSlideIndex

  function setSlideIndex(next: number | ((current: number) => number)) {
    const base = controlledSlideIndex ?? uncontrolledSlideIndex
    const resolved = typeof next === "function" ? next(base) : next
    const clamped = Math.min(
      Math.max(resolved, 0),
      Math.max(slides.length - 1, 0)
    )
    if (controlledSlideIndex == null) {
      setUncontrolledSlideIndex(clamped)
    }
    onSlideIndexChange?.(clamped)
  }

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
  const feedCarousel =
    isCarousel && (platform === "ig_feed" || platform === "facebook")
  const storyCarousel = isCarousel && platform === "ig_story"
  const safeSlideIndex = Math.min(
    Math.max(slideIndex, 0),
    Math.max(slides.length - 1, 0)
  )
  const activeSlide = slides[safeSlideIndex] ?? null

  const slidesFingerprint = slides.map((row) => row.id ?? row.url).join("|")

  useEffect(() => {
    setSlideIndex((current) =>
      Math.min(Math.max(current, 0), Math.max(slides.length - 1, 0))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp when slide set changes
  }, [slidesFingerprint])

  useEffect(() => {
    if (slides.length === 0 || !activeMedia?.url) return
    const needle = activeMedia.url.trim()
    const idx = slides.findIndex((row) => {
      const slideUrl = carouselItemUrl(row)
      return (
        mediaUrlsMatch(slideUrl, needle) ||
        mediaUrlsMatch(row.url, needle) ||
        (row.publicUrl != null && mediaUrlsMatch(row.publicUrl, needle))
      )
    })
    if (idx >= 0) {
      setSlideIndex(idx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync tray → slide
  }, [activeMedia?.url, slidesFingerprint])

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
    const next = safeSlideIndex + delta
    if (next < 0) setSlideIndex(slides.length - 1)
    else if (next >= slides.length) setSlideIndex(0)
    else setSlideIndex(next)
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
    ? compact
      ? "h-[532px] w-[272px] shrink-0"
      : "h-[700px] w-[360px] shrink-0"
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

  const lastExternalCutoutRequest = useRef(0)
  useEffect(() => {
    if (
      externalCutoutRequestId <= 0 ||
      externalCutoutRequestId === lastExternalCutoutRequest.current
    ) {
      return
    }
    lastExternalCutoutRequest.current = externalCutoutRequestId
    void onIsolate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit external trigger
  }, [externalCutoutRequestId])

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
          ? trackableUrl(trackableSlug, actionContext.entityId)
          : (await ensureLink()).shortUrl
      await navigator.clipboard.writeText(short)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2800)
      toast.success("Link copied — ready for IG Link sticker.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed.")
    } finally {
      setBusy(null)
    }
  }

  async function onPublish(options?: { allowDraftDrop?: boolean }) {
    if (!actionContext) return
    if (
      dispatchTrackForPlatform(platform) !== "autopilot" &&
      !options?.allowDraftDrop
    ) {
      toast.message(
        "Stories and TikTok use Draft & Drop — download media and copy the link sticker URL."
      )
      return
    }
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
          spokenHook: content.headline,
          ...(isVideo
            ? { videoAudioMode, tiktokVideoAudioMode: videoAudioMode }
            : {}),
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
      toast.success(payload.message || "Published live to feed.")
      onDispatchSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed.")
    } finally {
      setBusy(null)
    }
  }

  async function downloadImageFile(sourceUrl: string, fileName: string) {
    const response = await fetch(sourceUrl, { cache: "no-store" })
    if (!response.ok) throw new Error("Could not fetch image file.")
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.download = fileName
    anchor.href = objectUrl
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  }

  async function onDownload() {
    const node = captureRef.current
    const downloadMediaUrl = resolvedMedia?.url ?? null
    const fileStem = content.brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
    setBusy("download")
    try {
      if (
        isVideo &&
        downloadMediaUrl &&
        !downloadMediaUrl.startsWith("blob:") &&
        !downloadMediaUrl.startsWith("data:")
      ) {
        let fetchUrl = downloadMediaUrl
        if (videoAudioMode === "mute") {
          if (!actionContext?.entityId) {
            throw new Error("Missing entity context to prepare silent video.")
          }
          const prep = await fetch("/api/media/prepare-publish-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityId: actionContext.entityId,
              mediaUrl: downloadMediaUrl,
              videoAudioMode: "mute",
            }),
          })
          const prepPayload = (await prep.json()) as {
            error?: string
            url?: string
          }
          if (!prep.ok || !prepPayload.url) {
            throw new Error(
              prepPayload.error || "Could not prepare silent video."
            )
          }
          fetchUrl = prepPayload.url
        }
        const response = await fetch(fetchUrl)
        if (!response.ok) throw new Error("Could not fetch video file.")
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.download = `${fileStem}-${platform}.mp4`
        anchor.href = objectUrl
        anchor.click()
        URL.revokeObjectURL(objectUrl)
        toast.success("MP4 downloaded — ready for Story/Reel upload.")
        return
      }

      const baseImageUrl =
        downloadMediaUrl ||
        displayImageUrl ||
        originalImageUrl ||
        null
      if (
        baseImageUrl &&
        !baseImageUrl.startsWith("blob:") &&
        !baseImageUrl.startsWith("data:")
      ) {
        let exportUrl = baseImageUrl
        if (canvasOverlayNeedsBake(textOverlay)) {
          if (!actionContext?.entityId) {
            throw new Error("Missing entity context for text bake.")
          }
          exportUrl = await bakeCanvasTextOnImage({
            entityId: actionContext.entityId,
            marketingEntityId: actionContext.marketingEntityId,
            sourceUrl: baseImageUrl,
            overlay: textOverlay,
          })
        }
        await downloadImageFile(
          exportUrl,
          `${fileStem}-${platform}-9x16.png`
        )
        toast.success(
          canvasOverlayHasDecor(textOverlay)
            ? "9:16 image downloaded with your Canvas on-screen text only."
            : "9:16 image downloaded — clean media, no caption burned in."
        )
        return
      }

      if (!node) return
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        width: node.offsetWidth,
        height: node.offsetHeight,
      })
      const anchor = document.createElement("a")
      anchor.download = `${fileStem}-${platform}-9x16.png`
      anchor.href = dataUrl
      anchor.click()
      toast.success("9:16 image downloaded — ready for Story/Reel upload.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.")
    } finally {
      setBusy(null)
    }
  }

  const cutoutActive = cutoutMode !== "original"
  const mediaUrl = resolvedMedia?.url ?? null
  const workbench = !compact
  const isFudiEntity = isFudiStudioEntity({
    name: content.brandName,
    industry,
  })
  /** FÜDI intake = full-bleed dish/reel stories, not consignment cutout cards. */
  const useStoryCanvasForIg =
    !isFudiEntity && (cutoutMode !== "original" || Boolean(item))

  const isFeedPreview =
    platform === "ig_feed" || platform === "facebook"

  const stageAspectClass =
    isFeedPreview
      ? ""
      : platform === "ig_story" || platform === "tiktok"
        ? "aspect-[9/16]"
        : platform === "email"
          ? "aspect-[9/16]"
          : "aspect-[9/16]"

  const canvasHeadlineLive =
    textOverlay.enabled && textOverlay.headline.trim()
      ? textOverlay.headline.trim()
      : ""
  const feedPreviewCaption = (() => {
    const captionBody = content.caption.trim()
    if (captionBody) return captionBody
    if (canvasHeadlineLive) {
      return activeSlideText?.trim() || ""
    }
    return activeSlideText || content.headline.trim() || ""
  })()

  const remotionAspect: "story" | "feed" = isFeedPreview ? "feed" : "story"
  const remotionMediaFit: "cover" | "contain" = isFudiEntity ? "cover" : "contain"
  /** Studio wizard preview always uses DOM canvas text (WYSIWYG with Step 3). Remotion is for video playback / export only. */
  const remotionIncludeOverlays = false
  const usingRemotionForMedia = Boolean(
    (mediaUrl && isVideo) ||
      (isFeedPreview &&
        slides.some((slide) => carouselItemUrl(slide).length > 0))
  )
  const remotionDefersOverlays = false
  const spokenHook = content.headline.trim()
  const imageRemotionPreview = null
  const videoRemotionPreview =
    mediaUrl && isVideo
      ? buildRemotionPreviewInput({
          mediaUrl,
          mediaType: "video",
          mediaFit: remotionMediaFit,
          aspect: remotionAspect,
          textOverlay,
          includeOverlays: false,
        })
      : null

  const canvasEditActive =
    textOverlayInteractive && Boolean(onTextOverlayChange)

  const canvasOverlayOnMedia = (
    <CanvasTextOverlayLayer
      overlay={textOverlay}
      isVideo={isVideo}
      interactive={canvasEditActive}
      onOverlayChange={onTextOverlayChange ?? setTextOverlay}
      renderCanvasText={!remotionDefersOverlays}
    />
  )

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
            className={cn(
              "relative flex bg-black",
              isFeedPreview
                ? "min-h-0 w-full overflow-y-auto overflow-x-hidden"
                : canvasEditActive
                  ? "overflow-visible"
                  : "overflow-hidden",
              lockedViewport
                ? isFeedPreview
                  ? cn(
                      "w-full items-stretch justify-start",
                      compact ? "h-[472px]" : "h-[622px]"
                    )
                  : cn(
                      "w-full items-center justify-center",
                      compact ? "h-[472px]" : "h-[622px]"
                    )
                : "min-h-[280px] w-full items-center justify-center"
            )}
            style={{ borderRadius: 35 }}
          >
            <div
              className={cn(
                "relative max-w-full",
                isFeedPreview
                  ? "w-full shrink-0"
                  : cn(
                      "max-h-full",
                      canvasEditActive ? "overflow-visible" : "overflow-hidden",
                      stageAspectClass,
                      lockedViewport ? "h-full w-auto" : "w-full"
                    )
              )}
            >
              {platform === "ig_story" ? (
                <IgStoryChrome
                  handle={handle}
                  slideCount={slides.length}
                  activeSlideIndex={safeSlideIndex}
                  allowMediaOverflow={canvasEditActive}
                  onSegmentSelect={
                    storyCarousel
                      ? (index) => setSlideIndex(index)
                      : undefined
                  }
                >
                  <StorySlideNav
                    enabled={storyCarousel}
                    slideIndex={safeSlideIndex}
                    slideCount={slides.length}
                    onPrev={() => goSlide(-1)}
                    onNext={() => goSlide(1)}
                  >
                    {isVideo && mediaUrl ? (
                      <VideoFill
                        src={mediaUrl}
                        fit={isFudiEntity ? "cover" : "contain"}
                        remotionPreview={videoRemotionPreview}
                        mediaOverlay={canvasOverlayOnMedia}
                        allowCanvasOverflow={canvasEditActive}
                      />
                    ) : imageForCanvas ? (
                      <StoryMediaStage
                        imageUrl={imageForCanvas}
                        canvasColor={canvasColor}
                        mediaFit={isFudiEntity ? "cover" : "contain"}
                        remotionPreview={imageRemotionPreview}
                        mediaOverlay={canvasOverlayOnMedia}
                        allowCanvasOverflow={canvasEditActive}
                        storyCanvas={
                          <StoryCanvas
                            model={storyModel}
                            stylePreset={stylePreset}
                            format="story_9_16"
                            canvasColor={canvasColor}
                            cutoutMode={cutoutMode}
                            visualPresets={resolvedPresets}
                            className="!aspect-auto h-full w-full max-w-none"
                          />
                        }
                        useStoryCanvas={useStoryCanvasForIg}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-neutral-950 text-xs text-neutral-500">
                        Add media
                      </div>
                    )}
                  </StorySlideNav>
                </IgStoryChrome>
              ) : null}

              {isFeedPreview ? (
                <FeedChrome
                  brandName={content.brandName}
                  handle={handle}
                  network={platform === "facebook" ? "facebook" : "instagram"}
                  hookLine={
                    textOverlay.enabled && textOverlay.headline.trim()
                      ? activeSlideText || ""
                      : activeSlideText || content.headline
                  }
                  caption={feedPreviewCaption}
                >
                  <FeedMediaStage
                    slides={slides}
                    slideIndex={safeSlideIndex}
                    onSlideIndexChange={setSlideIndex}
                    onPrev={() => goSlide(-1)}
                    onNext={() => goSlide(1)}
                    showCarousel={feedCarousel}
                    canvasOverlay={canvasOverlayOnMedia}
                    canvasOverlayInteractive={canvasEditActive}
                    textOverlay={textOverlay}
                    spokenHook={spokenHook}
                    remotionIncludeOverlays={remotionDefersOverlays}
                    mediaFit={remotionMediaFit}
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
                  remotionPreview={
                    isVideo ? videoRemotionPreview : imageRemotionPreview
                  }
                  mediaOverlay={canvasOverlayOnMedia}
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
        </div>
      </div>

      {feedCarousel && !(textOverlay.enabled && textOverlay.headline.trim()) ? (
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
        {showTextStyler ? (
          <CanvasTextOverlayEditor
            value={textOverlay}
            onChange={setTextOverlay}
            isVideo={isVideo}
          />
        ) : null}
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

  const dispatchTrack = dispatchTrackForPlatform(platform)
  const linkStickerPath = trackableSlug
    ? `/r/${trackableSlug}`
    : "/r/…"

  const actionDock =
    showActionDock && actionContext ? (
      <div className="mt-2 flex w-full flex-col gap-2">
        {isVideo ? (
          <div className="space-y-1 border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm">
            <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
              Video audio
            </p>
            <Select
              value={videoAudioMode}
              onValueChange={(value) =>
                setVideoAudioMode(value as VideoAudioMode)
              }
              disabled={busy != null}
            >
              <SelectTrigger className="h-9 w-full rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-[0.55rem] uppercase shadow-keycap-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-mad-black">
                <SelectItem
                  value="preserve"
                  className="font-typewriter text-[0.55rem] uppercase"
                >
                  Keep original audio
                </SelectItem>
                <SelectItem
                  value="mute"
                  className="font-typewriter text-[0.55rem] uppercase"
                >
                  No audio (add music in-app)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="font-typewriter text-[0.48rem] leading-relaxed tracking-wide text-neutral-500 normal-case">
              {videoAudioMode === "mute"
                ? "Applies to download and API publish — silent MP4 for TikTok, Reels, or Facebook."
                : platform === "tiktok"
                  ? "TikTok Direct Post re-encodes to AAC before upload; other platforms send your file as-is."
                  : "Original soundtrack is kept for autopilot publish; TikTok API posts still optimize AAC when you switch to TikTok."}
            </p>
          </div>
        ) : null}
        {dispatchTrack === "autopilot" && showPublishCta ? (
          <>
            <button
              type="button"
              onClick={() => void onPublish()}
              disabled={busy != null}
              className="inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-60"
            >
              {busy === "publish" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Rocket className="size-3.5" />
              )}
              {publishCtaLabel.startsWith("🚀")
                ? publishCtaLabel
                : `🚀 ${publishCtaLabel}`}
            </button>
            <p className="font-typewriter text-[0.48rem] leading-relaxed tracking-wide text-neutral-500 normal-case">
              {AUTOPILOT_SOP_HELPER}
            </p>
          </>
        ) : null}

        {dispatchTrack === "draft_drop" ? (
          <>
            <button
              type="button"
              onClick={() => void onDownload()}
              disabled={busy != null}
              className="inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-60"
            >
              {busy === "download" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              📥 Download ready media (9:16)
            </button>
            <button
              type="button"
              onClick={() => void onCopyLink()}
              disabled={busy != null}
              className={cn(
                "inline-flex min-h-9 w-full items-center justify-center gap-2 border-2 border-mad-black px-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm transition-colors disabled:opacity-60",
                copied
                  ? "animate-pulse bg-mad-lime text-mad-black"
                  : "bg-mad-vermillion text-mad-white hover:bg-mad-black"
              )}
            >
              {busy === "link" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : copied ? (
                <Check className="size-3.5" />
              ) : (
                <ClipboardCopy className="size-3.5" />
              )}
              {copied
                ? "✓ Link copied — ready for IG sticker"
                : `📋 Copy link sticker URL (${linkStickerPath})`}
            </button>
            <p className="font-typewriter text-[0.48rem] leading-relaxed tracking-wide text-neutral-500 normal-case">
              {DRAFT_DROP_SOP_HELPER}
            </p>
            {platform === "tiktok" ? (
              <>
                <button
                  type="button"
                  onClick={() => void onPublish({ allowDraftDrop: true })}
                  disabled={busy != null}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-white font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime disabled:opacity-60"
                >
                  {busy === "publish" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Rocket className="size-3.5" />
                  )}
                  Send via TikTok API
                </button>
                <p className="font-typewriter text-[0.48rem] leading-relaxed tracking-wide text-neutral-500 normal-case">
                  {TIKTOK_API_SOP_HELPER}
                </p>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    ) : null

  const stylingDock =
    previewMinimal || hideStylingDock
      ? null
      : showCreativeControls || platform === "ig_story" ? (
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
        {showTextStyler && !previewMinimal ? (
          <CanvasTextOverlayEditor
            value={textOverlay}
            onChange={setTextOverlay}
            isVideo={isVideo}
            className="w-full max-w-[360px]"
          />
        ) : null}
        {hidePlatformSwitcher || previewMinimal ? null : stylingColumn}
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

function StorySlideNav({
  enabled,
  slideIndex,
  slideCount,
  onPrev,
  onNext,
  children,
}: {
  enabled: boolean
  slideIndex: number
  slideCount: number
  onPrev: () => void
  onNext: () => void
  children: ReactNode
}) {
  if (!enabled) {
    return <div className="relative size-full">{children}</div>
  }

  return (
    <div className="relative size-full">
      {children}
      <button
        type="button"
        aria-label="Previous story slide"
        onClick={onPrev}
        className="absolute inset-y-0 left-0 z-40 w-[30%] cursor-w-resize bg-transparent"
      />
      <button
        type="button"
        aria-label="Next story slide"
        onClick={onNext}
        className="absolute inset-y-0 right-0 z-40 w-[30%] cursor-e-resize bg-transparent"
      />
      <button
        type="button"
        aria-label="Previous slide"
        onClick={onPrev}
        className="absolute top-1/2 left-1.5 z-50 flex size-8 -translate-y-1/2 items-center justify-center border-2 border-mad-black bg-mad-white/95 font-typewriter text-sm font-bold text-mad-black shadow-keycap-sm transition hover:bg-mad-lime"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={onNext}
        className="absolute top-1/2 right-1.5 z-50 flex size-8 -translate-y-1/2 items-center justify-center border-2 border-mad-black bg-mad-white/95 font-typewriter text-sm font-bold text-mad-black shadow-keycap-sm transition hover:bg-mad-lime"
      >
        ›
      </button>
      <span className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2 border border-mad-black bg-mad-black/80 px-2 py-0.5 font-typewriter text-[0.5rem] font-bold text-mad-white">
        {slideIndex + 1}/{slideCount}
      </span>
    </div>
  )
}

function IgStoryChrome({
  handle,
  children,
  slideCount = 1,
  activeSlideIndex = 0,
  onSegmentSelect,
  allowMediaOverflow = false,
}: {
  handle: string
  children: ReactNode
  slideCount?: number
  activeSlideIndex?: number
  onSegmentSelect?: (index: number) => void
  allowMediaOverflow?: boolean
}) {
  const segments = Math.max(slideCount, 1)
  return (
    <div className="relative flex aspect-[9/16] h-full w-full flex-col overflow-hidden bg-neutral-950">
      <div className="relative z-10 flex h-[15%] min-h-[72px] shrink-0 flex-col justify-end gap-2 px-3 pb-2">
        <div className="flex gap-1">
          {Array.from({ length: segments }).map((_, index) => (
            <button
              key={`seg-${index}`}
              type="button"
              aria-label={`Story slide ${index + 1}`}
              disabled={!onSegmentSelect}
              onClick={() => onSegmentSelect?.(index)}
              className={cn(
                "h-[2px] flex-1 rounded-full transition",
                index === activeSlideIndex ? "bg-white" : "bg-white/35",
                onSegmentSelect && "hover:bg-white/70"
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-rose-400 text-[0.55rem] font-bold text-white">
            {handle.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-[0.7rem] font-semibold text-white drop-shadow">
            @{handle}
          </span>
          <span className="text-[0.65rem] text-white/70">2h ago</span>
        </div>
      </div>

      <div
        className={cn(
          "relative z-0 min-h-0 flex-1",
          allowMediaOverflow ? "overflow-visible" : "overflow-hidden"
        )}
      >
        {children}
      </div>

      <div className="relative z-10 flex h-[15%] min-h-[64px] shrink-0 items-center gap-2 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pt-4 pb-3">
        <div className="flex-1 rounded-full border border-white/40 px-3 py-2 text-[0.7rem] text-white/80">
          Send message…
        </div>
        <Heart className="size-5 shrink-0 text-white" />
        <Share2 className="size-5 shrink-0 text-white" />
      </div>
    </div>
  )
}

function StoryMediaStage({
  imageUrl,
  canvasColor,
  storyCanvas,
  useStoryCanvas,
  mediaFit = "contain",
  mediaOverlay = null,
  remotionPreview = null,
  allowCanvasOverflow = false,
}: {
  imageUrl: string
  canvasColor: string
  storyCanvas: ReactNode
  useStoryCanvas: boolean
  mediaFit?: "cover" | "contain"
  mediaOverlay?: ReactNode
  remotionPreview?: RemotionCanvasProps | null
  allowCanvasOverflow?: boolean
}) {
  const overflowClass = allowCanvasOverflow ? "overflow-visible" : "overflow-hidden"

  if (useStoryCanvas) {
    return (
      <div className={cn("relative size-full", overflowClass)}>
        {storyCanvas}
        {mediaOverlay}
      </div>
    )
  }

  if (remotionPreview) {
    return (
      <div
        className={cn("relative size-full", overflowClass)}
        style={
          mediaFit === "contain" ? { backgroundColor: canvasColor } : undefined
        }
      >
        <RemotionCanvas {...remotionPreview} />
        {mediaOverlay}
      </div>
    )
  }

  if (mediaFit === "cover") {
    return (
      <div className={cn("relative size-full bg-black", overflowClass)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        {mediaOverlay}
      </div>
    )
  }

  return (
    <div
      className={cn("relative size-full", overflowClass)}
      style={{ backgroundColor: canvasColor }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-xl"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            "relative max-h-full max-w-full",
            allowCanvasOverflow && "overflow-visible"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="max-h-full max-w-full object-contain shadow-lg"
          />
          {mediaOverlay}
        </div>
      </div>
    </div>
  )
}

function FeedChrome({
  brandName,
  handle,
  network,
  hookLine,
  caption,
  children,
}: {
  brandName: string
  handle: string
  network: "instagram" | "facebook"
  hookLine?: string
  caption?: string
  children: ReactNode
}) {
  const hook = hookLine?.trim() ?? ""
  const body = caption?.trim() ?? ""
  const showHookLine = Boolean(hook && hook !== body)

  return (
    <div className="flex w-full flex-col bg-white">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-neutral-100 px-3 py-2">
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
      <div className="shrink-0">{children}</div>
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3.5">
          <Heart className="size-5 text-neutral-900" />
          <MessageCircle className="size-5 text-neutral-900" />
          <Share2 className="size-5 text-neutral-900" />
        </div>
        <Bookmark className="size-5 text-neutral-900" />
      </div>
      <div className="shrink-0 space-y-0.5 px-3 pb-3">
        {showHookLine ? (
          <p className="line-clamp-2 text-[0.7rem] font-semibold leading-snug text-neutral-900">
            {hook}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap text-[0.65rem] leading-relaxed text-neutral-800">
          <span className="font-semibold text-neutral-900">
            {network === "facebook" ? brandName : handle}{" "}
          </span>
          {body ? (
            body
          ) : (
            <span className="text-neutral-400">
              Hook and caption preview here…
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

function VideoFill({
  src,
  fit = "cover",
  mediaOverlay = null,
  remotionPreview = null,
  allowCanvasOverflow = false,
}: {
  src: string
  fit?: "cover" | "contain"
  mediaOverlay?: ReactNode
  remotionPreview?: RemotionCanvasProps | null
  allowCanvasOverflow?: boolean
}) {
  const [muted, setMuted] = useState(true)
  return (
    <div
      className={cn(
        "absolute inset-0",
        allowCanvasOverflow ? "overflow-visible" : "overflow-hidden"
      )}
    >
      {remotionPreview ? (
        <RemotionCanvas {...remotionPreview} />
      ) : (
        <video
          src={src}
          className={cn(
            "h-full w-full",
            fit === "contain" ? "object-contain" : "object-cover"
          )}
          autoPlay
          loop
          muted={muted}
          playsInline
        />
      )}
      {mediaOverlay}
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

function FeedMediaStage({
  slides,
  slideIndex,
  onSlideIndexChange,
  onPrev,
  onNext,
  showCarousel,
  canvasOverlay = null,
  canvasOverlayInteractive = false,
  textOverlay,
  remotionIncludeOverlays,
  mediaFit,
}: {
  slides: SimulatorCarouselItem[]
  slideIndex: number
  onSlideIndexChange: (index: number) => void
  onPrev: () => void
  onNext: () => void
  showCarousel: boolean
  canvasOverlay?: ReactNode
  canvasOverlayInteractive?: boolean
  textOverlay: CanvasTextOverlayState
  spokenHook: string
  remotionIncludeOverlays: boolean
  mediaFit: "cover" | "contain"
}) {
  const touchStartX = useRef<number | null>(null)
  const slideCount = slides.length
  const active = slides[slideIndex] ?? slides[0] ?? null
  const mediaUrl = active?.url ?? null
  const trackWidthPercent = slideCount > 0 ? slideCount * 100 : 100
  const slideWidthPercent = slideCount > 0 ? 100 / slideCount : 100

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current == null || !showCarousel) return
    const endX = event.changedTouches[0]?.clientX
    if (endX == null) return
    const delta = endX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 36) return
    if (delta > 0) onPrev()
    else onNext()
  }

  return (
    <div className="flex w-full flex-col">
      <div
        className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-neutral-100"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {slideCount > 0 ? (
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{
              width: `${trackWidthPercent}%`,
              transform: `translateX(-${(slideIndex / Math.max(slideCount, 1)) * 100}%)`,
            }}
          >
            {slides.map((slide) => {
              const kind =
                slide.type === "video" ||
                detectMediaKindFromUrl(slide.url) === "video"
                  ? "video"
                  : "image"
              return (
                <div
                  key={slide.id ?? slide.url}
                  className="relative h-full shrink-0 overflow-hidden bg-neutral-950"
                  style={{ width: `${slideWidthPercent}%` }}
                >
                  {kind === "video" ? (
                    <RemotionCanvas
                      {...buildRemotionPreviewInput({
                        mediaUrl: slide.url,
                        mediaType: "video",
                        mediaFit,
                        aspect: "feed",
                        textOverlay,
                        includeOverlays: remotionIncludeOverlays,
                      })}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={slide.url}
                      alt=""
                      className={cn(
                        "absolute inset-0 size-full",
                        mediaFit === "contain"
                          ? "object-contain"
                          : "object-cover"
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : null}

        {!mediaUrl && slideCount === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
            Add media
          </div>
        ) : null}

        <div
          className={cn(
            "absolute inset-0 z-20",
            canvasOverlayInteractive ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          {canvasOverlay}
        </div>

        {showCarousel ? (
          <>
            <span className="absolute top-2 right-2 z-30 border border-mad-black bg-mad-black px-2 py-0.5 font-typewriter text-[0.55rem] font-bold text-mad-white">
              {slideIndex + 1}/{slideCount}
            </span>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={onPrev}
              className="absolute top-1/2 left-1 z-30 flex size-8 -translate-y-1/2 items-center justify-center border-2 border-mad-black bg-mad-white/95 font-typewriter text-xs font-bold text-mad-black shadow-keycap-sm transition hover:bg-mad-lime"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={onNext}
              className="absolute top-1/2 right-1 z-30 flex size-8 -translate-y-1/2 items-center justify-center border-2 border-mad-black bg-mad-white/95 font-typewriter text-xs font-bold text-mad-black shadow-keycap-sm transition hover:bg-mad-lime"
            >
              ›
            </button>
            <div className="absolute inset-x-0 bottom-2 z-30 flex justify-center gap-1.5">
              {slides.map((slide, index) => (
                <button
                  key={slide.id ?? slide.url}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => onSlideIndexChange(index)}
                  className={cn(
                    "size-2.5 rounded-full border border-mad-black transition",
                    index === slideIndex
                      ? "scale-110 bg-mad-lime"
                      : "bg-mad-white/70 hover:bg-mad-white"
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function TikTokChrome({
  handle,
  caption,
  mediaUrl,
  mediaType,
  mediaOverlay = null,
  remotionPreview = null,
}: {
  handle: string
  caption: string
  mediaUrl: string | null
  mediaType: "image" | "video"
  mediaOverlay?: ReactNode
  remotionPreview?: RemotionCanvasProps | null
}) {
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-950">
      {mediaUrl && remotionPreview ? (
        <div className="absolute inset-0">
          <RemotionCanvas {...remotionPreview} />
          {mediaOverlay}
        </div>
      ) : mediaUrl && mediaType === "video" ? (
        <VideoFill src={mediaUrl} mediaOverlay={mediaOverlay} />
      ) : mediaUrl ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          {mediaOverlay}
        </div>
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

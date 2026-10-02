"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { Link } from "wouter"
import { useRouter } from "@/lib/next-compat"
import { ChevronDown, Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  approveMarketingEntity,
  armMultiChannelDispatch,
  patchDropWorkbenchDraft,
  saveDropDraft,
} from "@/lib/actions"
import { initialPostIntentState } from "@/components/inventory/post-intent-editor"
import { MultiChannelScheduler } from "@/components/marketing/multi-channel-scheduler"
import {
  MediaTray,
  mediaAssetsFromImageUrls,
  resolveActiveMedia,
  type MediaAsset,
} from "@/components/marketing/media-tray"
import type { MediaVisualInspection } from "@/lib/media/inspect-schema"
import {
  MultiPlatformSimulator,
  DEFAULT_STORY_PREVIEW,
  type SimulatorPlatform,
  type StoryPreviewState,
} from "@/components/marketing/multi-platform-simulator"
import { CompactChannelRail } from "@/components/studio/compact-channel-rail"
import { StepDock, type WorkbenchStepId } from "@/components/studio/step-stepper"
import { StudioInnerStepper } from "@/components/studio/studio-inner-stepper"
import { StudioSplitShell } from "@/components/studio/studio-split-shell"
import { StudioStepSummary } from "@/components/studio/studio-step-summary"
import {
  StepCustomize,
  type CustomizeWizardPhase,
} from "@/components/studio/steps/step-customize"
import { StepMedia } from "@/components/studio/steps/step-media"
import { MediaLibraryDrawer } from "@/components/studio/media-library-drawer"
import type { MediaKind } from "@/lib/media/kind"
import {
  bakeCanvasTextOnImage,
  canvasOverlayNeedsBake,
} from "@/lib/media/bake-canvas-text"
import {
  DEFAULT_CANVAS_TEXT_OVERLAY,
  normalizeCanvasTextOverlay,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"
import {
  WORKBENCH_STEP_CANVAS,
  WORKBENCH_STEP_CHANNELS,
  WORKBENCH_STEP_COPY,
  WORKBENCH_STEP_INTENT,
  WORKBENCH_STEP_MEDIA,
  nextWorkbenchStep,
  parseWorkbenchStepParam,
  prevWorkbenchStep,
} from "@/lib/studio/workbench-steps"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  pickDefaultVibeTag,
  resolveIndustryProfile,
} from "@/lib/brands/industry-templates"
import { cleanHashtags, sanitizeItemTitle } from "@/lib/copy/caption-hygiene"
import {
  buildContextAwareHooks,
  scrubAgencyLeak,
  type ContextHookId,
} from "@/lib/inventory/context-hooks"
import { buildWorkbenchCaptionVariants } from "@/lib/inventory/caption-variants"
import {
  buildFudiRedirectSlugSeed,
  isFudiStudioEntity,
} from "@/lib/studio/fudi-tracks"
import { formatScheduleToast } from "@/lib/inventory/schedule"
import {
  CHANNEL_META,
  hydrateDispatchPlan,
  type ChannelSlot,
} from "@/lib/scheduling/brain-timing"
import { buildPostIntentMetadata } from "@/lib/inventory/post-intent"
import {
  buildDefaultDraft,
  reconcileFudiWorkbenchHeadline,
  repairFudiCaptionDoubling,
  resolveWorkbenchCaptionBody,
  stripDuplicateHookFromCaption,
  workbenchHeadlineFromTitle,
  evaluateSopChecklist,
  isSopValid,
  type SopDraft,
} from "@/lib/inventory/sop"
import {
  FUDI_DROP_BADGES,
  fudiChannelRecommendation,
  inferFudiDropKind,
} from "@/lib/today/agenda"
import { OptimizationTagsEditor } from "@/components/inventory/optimization-tags-editor"
import { requestEnhanceCaption } from "@/lib/inventory/enhance-caption-client"
import {
  buildOptimizationTags,
  mergeCaptionWithTags,
} from "@/lib/inventory/optimization-tags"
import type {
  MarketingEntity,
  MarketingEntityStatus,
  ScheduledSlotOccupancy,
} from "@/lib/inventory/types"
import { formatInventoryPrice } from "@/lib/inventory/types"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import { trackableUrl } from "@/lib/social/types"
import { cn } from "@/lib/utils"

type Props = {
  item: MarketingEntity
  brandName: string
  industry?: string | null
  entityId: string
  websiteUrl?: string | null
  visualPresets?: import("@/lib/entities/dna-schema").VisualPresets | null
  occupiedSlots: ScheduledSlotOccupancy[]
  entity?: StudioEntityDna | null
  initialStep?: string | null
}

function isMadCarouselDraft(item: MarketingEntity): boolean {
  return (
    item.copy_draft.metadata?.source_table === "mad_carousel" &&
    item.images.length >= 2
  )
}

function carouselSlideSubheads(item: MarketingEntity): string[] | null {
  const raw = item.copy_draft as {
    metadata?: { carousel_slide_subheads?: unknown }
  }
  const list = raw.metadata?.carousel_slide_subheads
  if (!Array.isArray(list)) return null
  return list.map((row) => String(row ?? "").trim())
}

function scrubCliches(caption: string): string {
  return scrubAgencyLeak(
    caption
      .replace(/check out this/gi, "")
      .replace(/must[- ]have/gi, "")
      .replace(/hurry before it'?s gone/gi, "")
      .replace(/don'?t miss out/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  )
}

function SopStatusPill({
  item,
  draft,
  onValidityChange,
}: {
  item: MarketingEntity
  draft: SopDraft
  onValidityChange?: (valid: boolean) => void
}) {
  const criteria = useMemo(
    () => evaluateSopChecklist(item, draft),
    [item, draft]
  )
  const valid = isSopValid(criteria)

  useEffect(() => {
    onValidityChange?.(valid)
  }, [onValidityChange, valid])

  const passed = criteria.filter((c) => c.passed).length

  return (
    <span
      className={cn(
        "font-typewriter text-[0.55rem] font-bold tracking-wider uppercase",
        valid ? "text-emerald-700" : "text-amber-700"
      )}
      title={criteria.map((c) => `${c.passed ? "✓" : "○"} ${c.label}`).join("\n")}
    >
      SOP {passed}/{criteria.length}
    </span>
  )
}

export function InventoryItemDetail({
  item,
  brandName,
  industry = null,
  entityId,
  websiteUrl = null,
  visualPresets = null,
  occupiedSlots,
  entity = null,
  initialStep = null,
}: Props) {
  const router = useRouter()
  const profile = useMemo(
    () => resolveIndustryProfile({ name: brandName, industry }),
    [brandName, industry]
  )
  const storyStickerLabel =
    profile.id === "fudi"
      ? profile.shopLinkLabel || "View on FÜDI"
      : "SHOP HERE"

  const isFudi = isFudiStudioEntity({ name: brandName, industry })

  const defaultListingVibe = useMemo(() => {
    if (item.vibe?.trim()) return item.vibe.trim()
    return (
      pickDefaultVibeTag(
        profile,
        `${item.title} ${item.description ?? ""} ${item.brand ?? ""}`
      ) || null
    )
  }, [item.vibe, item.title, item.description, item.brand, profile])

  const inferredDropKind = useMemo(
    () => (isFudi ? inferFudiDropKind(item) : null),
    [isFudi, item]
  )

  const defaultChannelHint = useMemo(
    () =>
      isFudi && inferredDropKind
        ? fudiChannelRecommendation(inferredDropKind)
        : "",
    [isFudi, inferredDropKind]
  )

  const [postIntent, setPostIntent] = useState(() =>
    initialPostIntentState({
      isFudi,
      item,
      defaultListingVibe,
      defaultDropKind: inferredDropKind,
      defaultChannelHint,
    })
  )

  const effectiveListingVibe =
    postIntent.listingVibe.trim() || defaultListingVibe

  const postIntentMetadata = useMemo(
    () => buildPostIntentMetadata(postIntent, { isFudi }),
    [postIntent, isFudi]
  )

  const postIntentPersistReady = useRef(false)

  useEffect(() => {
    if (!postIntentPersistReady.current) {
      postIntentPersistReady.current = true
      return
    }
    const handle = window.setTimeout(() => {
      void patchDropWorkbenchDraft({
        entityId,
        itemId: item.id,
        copyDraft: { metadata: postIntentMetadata },
      }).then((result) => {
        if (result.ok) return
        toast.error(result.error)
      }).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Could not save post intent."
        if (/unknown action/i.test(message)) {
          toast.message(
            "Post intent saved locally — restart the API server (port 8080) to persist chips."
          )
          return
        }
        toast.error(message)
      })
    }, 700)
    return () => window.clearTimeout(handle)
  }, [postIntentMetadata, entityId, item.id])

  const [step, setStep] = useState<WorkbenchStepId>(() =>
    parseWorkbenchStepParam(initialStep)
  )
  const [simPlatform, setSimPlatform] = useState<SimulatorPlatform>(() =>
    isMadCarouselDraft(item) ? "ig_feed" : "ig_story"
  )
  const [carouselSlideTexts, setCarouselSlideTexts] = useState<string[] | null>(
    () => carouselSlideSubheads(item)
  )
  const [storyPreview, setStoryPreview] =
    useState<StoryPreviewState>(DEFAULT_STORY_PREVIEW)
  const [images, setImages] = useState(item.images)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(() =>
    mediaAssetsFromImageUrls(item.images)
  )
  const [activeMediaId, setActiveMediaId] = useState<string | null>(
    () => mediaAssetsFromImageUrls(item.images)[0]?.id ?? null
  )
  const [visualInspection, setVisualInspection] =
    useState<MediaVisualInspection | null>(null)
  const [status, setStatus] = useState(item.status)
  const [activeHookId, setActiveHookId] = useState<ContextHookId | null>(null)
  const [captionVariantIndex, setCaptionVariantIndex] = useState(0)
  const [enhancingCaption, setEnhancingCaption] = useState(false)
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [cutoutRequestId, setCutoutRequestId] = useState(0)
  const [contentPillar, setContentPillar] = useState("")
  const [hookBlueprintId, setHookBlueprintId] = useState<string | null>(null)
  const [ctaBlueprintId, setCtaBlueprintId] = useState<string | null>(null)
  const [workbenchPersonaId, setWorkbenchPersonaId] = useState("")
  const [textOverlay, setTextOverlay] = useState<CanvasTextOverlayState>(() => {
    const raw = item.copy_draft as {
      metadata?: { canvas_text_overlay?: unknown }
    }
    if (raw.metadata?.canvas_text_overlay) {
      return normalizeCanvasTextOverlay(raw.metadata.canvas_text_overlay)
    }
    const base = normalizeCanvasTextOverlay(null)
    return base
  })
  const textOverlayPersistReady = useRef(false)

  useEffect(() => {
    if (!textOverlayPersistReady.current) {
      textOverlayPersistReady.current = true
      return
    }
    const handle = window.setTimeout(() => {
      void patchDropWorkbenchDraft({
        entityId,
        itemId: item.id,
        copyDraft: {
          metadata: {
            canvas_text_overlay: textOverlay,
          },
        },
      }).then((result) => {
        if (!result.ok) toast.error(result.error)
      })
    }, 500)
    return () => window.clearTimeout(handle)
  }, [textOverlay, entityId, item.id])

  const [draft, setDraft] = useState<SopDraft>(() => {
    const defaults = buildDefaultDraft(item, { brandName, industry })
    const savedTags = cleanHashtags(item.copy_draft.tags ?? [], {
      bannedSeeds: [item.website_item_id],
    })
    const seededTags =
      savedTags.length > 0
        ? savedTags
        : buildOptimizationTags({
            item,
            brandName,
            industry,
            listingVibe: item.vibe,
          })
    const savedHeadline = item.copy_draft.headline?.trim() ?? ""
    // Older drafts stored a truncated copy of the caption as the headline.
    const headlineIsFragment =
      savedHeadline.length > 0 &&
      (item.copy_draft.caption ?? "").trim().startsWith(savedHeadline)
    const isFudi = isFudiStudioEntity({ name: brandName, industry })
    let headline = scrubCliches(
      savedHeadline && !headlineIsFragment ? savedHeadline : defaults.headline
    )
    if (isFudi && savedHeadline && !headlineIsFragment) {
      headline = scrubCliches(reconcileFudiWorkbenchHeadline(savedHeadline, item))
    }
    let caption = scrubCliches(item.copy_draft.caption || defaults.caption)
    if (isFudi) {
      caption = scrubCliches(
        repairFudiCaptionDoubling(headline, caption, item.description)
      )
    }
    return {
      headline,
      caption,
      tags: seededTags,
    }
  })
  const [sopValid, setSopValid] = useState(false)
  // Built on the client so Brain slots use the viewer's timezone, not the server's.
  const [dispatchPlan, setDispatchPlan] = useState<ChannelSlot[] | null>(null)
  const [pending, startTransition] = useTransition()
  const [arming, setArming] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  function goToStep(next: WorkbenchStepId) {
    if (next === WORKBENCH_STEP_CHANNELS && !dispatchPlan) {
      setDispatchPlan(
        hydrateDispatchPlan({
          saved: item.copy_draft.dispatch_plan,
          legacyChannels: item.channels,
        })
      )
    }
    setStep(next)
  }

  const activeMedia = useMemo(
    () => resolveActiveMedia(mediaAssets, activeMediaId),
    [mediaAssets, activeMediaId]
  )

  const selectedImageUrl =
    activeMedia?.type === "image" ? activeMedia.url : images[0] ?? null

  // New source photo → clear cutout; Continue between steps keeps preview.
  const [cutoutSourceUrl, setCutoutSourceUrl] = useState(activeMedia?.url)
  if (activeMedia?.url !== cutoutSourceUrl) {
    setCutoutSourceUrl(activeMedia?.url)
    setStoryPreview((prev) => ({
      ...prev,
      cutoutMode: "original",
      cutoutImageUrl: null,
    }))
  }

  const workingItem = useMemo(
    () => ({ ...item, images, status }),
    [item, images, status]
  )

  const itemDestinationUrl = useMemo(
    () =>
      resolveItemDestinationUrl({
        entityId,
        websiteUrl,
        websiteItemId: item.website_item_id,
        copyDraft: item.copy_draft,
      }),
    [entityId, websiteUrl, item.website_item_id, item.copy_draft]
  )

  const trackablePreviewUrl = useMemo(
    () =>
      item.trackable_slug?.trim()
        ? trackableUrl(item.trackable_slug.trim())
        : itemDestinationUrl,
    [item.trackable_slug, itemDestinationUrl]
  )

  const slugSeed = isFudiStudioEntity({ name: brandName, industry })
    ? buildFudiRedirectSlugSeed(
        item.website_item_id?.startsWith("partner-") ||
          /partner|eatery|onboard/i.test(item.title)
          ? "partners"
          : "diners",
        item.title
      )
    : null

  const suggestedTags = useMemo(
    () =>
      buildOptimizationTags({
        item: workingItem,
        brandName,
        industry,
        listingVibe: effectiveListingVibe,
      }),
    [workingItem, brandName, industry, effectiveListingVibe]
  )

  const contextHooks = useMemo(
    () =>
      buildContextAwareHooks({
        item: workingItem,
        brandName,
        industry,
        vibeCategory: effectiveListingVibe,
        visualDescription: visualInspection?.visualDescription,
        concreteFeatures: visualInspection?.concreteFeatures,
        aestheticTags: visualInspection?.aestheticTags,
      }),
    [workingItem, brandName, industry, effectiveListingVibe, visualInspection]
  )

  const captionVariants = useMemo(
    () =>
      buildWorkbenchCaptionVariants({
        item: workingItem,
        brandName,
        industry,
        hooks: contextHooks,
      }),
    [workingItem, brandName, industry, contextHooks]
  )

  useEffect(() => {
    setCaptionVariantIndex((index) =>
      Math.min(index, Math.max(captionVariants.length - 1, 0))
    )
  }, [captionVariants.length])

  const onValidityChange = useCallback((valid: boolean) => {
    setSopValid(valid)
  }, [])

  function onMediaAssetsChange(next: MediaAsset[]) {
    setMediaAssets(next)
    const preferred =
      next.find((row) => row.id === activeMediaId) ?? next[0] ?? null
    setVisualInspection(
      preferred?.visualInspection ??
        next.find((row) => row.visualInspection)?.visualInspection ??
        null
    )
    const imageUrls = next
      .filter((row) => row.type === "image")
      .map((row) => row.publicUrl || row.url)
      .filter((url) => /^https?:\/\//i.test(url))
    if (imageUrls.length > 0) setImages(imageUrls)
  }

  function onSelectMedia(asset: MediaAsset) {
    setActiveMediaId(asset.id)
    setVisualInspection(asset.visualInspection ?? null)
  }

  function onSimulatorSlideIndexChange(index: number) {
    const asset = mediaAssets[index]
    if (asset && asset.id !== activeMediaId) {
      onSelectMedia(asset)
    }
  }

  function onVisualInspect(
    assetId: string,
    inspection: MediaVisualInspection | null
  ) {
    if (inspection) {
      setVisualInspection(inspection)
      return
    }
    const still =
      mediaAssets.find(
        (row) => row.id !== assetId && row.visualInspection
      )?.visualInspection ?? null
    setVisualInspection(still)
  }

  function applyCaptionVariant(variantIndex: number) {
    const variant = captionVariants[variantIndex]
    if (!variant) return
    setCaptionVariantIndex(variantIndex)
    setActiveHookId(
      variant.id === "intake" ? null : (variant.id as ContextHookId)
    )
    setDraft((current) => ({
      ...current,
      headline: scrubCliches(scrubAgencyLeak(variant.headline)),
      caption: scrubCliches(scrubAgencyLeak(variant.caption)),
    }))
  }

  function applyHook(hookId: ContextHookId) {
    const index = captionVariants.findIndex((row) => row.id === hookId)
    if (index >= 0) {
      applyCaptionVariant(index)
      return
    }
    const row = contextHooks.find((hook) => hook.id === hookId)
    if (!row) return
    setActiveHookId(hookId)
    const hookLine = scrubCliches(row.hook)
    setDraft((current) => ({
      ...current,
      headline: hookLine,
      caption: scrubCliches(
        resolveWorkbenchCaptionBody({
          headline: hookLine,
          item,
          fallbackCaption: current.caption,
          isFudi,
        })
      ),
    }))
  }

  function rotateCaptionVariant() {
    if (captionVariants.length <= 1) {
      toast.message("Add media inspection or pull intake for more hook angles.")
      return
    }
    const next = (captionVariantIndex + 1) % captionVariants.length
    applyCaptionVariant(next)
    toast.message(
      `Caption · ${captionVariants[next]?.label ?? "Variant"} (${next + 1}/${captionVariants.length})`
    )
  }

  async function enhanceCaptionWithAi() {
    if (enhancingCaption) return
    const toastId = toast.loading("Enhancing hook and caption…")
    setEnhancingCaption(true)
    try {
      const beforeHook = draft.headline.trim()
      const beforeCaption = draft.caption.trim()
      const payload = await requestEnhanceCaption({
        entityId,
        marketingEntityId: item.id,
        headline: draft.headline,
        caption: draft.caption,
        visualDescription: visualInspection?.visualDescription ?? null,
      })
      const nextHeadline = scrubCliches(scrubAgencyLeak(payload.headline))
      let nextCaption = scrubCliches(scrubAgencyLeak(payload.caption))
      nextCaption = scrubCliches(
        stripDuplicateHookFromCaption(nextHeadline, nextCaption)
      )
      if (isFudi) {
        nextCaption = scrubCliches(
          repairFudiCaptionDoubling(
            nextHeadline,
            nextCaption,
            item.description
          )
        )
      }
      setActiveHookId(null)
      setDraft((current) => ({
        ...current,
        headline: nextHeadline,
        caption: nextCaption,
      }))
      const unchanged =
        nextHeadline.trim() === beforeHook &&
        nextCaption.trim() === beforeCaption
      toast.dismiss(toastId)
      if (unchanged) {
        toast.message(
          "AI finished but copy is very similar — try Rotate or edit the hook first."
        )
      } else {
        toast.success("Hook and caption updated.")
      }
    } catch (error) {
      toast.dismiss(toastId)
      toast.error(
        error instanceof Error ? error.message : "Caption enhance failed."
      )
    } finally {
      setEnhancingCaption(false)
    }
  }

  function onApprove() {
    if (!sopValid) {
      toast.message("Finish Voice, Specs, and Image before approving.")
      return
    }

    startTransition(async () => {
      const result = await approveMarketingEntity({
        entityId,
        itemId: item.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStatus(result.data.status as MarketingEntityStatus)
      toast.success("Approved and ready to slot.")
      router.refresh()
    })
  }

  function resolvePublicMedia(): string | null {
    const media =
      (activeMedia?.url && /^https?:\/\//i.test(activeMedia.url)
        ? activeMedia.url
        : null) ||
      mediaAssets.find(
        (row) => row.publicUrl && /^https?:\/\//i.test(row.publicUrl)
      )?.publicUrl ||
      selectedImageUrl
    return media && /^https?:\/\//i.test(media) ? media : null
  }

  async function resolvePublishMediaUrl(): Promise<string | null> {
    const base = resolvePublicMedia()
    if (!base) return null
    if (activeMedia?.type === "video") return base
    if (!canvasOverlayNeedsBake(textOverlay)) return base
    const toastId = toast.loading("Baking on-image text into your publish file…")
    try {
      const baked = await bakeCanvasTextOnImage({
        entityId,
        marketingEntityId: item.id,
        sourceUrl: base,
        overlay: textOverlay,
      })
      toast.dismiss(toastId)
      toast.success("On-image text baked — social channels will receive this PNG.")
      return baked
    } catch (error) {
      toast.dismiss(toastId)
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not bake on-image text — fix overlay or retry."
      )
      return null
    }
  }

  function onSaveDraft() {
    setSavingDraft(true)
    startTransition(async () => {
      const media = await resolvePublishMediaUrl()
      if (!media) {
        setSavingDraft(false)
        if (!resolvePublicMedia()) {
          toast.error("Add a public https image before saving.")
        }
        return
      }
      const result = await saveDropDraft({
        entityId,
        itemId: item.id,
        dispatchPlan: dispatchPlan ?? undefined,
        copyDraft: {
          headline: draft.headline,
          caption: draft.caption,
          tags: draft.tags,
          media_url: media ?? undefined,
          placement:
            simPlatform === "ig_story" || activeMedia?.type === "video"
              ? "story"
              : "feed",
          platform:
            simPlatform === "email"
              ? "email"
              : simPlatform === "ig_story"
                ? "story"
                : "feed",
          metadata: {
            ...postIntentMetadata,
            canvas_text_overlay: textOverlay,
          },
        },
      })
      setSavingDraft(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStatus(result.data.status as MarketingEntityStatus)
      toast.success("Draft saved to Campaigns.")
      router.push(`/campaigns?eid=${encodeURIComponent(entityId)}&toast=draft`)
      router.refresh()
    })
  }

  function onArm() {
    const slots = (dispatchPlan ?? []).filter((slot) => slot.enabled)
    if (slots.length === 0) {
      toast.message("Tick at least one channel to arm.")
      return
    }

    const placement: "feed" | "story" =
      simPlatform === "ig_story" || activeMedia?.type === "video"
        ? "story"
        : "feed"

    setArming(true)
    startTransition(async () => {
      const media = await resolvePublishMediaUrl()
      if (!media) {
        setArming(false)
        if (!resolvePublicMedia()) {
          toast.error(
            "Arming needs a public https media URL — wait for upload to finish."
          )
        }
        return
      }

      const result = await armMultiChannelDispatch({
        entityId,
        itemId: item.id,
        slots,
        slugSeed,
        copyDraft: {
          headline: draft.headline,
          caption: draft.caption,
          tags: draft.tags,
          media_url: media,
          placement,
          platform:
            simPlatform === "email"
              ? "email"
              : placement === "story"
                ? "story"
                : "feed",
          metadata: {
            ...postIntentMetadata,
            canvas_text_overlay: textOverlay,
          },
        },
      })
      setArming(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const { immediate, scheduled, firstScheduledAt } = result.data
      setStatus(
        immediate.successes > 0 && scheduled === 0 && immediate.failures === 0
          ? "published"
          : "scheduled"
      )

      const parts: string[] = []
      if (immediate.successes > 0) {
        parts.push(`${immediate.successes} dispatched now`)
      }
      if (scheduled > 0 && firstScheduledAt) {
        parts.push(
          `${scheduled} armed · first ${formatScheduleToast(firstScheduledAt)}`
        )
      }
      toast.success(`Multi-channel post armed — ${parts.join(" · ") || "queued"}`)

      for (const failure of immediate.errors) {
        const channel =
          CHANNEL_META[failure.platform as keyof typeof CHANNEL_META]?.label ??
          failure.platform
        toast.error(`${channel}: ${failure.error} (will retry)`)
      }
      if (immediate.skippedReason) toast.message(immediate.skippedReason)

      router.push(`/campaigns?eid=${encodeURIComponent(entityId)}&toast=armed`)
      router.refresh()
    })
  }

  function onBack() {
    setStep((current) => prevWorkbenchStep(current))
  }

  function onCutoutToggle() {
    if (storyPreview.cutoutMode === "transparent") {
      setStoryPreview((current) => ({
        ...current,
        cutoutMode: "original",
        cutoutImageUrl: null,
      }))
      return
    }
    setCutoutRequestId((value) => value + 1)
  }

  function onFinishedRender(publicUrl: string, kind: MediaKind) {
    const asset: MediaAsset = {
      id: `render-${Date.now()}`,
      url: publicUrl,
      publicUrl,
      type: kind,
    }
    if (kind === "video") {
      onMediaAssetsChange([asset])
    } else {
      onMediaAssetsChange([...mediaAssets, asset])
    }
    setActiveMediaId(asset.id)
  }

  function onNext() {
    if (step === WORKBENCH_STEP_MEDIA) {
      if (mediaAssets.length === 0) {
        toast.message("Add a photo or reel before continuing.")
        return
      }
    }
    if (step === WORKBENCH_STEP_COPY) {
      if (!draft.caption.trim()) {
        toast.message("Pick a hook or write a caption before continuing.")
        return
      }
      goToStep(WORKBENCH_STEP_CHANNELS)
      return
    }
    if (step === WORKBENCH_STEP_CHANNELS) {
      onArm()
      return
    }
    setStep((current) => nextWorkbenchStep(current))
  }

  const alreadyApproved =
    status === "approved" || status === "scheduled" || status === "published"
  const scheduleLocked = status === "published"
  const priceLabel = formatInventoryPrice(item.price)

  const intentStepSummary =
    contentPillar.trim() || workbenchPersonaId
      ? `${contentPillar.trim() || "Pillar"} · persona set`
      : "Intent & DNA"
  const canvasStepSummary = (() => {
    const parts: string[] = []
    if (textOverlay.enabled && textOverlay.headline.trim()) {
      parts.push(textOverlay.headline.trim().slice(0, 32))
    }
    if (textOverlay.storyStickerMode === "editorial_poll") {
      parts.push("Poll")
    } else if (textOverlay.storyStickerMode === "countdown_timer") {
      parts.push("Countdown")
    } else if (
      textOverlay.stickerEnabled &&
      textOverlay.stickerId !== "link_pill"
    ) {
      parts.push("Sticker")
    }
    if (textOverlay.animation !== "none") parts.push("Motion")
    return parts.length > 0 ? parts.join(" · ") : "No on-canvas decor"
  })()
  function renderDropCustomize(phase: CustomizeWizardPhase) {
    if (!entity) return null
    return (
      <StepCustomize
        phase={phase}
        entity={entity}
        entityId={entityId}
        marketingEntityId={item.id}
        isFudi={isFudi}
        vibeOptions={profile.vibeTags}
        postIntent={postIntent}
        onPostIntentChange={setPostIntent}
        headline={draft.headline}
        caption={draft.caption}
        onHeadlineChange={(value) =>
          setDraft((current) => ({
            ...current,
            headline: scrubAgencyLeak(value),
            caption: scrubAgencyLeak(
              stripDuplicateHookFromCaption(value, current.caption),
              { trim: false }
            ),
          }))
        }
        onCaptionChange={(value) =>
          setDraft((current) => ({
            ...current,
            caption: scrubAgencyLeak(value, { trim: false }),
          }))
        }
        hookChips={contextHooks}
        activeHookId={activeHookId}
        onHookSelect={applyHook}
        contentPillar={contentPillar}
        onContentPillarChange={setContentPillar}
        personaId={workbenchPersonaId}
        onPersonaIdChange={setWorkbenchPersonaId}
        hookBlueprintId={hookBlueprintId}
        onHookBlueprintIdChange={setHookBlueprintId}
        ctaId={ctaBlueprintId}
        onCtaIdChange={setCtaBlueprintId}
        visualDescription={visualInspection?.visualDescription ?? null}
        isVideoPreview={activeMedia?.type === "video"}
        captionVariantLabel={
          captionVariants.length > 0
            ? `${captionVariants[captionVariantIndex]?.label ?? "Variant"} · ${captionVariantIndex + 1}/${captionVariants.length}`
            : null
        }
        onRotateCaption={rotateCaptionVariant}
        onEnhanceCaption={() => void enhanceCaptionWithAi()}
        enhancingCaption={enhancingCaption}
        textOverlay={textOverlay}
        onTextOverlayChange={setTextOverlay}
        destinationUrl={itemDestinationUrl}
        trackablePreview={trackablePreviewUrl}
        tagsSlot={
          phase === "copy" ? (
            <OptimizationTagsEditor
              entityId={entityId}
              marketingEntityId={item.id}
              tags={draft.tags}
              suggestedTags={suggestedTags}
              headline={draft.headline}
              caption={draft.caption}
              listingVibe={effectiveListingVibe}
              visualDescription={visualInspection?.visualDescription ?? null}
              bannedTagSeeds={[item.website_item_id ?? ""]}
              onTagsChange={(tags) =>
                setDraft((current) => ({ ...current, tags }))
              }
            />
          ) : null
        }
      />
    )
  }

  const wizardSteps = [
    WORKBENCH_STEP_MEDIA,
    WORKBENCH_STEP_INTENT,
    WORKBENCH_STEP_CANVAS,
    WORKBENCH_STEP_COPY,
  ] as const
  const onWizardStep = step !== WORKBENCH_STEP_CHANNELS
  const priorSummaryStep =
    step === WORKBENCH_STEP_INTENT
      ? WORKBENCH_STEP_MEDIA
      : step === WORKBENCH_STEP_CANVAS
        ? WORKBENCH_STEP_INTENT
        : step === WORKBENCH_STEP_COPY
          ? WORKBENCH_STEP_CANVAS
          : null

  return (
    <div
      className={
        onWizardStep
          ? "flex h-[calc(100vh-64px)] flex-col overflow-hidden"
          : "space-y-3 pb-24"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mad-black/10 pb-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href={`/today?eid=${encodeURIComponent(entityId)}`}
            className="shrink-0 font-typewriter text-[0.6rem] font-bold tracking-wider text-neutral-500 uppercase hover:text-mad-black"
          >
            ← Today
          </Link>
          <span className="hidden h-3 w-px bg-mad-black/20 sm:block" />
          <h1 className="min-w-0 truncate font-typewriter text-sm font-bold tracking-tight text-mad-black">
            {item.title}
          </h1>
          {priceLabel !== "—" ? (
            <span className="hidden shrink-0 font-typewriter text-[0.6rem] text-neutral-500 sm:inline">
              {priceLabel}
            </span>
          ) : null}
          <SopStatusPill
            item={workingItem}
            draft={draft}
            onValidityChange={onValidityChange}
          />
        </div>
        {!alreadyApproved ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={pending || !sopValid}
            className={cn(
              "shrink-0 border px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase transition",
              sopValid
                ? "border-mad-black bg-mad-black text-mad-white hover:bg-mad-vermillion disabled:opacity-50"
                : "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400"
            )}
          >
            {pending && !arming && !savingDraft ? "…" : "Approve"}
          </button>
        ) : (
          <span className="shrink-0 font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-400 uppercase">
            {status === "scheduled" || status === "published"
              ? status
              : "approved"}
          </span>
        )}
      </div>

      <StudioInnerStepper step={step} onStepChange={goToStep} />

      {step === WORKBENCH_STEP_CHANNELS ? (
        <div className="flex w-full flex-col gap-3 pb-2">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="order-2 min-w-0 space-y-3 md:order-1">
              <section className="space-y-1.5 border border-mad-black/25 bg-mad-white p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
                    Review
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(WORKBENCH_STEP_COPY)}
                    className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase underline-offset-2 hover:text-mad-black hover:underline"
                  >
                    Edit captions
                  </button>
                </div>
                <p className="text-sm font-medium text-mad-black">
                  {draft.headline || "—"}
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">
                  {mergeCaptionWithTags(draft.caption, draft.tags) || "—"}
                </p>
              </section>

              {dispatchPlan ? (
                <MultiChannelScheduler
                  plan={dispatchPlan}
                  onPlanChange={setDispatchPlan}
                  occupied={occupiedSlots.filter((row) => row.id !== item.id)}
                  onSaveDraft={onSaveDraft}
                  onArm={onArm}
                  saving={savingDraft}
                  arming={arming}
                  locked={scheduleLocked}
                  wizardLayout
                />
              ) : (
                <p className="border-2 border-mad-black px-3 py-6 text-center font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
                  Calculating Brain timing…
                </p>
              )}
            </div>

            <div className="order-1 justify-self-center p-0 md:order-2 md:justify-self-end">
              <MultiPlatformSimulator
                className="gap-2"
                compact
                content={{
                  brandName,
                  headline: draft.headline,
                  caption: mergeCaptionWithTags(draft.caption, draft.tags),
                  imageUrl:
                    activeMedia?.type === "image"
                      ? activeMedia.url
                      : selectedImageUrl,
                  stickerLabel: storyStickerLabel,
                }}
                activeMedia={activeMedia}
                carouselMedia={mediaAssets}
                slideTexts={carouselSlideTexts}
                onSlideTextsChange={setCarouselSlideTexts}
                onSlideIndexChange={onSimulatorSlideIndexChange}
                platform={simPlatform}
                onPlatformChange={setSimPlatform}
                storyPreview={storyPreview}
                onStoryPreviewChange={setStoryPreview}
                item={workingItem}
                industry={industry}
                visualPresets={visualPresets}
                showCreativeControls={false}
                showActionDock={step === WORKBENCH_STEP_CHANNELS}
                actionContext={{
                  entityId,
                  marketingEntityId: item.id,
                  websiteItemId: item.website_item_id,
                  websiteUrl,
                  trackableSlug: item.trackable_slug,
                  destinationUrl: itemDestinationUrl,
                  slugSeed: isFudiStudioEntity({ name: brandName, industry })
                    ? buildFudiRedirectSlugSeed(
                        item.website_item_id?.startsWith("partner-") ||
                          /partner|eatery|onboard/i.test(item.title)
                          ? "partners"
                          : "diners",
                        item.title
                      )
                    : null,
                }}
              />
            </div>
          </div>
        </div>
      ) : wizardSteps.includes(step as (typeof wizardSteps)[number]) ? (
        <>
          <StudioSplitShell
            className="min-h-0 flex-1"
            showPreview={step !== WORKBENCH_STEP_MEDIA}
            channelRail={
              <CompactChannelRail
                platform={simPlatform}
                onPlatformChange={setSimPlatform}
              />
            }
            navigationDock={
              <StepDock
                step={step}
                onBack={onBack}
                onNext={onNext}
                nextLabel={
                  step === WORKBENCH_STEP_MEDIA
                    ? "Continue to Intent ──▶"
                    : step === WORKBENCH_STEP_INTENT
                      ? "Continue to Canvas ──▶"
                      : step === WORKBENCH_STEP_CANVAS
                        ? "Continue to Copy ──▶"
                        : step === WORKBENCH_STEP_COPY
                          ? "Continue to Schedule ──▶"
                          : undefined
                }
                nextBusy={arming || savingDraft}
                nextDisabled={
                  (step === WORKBENCH_STEP_MEDIA &&
                    mediaAssets.length === 0) ||
                  (step === WORKBENCH_STEP_COPY && !draft.caption.trim())
                }
              />
            }
            preview={
              <MultiPlatformSimulator
                lockedViewport
                compact
                content={{
                  brandName,
                  headline: draft.headline,
                  caption: mergeCaptionWithTags(draft.caption, draft.tags),
                  imageUrl:
                    activeMedia?.type === "image"
                      ? activeMedia.url
                      : selectedImageUrl,
                  stickerLabel: storyStickerLabel,
                }}
                activeMedia={activeMedia}
                carouselMedia={mediaAssets}
                slideTexts={carouselSlideTexts}
                onSlideTextsChange={setCarouselSlideTexts}
                onSlideIndexChange={onSimulatorSlideIndexChange}
                platform={simPlatform}
                onPlatformChange={setSimPlatform}
                storyPreview={storyPreview}
                onStoryPreviewChange={setStoryPreview}
                hideStylingDock
                externalCutoutRequestId={cutoutRequestId}
                textOverlay={textOverlay}
                onTextOverlayChange={setTextOverlay}
                textOverlayInteractive={step === WORKBENCH_STEP_CANVAS}
                item={workingItem}
                industry={industry}
                visualPresets={visualPresets}
                showCreativeControls={false}
                showTextStyler={false}
                showActionDock={false}
                hidePlatformSwitcher
                actionContext={{
                  entityId,
                  marketingEntityId: item.id,
                  websiteItemId: item.website_item_id,
                  websiteUrl,
                  trackableSlug: item.trackable_slug,
                  destinationUrl: itemDestinationUrl,
                  slugSeed,
                }}
              />
            }
            controls={
              <div className="space-y-2">
                {priorSummaryStep === WORKBENCH_STEP_MEDIA ? (
                  <StudioStepSummary
                    title="Media attached"
                    summary={`${mediaAssets.length} asset${mediaAssets.length === 1 ? "" : "s"}`}
                    previewUrl={selectedImageUrl}
                    editLabel="✏ Change media"
                    onEdit={() => setStep(WORKBENCH_STEP_MEDIA)}
                  />
                ) : null}
                {priorSummaryStep === WORKBENCH_STEP_INTENT ? (
                  <StudioStepSummary
                    title="Intent"
                    summary={intentStepSummary}
                    onEdit={() => setStep(WORKBENCH_STEP_INTENT)}
                  />
                ) : null}
                {priorSummaryStep === WORKBENCH_STEP_CANVAS ? (
                  <StudioStepSummary
                    title="Canvas"
                    summary={canvasStepSummary}
                    onEdit={() => setStep(WORKBENCH_STEP_CANVAS)}
                  />
                ) : null}
                {step === WORKBENCH_STEP_MEDIA ? (
                  <StepMedia
                    entityId={entityId}
                    marketingEntityId={item.id}
                    assets={mediaAssets}
                    activeId={activeMediaId}
                    onAssetsChange={onMediaAssetsChange}
                    onSelectMedia={onSelectMedia}
                    onVisualInspect={onVisualInspect}
                    bridgePayload={{
                      spokenHook: draft.headline,
                      onScreenHeadline: draft.headline,
                      caption: draft.caption,
                      destinationUrl: itemDestinationUrl,
                    }}
                    onFinishedRender={onFinishedRender}
                    onOpenMediaLibrary={() => setMediaLibraryOpen(true)}
                    visualDescription={
                      visualInspection?.visualDescription ?? null
                    }
                    cutoutActive={storyPreview.cutoutMode === "transparent"}
                    onCutoutToggle={onCutoutToggle}
                    cutoutDisabled={simPlatform !== "ig_story"}
                  />
                ) : null}
                {step === WORKBENCH_STEP_INTENT
                  ? renderDropCustomize("intent")
                  : null}
                {step === WORKBENCH_STEP_CANVAS
                  ? renderDropCustomize("canvas")
                  : null}
                {step === WORKBENCH_STEP_COPY
                  ? renderDropCustomize("copy")
                  : null}
              </div>
            }
          />
          <MediaLibraryDrawer
            entityId={entityId}
            open={mediaLibraryOpen}
            onOpenChange={setMediaLibraryOpen}
            mode="attach"
            onAttachToTray={(picked) => {
              const next = picked.map((row, index) => ({
                id: `lib-${row.id}-${index}`,
                url: row.url,
                publicUrl: row.url,
                type: row.kind,
              }))
              onMediaAssetsChange(next)
              setActiveMediaId(next[0]?.id ?? null)
            }}
          />
        </>
      ) : null}

      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-2 py-1 text-left font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-400 uppercase hover:text-neutral-600">
          <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          Diagnostics
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pb-1">
          <dl className="grid gap-2 font-mono text-[0.65rem] text-neutral-500 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-400">Marketing entity</dt>
              <dd className="break-all text-neutral-700">{item.id}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Brand entity</dt>
              <dd className="break-all text-neutral-700">{entityId}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Store listing ID</dt>
              <dd className="text-neutral-700">
                {item.website_item_id || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-400">Status</dt>
              <dd className="text-neutral-700">{status}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Trackable slug</dt>
              <dd className="text-neutral-700">
                {item.trackable_slug || "not allocated"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-400">Website</dt>
              <dd className="truncate text-neutral-700">
                {websiteUrl || "—"}
              </dd>
            </div>
          </dl>
        </CollapsibleContent>
      </Collapsible>

      {step === WORKBENCH_STEP_CHANNELS ? (
        <StepDock
          step={step}
          onBack={onBack}
          onNext={onNext}
          nextLabel="Confirm & Arm"
          nextBusy={arming || savingDraft}
          showScheduleActions
          onSaveDraft={onSaveDraft}
          saveDraftBusy={savingDraft}
          onConfirmArm={onArm}
          confirmArmBusy={arming}
          confirmArmDisabled={
            scheduleLocked || !dispatchPlan?.some((slot) => slot.enabled)
          }
          nextDisabled={
            scheduleLocked ||
            !dispatchPlan?.some((slot) => slot.enabled)
          }
          className="fixed inset-x-0 bottom-0 z-40"
        />
      ) : null}
    </div>
  )
}

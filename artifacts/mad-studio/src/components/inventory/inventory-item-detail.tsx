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
import { ChevronDown, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  approveMarketingEntity,
  armMultiChannelDispatch,
  patchDropWorkbenchDraft,
  saveDropDraft,
} from "@/lib/actions"
import {
  PostIntentEditor,
  initialPostIntentState,
} from "@/components/inventory/post-intent-editor"
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
import { AutoTextarea } from "@/components/studio/auto-textarea"
import {
  StepDock,
  StepStepper,
  type WorkbenchStepId,
} from "@/components/studio/step-stepper"
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
import {
  buildOptimizationTags,
  formatTagsForCaption,
  mergeCaptionWithTags,
  normalizeOptTag,
} from "@/lib/inventory/optimization-tags"
import type {
  MarketingEntity,
  MarketingEntityStatus,
  ScheduledSlotOccupancy,
} from "@/lib/inventory/types"
import { formatInventoryPrice } from "@/lib/inventory/types"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import { cn } from "@/lib/utils"

type Props = {
  item: MarketingEntity
  brandName: string
  industry?: string | null
  entityId: string
  websiteUrl?: string | null
  visualPresets?: import("@/lib/entities/dna-schema").VisualPresets | null
  occupiedSlots: ScheduledSlotOccupancy[]
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

  const [step, setStep] = useState<WorkbenchStepId>(1)
  const [simPlatform, setSimPlatform] = useState<SimulatorPlatform>("ig_story")
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
    if (next === 3 && !dispatchPlan) {
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
    setDraft((current) => ({
      ...current,
      headline: workbenchHeadlineFromTitle(item.title, {
        brand: item.brand,
        profileId: profile.id,
      }),
      caption: scrubCliches(row.hook),
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
    setEnhancingCaption(true)
    try {
      const response = await fetch("/api/inventory/enhance-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          marketingEntityId: item.id,
          headline: draft.headline,
          caption: draft.caption,
          visualDescription: visualInspection?.visualDescription ?? null,
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        headline?: string
        caption?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || "Enhance failed.")
      }
      if (!payload.headline?.trim() || !payload.caption?.trim()) {
        throw new Error("Model returned empty copy.")
      }
      setActiveHookId(null)
      setDraft((current) => ({
        ...current,
        headline: scrubCliches(scrubAgencyLeak(payload.headline!.trim())),
        caption: scrubCliches(scrubAgencyLeak(payload.caption!.trim())),
      }))
      toast.success("Caption enhanced with AI.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Caption enhance failed."
      )
    } finally {
      setEnhancingCaption(false)
    }
  }

  function toggleTag(tag: string) {
    const normalized = normalizeOptTag(tag)
    if (!normalized) return
    setDraft((current) => {
      const exists = current.tags.includes(normalized)
      return {
        ...current,
        tags: exists
          ? current.tags.filter((row) => row !== normalized)
          : [...current.tags, normalized].slice(0, 20),
      }
    })
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

  function onSaveDraft() {
    const media = resolvePublicMedia()

    setSavingDraft(true)
    startTransition(async () => {
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
          metadata: postIntentMetadata,
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

    const media = resolvePublicMedia()
    if (!media) {
      toast.error(
        "Arming needs a public https media URL — wait for upload to finish."
      )
      return
    }

    const placement: "feed" | "story" =
      simPlatform === "ig_story" || activeMedia?.type === "video"
        ? "story"
        : "feed"

    setArming(true)
    startTransition(async () => {
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
          metadata: postIntentMetadata,
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
    setStep((current) => (current > 1 ? ((current - 1) as WorkbenchStepId) : current))
  }

  function onNext() {
    if (step === 1) {
      if (mediaAssets.length === 0) {
        toast.message("Add a photo or reel before continuing.")
        return
      }
      if (!draft.caption.trim()) {
        toast.message("Pick a hook or write a caption before continuing.")
        return
      }
      setStep(2)
      return
    }
    if (step === 2) {
      goToStep(3)
      return
    }
    onArm()
  }

  const alreadyApproved =
    status === "approved" || status === "scheduled" || status === "published"
  const scheduleLocked = status === "published"
  const priceLabel = formatInventoryPrice(item.price)

  return (
    <div className="space-y-3 pb-24">
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

      <StepStepper step={step} onStepChange={goToStep} />

      {step === 3 ? (
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
                    onClick={() => setStep(1)}
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
                platform={simPlatform}
                onPlatformChange={setSimPlatform}
                storyPreview={storyPreview}
                onStoryPreviewChange={setStoryPreview}
                item={workingItem}
                industry={industry}
                visualPresets={visualPresets}
                showCreativeControls={false}
                showActionDock={false}
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
      ) : step === 1 ? (
        <div className="space-y-3">
          <MultiPlatformSimulator
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
            platform={simPlatform}
            onPlatformChange={setSimPlatform}
            storyPreview={storyPreview}
            onStoryPreviewChange={setStoryPreview}
            item={workingItem}
            industry={industry}
            visualPresets={visualPresets}
            showCreativeControls
            showActionDock={false}
            mediaSlot={
              <div className="space-y-2">
                <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
                  Media
                </p>
                <MediaTray
                  entityId={entityId}
                  inventoryItemId={item.id}
                  assets={mediaAssets}
                  activeId={activeMediaId}
                  onAssetsChange={onMediaAssetsChange}
                  onSelectMedia={onSelectMedia}
                  onVisualInspect={onVisualInspect}
                />
                {visualInspection?.visualDescription ? (
                  <p className="line-clamp-3 font-typewriter text-[0.55rem] leading-relaxed text-neutral-600 normal-case">
                    {visualInspection.visualDescription}
                  </p>
                ) : null}
              </div>
            }
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

          <PostIntentEditor
            isFudi={isFudi}
            vibeOptions={profile.vibeTags}
            value={postIntent}
            onChange={setPostIntent}
          />

          <section className="space-y-2 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="space-y-1">
                <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
                  Captions
                </p>
                {captionVariants.length > 0 ? (
                  <p className="font-typewriter text-[0.5rem] tracking-wider text-neutral-500 uppercase">
                    {captionVariants[captionVariantIndex]?.label ?? "Variant"}{" "}
                    · {captionVariantIndex + 1}/{captionVariants.length}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={rotateCaptionVariant}
                  className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
                >
                  <RotateCcw className="size-3" />
                  Rotate
                </button>
                <button
                  type="button"
                  onClick={() => void enhanceCaptionWithAi()}
                  disabled={enhancingCaption}
                  className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-60"
                >
                  {enhancingCaption ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Sparkles className="size-3" />
                  )}
                  AI enhance
                </button>
              </div>
            </div>

            <div className="grid max-h-[11rem] gap-1 overflow-y-auto sm:grid-cols-3">
              {contextHooks.map((hook) => {
                const active = activeHookId === hook.id
                return (
                  <button
                    key={hook.id}
                    type="button"
                    onClick={() => applyHook(hook.id)}
                    className={cn(
                      "border-2 border-mad-black px-2 py-1.5 text-left transition",
                      active
                        ? "bg-mad-black text-mad-white"
                        : "bg-mad-white hover:bg-mad-lime"
                    )}
                  >
                    <span
                      className={cn(
                        "block font-typewriter text-[0.5rem] font-bold tracking-wider uppercase",
                        active ? "text-mad-lime" : "text-mad-vermillion"
                      )}
                    >
                      {hook.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug">
                      {hook.hook}
                    </span>
                  </button>
                )
              })}
            </div>

            <label className="block space-y-1">
              <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
                Hook
              </span>
              <AutoTextarea
                value={draft.headline}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    headline: scrubAgencyLeak(value, { trim: false }),
                  }))
                }
                onCommit={() =>
                  setDraft((current) => ({
                    ...current,
                    headline: scrubAgencyLeak(current.headline),
                  }))
                }
                rows={1}
                placeholder="Editorial hook"
                className="rounded-none border-2 border-mad-black bg-mad-white px-2 py-1.5 text-sm font-medium focus:bg-mad-lime/20"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
                Caption
              </span>
              <AutoTextarea
                value={draft.caption}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    caption: scrubAgencyLeak(value, { trim: false }),
                  }))
                }
                onCommit={() =>
                  setDraft((current) => ({
                    ...current,
                    caption: scrubAgencyLeak(current.caption),
                  }))
                }
                rows={3}
                placeholder="Caption for feed / story"
                className="rounded-none border-2 border-mad-black bg-mad-white px-2 py-1.5 text-sm focus:bg-mad-lime/20"
              />
            </label>

            <div className="space-y-1.5">
              <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
                Optimisation tags
              </span>
              <div className="flex flex-wrap gap-1">
                {suggestedTags.map((tag) => {
                  const active = draft.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider lowercase",
                        active
                          ? "bg-mad-black text-mad-white"
                          : "bg-mad-white text-mad-black hover:bg-mad-lime"
                      )}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
              {draft.tags.length > 0 ? (
                <p className="font-typewriter text-[0.55rem] leading-relaxed text-neutral-600 normal-case">
                  Live footer · {formatTagsForCaption(draft.tags)}
                </p>
              ) : (
                <p className="font-typewriter text-[0.55rem] text-neutral-500 uppercase">
                  Tap tags to append search-ready hashtags on publish
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <section className="min-w-0 space-y-2 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm">
            <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Review
            </p>
            {isFudi && postIntent.dropKind ? (
              <p className="font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase">
                {FUDI_DROP_BADGES[postIntent.dropKind].emoji}{" "}
                {FUDI_DROP_BADGES[postIntent.dropKind].label}
                {postIntent.channelHint.trim()
                  ? ` · ${postIntent.channelHint.trim()}`
                  : ""}
              </p>
            ) : null}
            {effectiveListingVibe ? (
              <p className="font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-600 uppercase">
                Listing vibe · {effectiveListingVibe}
              </p>
            ) : null}
            <div className="space-y-1">
              <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
                Hook
              </p>
              <p className="text-sm font-medium text-mad-black">
                {draft.headline || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
                Caption
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-mad-black">
                {mergeCaptionWithTags(draft.caption, draft.tags) || "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="border-2 border-mad-black bg-mad-white px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
            >
              Edit captions
            </button>
          </section>

          <MultiPlatformSimulator
            className="lg:justify-self-end"
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
            platform={simPlatform}
            onPlatformChange={setSimPlatform}
            storyPreview={storyPreview}
            onStoryPreviewChange={setStoryPreview}
            item={workingItem}
            industry={industry}
            visualPresets={visualPresets}
            showCreativeControls={false}
            showActionDock={false}
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
      )}

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

      <StepDock
        step={step}
        onBack={onBack}
        onNext={onNext}
        nextLabel={step === 3 ? "Confirm & Arm" : undefined}
        nextBusy={arming || savingDraft}
        nextDisabled={
          (step === 1 &&
            (mediaAssets.length === 0 || !draft.caption.trim())) ||
          (step === 3 &&
            (scheduleLocked ||
              !dispatchPlan?.some((slot) => slot.enabled)))
        }
        className="fixed inset-x-0 bottom-0 z-40"
      />
    </div>
  )
}

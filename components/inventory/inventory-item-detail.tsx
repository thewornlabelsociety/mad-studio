"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"

import {
  approveMarketingEntity,
  armMultiChannelDispatch,
  saveDropDraft,
} from "@/app/actions/inventory"
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
import {
  buildDefaultDraft,
  evaluateSopChecklist,
  isSopValid,
  type SopDraft,
} from "@/lib/inventory/sop"
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

  const listingVibe = useMemo(() => {
    if (item.vibe?.trim()) return item.vibe.trim()
    return (
      pickDefaultVibeTag(
        profile,
        `${item.title} ${item.description ?? ""} ${item.brand ?? ""}`
      ) || null
    )
  }, [item.vibe, item.title, item.description, item.brand, profile])

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
    return {
      headline: scrubCliches(
        savedHeadline && !headlineIsFragment ? savedHeadline : defaults.headline
      ),
      caption: scrubCliches(item.copy_draft.caption || defaults.caption),
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
        listingVibe,
      }),
    [workingItem, brandName, industry, listingVibe]
  )

  const contextHooks = useMemo(
    () =>
      buildContextAwareHooks({
        item: workingItem,
        brandName,
        industry,
        vibeCategory: listingVibe,
        visualDescription: visualInspection?.visualDescription,
        concreteFeatures: visualInspection?.concreteFeatures,
        aestheticTags: visualInspection?.aestheticTags,
      }),
    [workingItem, brandName, industry, listingVibe, visualInspection]
  )

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

  function applyHook(hookId: ContextHookId) {
    const row = contextHooks.find((hook) => hook.id === hookId)
    if (!row) return
    setActiveHookId(hookId)
    setDraft((current) => ({
      ...current,
      headline: sanitizeItemTitle(item.title, { brand: item.brand }).slice(0, 72),
      caption: scrubCliches(row.hook),
    }))
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
                  caption: draft.caption,
                  imageUrl:
                    activeMedia?.type === "image"
                      ? activeMedia.url
                      : selectedImageUrl,
                  stickerLabel: "SHOP HERE",
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
                  destinationUrl: resolveItemDestinationUrl({
                    websiteUrl,
                    websiteItemId: item.website_item_id,
                  }),
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
              caption: draft.caption,
              imageUrl:
                activeMedia?.type === "image"
                  ? activeMedia.url
                  : selectedImageUrl,
              stickerLabel: "SHOP HERE",
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
              destinationUrl: resolveItemDestinationUrl({
                websiteUrl,
                websiteItemId: item.website_item_id,
              }),
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

          <section className="space-y-2 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
                Captions
              </p>
              {listingVibe ? (
                <p className="font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase">
                  Listing vibe · {listingVibe}
                </p>
              ) : null}
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
                    headline: scrubAgencyLeak(value),
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
                    caption: scrubAgencyLeak(value),
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
            {listingVibe ? (
              <p className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase">
                Listing vibe · {listingVibe}
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
              caption: draft.caption,
              imageUrl:
                activeMedia?.type === "image"
                  ? activeMedia.url
                  : selectedImageUrl,
              stickerLabel: "SHOP HERE",
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
              destinationUrl: resolveItemDestinationUrl({
                websiteUrl,
                websiteItemId: item.website_item_id,
              }),
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

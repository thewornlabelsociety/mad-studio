"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "wouter"

import {
  MultiPlatformSimulator,
  DEFAULT_STORY_PREVIEW,
  type SimulatorPlatform,
  type StoryPreviewState,
} from "@/components/marketing/multi-platform-simulator"
import type { ActiveMedia } from "@/components/marketing/media-tray"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import type { MarketingEntity } from "@/lib/inventory/types"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import { resolveTodayLivePostCopy } from "@/lib/today/preview-copy"
import type { TodayQueueView } from "@/lib/today/queue"

type Props = {
  view: TodayQueueView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  entityName: string
  industry?: string | null
  websiteUrl?: string | null
  visualPresets?: VisualPresets | null
  onPublished?: (itemId: string) => void
}

function defaultPlatformForView(
  view: TodayQueueView,
  slideCount: number
): SimulatorPlatform {
  if (view.fudiDropKind === "platform_promo" || slideCount > 1) {
    return "ig_feed"
  }
  if (view.isVideo) return "tiktok"
  const hint = view.channelRecommendation.toLowerCase()
  if (
    hint.includes("carousel") ||
    (hint.includes("feed") && !hint.includes("story"))
  ) {
    return "ig_feed"
  }
  return view.channel === "tiktok" ? "tiktok" : "ig_story"
}

function previewItemForSimulator(
  item: MarketingEntity,
  liveCopy: ReturnType<typeof resolveTodayLivePostCopy>
): MarketingEntity {
  return {
    ...item,
    title: liveCopy.headline,
    description: liveCopy.captionBody || item.description,
    copy_draft: {
      ...item.copy_draft,
      headline: liveCopy.headline,
      caption: liveCopy.captionBody,
    },
  }
}

export function IntakePreviewDialog({
  view,
  open,
  onOpenChange,
  entityId,
  entityName,
  industry = null,
  websiteUrl = null,
  visualPresets = null,
  onPublished,
}: Props) {
  const [platform, setPlatform] = useState<SimulatorPlatform>("ig_story")
  const [storyPreview, setStoryPreview] =
    useState<StoryPreviewState>(DEFAULT_STORY_PREVIEW)

  const profile = useMemo(
    () => resolveIndustryProfile({ name: entityName, industry }),
    [entityName, industry]
  )

  const liveCopy = useMemo(
    () => (view ? resolveTodayLivePostCopy(view, entityName) : null),
    [view, entityName]
  )

  const carouselMedia = useMemo(() => {
    if (!view) return null
    const urls = view.item.images.filter(
      (url) => typeof url === "string" && /^https?:\/\//i.test(url)
    )
    if (urls.length <= 1) return null
    return urls.map((url, index) => ({
      id: `${view.item.id}-${index}`,
      url,
      type: "image" as const,
    }))
  }, [view])

  useEffect(() => {
    if (!view || !open) return
    const slideCount = carouselMedia?.length ?? (view.mediaUrl ? 1 : 0)
    setPlatform(defaultPlatformForView(view, slideCount))
    setStoryPreview(DEFAULT_STORY_PREVIEW)
  }, [view, open, carouselMedia?.length])

  const previewContent = useMemo(() => {
    if (!view || !liveCopy) return null
    const stickerLabel =
      profile.id === "fudi"
        ? profile.shopLinkLabel || "View on FÜDI"
        : "SHOP HERE"
    return {
      brandName: entityName,
      handle: liveCopy.byline ?? entityName,
      headline: liveCopy.headline,
      caption: liveCopy.fullCaption,
      imageUrl: view.mediaUrl,
      stickerLabel,
    }
  }, [view, liveCopy, entityName, profile])

  const simulatorItem = useMemo(() => {
    if (!view || !liveCopy) return null
    return previewItemForSimulator(view.item, liveCopy)
  }, [view, liveCopy])

  const activeMedia = useMemo((): ActiveMedia | null => {
    if (!view?.mediaUrl) return null
    return {
      url: view.mediaUrl,
      type: view.isVideo ? "video" : "image",
    }
  }, [view])

  const actionContext = useMemo(() => {
    if (!view) return null
    return {
      entityId,
      marketingEntityId: view.item.id,
      websiteItemId: view.item.website_item_id,
      websiteUrl,
      trackableSlug: view.item.trackable_slug,
      destinationUrl: resolveItemDestinationUrl({
        entityId,
        websiteUrl,
        websiteItemId: view.item.website_item_id,
        copyDraft: view.item.copy_draft,
      }),
      slugSeed: view.slugSeed,
    }
  }, [view, entityId, websiteUrl])

  const studioHref = view
    ? `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(view.item.id)}`
    : "/studio"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={view?.item.id ?? "preview"}
        className="!flex max-h-[min(92dvh,880px)] w-[calc(100%-1rem)] max-w-lg !flex-col !gap-0 overflow-hidden !rounded-none border-2 border-mad-black !p-0 shadow-keycap-lg sm:w-full"
      >
        {view && liveCopy && previewContent && simulatorItem ? (
          <>
            <DialogHeader className="shrink-0 border-b-2 border-mad-black px-4 py-3 text-left">
              <DialogTitle className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
                Quick preview
              </DialogTitle>
              <p className="font-typewriter text-[0.5rem] leading-relaxed tracking-wider text-neutral-500 normal-case">
                Live preview — Feed/Facebook can publish live; Story/TikTok use
                Download media + Copy link sticker URL for your phone drop.
              </p>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              <MultiPlatformSimulator
                stacked
                previewMinimal
                content={previewContent}
                activeMedia={activeMedia}
                carouselMedia={carouselMedia}
                platform={platform}
                onPlatformChange={setPlatform}
                storyPreview={storyPreview}
                onStoryPreviewChange={setStoryPreview}
                item={simulatorItem}
                industry={industry}
                visualPresets={visualPresets}
                showCreativeControls={false}
                showTextStyler={false}
                showActionDock
                showPublishCta
                publishCtaLabel="Quick publish"
                actionContext={actionContext}
                onDispatchSuccess={() => {
                  onPublished?.(view.item.id)
                  onOpenChange(false)
                }}
              />

              <div className="mt-4 pb-1">
                <Link
                  href={`${studioHref}${studioHref.includes("?") ? "&" : "?"}step=2`}
                  className="inline-flex w-full items-center justify-center border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime"
                  onClick={() => onOpenChange(false)}
                >
                  Craft in Studio →
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 font-typewriter text-xs uppercase text-neutral-500">
            Loading preview…
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

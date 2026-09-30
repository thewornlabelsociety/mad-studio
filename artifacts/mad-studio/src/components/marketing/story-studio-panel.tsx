"use client"

/**
 * @deprecated Use MultiPlatformSimulator — kept as a thin adapter for any lingering imports.
 */
import { MultiPlatformSimulator } from "@/components/marketing/multi-platform-simulator"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import type { MarketingEntity } from "@/lib/inventory/types"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"

type Props = {
  item: MarketingEntity
  entityId: string
  brandName: string
  industry?: string | null
  websiteUrl?: string | null
  visualPresets?: VisualPresets | null
  headline?: string
  imageUrl?: string | null
  className?: string
}

export function StoryStudioPanel({
  item,
  entityId,
  brandName,
  industry = null,
  websiteUrl = null,
  visualPresets = null,
  headline,
  imageUrl = null,
  className,
}: Props) {
  return (
    <MultiPlatformSimulator
      className={className}
      content={{
        brandName,
        headline: headline || item.title,
        caption: item.copy_draft.caption || item.description || item.title,
        imageUrl,
        stickerLabel: "SHOP HERE",
      }}
      item={item}
      industry={industry}
      visualPresets={visualPresets}
      showCreativeControls
      showActionDock
      actionContext={{
        entityId,
        marketingEntityId: item.id,
        websiteItemId: item.website_item_id,
        websiteUrl,
        trackableSlug: item.trackable_slug,
        destinationUrl: resolveItemDestinationUrl({
          entityId,
          websiteUrl,
          websiteItemId: item.website_item_id,
          copyDraft: item.copy_draft,
        }),
      }}
    />
  )
}

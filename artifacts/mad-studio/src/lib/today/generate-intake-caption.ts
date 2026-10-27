import { patchDropWorkbenchDraft } from "@/lib/actions"
import {
  defaultIntakeCaptionForItem,
  type IntakeCaptionDefaultSource,
} from "@/lib/inventory/intake-caption-default"
import { requestEnhanceCaption } from "@/lib/inventory/enhance-caption-client"
import { requestMediaInspection } from "@/lib/media/client-inspect"
import { stripDuplicateHookFromCaption } from "@/lib/inventory/sop"
import type { MarketingEntity } from "@/lib/inventory/types"

export async function generateIntakeCaptionForItem(input: {
  entityId: string
  item: MarketingEntity
  defaultSource: IntakeCaptionDefaultSource
  regenerate?: boolean
}): Promise<{ headline: string; caption: string }> {
  const base = defaultIntakeCaptionForItem(input.item, input.defaultSource)
  const imageUrl = input.item.images.find((url) => /^https?:\/\//i.test(url))
  let visualDescription: string | null = null

  if (imageUrl) {
    try {
      const inspection = await requestMediaInspection({
        entityId: input.entityId,
        mediaUrl: imageUrl,
        mediaType: "image",
      })
      visualDescription = inspection?.visualDescription ?? null
    } catch {
      // Enhance still runs from listing text.
    }
  }

  const enhanced = await requestEnhanceCaption({
    entityId: input.entityId,
    marketingEntityId: input.item.id,
    headline: base.headline,
    caption: base.caption,
    visualDescription,
    regenerate: input.regenerate,
  })

  const caption = stripDuplicateHookFromCaption(
    enhanced.headline,
    enhanced.caption
  )

  const result = await patchDropWorkbenchDraft({
    entityId: input.entityId,
    itemId: input.item.id,
    copyDraft: {
      headline: enhanced.headline,
      caption,
      metadata: {
        intake_caption_source: input.defaultSource,
        intake_caption_seeded: false,
        intake_caption_generated_at: new Date().toISOString(),
      },
    },
  })

  if (!result.ok) {
    throw new Error(result.error ?? "Could not save caption.")
  }

  return { headline: enhanced.headline, caption }
}

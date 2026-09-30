import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import type { ContextHook } from "@/lib/inventory/context-hooks"
import {
  buildDefaultDraft,
  workbenchHeadlineFromTitle,
} from "@/lib/inventory/sop"
import type { MarketingEntity } from "@/lib/inventory/types"

export type WorkbenchCaptionVariant = {
  id: string
  label: string
  headline: string
  caption: string
}

/** Intake default + context hooks — used by Rotate on the Media step. */
export function buildWorkbenchCaptionVariants(input: {
  item: MarketingEntity
  brandName: string
  industry?: string | null
  hooks: ContextHook[]
}): WorkbenchCaptionVariant[] {
  const profile = resolveIndustryProfile({
    name: input.brandName,
    industry: input.industry,
  })
  const baseline = buildDefaultDraft(input.item, {
    brandName: input.brandName,
    industry: input.industry,
  })
  const headline = workbenchHeadlineFromTitle(input.item.title, {
    brand: input.item.brand,
    profileId: profile.id,
  })

  return [
    {
      id: "intake",
      label: "From intake",
      headline: baseline.headline,
      caption: baseline.caption,
    },
    ...input.hooks.map((hook) => ({
      id: hook.id,
      label: hook.label,
      headline,
      caption: hook.hook,
    })),
  ]
}

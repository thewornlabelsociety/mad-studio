import type { ContextHook } from "@/lib/inventory/context-hooks"
import {
  buildDefaultDraft,
  stripDuplicateHookFromCaption,
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
  const baseline = buildDefaultDraft(input.item, {
    brandName: input.brandName,
    industry: input.industry,
  })

  return [
    {
      id: "intake",
      label: "From intake",
      headline: baseline.headline,
      caption: stripDuplicateHookFromCaption(
        baseline.headline,
        baseline.caption
      ),
    },
    ...input.hooks.map((hook) => ({
      id: hook.id,
      label: hook.label,
      headline: hook.hook,
      caption: stripDuplicateHookFromCaption(hook.hook, baseline.caption),
    })),
  ]
}

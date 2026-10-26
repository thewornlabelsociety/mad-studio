import type { EntityTemplateInstance } from "./template-schema.ts"
import { resolveTemplateStudioCaption } from "./template-studio-caption.ts"
import {
  WLS_DAILY_STORY_HANDOFF_QUERY_FLAG,
  WLS_DAILY_STORY_STUDIO_MAX_FRAMES,
} from "./wls-daily-story-studio-seed.ts"

/** Studio handoff URL — reuses existing Create wizard (not a second engine). */
export function buildStudioHandoffHref(input: {
  entityId: string
  template: EntityTemplateInstance
}): string {
  const spark = resolveTemplateStudioCaption({
    defaultStudioCaption: input.template.payload.default_studio_caption,
    creativeInstructions:
      input.template.creative_instructions.trim() ||
      input.template.payload.creative_instructions.trim(),
    templateName: input.template.name,
  })
  const params = new URLSearchParams({
    eid: input.entityId,
    /** Media step (Create workbench step 2 — step 1 is Today). */
    step: "2",
    prompt: spark.slice(0, 500),
    templateInstanceId: input.template.id,
    templateVersion: String(input.template.version),
  })
  if (input.template.formula_hook_id) {
    params.set("formulaHookId", input.template.formula_hook_id)
  }
  return `/studio?${params.toString()}`
}

export function categoryLabel(category: string): string {
  return category.replace(/_/g, " ")
}

/**
 * WLS Daily New Arrival Story → Create Studio with N product frames (Story).
 * Server validates ids on load via POST /api/templates/wls-daily-story/studio-seed.
 */
export function buildWlsDailyStoryStudioHandoffHref(input: {
  entityId: string
  templateInstanceId: string
  marketingEntityIds: string[]
  templateVersion?: number
  formulaHookId?: string | null
}): string {
  const ids = input.marketingEntityIds
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, WLS_DAILY_STORY_STUDIO_MAX_FRAMES)
  const params = new URLSearchParams({
    eid: input.entityId,
    templateInstanceId: input.templateInstanceId,
    format: "story",
    [WLS_DAILY_STORY_HANDOFF_QUERY_FLAG]: "1",
    items: ids.join(","),
  })
  if (input.templateVersion != null) {
    params.set("templateVersion", String(input.templateVersion))
  }
  if (input.formulaHookId) {
    params.set("formulaHookId", input.formulaHookId)
  }
  return `/studio?${params.toString()}`
}

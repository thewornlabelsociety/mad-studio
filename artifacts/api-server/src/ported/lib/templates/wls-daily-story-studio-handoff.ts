import type { SupabaseClient } from "@supabase/supabase-js"

import {
  selectWlsProductsByIds,
  type WlsProductSelection,
} from "@/lib/inventory/wls-product-eligibility"
import { resolveTemplateStudioCaption } from "@/lib/templates/template-studio-caption"
import {
  WLS_DAILY_STORY_TEMPLATE_NAME,
} from "@/lib/templates/wls-daily-story"
import { normalizePayload } from "@/lib/templates/template-engine"

export const WLS_DAILY_STORY_STUDIO_MAX_FRAMES = 5

export type WlsDailyStoryStudioTemplateMeta = {
  templateInstanceId: string
  templateVersion: number
  formulaHookId: string | null
  canvasLayoutId: string | null
  storyStylePreset: string | null
  creativeSpark: string
  defaultStudioCaption: string | null
}

export type ValidateWlsDailyStoryStudioHandoffInput = {
  supabase: SupabaseClient
  entityId: string
  templateInstanceId: string
  marketingEntityIds: string[]
}

export type ValidateWlsDailyStoryStudioHandoffResult = {
  template: WlsDailyStoryStudioTemplateMeta
  selections: WlsProductSelection[]
}

/**
 * Server-side gate for Studio handoff — entity, template instance, and each
 * product must pass Checkpoint A eligibility (no trust in URL params alone).
 */
export async function validateWlsDailyStoryStudioHandoff(
  input: ValidateWlsDailyStoryStudioHandoffInput
): Promise<ValidateWlsDailyStoryStudioHandoffResult> {
  const ids = input.marketingEntityIds.map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) {
    throw new Error("Select at least one eligible product.")
  }
  if (ids.length > WLS_DAILY_STORY_STUDIO_MAX_FRAMES) {
    throw new Error(
      `Daily Story handoff supports up to ${WLS_DAILY_STORY_STUDIO_MAX_FRAMES} products.`
    )
  }
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    throw new Error("Duplicate product ids in handoff.")
  }

  const { data: instance, error: instanceError } = await input.supabase
    .from("entity_template_instances")
    .select(
      "id, entity_id, name, version, creative_instructions, formula_hook_id, canvas_layout_id, story_style_preset, payload"
    )
    .eq("id", input.templateInstanceId)
    .maybeSingle()

  if (instanceError) {
    throw new Error(instanceError.message)
  }
  if (!instance || instance.entity_id !== input.entityId) {
    throw new Error("Template instance not found for this brand.")
  }
  if (instance.name.trim() !== WLS_DAILY_STORY_TEMPLATE_NAME) {
    throw new Error(
      `Handoff requires the "${WLS_DAILY_STORY_TEMPLATE_NAME}" template instance.`
    )
  }

  const { data: entity, error: entityError } = await input.supabase
    .from("entities")
    .select("id, website_url")
    .eq("id", input.entityId)
    .maybeSingle()

  if (entityError || !entity) {
    throw new Error(entityError?.message ?? "Brand not found.")
  }

  const selections = await selectWlsProductsByIds({
    supabase: input.supabase,
    entityId: input.entityId,
    websiteUrl: entity.website_url,
    template: "daily_story",
    marketingEntityIds: ids,
    pickSurface: "story",
  })

  const payload = normalizePayload(
    instance.payload && typeof instance.payload === "object"
      ? (instance.payload as Record<string, unknown>)
      : {}
  )
  const defaultStudioCaption = payload.default_studio_caption?.trim() || null
  const creativeInstructions =
    instance.creative_instructions?.trim() ||
    payload.creative_instructions?.trim() ||
    ""
  const creativeSpark = resolveTemplateStudioCaption({
    defaultStudioCaption,
    creativeInstructions,
    templateName: instance.name,
  })

  return {
    template: {
      templateInstanceId: instance.id,
      templateVersion: instance.version,
      formulaHookId: instance.formula_hook_id ?? null,
      canvasLayoutId: instance.canvas_layout_id ?? null,
      storyStylePreset: instance.story_style_preset ?? null,
      creativeSpark,
      defaultStudioCaption,
    },
    selections,
  }
}

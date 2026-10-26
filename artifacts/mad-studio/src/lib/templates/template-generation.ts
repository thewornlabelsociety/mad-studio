import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

import {
  TemplateIsolationError,
  normalizePayload,
} from "./template-engine.ts"
import {
  type ResolvedTemplateForGeneration,
  buildAttributionColumns,
  buildGenerationRequestFingerprint,
  buildTemplateGuidancePromptBlock,
  isDuplicateGenerationError,
  makeGenerationKeyForTemplate,
} from "./template-generation-core.ts"
import { entityTemplateInstanceSchema } from "./template-schema.ts"
import { ensureTemplateVersionSnapshot } from "./template-service.ts"

export type { ResolvedTemplateForGeneration }
export {
  buildAttributionColumns,
  buildGenerationRequestFingerprint,
  buildTemplateGuidancePromptBlock,
  isDuplicateGenerationError,
  makeGenerationKeyForTemplate,
}

type Db = SupabaseClient<Database>

/**
 * Server-side resolve: loads entity-owned instance + head version.
 * Rejects cross-entity ids.
 */
export async function resolveTemplateForGeneration(input: {
  supabase: Db
  entityId: string
  templateInstanceId: string
  userId?: string
}): Promise<ResolvedTemplateForGeneration> {
  const { data: row, error } = await input.supabase
    .from("entity_template_instances")
    .select("*")
    .eq("id", input.templateInstanceId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!row) {
    throw new Error("Template instance not found.")
  }
  if (row.entity_id !== input.entityId) {
    throw new TemplateIsolationError("Cross-entity template use rejected.")
  }

  const instance = entityTemplateInstanceSchema.parse({
    ...row,
    channel_plan: Array.isArray(row.channel_plan) ? row.channel_plan : [],
    placeholder_defaults:
      row.placeholder_defaults && typeof row.placeholder_defaults === "object"
        ? row.placeholder_defaults
        : {},
    payload: normalizePayload(
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {}
    ),
    performance:
      row.performance && typeof row.performance === "object"
        ? row.performance
        : {},
  })

  const { data: versionRow, error: versionError } = await input.supabase
    .from("entity_template_versions")
    .select("id, version, entity_id")
    .eq("instance_id", instance.id)
    .eq("entity_id", input.entityId)
    .eq("version", instance.version)
    .maybeSingle()

  if (versionError) {
    throw new Error(versionError.message)
  }

  let versionId = versionRow?.id ?? null
  if (!versionId) {
    const { data: latest } = await input.supabase
      .from("entity_template_versions")
      .select("id, version, entity_id")
      .eq("instance_id", instance.id)
      .eq("entity_id", input.entityId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
    versionId = latest?.id ?? null
  }

  if (!versionId && input.userId) {
    await ensureTemplateVersionSnapshot({
      supabase: input.supabase,
      userId: input.userId,
      entityId: input.entityId,
      instance,
    })
    const { data: afterEnsure } = await input.supabase
      .from("entity_template_versions")
      .select("id, version, entity_id")
      .eq("instance_id", instance.id)
      .eq("entity_id", input.entityId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
    versionId = afterEnsure?.id ?? null
  }

  if (!versionId) {
    throw new Error(
      "Template version snapshot missing. Save the template once before generating."
    )
  }

  const payload = normalizePayload(instance.payload)

  return {
    instanceId: instance.id,
    versionId,
    version: instance.version,
    entityId: instance.entity_id,
    name: instance.name,
    creativeInstructions:
      instance.creative_instructions.trim() ||
      payload.creative_instructions.trim() ||
      instance.name,
    formulaHookId: instance.formula_hook_id ?? payload.formula_hook_id ?? null,
    channelPlan:
      instance.channel_plan.length > 0
        ? instance.channel_plan
        : payload.default_channels,
    placeholderDefaults: instance.placeholder_defaults ?? {},
    canvasLayoutId: instance.canvas_layout_id ?? payload.canvas_layout_id ?? null,
    storyStylePreset:
      instance.story_style_preset ?? payload.story_style_preset ?? null,
    packBias: payload.pack_bias ?? null,
    surfaces: payload.surfaces,
    placeholders: payload.placeholders,
    defaultStudioCaption: payload.default_studio_caption?.trim() || null,
  }
}

export async function findCampaignByGenerationKey(input: {
  supabase: Db
  entityId: string
  generationKey: string
}): Promise<{
  id: string
  title: string
  asset_pack: unknown
  algorithmic_signals: unknown
  media_url: string | null
  template_instance_id: string | null
  template_version_id: string | null
  template_generation_key: string | null
  entity_id: string
} | null> {
  const { data, error } = await input.supabase
    .from("campaigns")
    .select(
      "id, title, asset_pack, algorithmic_signals, media_url, template_instance_id, template_version_id, template_generation_key, entity_id"
    )
    .eq("entity_id", input.entityId)
    .eq("template_generation_key", input.generationKey)
    .maybeSingle()

  if (error) {
    if (
      error.message.toLowerCase().includes("template_generation_key") ||
      error.message.toLowerCase().includes("does not exist")
    ) {
      return null
    }
    throw new Error(error.message)
  }
  if (!data || data.entity_id !== input.entityId) return null
  return data
}

export { TemplateIsolationError }

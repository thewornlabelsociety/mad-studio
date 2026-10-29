import type { SupabaseClient } from "@supabase/supabase-js"

import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import {
  hasUsableFrameTemplate,
  parseFrameTemplate,
  type FrameTemplate,
} from "@/lib/templates/frame-template"
import { resolveTemplateForGeneration } from "@/lib/templates/template-generation"
import { resolveTemplateStudioCaption } from "@/lib/templates/template-studio-caption"
import { WLS_DAILY_STORY_TEMPLATE_NAME } from "@/lib/templates/wls-daily-story"
import { validateWlsDailyStoryStudioHandoff } from "@/lib/templates/wls-daily-story-studio-handoff"

export type StudioHandoffInitialStep = "media" | "canvas"

export type StudioHandoffTemplateMeta = {
  templateInstanceId: string
  templateVersion: number
  formulaHookId: string | null
  canvasLayoutId: string | null
  storyStylePreset: string | null
  creativeSpark: string
  defaultStudioCaption: string | null
  channelPlan: string[]
  surfaces: string[]
  templateName: string
}

export type ResolveStudioTemplateHandoffInput = {
  supabase: SupabaseClient
  entityId: string
  templateInstanceId: string
  marketingEntityIds?: string[]
  userId: string
}

export type StudioGenericHandoffResult = {
  kind: "generic"
  initialStep: StudioHandoffInitialStep
  template: StudioHandoffTemplateMeta
}

export type StudioWlsDailyStoryHandoffResult = {
  kind: "wls_daily_story"
  initialStep: StudioHandoffInitialStep
  template: StudioHandoffTemplateMeta
  selections?: WlsProductSelection[]
}

export type StudioFrameTemplateHandoffResult = {
  kind: "frame_template"
  initialStep: StudioHandoffInitialStep
  template: StudioHandoffTemplateMeta
  frameTemplate: FrameTemplate
}

export type ResolveStudioTemplateHandoffResult =
  | StudioGenericHandoffResult
  | StudioWlsDailyStoryHandoffResult
  | StudioFrameTemplateHandoffResult

function metaFromResolved(input: {
  name: string
  instanceId: string
  version: number
  formulaHookId: string | null
  canvasLayoutId: string | null
  storyStylePreset: string | null
  creativeInstructions: string
  defaultStudioCaption: string | null
  channelPlan: string[]
  surfaces: string[]
}): StudioHandoffTemplateMeta {
  const defaultStudioCaption = input.defaultStudioCaption?.trim() || null
  const creativeSpark = resolveTemplateStudioCaption({
    defaultStudioCaption,
    creativeInstructions: input.creativeInstructions,
    templateName: input.name,
  })
  return {
    templateName: input.name,
    templateInstanceId: input.instanceId,
    templateVersion: input.version,
    formulaHookId: input.formulaHookId,
    canvasLayoutId: input.canvasLayoutId,
    storyStylePreset: input.storyStylePreset,
    creativeSpark,
    defaultStudioCaption,
    channelPlan: input.channelPlan,
    surfaces: input.surfaces,
  }
}

function isWlsDailyStoryTemplateName(name: string): boolean {
  return name.trim() === WLS_DAILY_STORY_TEMPLATE_NAME
}

/**
 * Resolve how Create Studio should apply a template instance
 * (generic brief vs WLS seed vs Canva frame layout).
 */
export async function resolveStudioTemplateHandoff(
  input: ResolveStudioTemplateHandoffInput
): Promise<ResolveStudioTemplateHandoffResult> {
  const resolved = await resolveTemplateForGeneration({
    supabase: input.supabase,
    entityId: input.entityId,
    templateInstanceId: input.templateInstanceId,
    userId: input.userId,
  })

  const template = metaFromResolved({
    name: resolved.name,
    instanceId: resolved.instanceId,
    version: resolved.version,
    formulaHookId: resolved.formulaHookId,
    canvasLayoutId: resolved.canvasLayoutId,
    storyStylePreset: resolved.storyStylePreset,
    creativeInstructions: resolved.creativeInstructions,
    defaultStudioCaption: resolved.defaultStudioCaption,
    channelPlan: resolved.channelPlan,
    surfaces: resolved.surfaces,
  })

  const frameTemplate = parseFrameTemplate(resolved.frameTemplate)
  if (hasUsableFrameTemplate(frameTemplate)) {
    return {
      kind: "frame_template",
      initialStep: "media",
      template,
      frameTemplate,
    }
  }

  if (!isWlsDailyStoryTemplateName(resolved.name)) {
    return {
      kind: "generic",
      initialStep: "media",
      template,
    }
  }

  const ids = (input.marketingEntityIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length === 0) {
    return {
      kind: "wls_daily_story",
      initialStep: "media",
      template,
    }
  }

  const wls = await validateWlsDailyStoryStudioHandoff({
    supabase: input.supabase,
    entityId: input.entityId,
    templateInstanceId: input.templateInstanceId,
    marketingEntityIds: ids,
  })

  return {
    kind: "wls_daily_story",
    initialStep: "media",
    template: {
      ...template,
      templateInstanceId: wls.template.templateInstanceId,
      templateVersion: wls.template.templateVersion,
      formulaHookId: wls.template.formulaHookId,
      canvasLayoutId: wls.template.canvasLayoutId,
      storyStylePreset: wls.template.storyStylePreset,
      creativeSpark: wls.template.creativeSpark,
      defaultStudioCaption: wls.template.defaultStudioCaption,
    },
    selections: wls.selections,
  }
}

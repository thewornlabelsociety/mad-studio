import { z } from "zod"

import {
  frameTemplateSchema,
  type FrameTemplate,
} from "@/lib/templates/frame-template"
import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"

export const studioHandoffInitialStepSchema = z.enum(["media", "canvas"])
export type StudioHandoffInitialStep = z.infer<
  typeof studioHandoffInitialStepSchema
>

export const studioHandoffTemplateMetaSchema = z.object({
  templateInstanceId: z.string().uuid(),
  templateVersion: z.number().int().positive(),
  formulaHookId: z.string().nullable(),
  canvasLayoutId: z.string().nullable(),
  storyStylePreset: z.string().nullable(),
  creativeSpark: z.string(),
  /** Set when payload.default_studio_caption is defined — wins over merged intake on handoff. */
  defaultStudioCaption: z.string().nullable().optional(),
  channelPlan: z.array(z.string()).default([]),
  surfaces: z.array(z.string()).default([]),
  templateName: z.string().min(1),
})

export type StudioHandoffTemplateMeta = z.infer<
  typeof studioHandoffTemplateMetaSchema
>

export type StudioGenericHandoffResponse = {
  kind: "generic"
  initialStep: StudioHandoffInitialStep
  template: StudioHandoffTemplateMeta
}

export type StudioWlsDailyStoryHandoffResponse = {
  kind: "wls_daily_story"
  initialStep: StudioHandoffInitialStep
  template: StudioHandoffTemplateMeta
  selections?: WlsProductSelection[]
}

export type StudioFrameTemplateHandoffResponse = {
  kind: "frame_template"
  initialStep: StudioHandoffInitialStep
  template: StudioHandoffTemplateMeta
  frameTemplate: FrameTemplate
}

export type StudioTemplateHandoffResponse =
  | StudioGenericHandoffResponse
  | StudioWlsDailyStoryHandoffResponse
  | StudioFrameTemplateHandoffResponse

export function parseStudioTemplateHandoffResponse(
  raw: unknown
): StudioTemplateHandoffResponse {
  const payload =
    raw && typeof raw === "object"
      ? { ...(raw as Record<string, unknown>) }
      : {}
  delete payload.ok
  delete payload.error

  const base = z
    .object({
      kind: z.enum(["generic", "wls_daily_story", "frame_template"]),
      initialStep: studioHandoffInitialStepSchema,
      template: studioHandoffTemplateMetaSchema,
      selections: z.array(z.unknown()).optional(),
      frameTemplate: frameTemplateSchema.optional(),
    })
    .parse(payload)

  if (base.kind === "generic") {
    return {
      kind: "generic",
      initialStep: base.initialStep,
      template: base.template,
    }
  }

  if (base.kind === "frame_template") {
    if (!base.frameTemplate) {
      throw new Error("Frame template handoff missing layout.")
    }
    return {
      kind: "frame_template",
      initialStep: base.initialStep,
      template: base.template,
      frameTemplate: base.frameTemplate,
    }
  }

  return {
    kind: "wls_daily_story",
    initialStep: base.initialStep,
    template: base.template,
    selections: base.selections as WlsProductSelection[] | undefined,
  }
}

import { z } from "zod"

import { frameTemplateSchema } from "@/lib/templates/frame-template"

/** Extensible taxonomy — keep in sync with DB CHECK on platform_template_defs.category */
export const TEMPLATE_CATEGORIES = [
  "new_arrivals",
  "product_spotlight",
  "promotional",
  "educational",
  "community",
  "seasonal",
  "events",
  "email_newsletter",
  "launch",
  "recurring_series",
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

export const TEMPLATE_SURFACES = [
  "social_post",
  "carousel",
  "story",
  "video_brief",
  "email",
  "multi_channel",
] as const

export type TemplateSurface = (typeof TEMPLATE_SURFACES)[number]

export const TEMPLATE_INSTANCE_STATUSES = ["draft", "active", "archived"] as const
export type TemplateInstanceStatus = (typeof TEMPLATE_INSTANCE_STATUSES)[number]

export const RECIPE_STATUSES = ["active", "archived"] as const

/** Future-proof payload shared by starters + instances (not a second CampaignPack). */
export const templatePayloadSchema = z.object({
  surfaces: z.array(z.enum(TEMPLATE_SURFACES)).default(["social_post"]),
  default_channels: z.array(z.string().min(1).max(64)).max(12).default([]),
  creative_instructions: z.string().max(4000).default(""),
  formula_hook_id: z.string().max(80).optional().nullable(),
  story_style_preset: z.string().max(80).optional().nullable(),
  canvas_layout_id: z.string().max(80).optional().nullable(),
  placeholders: z.array(z.string().max(40)).max(24).default([]),
  email_skeleton: z
    .object({
      subject_hint: z.string().max(200).optional(),
      preview_hint: z.string().max(200).optional(),
    })
    .optional(),
  pack_bias: z.string().max(1000).optional(),
  /** Prefills Studio Copy when this template is applied (CTA / boilerplate). */
  default_studio_caption: z.string().max(4000).optional(),
  /**
   * Canva-style visual layout: background PNG + image drop slots + editable text.
   * Optional — brief-only templates omit this.
   */
  frame_template: frameTemplateSchema.optional().nullable(),
})

export type TemplatePayload = z.infer<typeof templatePayloadSchema>

export const platformTemplateDefSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  category: z.enum(TEMPLATE_CATEGORIES),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  industry_tags: z.array(z.string().max(40)).default([]),
  payload: templatePayloadSchema,
  version: z.number().int().positive(),
  is_published: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type PlatformTemplateDef = z.infer<typeof platformTemplateDefSchema>

export const entityTemplateInstanceSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid(),
  source_def_id: z.string().uuid().nullable().optional(),
  parent_instance_id: z.string().uuid().nullable().optional(),
  category: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  status: z.enum(TEMPLATE_INSTANCE_STATUSES),
  version: z.number().int().positive(),
  creative_instructions: z.string().max(4000).default(""),
  formula_hook_id: z.string().max(80).nullable().optional(),
  canvas_layout_id: z.string().max(80).nullable().optional(),
  story_style_preset: z.string().max(80).nullable().optional(),
  channel_plan: z.array(z.string().max(64)).default([]),
  placeholder_defaults: z.record(z.string(), z.string()).default({}),
  payload: templatePayloadSchema,
  performance: z.record(z.string(), z.unknown()).default({}),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type EntityTemplateInstance = z.infer<typeof entityTemplateInstanceSchema>

export const entityTemplateVersionSchema = z.object({
  id: z.string().uuid(),
  instance_id: z.string().uuid(),
  entity_id: z.string().uuid(),
  version: z.number().int().positive(),
  snapshot: z.record(z.string(), z.unknown()),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
})

export type EntityTemplateVersion = z.infer<typeof entityTemplateVersionSchema>

export const entityCreativeRecipeSchema = z.object({
  id: z.string().uuid(),
  entity_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  status: z.enum(RECIPE_STATUSES),
  source_campaign_id: z.string().uuid().nullable().optional(),
  source_template_instance_id: z.string().uuid().nullable().optional(),
  source_template_version_id: z.string().uuid().nullable().optional(),
  pack_snapshot: z.record(z.string(), z.unknown()).default({}),
  canvas_layout_id: z.string().max(80).nullable().optional(),
  formula_hook_id: z.string().max(80).nullable().optional(),
  channel_plan: z.array(z.string().max(64)).default([]),
  text_overlay: z.record(z.string(), z.unknown()).nullable().optional(),
  performance: z.record(z.string(), z.unknown()).default({}),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type EntityCreativeRecipe = z.infer<typeof entityCreativeRecipeSchema>

/** Attribution fields stored on campaigns (additive). */
export const campaignTemplateAttributionSchema = z.object({
  template_instance_id: z.string().uuid().nullable().optional(),
  template_version_id: z.string().uuid().nullable().optional(),
  template_generation_key: z.string().min(8).max(120).nullable().optional(),
})

export type CampaignTemplateAttribution = z.infer<
  typeof campaignTemplateAttributionSchema
>

// ---- API request contracts ----

export const forkTemplateRequestSchema = z.object({
  entityId: z.string().uuid(),
  starterId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  forkKey: z.string().min(8).max(120).optional(),
})

export const createTemplateInstanceRequestSchema = z.object({
  entityId: z.string().uuid(),
  category: z.enum(TEMPLATE_CATEGORIES).or(z.string().min(1).max(64)),
  name: z.string().min(1).max(200),
  creative_instructions: z.string().max(4000).optional(),
  payload: templatePayloadSchema.partial().optional(),
  formula_hook_id: z.string().max(80).nullable().optional(),
  canvas_layout_id: z.string().max(80).nullable().optional(),
  story_style_preset: z.string().max(80).nullable().optional(),
  channel_plan: z.array(z.string().max(64)).max(12).optional(),
  placeholder_defaults: z.record(z.string(), z.string()).optional(),
  status: z.enum(TEMPLATE_INSTANCE_STATUSES).optional(),
})

export const updateTemplateInstanceRequestSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  creative_instructions: z.string().max(4000).optional(),
  payload: templatePayloadSchema.partial().optional(),
  formula_hook_id: z.string().max(80).nullable().optional(),
  canvas_layout_id: z.string().max(80).nullable().optional(),
  story_style_preset: z.string().max(80).nullable().optional(),
  channel_plan: z.array(z.string().max(64)).max(12).optional(),
  placeholder_defaults: z.record(z.string(), z.string()).optional(),
  status: z.enum(TEMPLATE_INSTANCE_STATUSES).optional(),
  /** When true (default for active→edits), append a version snapshot before mutate. */
  createVersion: z.boolean().optional(),
})

export const duplicateTemplateRequestSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
})

export const createRecipeRequestSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(200),
  source_campaign_id: z.string().uuid().nullable().optional(),
  source_template_instance_id: z.string().uuid().nullable().optional(),
  source_template_version_id: z.string().uuid().nullable().optional(),
  pack_snapshot: z.record(z.string(), z.unknown()).default({}),
  canvas_layout_id: z.string().max(80).nullable().optional(),
  formula_hook_id: z.string().max(80).nullable().optional(),
  channel_plan: z.array(z.string().max(64)).max(12).optional(),
  text_overlay: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const templateGenerationKeySchema = z
  .string()
  .min(8)
  .max(120)
  .regex(/^[a-zA-Z0-9:_-]+$/)

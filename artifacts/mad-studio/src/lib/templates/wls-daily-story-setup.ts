import type { SupabaseClient } from "@supabase/supabase-js"

import {
  TemplateConflictError,
  TemplateIsolationError,
} from "@/lib/templates/template-engine"
import type {
  EntityTemplateInstance,
  EntityTemplateVersion,
} from "@/lib/templates/template-schema"
import {
  createTemplateInstance,
  ensureTemplateVersionSnapshot,
  listEntityTemplateInstances,
} from "@/lib/templates/template-service"
import {
  isWornLabelFashionEntity,
  WLS_DAILY_STORY_TEMPLATE_NAME,
} from "@/lib/templates/wls-daily-story"

export type EnsureWlsDailyStoryResult = {
  created: boolean
  instance: EntityTemplateInstance
  latestVersion: EntityTemplateVersion | null
}

/**
 * Idempotent: returns the existing WLS Daily New Arrival Story template or
 * creates it once for the given entity. No hardcoded entity UUID.
 */
export async function ensureWlsDailyStoryTemplate(input: {
  supabase: SupabaseClient
  userId: string
  entityId: string
  brandName: string
  industry?: string | null
}): Promise<EnsureWlsDailyStoryResult> {
  if (
    !isWornLabelFashionEntity({
      name: input.brandName,
      industry: input.industry,
    })
  ) {
    throw new TemplateIsolationError(
      "WLS Daily New Arrival Story can only be set up on a Worn Label Society brand."
    )
  }

  const existing = await listEntityTemplateInstances({
    supabase: input.supabase as never,
    userId: input.userId,
    entityId: input.entityId,
  })
  const found = existing.find(
    (row) => row.name === WLS_DAILY_STORY_TEMPLATE_NAME
  )
  if (found) {
    const latestVersion = await ensureTemplateVersionSnapshot({
      supabase: input.supabase as never,
      userId: input.userId,
      entityId: input.entityId,
      instance: found,
    })
    return {
      created: false,
      instance: found,
      latestVersion,
    }
  }

  try {
    const instance = await createTemplateInstance({
      supabase: input.supabase as never,
      userId: input.userId,
      body: {
        entityId: input.entityId,
        category: "new_arrivals",
        name: WLS_DAILY_STORY_TEMPLATE_NAME,
        status: "active",
        creative_instructions:
          "Daily New Arrival Instagram Story (1080×1920). Use the real product photo or approved cutout, verified brand/size/price from the WLS listing, and the exact product URL for phone link-sticker handoff. Never invent stock, size, or price. Keep cream/beige + near-black WLS palette and Brand Brain logo.",
        story_style_preset: "moody_noir",
        canvas_layout_id: "story_9_16",
        formula_hook_id: "wls_just_landed",
        channel_plan: ["instagram_story"],
        payload: {
          surfaces: ["story"],
          default_channels: ["instagram_story"],
          creative_instructions:
            "Product-driven 9:16 Story from synced WLS website listings. Checkpoint A eligibility required.",
          story_style_preset: "moody_noir",
          canvas_layout_id: "story_9_16",
          formula_hook_id: "wls_just_landed",
          placeholders: ["brand", "item", "size", "price", "url"],
        },
        placeholder_defaults: {
          editorial: "New Arrival",
        },
      },
    })

    const latestVersion = await ensureTemplateVersionSnapshot({
      supabase: input.supabase as never,
      userId: input.userId,
      entityId: input.entityId,
      instance,
    })

    return {
      created: true,
      instance,
      latestVersion,
    }
  } catch (error) {
    if (error instanceof TemplateConflictError) {
      const again = await listEntityTemplateInstances({
        supabase: input.supabase as never,
        userId: input.userId,
        entityId: input.entityId,
      })
      const raced = again.find(
        (row) => row.name === WLS_DAILY_STORY_TEMPLATE_NAME
      )
      if (raced) {
        const latestVersion = await ensureTemplateVersionSnapshot({
          supabase: input.supabase as never,
          userId: input.userId,
          entityId: input.entityId,
          instance: raced,
        })
        return {
          created: false,
          instance: raced,
          latestVersion,
        }
      }
    }
    throw error
  }
}

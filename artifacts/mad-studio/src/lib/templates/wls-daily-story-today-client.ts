import {
  entityTemplateInstanceSchema,
  type EntityTemplateInstance,
} from "@/lib/templates/template-schema"
import { buildStudioHandoffHref } from "@/lib/templates/template-handoff"

export type EnsureWlsDailyStoryTemplateResult =
  | { ok: true; instance: EntityTemplateInstance }
  | { ok: false; error: string }

/**
 * Resolve (or create) the entity-owned WLS Daily New Arrival Story template instance.
 * Uses POST /api/templates/wls-daily-story/ensure — no hardcoded template ids.
 */
export async function ensureWlsDailyStoryTemplateForEntity(
  entityId: string
): Promise<EnsureWlsDailyStoryTemplateResult> {
  const trimmed = entityId.trim()
  if (!trimmed) {
    return { ok: false, error: "Select a brand first." }
  }

  try {
    const res = await fetch("/api/templates/wls-daily-story/ensure", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: trimmed }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      instance?: unknown
      error?: string
      message?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        error:
          data.error ||
          data.message ||
          "Could not set up Daily New Arrival Story for this brand.",
      }
    }
    const parsed = entityTemplateInstanceSchema.safeParse(data.instance)
    if (!parsed.success) {
      return {
        ok: false,
        error: "Template setup returned an invalid instance.",
      }
    }
    return { ok: true, instance: parsed.data }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not reach the template service.",
    }
  }
}

/** Studio Media step handoff — no itemId, no wlsDailyStory items flag (pick products in Studio). */
export function buildWlsDailyStoryTodayStudioHref(input: {
  entityId: string
  instance: EntityTemplateInstance
}): string {
  return buildStudioHandoffHref({
    entityId: input.entityId,
    template: input.instance,
  })
}

import { parseApiJsonResponse } from "@/lib/api/parse-response"

import { buildStudioHandoffHref, categoryLabel } from "./template-handoff"
import { getMockInstances, getMockStarters } from "./template-mock"
import {
  entityTemplateInstanceSchema,
  platformTemplateDefSchema,
  type EntityTemplateInstance,
  type PlatformTemplateDef,
  type TemplateInstanceStatus,
  type TemplatePayload,
} from "./template-schema"

export { buildStudioHandoffHref, categoryLabel }

/** Never mix: UI must surface this mode explicitly. */
export type TemplateDataSource = "live" | "mock"

export type TemplateBackendStatus = {
  source: TemplateDataSource
  /** Mutations (fork/save/activate/duplicate) allowed only when live. */
  mutationsEnabled: boolean
  /** Generate → Studio handoff with template attribution only when live. */
  generateEnabled: boolean
  message: string | null
  detail: string | null
}

export type TemplateCentreBundle = {
  status: TemplateBackendStatus
  starters: PlatformTemplateDef[]
  instances: EntityTemplateInstance[]
}

function isUnavailableBackendError(message: string, status: number): boolean {
  const lower = message.toLowerCase()
  return (
    status === 404 ||
    status === 501 ||
    status === 503 ||
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("platform_template_defs") ||
    lower.includes("entity_template_instances") ||
    lower.includes("relation") ||
    lower.includes("api route not found") ||
    lower.includes("api server is not running")
  )
}

async function fetchJson(
  input: string,
  init?: RequestInit
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; message: string }> {
  try {
    const response = await fetch(input, {
      ...init,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })
    const data = await parseApiJsonResponse<Record<string, unknown>>(response)
    if (!response.ok) {
      const message =
        typeof data.error === "string" ? data.error : `HTTP ${response.status}`
      return { ok: false, status: response.status, message }
    }
    return { ok: true, data }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      message: error instanceof Error ? error.message : "Request failed.",
    }
  }
}

function mockStatus(detail: string): TemplateBackendStatus {
  return {
    source: "mock",
    mutationsEnabled: false,
    generateEnabled: false,
    message: "Demo data only — template tables are not available yet.",
    detail,
  }
}

function liveStatus(): TemplateBackendStatus {
  return {
    source: "live",
    mutationsEnabled: true,
    generateEnabled: true,
    message: null,
    detail: null,
  }
}

/**
 * Load Template Centre data for one entity.
 * Live path requires Phase 3B migration + API.
 * On unavailable backend, returns labeled mock data (never mixed with live rows).
 */
export async function loadTemplateCentre(
  entityId: string
): Promise<TemplateCentreBundle> {
  const startersRes = await fetchJson("/api/templates/starters")
  if (!startersRes.ok) {
    if (isUnavailableBackendError(startersRes.message, startersRes.status)) {
      return {
        status: mockStatus(startersRes.message),
        starters: getMockStarters(),
        instances: getMockInstances(entityId),
      }
    }
    throw new Error(startersRes.message)
  }

  const instancesRes = await fetchJson(
    `/api/templates/instances?entityId=${encodeURIComponent(entityId)}`
  )
  if (!instancesRes.ok) {
    if (isUnavailableBackendError(instancesRes.message, instancesRes.status)) {
      // Starters worked but instances table missing — still treat as mock-only
      // to avoid mixing live starters with mock instances.
      return {
        status: mockStatus(instancesRes.message),
        starters: getMockStarters(),
        instances: getMockInstances(entityId),
      }
    }
    throw new Error(instancesRes.message)
  }

  const startersRaw = (startersRes.data as { starters?: unknown }).starters
  const instancesRaw = (instancesRes.data as { instances?: unknown }).instances

  const starters = Array.isArray(startersRaw)
    ? startersRaw.map((row) => platformTemplateDefSchema.parse(row))
    : []
  const instances = Array.isArray(instancesRaw)
    ? instancesRaw
        .map((row) => entityTemplateInstanceSchema.parse(row))
        .filter((row) => row.entity_id === entityId)
    : []

  return {
    status: liveStatus(),
    starters,
    instances,
  }
}

export async function forkStarterLive(input: {
  entityId: string
  starterId: string
  name?: string
}): Promise<EntityTemplateInstance> {
  const res = await fetchJson("/api/templates/fork", {
    method: "POST",
    body: JSON.stringify({
      entityId: input.entityId,
      starterId: input.starterId,
      name: input.name,
    }),
  })
  if (!res.ok) throw new Error(res.message)
  return entityTemplateInstanceSchema.parse(
    (res.data as { instance: unknown }).instance
  )
}

export async function duplicateInstanceLive(input: {
  entityId: string
  instanceId: string
  name?: string
}): Promise<EntityTemplateInstance> {
  const res = await fetchJson(
    `/api/templates/instances/${encodeURIComponent(input.instanceId)}/duplicate`,
    {
      method: "POST",
      body: JSON.stringify({
        entityId: input.entityId,
        name: input.name,
      }),
    }
  )
  if (!res.ok) throw new Error(res.message)
  return entityTemplateInstanceSchema.parse(
    (res.data as { instance: unknown }).instance
  )
}

export async function updateInstanceLive(input: {
  entityId: string
  instanceId: string
  name?: string
  creative_instructions?: string
  status?: TemplateInstanceStatus
  formula_hook_id?: string | null
  story_style_preset?: string | null
  canvas_layout_id?: string | null
  channel_plan?: string[]
  placeholder_defaults?: Record<string, string>
  payload?: Partial<TemplatePayload>
}): Promise<EntityTemplateInstance> {
  const res = await fetchJson(
    `/api/templates/instances/${encodeURIComponent(input.instanceId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        entityId: input.entityId,
        name: input.name,
        creative_instructions: input.creative_instructions,
        status: input.status,
        formula_hook_id: input.formula_hook_id,
        story_style_preset: input.story_style_preset,
        canvas_layout_id: input.canvas_layout_id,
        channel_plan: input.channel_plan,
        placeholder_defaults: input.placeholder_defaults,
        payload: input.payload,
        createVersion: true,
      }),
    }
  )
  if (!res.ok) throw new Error(res.message)
  return entityTemplateInstanceSchema.parse(
    (res.data as { instance: unknown }).instance
  )
}

export const CHANNEL_OPTIONS = [
  { id: "instagram_feed", label: "Instagram feed" },
  { id: "instagram_story", label: "Instagram story" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "email", label: "Email" },
] as const

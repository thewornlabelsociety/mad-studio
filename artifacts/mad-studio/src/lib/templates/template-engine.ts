import {
  templatePayloadSchema,
  type CampaignTemplateAttribution,
  type EntityTemplateInstance,
  type PlatformTemplateDef,
  type TemplatePayload,
} from "./template-schema.ts"

export class TemplateIsolationError extends Error {
  readonly code = "TEMPLATE_ISOLATION" as const
  constructor(message = "Cross-entity template access denied.") {
    super(message)
    this.name = "TemplateIsolationError"
  }
}

export class TemplateAuthorizationError extends Error {
  readonly code = "TEMPLATE_UNAUTHORIZED" as const
  constructor(message = "Role cannot write templates.") {
    super(message)
    this.name = "TemplateAuthorizationError"
  }
}

export class TemplateConflictError extends Error {
  readonly code = "TEMPLATE_CONFLICT" as const
  constructor(message: string) {
    super(message)
    this.name = "TemplateConflictError"
  }
}

export type TemplateWriteRole = "entity_manager" | "creator" | "viewer" | "none"

/** Server-side role gate mirroring RLS write policies. */
export function assertTemplateWriteRole(role: TemplateWriteRole): void {
  if (role !== "entity_manager" && role !== "creator") {
    throw new TemplateAuthorizationError(
      "Unauthorized role cannot write templates or recipes."
    )
  }
}

export function assertSameEntity(
  expectedEntityId: string,
  actualEntityId: string | null | undefined,
  label = "resource"
): void {
  if (!actualEntityId || actualEntityId !== expectedEntityId) {
    throw new TemplateIsolationError(
      `Cross-entity ${label} access denied.`
    )
  }
}

/** Deep-clone JSON-safe values so forks never share references with starters. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function normalizePayload(
  partial?: Partial<TemplatePayload> | Record<string, unknown> | null
): TemplatePayload {
  return templatePayloadSchema.parse(partial ?? {})
}

export function mergePayload(
  base: TemplatePayload | Record<string, unknown>,
  patch?: Partial<TemplatePayload> | null
): TemplatePayload {
  const merged = {
    ...normalizePayload(base),
    ...(patch ?? {}),
  }
  if (patch?.surfaces) merged.surfaces = patch.surfaces
  if (patch?.default_channels) merged.default_channels = patch.default_channels
  if (patch?.placeholders) merged.placeholders = patch.placeholders
  return normalizePayload(merged)
}

export type ForkStarterInput = {
  entityId: string
  starter: PlatformTemplateDef
  name?: string
  userId?: string | null
}

/**
 * Pure fork: copies starter payload into an entity-owned instance draft.
 * Does not mutate `starter` (immutability of platform defs).
 */
export function buildForkedInstance(input: ForkStarterInput): Omit<
  EntityTemplateInstance,
  "id" | "created_at" | "updated_at"
> & { id?: never } {
  const starterSnapshot = cloneJson(input.starter)
  const payload = normalizePayload(starterSnapshot.payload)

  return {
    entity_id: input.entityId,
    source_def_id: starterSnapshot.id,
    parent_instance_id: null,
    category: starterSnapshot.category,
    name: (input.name?.trim() || starterSnapshot.title).slice(0, 200),
    status: "draft",
    version: 1,
    creative_instructions:
      payload.creative_instructions || starterSnapshot.description || "",
    formula_hook_id: payload.formula_hook_id ?? null,
    canvas_layout_id: payload.canvas_layout_id ?? null,
    story_style_preset: payload.story_style_preset ?? null,
    channel_plan: [...(payload.default_channels ?? [])],
    placeholder_defaults: {},
    payload,
    performance: {},
    created_by: input.userId ?? null,
  }
}

/** Snapshot shape stored in entity_template_versions.snapshot */
export function buildVersionSnapshot(
  instance: Pick<
    EntityTemplateInstance,
    | "name"
    | "category"
    | "status"
    | "creative_instructions"
    | "formula_hook_id"
    | "canvas_layout_id"
    | "story_style_preset"
    | "channel_plan"
    | "placeholder_defaults"
    | "payload"
    | "source_def_id"
    | "parent_instance_id"
    | "version"
  >
): Record<string, unknown> {
  return cloneJson({
    name: instance.name,
    category: instance.category,
    status: instance.status,
    creative_instructions: instance.creative_instructions,
    formula_hook_id: instance.formula_hook_id ?? null,
    canvas_layout_id: instance.canvas_layout_id ?? null,
    story_style_preset: instance.story_style_preset ?? null,
    channel_plan: instance.channel_plan ?? [],
    placeholder_defaults: instance.placeholder_defaults ?? {},
    payload: normalizePayload(instance.payload),
    source_def_id: instance.source_def_id ?? null,
    parent_instance_id: instance.parent_instance_id ?? null,
    version: instance.version,
  })
}

/**
 * Active (or any) template edits bump version and require a new snapshot row.
 * Previous version numbers are never mutated in place.
 */
export function planInstanceUpdate(input: {
  current: EntityTemplateInstance
  entityId: string
  patch: {
    name?: string
    creative_instructions?: string
    payload?: Partial<TemplatePayload>
    formula_hook_id?: string | null
    canvas_layout_id?: string | null
    story_style_preset?: string | null
    channel_plan?: string[]
    placeholder_defaults?: Record<string, string>
    status?: EntityTemplateInstance["status"]
  }
  createVersion?: boolean
}): {
  nextVersion: number
  shouldAppendVersion: boolean
  previousSnapshot: Record<string, unknown>
  nextRow: Omit<EntityTemplateInstance, "created_at" | "updated_at">
} {
  assertSameEntity(input.entityId, input.current.entity_id, "template instance")

  const shouldAppendVersion = input.createVersion !== false
  const previousSnapshot = buildVersionSnapshot(input.current)
  const nextVersion = shouldAppendVersion
    ? input.current.version + 1
    : input.current.version

  const payload = mergePayload(input.current.payload, input.patch.payload)

  const nextRow: Omit<EntityTemplateInstance, "created_at" | "updated_at"> = {
    ...input.current,
    name: input.patch.name?.trim() || input.current.name,
    creative_instructions:
      input.patch.creative_instructions ?? input.current.creative_instructions,
    formula_hook_id:
      input.patch.formula_hook_id !== undefined
        ? input.patch.formula_hook_id
        : input.current.formula_hook_id,
    canvas_layout_id:
      input.patch.canvas_layout_id !== undefined
        ? input.patch.canvas_layout_id
        : input.current.canvas_layout_id,
    story_style_preset:
      input.patch.story_style_preset !== undefined
        ? input.patch.story_style_preset
        : input.current.story_style_preset,
    channel_plan: input.patch.channel_plan ?? input.current.channel_plan,
    placeholder_defaults:
      input.patch.placeholder_defaults ?? input.current.placeholder_defaults,
    status: input.patch.status ?? input.current.status,
    payload,
    version: nextVersion,
  }

  return {
    nextVersion,
    shouldAppendVersion,
    previousSnapshot,
    nextRow,
  }
}

export function buildDuplicateInstance(input: {
  entityId: string
  source: EntityTemplateInstance
  name?: string
  userId?: string | null
}): Omit<EntityTemplateInstance, "id" | "created_at" | "updated_at"> {
  assertSameEntity(input.entityId, input.source.entity_id, "template instance")
  const cloned = cloneJson(input.source)

  return {
    entity_id: input.entityId,
    source_def_id: cloned.source_def_id ?? null,
    parent_instance_id: cloned.id,
    category: cloned.category,
    name: (input.name?.trim() || `${cloned.name} (copy)`).slice(0, 200),
    status: "draft",
    version: 1,
    creative_instructions: cloned.creative_instructions,
    formula_hook_id: cloned.formula_hook_id ?? null,
    canvas_layout_id: cloned.canvas_layout_id ?? null,
    story_style_preset: cloned.story_style_preset ?? null,
    channel_plan: [...(cloned.channel_plan ?? [])],
    placeholder_defaults: { ...(cloned.placeholder_defaults ?? {}) },
    payload: normalizePayload(cloned.payload),
    performance: {},
    created_by: input.userId ?? null,
  }
}

export type RecipeRefCheckInput = {
  entityId: string
  sourceCampaignEntityId?: string | null
  sourceTemplateInstanceEntityId?: string | null
  sourceTemplateVersionEntityId?: string | null
}

/** Reject recipes that point at another entity's campaign/template/version. */
export function assertRecipeRefsSameEntity(input: RecipeRefCheckInput): void {
  if (
    input.sourceCampaignEntityId != null &&
    input.sourceCampaignEntityId !== input.entityId
  ) {
    throw new TemplateIsolationError(
      "Cross-entity recipe campaign reference rejected."
    )
  }
  if (
    input.sourceTemplateInstanceEntityId != null &&
    input.sourceTemplateInstanceEntityId !== input.entityId
  ) {
    throw new TemplateIsolationError(
      "Cross-entity recipe template reference rejected."
    )
  }
  if (
    input.sourceTemplateVersionEntityId != null &&
    input.sourceTemplateVersionEntityId !== input.entityId
  ) {
    throw new TemplateIsolationError(
      "Cross-entity recipe version reference rejected."
    )
  }
}

/**
 * Deterministic idempotency key for template-driven generation.
 * Duplicate requests with the same key can be safely identified.
 */
export function buildTemplateGenerationKey(input: {
  entityId: string
  templateInstanceId: string
  templateVersionId: string
  requestFingerprint: string
}): string {
  const fp = input.requestFingerprint
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
  return [
    "tg",
    input.entityId.slice(0, 8),
    input.templateInstanceId.slice(0, 8),
    input.templateVersionId.slice(0, 8),
    fp || "default",
  ].join(":")
}

export function buildCampaignAttribution(input: {
  templateInstanceId: string
  templateVersionId: string
  generationKey: string
}): CampaignTemplateAttribution {
  return {
    template_instance_id: input.templateInstanceId,
    template_version_id: input.templateVersionId,
    template_generation_key: input.generationKey,
  }
}

/** Detect duplicate generation via unique (entity_id, template_generation_key). */
export function isDuplicateGenerationError(error: {
  code?: string
  message?: string
}): boolean {
  if (error.code === "23505") return true
  const msg = (error.message ?? "").toLowerCase()
  return (
    msg.includes("idx_campaigns_entity_generation_key") ||
    msg.includes("template_generation_key")
  )
}

/**
 * Prove starters stay unchanged after fork (reference + deep equality).
 * Used by tests and as a runtime guard in fork paths.
 */
export function assertStarterUnchangedAfterFork(
  before: PlatformTemplateDef,
  after: PlatformTemplateDef
): void {
  if (before === after) {
    // Same reference is fine if we never mutated; deep-compare content.
  }
  const a = JSON.stringify(before)
  const b = JSON.stringify(after)
  if (a !== b) {
    throw new Error("Platform starter was mutated during fork.")
  }
}

/** Versions are append-only: never rewrite a prior snapshot payload. */
export function assertVersionHistoryImmutable(input: {
  existingSnapshots: Array<{ version: number; snapshot: Record<string, unknown> }>
  appendVersion: number
}): void {
  const maxExisting = input.existingSnapshots.reduce(
    (max, row) => Math.max(max, row.version),
    0
  )
  for (const row of input.existingSnapshots) {
    if (row.version === input.appendVersion) {
      throw new TemplateConflictError(
        `Template version ${input.appendVersion} already exists and is immutable.`
      )
    }
  }
  if (input.appendVersion <= maxExisting) {
    throw new TemplateConflictError(
      "Template version history is append-only; cannot insert behind head."
    )
  }
}

/** Pure check: mutating a stored snapshot in place is forbidden. */
export function assertSnapshotNotMutated(
  stored: Record<string, unknown>,
  candidate: Record<string, unknown>
): void {
  if (JSON.stringify(stored) !== JSON.stringify(candidate)) {
    throw new TemplateConflictError(
      "Template version snapshots are immutable."
    )
  }
}

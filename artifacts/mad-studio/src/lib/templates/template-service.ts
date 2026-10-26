import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/database.types"
import { assertBrainEntityAccess } from "@/lib/brain/entity-access"

import {
  TemplateConflictError,
  TemplateIsolationError,
  assertRecipeRefsSameEntity,
  assertSameEntity,
  assertStarterUnchangedAfterFork,
  assertTemplateWriteRole,
  assertVersionHistoryImmutable,
  buildDuplicateInstance,
  buildForkedInstance,
  buildVersionSnapshot,
  cloneJson,
  normalizePayload,
  planInstanceUpdate,
  type TemplateWriteRole,
} from "./template-engine"
import {
  createRecipeRequestSchema,
  createTemplateInstanceRequestSchema,
  entityCreativeRecipeSchema,
  entityTemplateInstanceSchema,
  entityTemplateVersionSchema,
  forkTemplateRequestSchema,
  platformTemplateDefSchema,
  templatePayloadSchema,
  updateTemplateInstanceRequestSchema,
  type EntityCreativeRecipe,
  type EntityTemplateInstance,
  type EntityTemplateVersion,
  type PlatformTemplateDef,
} from "./template-schema"

type Db = SupabaseClient<Database>

async function requireEntityAccess(input: {
  supabase: Db
  userId: string
  entityId: string
  mode: "view" | "edit"
}): Promise<void> {
  // Writes: trust role-aware RPC only (fail closed). Do not use the Brain
  // membership fallback, which is role-blind and could elevate viewers.
  if (input.mode === "edit") {
    const { data, error } = await input.supabase.rpc("has_entity_access", {
      ent_id: input.entityId,
      allowed_roles: ["entity_manager", "creator"],
    })
    if (error) {
      throw new TemplateIsolationError(error.message)
    }
    if (!data) {
      throw new TemplateIsolationError(
        "MULTI-BRAND ISOLATION ACTIVE. Verify Entity Access."
      )
    }
    return
  }

  const access = await assertBrainEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    mode: "view",
  })
  if (!access.ok) {
    throw new TemplateIsolationError(access.error)
  }
}

function mapInstance(row: Record<string, unknown>): EntityTemplateInstance {
  return entityTemplateInstanceSchema.parse({
    ...row,
    channel_plan: Array.isArray(row.channel_plan)
      ? row.channel_plan
      : typeof row.channel_plan === "string"
        ? JSON.parse(row.channel_plan)
        : [],
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
}

export async function listPublishedStarters(
  supabase: Db
): Promise<PlatformTemplateDef[]> {
  const { data, error } = await supabase
    .from("platform_template_defs")
    .select("*")
    .eq("is_published", true)
    .order("category", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    platformTemplateDefSchema.parse({
      ...row,
      payload: normalizePayload(
        row.payload && typeof row.payload === "object"
          ? (row.payload as Record<string, unknown>)
          : {}
      ),
      industry_tags: row.industry_tags ?? [],
    })
  )
}

export async function listEntityTemplateInstances(input: {
  supabase: Db
  userId: string
  entityId: string
}): Promise<EntityTemplateInstance[]> {
  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    mode: "view",
  })

  const { data, error } = await input.supabase
    .from("entity_template_instances")
    .select("*")
    .eq("entity_id", input.entityId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapInstance(row as Record<string, unknown>))
}

export async function getEntityTemplateInstance(input: {
  supabase: Db
  userId: string
  entityId: string
  instanceId: string
}): Promise<EntityTemplateInstance | null> {
  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    mode: "view",
  })

  const { data, error } = await input.supabase
    .from("entity_template_instances")
    .select("*")
    .eq("id", input.instanceId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  assertSameEntity(input.entityId, data.entity_id, "template instance")
  return mapInstance(data as Record<string, unknown>)
}

export async function forkPlatformStarter(input: {
  supabase: Db
  userId: string
  body: unknown
  writeRole?: TemplateWriteRole
}): Promise<EntityTemplateInstance> {
  const parsed = forkTemplateRequestSchema.parse(input.body)
  if (input.writeRole) assertTemplateWriteRole(input.writeRole)

  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: parsed.entityId,
    mode: "edit",
  })

  const { data: starter, error: starterError } = await input.supabase
    .from("platform_template_defs")
    .select("*")
    .eq("id", parsed.starterId)
    .eq("is_published", true)
    .maybeSingle()

  if (starterError) throw new Error(starterError.message)
  if (!starter) throw new Error("Starter template not found.")

  const starterBefore = platformTemplateDefSchema.parse({
    ...starter,
    payload: normalizePayload(
      starter.payload && typeof starter.payload === "object"
        ? (starter.payload as Record<string, unknown>)
        : {}
    ),
    industry_tags: starter.industry_tags ?? [],
  })
  const starterGuard = cloneJson(starterBefore)

  const draft = buildForkedInstance({
    entityId: parsed.entityId,
    starter: starterBefore,
    name: parsed.name,
    userId: input.userId,
  })

  assertStarterUnchangedAfterFork(starterGuard, starterBefore)

  const { data: inserted, error } = await input.supabase
    .from("entity_template_instances")
    .insert({
      entity_id: draft.entity_id,
      source_def_id: draft.source_def_id,
      parent_instance_id: draft.parent_instance_id,
      category: draft.category,
      name: draft.name,
      status: draft.status,
      version: draft.version,
      creative_instructions: draft.creative_instructions,
      formula_hook_id: draft.formula_hook_id,
      canvas_layout_id: draft.canvas_layout_id,
      story_style_preset: draft.story_style_preset,
      channel_plan: draft.channel_plan as unknown as Json,
      placeholder_defaults: draft.placeholder_defaults as unknown as Json,
      payload: draft.payload as unknown as Json,
      performance: draft.performance as unknown as Json,
      created_by: draft.created_by,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new TemplateConflictError(
        "A template with this name already exists for the entity."
      )
    }
    throw new Error(error.message)
  }

  const instance = mapInstance(inserted as Record<string, unknown>)

  // Initial version snapshot (v1)
  const { error: versionError } = await input.supabase
    .from("entity_template_versions")
    .insert({
      instance_id: instance.id,
      entity_id: parsed.entityId,
      version: 1,
      snapshot: buildVersionSnapshot(instance) as unknown as Json,
      created_by: input.userId,
    })

  if (versionError && versionError.code !== "23505") {
    throw new Error(versionError.message)
  }

  // Re-read starter to prove platform row was not mutated by fork.
  const { data: starterAfter } = await input.supabase
    .from("platform_template_defs")
    .select("*")
    .eq("id", parsed.starterId)
    .maybeSingle()

  if (starterAfter) {
    const after = platformTemplateDefSchema.parse({
      ...starterAfter,
      payload: normalizePayload(
        starterAfter.payload && typeof starterAfter.payload === "object"
          ? (starterAfter.payload as Record<string, unknown>)
          : {}
      ),
      industry_tags: starterAfter.industry_tags ?? [],
    })
    assertStarterUnchangedAfterFork(starterGuard, after)
  }

  return instance
}

export async function createTemplateInstance(input: {
  supabase: Db
  userId: string
  body: unknown
  writeRole?: TemplateWriteRole
}): Promise<EntityTemplateInstance> {
  const parsed = createTemplateInstanceRequestSchema.parse(input.body)
  if (input.writeRole) assertTemplateWriteRole(input.writeRole)

  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: parsed.entityId,
    mode: "edit",
  })

  const payload = templatePayloadSchema.parse({
    ...(parsed.payload ?? {}),
    creative_instructions:
      parsed.creative_instructions ??
      parsed.payload?.creative_instructions ??
      "",
    formula_hook_id:
      parsed.formula_hook_id ?? parsed.payload?.formula_hook_id ?? null,
    canvas_layout_id:
      parsed.canvas_layout_id ?? parsed.payload?.canvas_layout_id ?? null,
    story_style_preset:
      parsed.story_style_preset ?? parsed.payload?.story_style_preset ?? null,
    default_channels:
      parsed.channel_plan ?? parsed.payload?.default_channels ?? [],
  })

  const { data, error } = await input.supabase
    .from("entity_template_instances")
    .insert({
      entity_id: parsed.entityId,
      category: parsed.category,
      name: parsed.name,
      status: parsed.status ?? "draft",
      version: 1,
      creative_instructions: payload.creative_instructions,
      formula_hook_id: payload.formula_hook_id ?? null,
      canvas_layout_id: payload.canvas_layout_id ?? null,
      story_style_preset: payload.story_style_preset ?? null,
      channel_plan: (parsed.channel_plan ??
        payload.default_channels) as unknown as Json,
      placeholder_defaults: (parsed.placeholder_defaults ??
        {}) as unknown as Json,
      payload: payload as unknown as Json,
      performance: {} as unknown as Json,
      created_by: input.userId,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new TemplateConflictError(
        "A template with this name already exists for the entity."
      )
    }
    throw new Error(error.message)
  }

  const instance = mapInstance(data as Record<string, unknown>)
  await input.supabase.from("entity_template_versions").insert({
    instance_id: instance.id,
    entity_id: parsed.entityId,
    version: 1,
    snapshot: buildVersionSnapshot(instance) as unknown as Json,
    created_by: input.userId,
  })

  return instance
}

export async function updateTemplateInstance(input: {
  supabase: Db
  userId: string
  instanceId: string
  body: unknown
  writeRole?: TemplateWriteRole
}): Promise<EntityTemplateInstance> {
  const parsed = updateTemplateInstanceRequestSchema.parse(input.body)
  if (input.writeRole) assertTemplateWriteRole(input.writeRole)

  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: parsed.entityId,
    mode: "edit",
  })

  const current = await getEntityTemplateInstance({
    supabase: input.supabase,
    userId: input.userId,
    entityId: parsed.entityId,
    instanceId: input.instanceId,
  })
  if (!current) throw new Error("Template instance not found.")

  const plan = planInstanceUpdate({
    current,
    entityId: parsed.entityId,
    patch: {
      name: parsed.name,
      creative_instructions: parsed.creative_instructions,
      payload: parsed.payload,
      formula_hook_id: parsed.formula_hook_id,
      canvas_layout_id: parsed.canvas_layout_id,
      story_style_preset: parsed.story_style_preset,
      channel_plan: parsed.channel_plan,
      placeholder_defaults: parsed.placeholder_defaults,
      status: parsed.status,
    },
    createVersion: parsed.createVersion,
  })

  if (plan.shouldAppendVersion) {
    const { data: existingVersions } = await input.supabase
      .from("entity_template_versions")
      .select("version, snapshot")
      .eq("instance_id", current.id)
      .eq("entity_id", parsed.entityId)

    assertVersionHistoryImmutable({
      existingSnapshots: (existingVersions ?? []).map((row) => ({
        version: row.version,
        snapshot: (row.snapshot ?? {}) as Record<string, unknown>,
      })),
      appendVersion: plan.nextVersion,
    })
  }

  const { data, error } = await input.supabase
    .from("entity_template_instances")
    .update({
      name: plan.nextRow.name,
      creative_instructions: plan.nextRow.creative_instructions,
      formula_hook_id: plan.nextRow.formula_hook_id,
      canvas_layout_id: plan.nextRow.canvas_layout_id,
      story_style_preset: plan.nextRow.story_style_preset,
      channel_plan: plan.nextRow.channel_plan as unknown as Json,
      placeholder_defaults: plan.nextRow
        .placeholder_defaults as unknown as Json,
      payload: plan.nextRow.payload as unknown as Json,
      status: plan.nextRow.status,
      version: plan.nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id)
    .eq("entity_id", parsed.entityId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  const updated = mapInstance(data as Record<string, unknown>)

  // Append-only: write the new head snapshot; never mutate prior rows.
  if (plan.shouldAppendVersion) {
    const { error: headVersionError } = await input.supabase
      .from("entity_template_versions")
      .insert({
        instance_id: updated.id,
        entity_id: parsed.entityId,
        version: updated.version,
        snapshot: buildVersionSnapshot(updated) as unknown as Json,
        created_by: input.userId,
      })
    if (headVersionError) {
      if (headVersionError.code === "23505") {
        throw new TemplateConflictError(
          `Template version ${updated.version} already exists and is immutable.`
        )
      }
      throw new Error(headVersionError.message)
    }
  }

  return updated
}

export async function duplicateTemplateInstance(input: {
  supabase: Db
  userId: string
  instanceId: string
  entityId: string
  name?: string
  writeRole?: TemplateWriteRole
}): Promise<EntityTemplateInstance> {
  if (input.writeRole) assertTemplateWriteRole(input.writeRole)

  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    mode: "edit",
  })

  const source = await getEntityTemplateInstance({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    instanceId: input.instanceId,
  })
  if (!source) throw new Error("Template instance not found.")

  const draft = buildDuplicateInstance({
    entityId: input.entityId,
    source,
    name: input.name,
    userId: input.userId,
  })

  const { data, error } = await input.supabase
    .from("entity_template_instances")
    .insert({
      entity_id: draft.entity_id,
      source_def_id: draft.source_def_id,
      parent_instance_id: draft.parent_instance_id,
      category: draft.category,
      name: draft.name,
      status: draft.status,
      version: draft.version,
      creative_instructions: draft.creative_instructions,
      formula_hook_id: draft.formula_hook_id,
      canvas_layout_id: draft.canvas_layout_id,
      story_style_preset: draft.story_style_preset,
      channel_plan: draft.channel_plan as unknown as Json,
      placeholder_defaults: draft.placeholder_defaults as unknown as Json,
      payload: draft.payload as unknown as Json,
      performance: draft.performance as unknown as Json,
      created_by: draft.created_by,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new TemplateConflictError(
        "A template with this name already exists for the entity."
      )
    }
    throw new Error(error.message)
  }

  const instance = mapInstance(data as Record<string, unknown>)
  await input.supabase.from("entity_template_versions").insert({
    instance_id: instance.id,
    entity_id: input.entityId,
    version: 1,
    snapshot: buildVersionSnapshot(instance) as unknown as Json,
    created_by: input.userId,
  })

  return instance
}

/**
 * Idempotent: older instances may exist without a row in entity_template_versions.
 * Handoff and generate/pack require at least one snapshot.
 */
export async function ensureTemplateVersionSnapshot(input: {
  supabase: Db
  userId: string
  entityId: string
  instance: EntityTemplateInstance
}): Promise<EntityTemplateVersion> {
  const versions = await listTemplateVersions({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    instanceId: input.instance.id,
  })
  if (versions[0]) return versions[0]

  const versionNumber = Math.max(1, input.instance.version ?? 1)
  const { error } = await input.supabase.from("entity_template_versions").insert({
    instance_id: input.instance.id,
    entity_id: input.entityId,
    version: versionNumber,
    snapshot: buildVersionSnapshot(input.instance) as unknown as Json,
    created_by: input.userId,
  })
  if (error && error.code !== "23505") {
    throw new Error(error.message)
  }

  const after = await listTemplateVersions({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    instanceId: input.instance.id,
  })
  if (!after[0]) {
    throw new Error("Could not create template version snapshot.")
  }
  return after[0]
}

export async function listTemplateVersions(input: {
  supabase: Db
  userId: string
  entityId: string
  instanceId: string
}): Promise<EntityTemplateVersion[]> {
  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    mode: "view",
  })

  // Confirm instance belongs to entity before listing versions.
  const instance = await getEntityTemplateInstance({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    instanceId: input.instanceId,
  })
  if (!instance) throw new Error("Template instance not found.")

  const { data, error } = await input.supabase
    .from("entity_template_versions")
    .select("*")
    .eq("instance_id", input.instanceId)
    .eq("entity_id", input.entityId)
    .order("version", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    entityTemplateVersionSchema.parse({
      ...row,
      snapshot:
        row.snapshot && typeof row.snapshot === "object"
          ? row.snapshot
          : {},
    })
  )
}

export async function createCreativeRecipe(input: {
  supabase: Db
  userId: string
  body: unknown
  writeRole?: TemplateWriteRole
}): Promise<EntityCreativeRecipe> {
  const parsed = createRecipeRequestSchema.parse(input.body)
  if (input.writeRole) assertTemplateWriteRole(input.writeRole)

  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: parsed.entityId,
    mode: "edit",
  })

  let sourceCampaignEntityId: string | null = null
  let sourceTemplateInstanceEntityId: string | null = null
  let sourceTemplateVersionEntityId: string | null = null

  if (parsed.source_campaign_id) {
    const { data: campaign } = await input.supabase
      .from("campaigns")
      .select("id, entity_id")
      .eq("id", parsed.source_campaign_id)
      .maybeSingle()
    sourceCampaignEntityId = campaign?.entity_id ?? null
    if (!campaign) throw new Error("Source campaign not found.")
  }

  if (parsed.source_template_instance_id) {
    const { data: tmpl } = await input.supabase
      .from("entity_template_instances")
      .select("id, entity_id")
      .eq("id", parsed.source_template_instance_id)
      .maybeSingle()
    sourceTemplateInstanceEntityId = tmpl?.entity_id ?? null
    if (!tmpl) throw new Error("Source template instance not found.")
  }

  if (parsed.source_template_version_id) {
    const { data: ver } = await input.supabase
      .from("entity_template_versions")
      .select("id, entity_id")
      .eq("id", parsed.source_template_version_id)
      .maybeSingle()
    sourceTemplateVersionEntityId = ver?.entity_id ?? null
    if (!ver) throw new Error("Source template version not found.")
  }

  assertRecipeRefsSameEntity({
    entityId: parsed.entityId,
    sourceCampaignEntityId,
    sourceTemplateInstanceEntityId,
    sourceTemplateVersionEntityId,
  })

  const { data, error } = await input.supabase
    .from("entity_creative_recipes")
    .insert({
      entity_id: parsed.entityId,
      name: parsed.name,
      status: "active",
      source_campaign_id: parsed.source_campaign_id ?? null,
      source_template_instance_id: parsed.source_template_instance_id ?? null,
      source_template_version_id: parsed.source_template_version_id ?? null,
      pack_snapshot: parsed.pack_snapshot as unknown as Json,
      canvas_layout_id: parsed.canvas_layout_id ?? null,
      formula_hook_id: parsed.formula_hook_id ?? null,
      channel_plan: (parsed.channel_plan ?? []) as unknown as Json,
      text_overlay: (parsed.text_overlay ?? null) as unknown as Json,
      performance: {} as unknown as Json,
      created_by: input.userId,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new TemplateConflictError(
        "A recipe with this name already exists for the entity."
      )
    }
    throw new Error(error.message)
  }

  return entityCreativeRecipeSchema.parse({
    ...data,
    channel_plan: Array.isArray(data.channel_plan) ? data.channel_plan : [],
    pack_snapshot:
      data.pack_snapshot && typeof data.pack_snapshot === "object"
        ? data.pack_snapshot
        : {},
    performance:
      data.performance && typeof data.performance === "object"
        ? data.performance
        : {},
  })
}

export async function listCreativeRecipes(input: {
  supabase: Db
  userId: string
  entityId: string
}): Promise<EntityCreativeRecipe[]> {
  await requireEntityAccess({
    supabase: input.supabase,
    userId: input.userId,
    entityId: input.entityId,
    mode: "view",
  })

  const { data, error } = await input.supabase
    .from("entity_creative_recipes")
    .select("*")
    .eq("entity_id", input.entityId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    entityCreativeRecipeSchema.parse({
      ...row,
      channel_plan: Array.isArray(row.channel_plan) ? row.channel_plan : [],
      pack_snapshot:
        row.pack_snapshot && typeof row.pack_snapshot === "object"
          ? row.pack_snapshot
          : {},
      performance:
        row.performance && typeof row.performance === "object"
          ? row.performance
          : {},
    })
  )
}

/** Exported for privileged (service-role) callers — still requires entityId match. */
export function assertPrivilegedEntityContext(
  requestedEntityId: string,
  rowEntityId: string | null | undefined,
  label = "template"
): void {
  assertSameEntity(requestedEntityId, rowEntityId, label)
}

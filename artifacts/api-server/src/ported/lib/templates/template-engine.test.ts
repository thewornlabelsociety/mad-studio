import assert from "node:assert/strict"
import { test } from "node:test"

import { campaignPackSchema } from "../campaigns/pack-schema.ts"

import {
  TemplateAuthorizationError,
  TemplateIsolationError,
  assertRecipeRefsSameEntity,
  assertSameEntity,
  assertSnapshotNotMutated,
  assertStarterUnchangedAfterFork,
  assertTemplateWriteRole,
  assertVersionHistoryImmutable,
  buildCampaignAttribution,
  buildDuplicateInstance,
  buildForkedInstance,
  buildTemplateGenerationKey,
  buildVersionSnapshot,
  cloneJson,
  isDuplicateGenerationError,
  planInstanceUpdate,
} from "./template-engine.ts"
import {
  createRecipeRequestSchema,
  templatePayloadSchema,
  type EntityTemplateInstance,
  type PlatformTemplateDef,
} from "./template-schema.ts"

const ENTITY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ENTITY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const STARTER_ID = "11111111-1111-1111-1111-111111111111"
const INSTANCE_ID = "22222222-2222-2222-2222-222222222222"
const VERSION_ID = "33333333-3333-3333-3333-333333333333"

function makeStarter(
  overrides: Partial<PlatformTemplateDef> = {}
): PlatformTemplateDef {
  return {
    id: STARTER_ID,
    slug: "starter-new-arrivals",
    category: "new_arrivals",
    title: "New arrivals drop",
    description: "Generic arrival announcement",
    industry_tags: ["fashion"],
    payload: templatePayloadSchema.parse({
      surfaces: ["social_post", "story"],
      default_channels: ["instagram_feed"],
      creative_instructions: "Announce a new item.",
      formula_hook_id: "curiosity_gap",
      placeholders: ["item"],
    }),
    version: 1,
    is_published: true,
    ...overrides,
  }
}

function makeInstance(
  overrides: Partial<EntityTemplateInstance> = {}
): EntityTemplateInstance {
  return {
    id: INSTANCE_ID,
    entity_id: ENTITY_A,
    source_def_id: STARTER_ID,
    parent_instance_id: null,
    category: "new_arrivals",
    name: "Brand A arrivals",
    status: "active",
    version: 1,
    creative_instructions: "Announce a new item.",
    formula_hook_id: "curiosity_gap",
    canvas_layout_id: null,
    story_style_preset: null,
    channel_plan: ["instagram_feed"],
    placeholder_defaults: {},
    payload: templatePayloadSchema.parse({
      surfaces: ["social_post"],
      default_channels: ["instagram_feed"],
      creative_instructions: "Announce a new item.",
    }),
    performance: {},
    created_by: null,
    ...overrides,
  }
}

test("Entity A cannot read or modify Entity B templates (isolation helpers)", () => {
  assert.throws(
    () => assertSameEntity(ENTITY_A, ENTITY_B, "template instance"),
    TemplateIsolationError
  )
  assert.throws(
    () =>
      buildDuplicateInstance({
        entityId: ENTITY_A,
        source: makeInstance({ entity_id: ENTITY_B }),
      }),
    TemplateIsolationError
  )
  assert.throws(
    () =>
      planInstanceUpdate({
        current: makeInstance({ entity_id: ENTITY_B }),
        entityId: ENTITY_A,
        patch: { name: "Hijack" },
      }),
    TemplateIsolationError
  )
  // Privileged backends must still validate entity context (same helper).
  assert.throws(
    () => assertSameEntity(ENTITY_A, null, "template"),
    TemplateIsolationError
  )
})

test("Unauthorized roles cannot write", () => {
  assert.throws(() => assertTemplateWriteRole("viewer"), TemplateAuthorizationError)
  assert.throws(() => assertTemplateWriteRole("none"), TemplateAuthorizationError)
  assert.doesNotThrow(() => assertTemplateWriteRole("creator"))
  assert.doesNotThrow(() => assertTemplateWriteRole("entity_manager"))
})

test("Starter definitions remain unchanged after forking", () => {
  const starter = makeStarter()
  const before = cloneJson(starter)
  const forked = buildForkedInstance({
    entityId: ENTITY_A,
    starter,
    name: "My fork",
  })

  // Mutating the fork must not touch the starter object.
  forked.payload.creative_instructions = "BRAND SPECIFIC COPY"
  forked.name = "Mutated fork name"
  forked.channel_plan.push("tiktok")

  assertStarterUnchangedAfterFork(before, starter)
  assert.equal(starter.payload.creative_instructions, "Announce a new item.")
  assert.equal(starter.title, "New arrivals drop")
  assert.deepEqual(starter.payload.default_channels, ["instagram_feed"])
  assert.equal(forked.entity_id, ENTITY_A)
  assert.equal(forked.source_def_id, STARTER_ID)
  assert.notEqual(forked.name, starter.title) // renamed
})

test("Template version history is immutable", () => {
  const instance = makeInstance({ version: 1 })
  const snapV1 = buildVersionSnapshot(instance)
  const history = [{ version: 1, snapshot: snapV1 }]

  assert.throws(
    () =>
      assertVersionHistoryImmutable({
        existingSnapshots: history,
        appendVersion: 1,
      }),
    /immutable|already exists/i
  )

  assert.throws(
    () =>
      assertVersionHistoryImmutable({
        existingSnapshots: history,
        appendVersion: 0,
      }),
    /append-only/i
  )

  assert.doesNotThrow(() =>
    assertVersionHistoryImmutable({
      existingSnapshots: history,
      appendVersion: 2,
    })
  )

  const plan = planInstanceUpdate({
    current: instance,
    entityId: ENTITY_A,
    patch: { creative_instructions: "Revised instructions" },
  })
  assert.equal(plan.nextVersion, 2)
  assert.equal(plan.shouldAppendVersion, true)
  assert.equal(plan.previousSnapshot.creative_instructions, "Announce a new item.")
  assert.equal(plan.nextRow.creative_instructions, "Revised instructions")

  // Prior snapshot must not change when next row is edited further.
  const prior = cloneJson(plan.previousSnapshot)
  plan.nextRow.creative_instructions = "Another edit"
  assertSnapshotNotMutated(prior, plan.previousSnapshot)
})

test("Cross-entity recipe references are rejected", () => {
  assert.throws(
    () =>
      assertRecipeRefsSameEntity({
        entityId: ENTITY_A,
        sourceCampaignEntityId: ENTITY_B,
      }),
    /campaign reference/i
  )
  assert.throws(
    () =>
      assertRecipeRefsSameEntity({
        entityId: ENTITY_A,
        sourceTemplateInstanceEntityId: ENTITY_B,
      }),
    /template reference/i
  )
  assert.throws(
    () =>
      assertRecipeRefsSameEntity({
        entityId: ENTITY_A,
        sourceTemplateVersionEntityId: ENTITY_B,
      }),
    /version reference/i
  )
  assert.doesNotThrow(() =>
    assertRecipeRefsSameEntity({
      entityId: ENTITY_A,
      sourceCampaignEntityId: ENTITY_A,
      sourceTemplateInstanceEntityId: ENTITY_A,
      sourceTemplateVersionEntityId: ENTITY_A,
    })
  )

  const badRecipe = createRecipeRequestSchema.safeParse({
    entityId: "not-a-uuid",
    name: "x",
    pack_snapshot: {},
  })
  assert.equal(badRecipe.success, false)
})

test("Duplicate generation requests can be safely identified", () => {
  const key1 = buildTemplateGenerationKey({
    entityId: ENTITY_A,
    templateInstanceId: INSTANCE_ID,
    templateVersionId: VERSION_ID,
    requestFingerprint: "spark:drop-friday",
  })
  const key2 = buildTemplateGenerationKey({
    entityId: ENTITY_A,
    templateInstanceId: INSTANCE_ID,
    templateVersionId: VERSION_ID,
    requestFingerprint: "spark:drop-friday",
  })
  const keyOther = buildTemplateGenerationKey({
    entityId: ENTITY_B,
    templateInstanceId: INSTANCE_ID,
    templateVersionId: VERSION_ID,
    requestFingerprint: "spark:drop-friday",
  })

  assert.equal(key1, key2)
  assert.notEqual(key1, keyOther)
  assert.equal(isDuplicateGenerationError({ code: "23505" }), true)
  assert.equal(
    isDuplicateGenerationError({
      message: 'duplicate key value violates unique constraint "idx_campaigns_entity_generation_key"',
    }),
    true
  )
  assert.equal(isDuplicateGenerationError({ message: "other" }), false)

  const attribution = buildCampaignAttribution({
    templateInstanceId: INSTANCE_ID,
    templateVersionId: VERSION_ID,
    generationKey: key1,
  })
  assert.equal(attribution.template_instance_id, INSTANCE_ID)
  assert.equal(attribution.template_version_id, VERSION_ID)
  assert.equal(attribution.template_generation_key, key1)
})

test("Existing CampaignPack contract remains unchanged", () => {
  const pack = campaignPackSchema.parse({
    campaign_title: "Friday Drop",
    algorithmic_signals: {
      spoken_hook: "This linen set just landed",
      on_screen_text: "New in store",
      search_keywords: ["linen set", "summer outfit", "whangarei fashion"],
    },
    short_video_script: {
      hook_visual: "Rack pull",
      spoken_lines: ["Line one", "Line two"],
      b_roll_cues: ["Detail shot"],
      cta_spoken: "Come try it on",
    },
    carousel: {
      title: "Drop",
      slides: [
        { slide_number: 1, headline: "A", body_text: "a" },
        { slide_number: 2, headline: "B", body_text: "b" },
        { slide_number: 3, headline: "C", body_text: "c" },
      ],
    },
    seo_caption: {
      caption_body: "Caption",
      search_optimized_tags: ["tag1", "tag2", "tag3"],
    },
    email_drop: {
      subject_line: "Subject",
      preview_text: "Preview",
      body_markdown: "Body",
    },
    b2b_dm: {
      platform: "instagram",
      message_text: "Hello",
    },
  })
  assert.equal(pack.campaign_title, "Friday Drop")
  assert.ok(pack.email_drop)
  assert.ok(pack.carousel.slides.length >= 3)
})

test("Template payload supports multi-surface contracts without a second engine", () => {
  const multi = templatePayloadSchema.parse({
    surfaces: [
      "social_post",
      "carousel",
      "story",
      "video_brief",
      "email",
      "multi_channel",
    ],
    default_channels: ["instagram_feed", "email", "tiktok"],
    creative_instructions: "One pack, many surfaces.",
    email_skeleton: { subject_hint: "This week", preview_hint: "Preview" },
  })
  assert.equal(multi.surfaces.length, 6)
  assert.ok(multi.email_skeleton?.subject_hint)
})

import assert from "node:assert/strict"
import { test } from "node:test"

import { generatePackRequestSchema } from "../campaigns/pack-schema.ts"
import {
  TemplateIsolationError,
  assertSameEntity,
  isDuplicateGenerationError,
} from "./template-engine.ts"
import {
  buildAttributionColumns,
  buildGenerationRequestFingerprint,
  buildTemplateGuidancePromptBlock,
  makeGenerationKeyForTemplate,
  type ResolvedTemplateForGeneration,
} from "./template-generation-core.ts"

const ENTITY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ENTITY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

function sampleTemplate(
  overrides: Partial<ResolvedTemplateForGeneration> = {}
): ResolvedTemplateForGeneration {
  return {
    instanceId: "22222222-2222-2222-2222-222222222222",
    versionId: "33333333-3333-3333-3333-333333333333",
    version: 2,
    entityId: ENTITY_A,
    name: "Arrivals",
    creativeInstructions:
      "MUST mention the showroom try-on and never invent a discount percentage.",
    formulaHookId: "curiosity_gap",
    channelPlan: ["instagram_feed", "instagram_story"],
    placeholderDefaults: { location: "Whangārei" },
    canvasLayoutId: "layout_a",
    storyStylePreset: "lower_third_clear",
    packBias: "Lean into tactile fabric detail.",
    surfaces: ["social_post", "story"],
    placeholders: ["item", "location"],
    ...overrides,
  }
}

test("1) template instructions materially appear in generation guidance", () => {
  const block = buildTemplateGuidancePromptBlock(sampleTemplate())
  assert.match(block, /MUST mention the showroom try-on/)
  assert.match(block, /curiosity_gap/)
  assert.match(block, /instagram_feed/)
  assert.match(block, /layout_a/)
  assert.match(block, /lower_third_clear/)
  assert.match(block, /Whangārei/)
  assert.match(block, /version 2/)
  // Brand DNA layer stays separate — guidance still requires forbidden-word obedience.
  assert.match(block, /forbidden words/i)
})

test("2) template version attribution columns are persisted shape", () => {
  const template = sampleTemplate()
  const key = makeGenerationKeyForTemplate({
    entityId: ENTITY_A,
    template,
    eventDescription: "Linen set just landed",
    targetGoal: "Drive Sales",
    intent: "Drive Sales",
    personaName: "Local buyer",
  })
  const cols = buildAttributionColumns(template, key)
  assert.equal(cols.template_instance_id, template.instanceId)
  assert.equal(cols.template_version_id, template.versionId)
  assert.equal(cols.template_generation_key, key)
})

test("3) duplicate generation requests share the same key", () => {
  const template = sampleTemplate()
  const key1 = makeGenerationKeyForTemplate({
    entityId: ENTITY_A,
    template,
    eventDescription: "Linen set just landed",
    targetGoal: "Drive Sales",
    intent: "Drive Sales",
    personaName: "Local buyer",
  })
  const key2 = makeGenerationKeyForTemplate({
    entityId: ENTITY_A,
    template,
    eventDescription: "Linen set just landed",
    targetGoal: "Drive Sales",
    intent: "Drive Sales",
    personaName: "Local buyer",
  })
  assert.equal(key1, key2)
  assert.equal(isDuplicateGenerationError({ code: "23505" }), true)
})

test("4) cross-entity template use is rejected", () => {
  assert.throws(
    () => assertSameEntity(ENTITY_A, ENTITY_B, "template"),
    TemplateIsolationError
  )
})

test("5) normal Studio generation request remains valid without template", () => {
  const parsed = generatePackRequestSchema.safeParse({
    entityId: ENTITY_A,
    eventDescription: "Linen set just landed today",
    targetGoal: "Drive Sales",
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.templateInstanceId ?? null, null)
  }
})

test("6) failed/duplicate detection does not invent publish status", () => {
  assert.equal(isDuplicateGenerationError({ message: "timeout" }), false)
  const cols = buildAttributionColumns(sampleTemplate(), "tg:test:key")
  assert.equal("status" in cols, false)
  assert.equal("published_at" in cols, false)
})

test("7) no automatic publishing fields on attribution helper", () => {
  const cols = buildAttributionColumns(sampleTemplate(), "tg:test:key")
  assert.deepEqual(Object.keys(cols).sort(), [
    "template_generation_key",
    "template_instance_id",
    "template_version_id",
  ])
})

test("generate pack request accepts templateInstanceId", () => {
  const parsed = generatePackRequestSchema.safeParse({
    entityId: ENTITY_A,
    eventDescription: "Linen set just landed today",
    targetGoal: "Drive Sales",
    templateInstanceId: "22222222-2222-2222-2222-222222222222",
  })
  assert.equal(parsed.success, true)
})

test("fingerprint changes when intent changes", () => {
  const base = buildGenerationRequestFingerprint({
    eventDescription: "spark",
    targetGoal: "goal",
    intent: "Drive Sales",
    personaName: "A",
  })
  const other = buildGenerationRequestFingerprint({
    eventDescription: "spark",
    targetGoal: "goal",
    intent: "Build Hype",
    personaName: "A",
  })
  assert.notEqual(base, other)
})

import assert from "node:assert/strict"
import { test } from "node:test"

import { buildStudioHandoffHref } from "./template-handoff.ts"
import { WLS_DAILY_STORY_TEMPLATE_NAME } from "./wls-daily-story.ts"
import type { EntityTemplateInstance } from "./template-schema.ts"

const ENTITY = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const TEMPLATE = "22222222-2222-2222-2222-222222222222"

function mockInstance(): EntityTemplateInstance {
  return {
    id: TEMPLATE,
    entity_id: ENTITY,
    source_def_id: null,
    parent_instance_id: null,
    category: "new_arrivals",
    name: WLS_DAILY_STORY_TEMPLATE_NAME,
    status: "active",
    version: 3,
    creative_instructions: "Daily arrivals on Story.",
    payload: {
      surfaces: ["story"],
      default_channels: [],
      creative_instructions: "Daily arrivals on Story.",
      placeholders: [],
    },
    channel_plan: ["instagram_story"],
    surfaces: ["story"],
    formula_hook_id: null,
    story_style_preset: "moody_noir",
    canvas_layout_id: "story_9_16",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

test("Today WLS entry uses studio handoff without itemId or wlsDailyStory items", () => {
  const href = buildStudioHandoffHref({
    entityId: ENTITY,
    template: mockInstance(),
  })
  assert.match(href, /^\/studio\?/)
  assert.match(href, new RegExp(`eid=${ENTITY}`))
  assert.match(href, /step=2/)
  assert.match(href, new RegExp(`templateInstanceId=${TEMPLATE}`))
  assert.doesNotMatch(href, /itemId=/)
  assert.doesNotMatch(href, /wlsDailyStory=/)
  assert.doesNotMatch(href, /items=/)
})

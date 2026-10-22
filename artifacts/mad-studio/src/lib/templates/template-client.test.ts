import assert from "node:assert/strict"
import { test } from "node:test"

import { buildStudioHandoffHref } from "./template-handoff.ts"
import { getMockInstances, getMockStarters, isMockTemplateId } from "./template-mock.ts"
import { templatePayloadSchema } from "./template-schema.ts"

const ENTITY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ENTITY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

test("mock instances are scoped to the requested entity id", () => {
  const a = getMockInstances(ENTITY_A)
  const b = getMockInstances(ENTITY_B)
  assert.ok(a.every((row) => row.entity_id === ENTITY_A))
  assert.ok(b.every((row) => row.entity_id === ENTITY_B))
  assert.ok(a.every((row) => isMockTemplateId(row.id)))
  assert.ok(getMockStarters().every((row) => isMockTemplateId(row.id)))
})

test("studio handoff reuses Create wizard query params", () => {
  const [instance] = getMockInstances(ENTITY_A)
  assert.ok(instance)
  const href = buildStudioHandoffHref({
    entityId: ENTITY_A,
    template: instance,
  })
  assert.match(href, /^\/studio\?/)
  assert.match(href, /eid=aaaaaaaa/)
  assert.match(href, /step=2/)
  assert.match(href, /templateInstanceId=/)
  assert.match(href, /prompt=/)
})

test("mock starter payloads satisfy template contract", () => {
  for (const starter of getMockStarters()) {
    assert.doesNotThrow(() => templatePayloadSchema.parse(starter.payload))
    assert.ok(starter.payload.surfaces.length >= 1)
  }
})

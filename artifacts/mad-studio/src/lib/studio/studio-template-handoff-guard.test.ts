import assert from "node:assert/strict"
import { test } from "node:test"

import {
  shouldSkipStudioTemplateHandoff,
  studioTemplateHandoffResumeKey,
} from "./studio-template-handoff-guard.ts"

const ENTITY = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const TEMPLATE = "22222222-2222-2222-2222-222222222222"

test("resume key includes entity, instance and version", () => {
  const key = studioTemplateHandoffResumeKey({
    entityId: ENTITY,
    templateInstanceId: TEMPLATE,
    templateVersion: "3",
  })
  assert.equal(key, `${ENTITY}:${TEMPLATE}:3`)
})

test("skip only when tray has media and keys match", () => {
  const key = studioTemplateHandoffResumeKey({
    entityId: ENTITY,
    templateInstanceId: TEMPLATE,
    templateVersion: "2",
  })
  assert.equal(
    shouldSkipStudioTemplateHandoff({
      mediaAssetCount: 2,
      resumeKey: key,
      lastSuccessfulHandoffKey: key,
    }),
    true
  )
  assert.equal(
    shouldSkipStudioTemplateHandoff({
      mediaAssetCount: 0,
      resumeKey: key,
      lastSuccessfulHandoffKey: key,
    }),
    false
  )
})

test("different entity or version must not skip", () => {
  const keyV2 = studioTemplateHandoffResumeKey({
    entityId: ENTITY,
    templateInstanceId: TEMPLATE,
    templateVersion: "2",
  })
  const keyV3 = studioTemplateHandoffResumeKey({
    entityId: ENTITY,
    templateInstanceId: TEMPLATE,
    templateVersion: "3",
  })
  const otherEntity = studioTemplateHandoffResumeKey({
    entityId: OTHER,
    templateInstanceId: TEMPLATE,
    templateVersion: "2",
  })
  assert.equal(
    shouldSkipStudioTemplateHandoff({
      mediaAssetCount: 1,
      resumeKey: keyV3,
      lastSuccessfulHandoffKey: keyV2,
    }),
    false
  )
  assert.equal(
    shouldSkipStudioTemplateHandoff({
      mediaAssetCount: 1,
      resumeKey: otherEntity,
      lastSuccessfulHandoffKey: keyV2,
    }),
    false
  )
})

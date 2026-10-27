import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isSimulatorPlatform,
  STUDIO_PREVIEW_CHANNELS,
} from "./studio-preview-channels.ts"

test("studio preview lists six channels with facebook story unavailable", () => {
  assert.equal(STUDIO_PREVIEW_CHANNELS.length, 6)
  const fbStory = STUDIO_PREVIEW_CHANNELS.find((row) => row.id === "facebook_story")
  assert.ok(fbStory)
  assert.equal(fbStory.previewAvailable, false)
  assert.equal(fbStory.publishSupported, false)
})

test("isSimulatorPlatform excludes facebook_story placeholder", () => {
  assert.equal(isSimulatorPlatform("ig_feed"), true)
  assert.equal(isSimulatorPlatform("facebook_story"), false)
})

import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveTemplateStudioCaption } from "./template-studio-caption"

test("default studio caption wins over creative instructions", () => {
  assert.equal(
    resolveTemplateStudioCaption({
      defaultStudioCaption: "New in — shop the drop.",
      creativeInstructions: "Long AI brief.",
      templateName: "New arrivals",
    }),
    "New in — shop the drop."
  )
})

test("falls back to creative instructions then name", () => {
  assert.equal(
    resolveTemplateStudioCaption({
      defaultStudioCaption: "",
      creativeInstructions: "Spotlight one hero piece.",
      templateName: "New arrivals",
    }),
    "Spotlight one hero piece."
  )
})

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

test("does not leak operator creative_instructions into public caption", () => {
  assert.equal(
    resolveTemplateStudioCaption({
      defaultStudioCaption: "",
      creativeInstructions:
        "Daily New Arrival Instagram Story (1080×1920). Never invent stock.",
      templateName: "WLS — Daily New Arrival Story",
    }),
    ""
  )
})

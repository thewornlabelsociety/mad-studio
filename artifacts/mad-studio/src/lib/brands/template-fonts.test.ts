import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_TEMPLATE_FONTS,
  resolveTemplateFonts,
  TEMPLATE_FONT_CHOICES,
  templateFontVars,
} from "./template-fonts.ts"

test("missing or unknown fonts fall back to the brand defaults", () => {
  assert.deepEqual(resolveTemplateFonts(undefined), DEFAULT_TEMPLATE_FONTS)
  assert.deepEqual(resolveTemplateFonts({ serif: "comic-sans", script: 7 }), DEFAULT_TEMPLATE_FONTS)
  assert.deepEqual(resolveTemplateFonts({ script: "dancing" }), { ...DEFAULT_TEMPLATE_FONTS, script: "dancing" })
})

test("vars carry the stack, a readable weight and a size scale for each role", () => {
  const vars = templateFontVars({ display: "jost", serif: "playfair", script: "dancing" })
  assert.match(vars["--kit-display"], /^'Jost'/)
  assert.match(vars["--kit-serif"], /^'Playfair Display'/)
  assert.equal(vars["--kit-serif-weight"], "700")
  assert.equal(vars["--kit-script-scale"], "0.72")
})

test("no serif or display choice uses a hairline weight", () => {
  for (const choice of [...TEMPLATE_FONT_CHOICES.display, ...TEMPLATE_FONT_CHOICES.serif]) {
    // DM Serif Display is drawn heavy at 400; the rest need 500+.
    assert.ok(choice.weight >= 500 || choice.id === "dm_serif", `${choice.label} is too thin`)
  }
})

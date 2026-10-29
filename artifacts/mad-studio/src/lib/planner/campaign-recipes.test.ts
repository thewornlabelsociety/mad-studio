import assert from "node:assert/strict"
import { test } from "node:test"

import { buildCampaign, CAMPAIGN_RECIPES, campaignStepsOn, parseYmd, recipeMoment } from "./campaign-recipes.ts"

const recipe = (id: string) => {
  const found = CAMPAIGN_RECIPES.find((row) => row.id === id)
  assert.ok(found, id)
  return found
}

test("Black Friday dates come from the NZ calendar", () => {
  const today = new Date(2026, 9, 30)
  const moment = recipeMoment(recipe("black_friday"), today)
  assert.ok(moment)
  const plan = buildCampaign({ recipe: recipe("black_friday"), start: moment.start, end: moment.end, now: today })
  assert.equal(plan.start, "2026-11-27")
  assert.equal(plan.end, "2026-11-30")
  assert.deepEqual(
    plan.steps.map((step) => step.date),
    ["2026-11-20", "2026-11-24", "2026-11-26", "2026-11-27", "2026-11-30"]
  )
  const teaser = plan.steps[0].card
  assert.ok(teaser)
  assert.equal(teaser.details[0], "27 Nov to 30 Nov")
})

test("a pick-a-date recipe runs from the chosen day", () => {
  const plan = buildCampaign({ recipe: recipe("sale_weekend"), start: parseYmd("2026-12-04") })
  assert.equal(plan.end, "2026-12-06")
  assert.equal(plan.steps[0].date, "2026-12-01")
  assert.equal(plan.steps.at(-1)?.date, "2026-12-06")
  assert.equal(campaignStepsOn([plan], parseYmd("2026-12-04")).length, 1)
})

test("change of season follows the next season", () => {
  const moment = recipeMoment(recipe("change_of_season"), new Date(2026, 9, 30))
  assert.equal(moment?.id, "summer")
})

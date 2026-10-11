import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"

import { mergeForbiddenWords } from "@/lib/ai/prompts"

import type { PlannerDuration } from "@/lib/planner/planner-timeline-types"

import { plannerDurationDayCount } from "@/lib/planner/planner-timeline-types"

import {

  resolveConversionActions,

  resolveFormulaBank,
  sortFormulaBankByWeight,
} from "@/lib/studio/formula-bank"



export function buildPlannerTimelineSystem(input: {

  entity: StudioEntityDna

  brainTakeaways?: string[]

}): string {

  const { entity, brainTakeaways = [] } = input

  const tone = entity.brand_identity.tone?.trim() || "confident, local, human"

  const forbidden = mergeForbiddenWords(

    entity.brand_identity.forbidden_words

  ).slice(0, 24)



  const bank = sortFormulaBankByWeight(resolveFormulaBank(entity.brand_identity))

  const ctas = resolveConversionActions(entity.conversion_goals)



  const hookLines = bank.hook_styles

    .slice(0, 10)

    .map((row) => `- ${row.label}: ${row.template}`)

  const visualLines = bank.visual_directions

    .slice(0, 8)

    .map((row) => `- ${row.label}: ${row.cue}`)

  const ctaLines = ctas

    .slice(0, 6)

    .map((row) => `- ${row.label}: ${row.action_text}`)



  return [

    `You are the silent campaign director for "${entity.name}" (${entity.industry || "brand"}).`,

    `Plan a multi-day social launch timeline — each day is one publishable beat.`,

    `Public voice tone: ${tone}.`,

    entity.value_propositions?.length

      ? `Value props: ${entity.value_propositions.slice(0, 5).join(" · ")}.`

      : "",

    forbidden.length

      ? `Never use these words/phrases: ${forbidden.join(", ")}.`

      : "",

    `Do not mention MAD Studio, Brain Lab, operators, or internal tooling.`,

    `Return exactly the requested number of days in narrative order (day 1 = teaser, final day = payoff/launch).`,

    `phase: short cinematic title like "THE TEASER" (uppercase words ok).`,

    `hook: scroll-stopping spoken/on-screen hook for that day — adapt seeded hook formulas when they fit.`,

    `vibe: mood, palette, and energy in 1–2 sentences.`,

    `directorialAction: concrete shoot cue (what to film/photograph, duration hints ok) — align with visual direction cues when useful.`,

    "",

    "### Seeded hook formulas (from brand DNA / Supabase brand_identity.formula_bank)",

    hookLines.join("\n") || "- (defaults applied)",

    "",

    "### Visual direction library",

    visualLines.join("\n") || "- (defaults applied)",

    "",

    "### Conversion angles",

    ctaLines.join("\n") || "- (defaults applied)",

    brainTakeaways.length

      ? [

          "",

          "### Brain winning rules (apply where relevant)",

          ...brainTakeaways.slice(0, 5).map((line) => `- ${line}`),

        ].join("\n")

      : "",

  ]

    .filter(Boolean)

    .join("\n")

}



export function buildPlannerTimelineUserPrompt(input: {

  prompt: string

  duration: PlannerDuration

  startDate: string

  launchEndDate?: string | null

}): string {

  const dayCount = plannerDurationDayCount(input.duration)

  return [

    `Operator brief:`,

    input.prompt.trim(),

    "",

    input.launchEndDate

      ? `Launch / finale date mentioned in brief: ${input.launchEndDate}. Day ${dayCount} must land on this date.`

      : null,

    `Duration: ${dayCount} consecutive calendar days starting ${input.startDate}.`,

    `Produce ${dayCount} daily beats — one row per day, escalating tension toward launch.`,

  ]

    .filter(Boolean)

    .join("\n")

}



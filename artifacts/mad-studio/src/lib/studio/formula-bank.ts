import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import type { BrandIdentity } from "@/lib/entities/dna-schema"

export type FormulaHookStyle = {
  id: string
  label: string
  template: string
}

export type FormulaVisualDirection = {
  id: string
  label: string
  cue: string
}

export type FormulaConversionAction = {
  id: string
  label: string
  action_text: string
}

export type FormulaBank = {
  hook_styles: FormulaHookStyle[]
  visual_directions: FormulaVisualDirection[]
}

export type FormulaRenderSlots = {
  item: string
  priceA: string
  priceB: string
  location: string
  painfulAction: string
  cityArea: string
  interest: string
}

export const DEFAULT_FORMULA_BANK: FormulaBank = {
  hook_styles: [
    {
      id: "price_contrast",
      label: "Price Shock / Value Contrast",
      template:
        "Why pay retail at [Price A] when you can get [Item] for [Price B]?",
    },
    {
      id: "curiosity_gap",
      label: "Curiosity / Secret Insider",
      template:
        "Nobody in [Location] realizes you can actually get [Item] right now...",
    },
    {
      id: "negative_warning",
      label: "Negative Constraint (Stop Doing X)",
      template: "Stop doing [Painful Action] in 2026. Here is the 10-second fix:",
    },
    {
      id: "hyper_local",
      label: "Hyper-Local Callout",
      template:
        "If you live in [City/Area] and love [Interest], do not scroll past this.",
    },
    {
      id: "behind_curtain",
      label: "Behind the Pass / Workshop",
      template: "Watch how we prep 40 portions of [Item] before 5:00 PM.",
    },
  ],
  visual_directions: [
    {
      id: "tactile_close",
      label: "Extreme Close-Up (Texture / Sizzle / Tag)",
      cue: "Macro camera on fabric weave or sizzling butter within 0-2s.",
    },
    {
      id: "handheld_rack",
      label: "Handheld POV Walkthrough",
      cue: "Natural first-person perspective entering the space or pulling item.",
    },
    {
      id: "quick_cut_montage",
      label: "3-Shot Quick Cut (Wide -> Detail -> Action)",
      cue: "Beat 1: Wide room. Beat 2: Hero item. Beat 3: Human interaction.",
    },
  ],
}

export const DEFAULT_CONVERSION_ACTIONS: FormulaConversionAction[] = [
  {
    id: "tap_sticker",
    label: "Tap Link Sticker in Story",
    action_text: "Tap the link sticker above to inspect piece / view menu.",
  },
  {
    id: "dm_hold",
    label: 'DM "HOLD" to Reserve',
    action_text: 'DM us "HOLD" to claim one of the few available slots.',
  },
  {
    id: "save_weekend",
    label: "Save for Weekend Plans",
    action_text: "Tap save so you don't forget where to go this Friday.",
  },
  {
    id: "in_store_table",
    label: "Dine In / Try On In Showroom",
    action_text: "Pop in today before 5:00 PM to catch it in person.",
  },
]

const SLOT_MAP: Record<string, keyof FormulaRenderSlots> = {
  Item: "item",
  "Price A": "priceA",
  "Price B": "priceB",
  Location: "location",
  "Painful Action": "painfulAction",
  "City/Area": "cityArea",
  Interest: "interest",
}

export function resolveFormulaBank(
  identity: BrandIdentity & { formula_bank?: FormulaBank | null }
): FormulaBank {
  const bank = identity.formula_bank
  if (
    bank &&
    Array.isArray(bank.hook_styles) &&
    bank.hook_styles.length > 0 &&
    Array.isArray(bank.visual_directions) &&
    bank.visual_directions.length > 0
  ) {
    return bank
  }
  return DEFAULT_FORMULA_BANK
}

export function resolveConversionActions(
  goals: unknown
): FormulaConversionAction[] {
  if (!Array.isArray(goals) || goals.length === 0) {
    return DEFAULT_CONVERSION_ACTIONS
  }
  const parsed: FormulaConversionAction[] = []
  for (const entry of goals) {
    if (typeof entry === "string" && entry.trim()) {
      parsed.push({
        id: entry.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
        label: entry,
        action_text: entry,
      })
      continue
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const row = entry as Record<string, unknown>
      const actionText =
        typeof row.action_text === "string"
          ? row.action_text
          : typeof row.label === "string"
            ? row.label
            : ""
      const label =
        typeof row.label === "string" ? row.label : actionText || "CTA"
      const id =
        typeof row.id === "string"
          ? row.id
          : label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)
      if (actionText.trim()) {
        parsed.push({ id, label, action_text: actionText.trim() })
      }
    }
  }
  return parsed.length > 0 ? parsed : DEFAULT_CONVERSION_ACTIONS
}

export function fillFormulaTemplate(
  template: string,
  slots: FormulaRenderSlots
): string {
  return template.replace(/\[([^\]]+)\]/g, (_match, key: string) => {
    const slotKey = SLOT_MAP[key.trim()]
    if (!slotKey) return `[${key}]`
    const value = slots[slotKey]?.trim()
    return value || `[${key}]`
  })
}

export function defaultSlotsFromSpark(spark: string): FormulaRenderSlots {
  const trimmed = spark.trim()
  return {
    item: trimmed.slice(0, 80) || "this drop",
    priceA: "$99",
    priceB: "$49",
    location: "Whangārei",
    painfulAction: "paying full retail",
    cityArea: "Whangārei",
    interest: "great food",
  }
}

export function buildCampaignPackFromFormula(input: {
  hook: FormulaHookStyle
  visual: FormulaVisualDirection
  cta: FormulaConversionAction
  slots: FormulaRenderSlots
  spark: string
  campaignTitle?: string
}): CampaignPack {
  const spokenHook = fillFormulaTemplate(input.hook.template, input.slots)
  const onScreen = spokenHook
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ")
    .toUpperCase()

  const captionBody = [
    spokenHook,
    "",
    input.visual.cue,
    "",
    input.cta.action_text,
    input.spark.trim() ? `\n${input.spark.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const title =
    input.campaignTitle?.trim() ||
    input.slots.item.trim().slice(0, 60) ||
    "Formula campaign"

  return {
    campaign_title: title,
    creative_hooks: {
      vibe_styling: spokenHook,
      investment_condition: input.visual.cue,
      local_instore: input.cta.action_text,
    },
    algorithmic_signals: {
      spoken_hook: spokenHook.slice(0, 220),
      on_screen_text: onScreen || "SEE THIS NOW",
      search_keywords: [
        input.slots.item,
        input.slots.cityArea,
        input.slots.interest,
      ]
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 5),
    },
    short_video_script: {
      hook_visual: input.visual.cue,
      spoken_lines: [spokenHook, input.cta.action_text],
      b_roll_cues: [input.visual.cue],
      cta_spoken: input.cta.action_text,
    },
    carousel: {
      title,
      slides: [
        {
          slide_number: 1,
          headline: onScreen || "Hook",
          body_text: spokenHook,
        },
        {
          slide_number: 2,
          headline: "Visual direction",
          body_text: input.visual.cue,
        },
        {
          slide_number: 3,
          headline: "Action",
          body_text: input.cta.action_text,
        },
      ],
    },
    seo_caption: {
      caption_body: captionBody.slice(0, 2200),
      search_optimized_tags: [
        input.slots.item,
        input.slots.cityArea,
        "local",
        "menu",
        "drop",
      ].slice(0, 8),
    },
    email_drop: {
      subject_line: title.slice(0, 120),
      preview_text: spokenHook.slice(0, 140),
      body_markdown: captionBody,
    },
    b2b_dm: {
      platform: "instagram",
      message_text: `${spokenHook}\n\n${input.cta.action_text}`,
    },
  }
}

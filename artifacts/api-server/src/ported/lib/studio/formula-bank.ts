import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import type { BrandIdentity } from "@/lib/entities/dna-schema"

export type FormulaHookStyle = {
  id: string
  label: string
  template: string
  weight?: number
  success_count?: number
  failure_count?: number
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
  brand: string
  size: string
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

/**
 * Worn Label Society — designer consignment. Hooks lean on brand, size and
 * value; filming notes are fashion-only (labels, fabric, fit).
 */
export const WORN_LABEL_FORMULA_BANK: FormulaBank = {
  hook_styles: [
    {
      id: "wls_just_landed",
      label: "Just Landed / New In",
      template: "Just landed: [Brand] [Item], size [Size]. One of one.",
    },
    {
      id: "wls_price_contrast",
      label: "Designer for Less",
      template: "[Brand] retails around [Price A]. This [Item] is [Price B] — size [Size].",
    },
    {
      id: "wls_one_of_one",
      label: "One of One / Last Chance",
      template: "Only one [Brand] [Item] in size [Size]. When it's gone, it's gone.",
    },
    {
      id: "wls_size_edit",
      label: "Size Edit",
      template: "Size [Size]? This week's finds start with this [Brand] [Item].",
    },
    {
      id: "wls_style_it",
      label: "Style It Three Ways",
      template: "One [Brand] [Item], three ways to wear it — which is yours?",
    },
    {
      id: "wls_second_life",
      label: "Second Life / Pre-loved",
      template: "Give this [Brand] [Item] a second life — pre-loved, never tired.",
    },
    {
      id: "wls_try_on",
      label: "Showroom Try-On",
      template: "Try this [Brand] [Item] on in our [Location] showroom — size [Size].",
    },
    {
      id: "wls_price_drop",
      label: "Price Drop",
      template: "Price drop: [Brand] [Item], now [Price B]. Size [Size].",
    },
  ],
  visual_directions: [
    {
      id: "wls_label_fabric",
      label: "Label & Fabric Close-Up",
      cue: "Open on the designer label, then a slow macro across the fabric within 0–2s.",
    },
    {
      id: "wls_hanger_reveal",
      label: "Hanger Reveal",
      cue: "Slow pan down the piece on its hanger, ending on the price tag.",
    },
    {
      id: "wls_mirror_try_on",
      label: "Mirror Try-On",
      cue: "Wide mirror shot of the fit, then cut to one detail — collar, hem or hardware.",
    },
    {
      id: "wls_rack_walk",
      label: "Showroom Rack Walk",
      cue: "Handheld walk along the rail, pulling the piece out to camera.",
    },
    {
      id: "wls_flat_lay",
      label: "Styled Flat Lay",
      cue: "Top-down flat lay with shoes and a bag to show how to wear it.",
    },
  ],
}

/** Starting bank per brand profile (FÜDI and others use the default bank). */
const PROFILE_FORMULA_BANKS: Partial<Record<string, FormulaBank>> = {
  worn_label: WORN_LABEL_FORMULA_BANK,
}

const DEFAULT_HOOK_IDS = new Set(
  DEFAULT_FORMULA_BANK.hook_styles.map((hook) => hook.id)
)

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
  Brand: "brand",
  Size: "size",
  "Price A": "priceA",
  "Price B": "priceB",
  Location: "location",
  "Painful Action": "painfulAction",
  "City/Area": "cityArea",
  Interest: "interest",
}

export function sortFormulaBankByWeight(bank: FormulaBank): FormulaBank {
  const hook_styles = [...bank.hook_styles].sort(
    (a, b) => (b.weight ?? 1) - (a.weight ?? 1)
  )
  return { ...bank, hook_styles }
}

/**
 * The brand's formula bank. With a brand profile id, a bank that is only a
 * saved copy of the generic default (seeded at brand setup) is swapped for
 * that brand's own starting bank; a customised bank is always kept.
 */
export function resolveFormulaBank(
  identity: BrandIdentity & { formula_bank?: FormulaBank | null },
  profileId?: string | null
): FormulaBank {
  const profileBank = profileId ? PROFILE_FORMULA_BANKS[profileId] : undefined
  const bank = identity.formula_bank
  if (
    bank &&
    Array.isArray(bank.hook_styles) &&
    bank.hook_styles.length > 0 &&
    Array.isArray(bank.visual_directions) &&
    bank.visual_directions.length > 0
  ) {
    const isSeededDefault = bank.hook_styles.every((hook) =>
      DEFAULT_HOOK_IDS.has(hook.id)
    )
    if (profileBank && isSeededDefault) return profileBank
    return bank
  }
  return profileBank ?? DEFAULT_FORMULA_BANK
}

/** Slot keys a template uses, in order of first appearance. */
export function slotsInTemplate(template: string): Array<keyof FormulaRenderSlots> {
  const keys: Array<keyof FormulaRenderSlots> = []
  for (const match of template.matchAll(/\[([^\]]+)\]/g)) {
    const key = SLOT_MAP[match[1].trim()]
    if (key && !keys.includes(key)) keys.push(key)
  }
  return keys
}

/**
 * Everyday Worn Label calls to action — selling, engagement and showroom —
 * offered ahead of the brand's own Brand Brain conversion goals.
 */
export const WORN_LABEL_CONVERSION_ACTIONS: FormulaConversionAction[] = [
  {
    id: "wls_shop_link",
    label: "Shop · Tap the link",
    action_text: "Tap the link to shop it before it's gone.",
  },
  {
    id: "wls_dm_hold",
    label: "Shop · DM to hold it",
    action_text: 'DM "HOLD" and we\'ll keep it aside for 24 hours.',
  },
  {
    id: "wls_size_edit",
    label: "Shop · More in your size",
    action_text: "Shop more pieces in your size through the link.",
  },
  {
    id: "wls_try_on",
    label: "Showroom · Try it on",
    action_text: "Try it on in our Whangārei showroom this week.",
  },
  {
    id: "wls_comment_size",
    label: "Engage · Comment your size",
    action_text: "Comment your size and we'll tag you when something fits.",
  },
  {
    id: "wls_tag_friend",
    label: "Engage · Tag a friend",
    action_text: "Tag the friend this would look incredible on.",
  },
  {
    id: "wls_save",
    label: "Engage · Save for later",
    action_text: "Save this so you can find it again.",
  },
  {
    id: "wls_vip",
    label: "Engage · Join the VIP list",
    action_text: "Join our VIP list for first look at new arrivals.",
  },
]

const PROFILE_CONVERSION_ACTIONS: Partial<
  Record<string, FormulaConversionAction[]>
> = {
  worn_label: WORN_LABEL_CONVERSION_ACTIONS,
}

/**
 * CTA choices. With a brand profile id, that brand's everyday CTAs come first,
 * followed by its own Brand Brain conversion goals (duplicates dropped).
 */
export function resolveConversionActions(
  goals: unknown,
  profileId?: string | null
): FormulaConversionAction[] {
  const own = parseConversionGoals(goals)
  const library = profileId ? PROFILE_CONVERSION_ACTIONS[profileId] : undefined
  if (!library) return own ?? DEFAULT_CONVERSION_ACTIONS
  const seen = new Set(library.map((row) => row.action_text.toLowerCase()))
  return [
    ...library,
    ...(own ?? []).filter((row) => !seen.has(row.action_text.toLowerCase())),
  ]
}

function parseConversionGoals(goals: unknown): FormulaConversionAction[] | null {
  if (!Array.isArray(goals) || goals.length === 0) {
    return null
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
  return parsed.length > 0 ? parsed : null
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

/**
 * Starting slot values. Prices, item and interest start empty on purpose: an
 * unfilled slot stays as "[Price A]" so the review screen blocks it, instead
 * of a made-up price going out on a real post.
 */
export function defaultSlotsFromSpark(spark: string): FormulaRenderSlots {
  const trimmed = spark.trim()
  return {
    item: trimmed.slice(0, 80),
    brand: "",
    size: "",
    priceA: "",
    priceB: "",
    location: "Whangārei",
    painfulAction: "paying full retail",
    cityArea: "Whangārei",
    interest: "",
  }
}

/** Unfilled "[Slot]" placeholders left in post copy. */
export function unfilledFormulaSlots(text: string): string[] {
  return [...new Set(text.match(/\[[A-Z][A-Za-z /]{0,30}\]/g) ?? [])]
}

/**
 * Short on-screen line from a hook: its first whole phrase (up to a full
 * stop, dash or colon), trimmed at a word boundary — never mid-phrase.
 */
const DANGLING_WORDS =
  /\s+(a|an|the|for|to|in|of|at|on|and|or|with|when|you|can|get|this|is|it|your|our)$/i

export function onScreenLine(hook: string, maxLength = 64): string {
  const phrase =
    hook
      .split(/(?<=[.!?])\s+|\s+[—–-]\s+|:\s+/)[0]
      ?.replace(/[.!?:,]+$/, "")
      .trim() ?? ""
  let line = phrase
  if (line.length > maxLength) {
    line = line.slice(0, maxLength)
    const lastSpace = line.lastIndexOf(" ")
    if (lastSpace > maxLength / 2) line = line.slice(0, lastSpace)
    while (DANGLING_WORDS.test(line)) line = line.replace(DANGLING_WORDS, "")
  }
  // Keep prices and percentages ("$49", "30%") readable on screen.
  return line.replace(/[^\w\s$%'&]/g, " ").replace(/\s+/g, " ").trim().toUpperCase()
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
  const onScreen = onScreenLine(spokenHook)

  // The visual cue is a filming note for the video script, not post copy.
  const captionBody = [
    spokenHook,
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
      // One word per tag (hashtags can't have spaces); brand-neutral extras.
      search_optimized_tags: [
        ...new Set(
          [input.slots.brand, input.slots.item, input.slots.cityArea, "local", "newin"]
            .map((tag) =>
              tag
                .toLowerCase()
                .replace(/^(this|the|our|a|an)\s+/, "")
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .replace(/[^a-z0-9]/g, "")
            )
            .filter((tag) => tag.length >= 2)
        ),
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

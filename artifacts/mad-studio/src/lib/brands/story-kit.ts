import type { StoryBackground, VisualPresets } from "@/lib/entities/dna-schema"

export type { StoryBackground }

/** Traits read from a listing (words) and its cutout (colour), matched to backgrounds. */
export const STORY_ITEM_TRAITS = [
  { id: "cream", label: "Cream & off-white" },
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
  { id: "dark_denim", label: "Dark denim" },
  { id: "washed_denim", label: "Washed denim" },
  { id: "tan_leather", label: "Tan leather" },
  { id: "earthy", label: "Earthy tones" },
  { id: "bright", label: "Bright colour" },
  { id: "sneakers", label: "Sneakers" },
  { id: "accessories", label: "Accessories" },
  { id: "print", label: "Prints & patterns" },
] as const

export type StoryItemTrait = (typeof STORY_ITEM_TRAITS)[number]["id"]

const TRAIT_IDS = new Set<string>(STORY_ITEM_TRAITS.map((trait) => trait.id))

export function storyTraitLabel(id: string): string {
  return STORY_ITEM_TRAITS.find((trait) => trait.id === id)?.label ?? id
}

/** Worn Label Society's five Story backgrounds. */
export const WLS_STORY_KIT: StoryBackground[] = [
  {
    id: "deep_green",
    name: "Deep Green",
    color: "#07594F",
    text_color: "#F1EADB",
    accent_color: "#EAD8A0",
    suits: ["cream", "tan_leather", "washed_denim"],
  },
  {
    id: "charcoal",
    name: "Charcoal",
    color: "#252525",
    text_color: "#F1EADB",
    accent_color: "#CBA977",
    suits: ["sneakers", "bright", "accessories"],
  },
  {
    id: "vintage_beige",
    name: "Vintage Beige",
    color: "#D7C4A6",
    text_color: "#252525",
    accent_color: "#07594F",
    suits: ["dark_denim", "black", "print"],
  },
  {
    id: "faded_olive",
    name: "Faded Olive",
    color: "#858575",
    text_color: "#F1EADB",
    accent_color: "#EAD8A0",
    suits: ["earthy", "cream", "washed_denim"],
  },
  {
    id: "worn_taupe",
    name: "Worn Taupe",
    color: "#A68D78",
    text_color: "#252525",
    accent_color: "#F1EADB",
    suits: ["white", "black", "print"],
  },
]

export const STORY_KIT_LIGHT_TEXT = "#F1EADB"
export const STORY_KIT_DARK_TEXT = "#252525"

const HEX6 = /^#[0-9a-f]{6}$/i

function toHex6(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? ""
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const [, r, g, b] = raw
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return HEX6.test(raw) ? raw.toUpperCase() : null
}

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Cream or charcoal, whichever reads better on `background`. */
export function readableTextOn(background: string): string {
  const bg = toHex6(background) ?? STORY_KIT_DARK_TEXT
  return contrastRatio(bg, STORY_KIT_LIGHT_TEXT) >=
    contrastRatio(bg, STORY_KIT_DARK_TEXT)
    ? STORY_KIT_LIGHT_TEXT
    : STORY_KIT_DARK_TEXT
}

function cleanBackground(row: StoryBackground, index: number): StoryBackground | null {
  const color = toHex6(row.color)
  if (!color) return null
  const text = toHex6(row.text_color) ?? readableTextOn(color)
  return {
    id: row.id?.trim() || `bg_${index + 1}`,
    name: row.name?.trim() || `Background ${index + 1}`,
    color,
    text_color: text,
    accent_color: toHex6(row.accent_color) ?? text,
    suits: (row.suits ?? []).filter((id) => TRAIT_IDS.has(id)),
  }
}

/**
 * The brand's Story backgrounds: the saved kit when there is one, Worn Label's
 * five for Worn Label, otherwise one ground built from the brand colours.
 */
export function resolveStoryKit(input: {
  presets: Pick<VisualPresets, "story_kit" | "canvas_color" | "text_color" | "accent_color">
  isWornLabel: boolean
}): StoryBackground[] {
  const saved = (input.presets.story_kit ?? [])
    .map(cleanBackground)
    .filter((row): row is StoryBackground => row != null)
  if (saved.length > 0) return saved
  if (input.isWornLabel) return WLS_STORY_KIT
  const color = toHex6(input.presets.canvas_color) ?? STORY_KIT_DARK_TEXT
  const text = toHex6(input.presets.text_color) ?? readableTextOn(color)
  return [
    {
      id: "brand",
      name: "Brand",
      color,
      text_color: text,
      accent_color: toHex6(input.presets.accent_color) ?? text,
      suits: [],
    },
  ]
}

export type Rgb = { r: number; g: number; b: number }

const WORD_TRAITS: Array<[RegExp, StoryItemTrait]> = [
  [/\b(sneakers?|trainers?|runners?|air ?max|air ?force|jordans?|converse|vans|new balance|asics)\b/i, "sneakers"],
  [/\b(bag|tote|clutch|handbag|backpack|purse|wallet|belt|hat|cap|beanie|scarf|sunglasses|necklace|earrings?|bracelet|jewell?ery|watch)\b/i, "accessories"],
  [/\b(print(ed)?|pattern(ed)?|floral|stripe[sd]?|check(ed)?|plaid|tartan|leopard|animal|paisley|polka|spot(ted)?|graphic)\b/i, "print"],
  [/\b(cream|ivory|ecru|oat(meal)?|off[- ]?white|natural|bone|vanilla)\b/i, "cream"],
  [/\bwhite\b/i, "white"],
  [/\bblack\b/i, "black"],
  [/\b(khaki|olive|rust|brown|camel|sage|mustard|terracotta|chocolate|mocha|taupe|stone|sand)\b/i, "earthy"],
  [/\b(red|pink|orange|yellow|purple|lilac|neon|cobalt|fuchsia|hot pink|lime|turquoise)\b/i, "bright"],
]

const COLOUR_TRAITS = new Set<StoryItemTrait>([
  "cream",
  "white",
  "black",
  "earthy",
  "bright",
])

function hsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
      : max === gn
        ? ((bn - rn) / d + 2) * 60
        : ((rn - gn) / d + 4) * 60
  return { h, s, l }
}

function colourTraits(rgb: Rgb): StoryItemTrait[] {
  const { h, s, l } = hsl(rgb)
  if (l < 0.2) return ["black"]
  if (l > 0.82 && s < 0.25) return h >= 25 && h <= 60 && s > 0.08 ? ["cream"] : ["white"]
  if (l > 0.68 && s < 0.45 && h >= 25 && h <= 60) return ["cream"]
  if (s > 0.5 && l > 0.3 && l < 0.75) return ["bright"]
  if (h >= 15 && h <= 95 && s < 0.5) return ["earthy"]
  return []
}

/**
 * Traits for one listing: garment words from the title and description, colour
 * words when the listing names one, otherwise the cutout's average colour.
 */
export function detectItemTraits(input: {
  text: string
  colour?: Rgb | null
}): StoryItemTrait[] {
  const text = input.text
  const traits = new Set<StoryItemTrait>()
  for (const [pattern, trait] of WORD_TRAITS) {
    if (pattern.test(text)) traits.add(trait)
  }

  const colour = input.colour ? hsl(input.colour) : null
  if (/\b(denim|jeans?|chambray)\b/i.test(text)) {
    const washedWords = /\b(light|washed|faded|acid|stone ?wash|bleach(ed)?|vintage wash|pale)\b/i
    const darkWords = /\b(raw|indigo|dark|rinse|black)\b/i
    traits.add(
      washedWords.test(text)
        ? "washed_denim"
        : darkWords.test(text)
          ? "dark_denim"
          : colour && colour.l >= 0.45
            ? "washed_denim"
            : "dark_denim"
    )
  }
  if (/\bleather\b/i.test(text) && /\b(tan|brown|cognac|camel|caramel|chestnut)\b/i.test(text)) {
    traits.add("tan_leather")
  }

  const namedColour = [...traits].some((trait) => COLOUR_TRAITS.has(trait))
  if (!namedColour && input.colour) {
    for (const trait of colourTraits(input.colour)) traits.add(trait)
  }
  return [...traits]
}

export type StoryBackgroundPick = {
  background: StoryBackground
  /** Traits that decided it; empty when the kit simply rotated. */
  matched: StoryItemTrait[]
}

/**
 * Best background for an item's traits. When the best match is the background
 * the previous Story used, the next-best match wins so a run of Stories varies.
 */
export function pickStoryBackground(input: {
  kit: StoryBackground[]
  traits: StoryItemTrait[]
  previousId?: string | null
}): StoryBackgroundPick {
  const { kit, traits, previousId } = input
  const wanted = new Set<string>(traits)
  const scored = kit
    .map((background, index) => {
      const matched = (background.suits ?? []).filter((id) =>
        wanted.has(id)
      ) as StoryItemTrait[]
      return { background, index, matched }
    })
    .filter((row) => row.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.index - b.index)

  const fresh = scored.find((row) => row.background.id !== previousId)
  if (fresh) return { background: fresh.background, matched: fresh.matched }
  if (scored[0] && kit.length === 1) {
    return { background: scored[0].background, matched: scored[0].matched }
  }

  const previousIndex = kit.findIndex((row) => row.id === previousId)
  const next = kit[(previousIndex + 1) % kit.length] ?? kit[0]
  return { background: next, matched: [] }
}

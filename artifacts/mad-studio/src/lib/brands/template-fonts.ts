/**
 * The brand kit's three template fonts: display (letter-spaced capitals),
 * serif (big headlines) and script (short accent lines). Templates read them
 * as CSS variables, so changing them in the brand kit restyles every card.
 *
 * Each choice carries its own weight and size adjustment, so swapping a font
 * keeps text readable and inside the card. No imports: shared and testable.
 */

export type TemplateFontRole = "display" | "serif" | "script"

export type TemplateFontChoice = {
  id: string
  label: string
  /** CSS font-family stack. */
  stack: string
  /** Weight used for this role (thin weights are what made text hard to read). */
  weight: number
  /**
   * Size relative to the default font for the role: wide or tall fonts come
   * down, small-bodied scripts go up, so layouts fit whichever is chosen.
   */
  scale: number
}

export type TemplateFonts = Record<TemplateFontRole, string>

export const TEMPLATE_FONT_CHOICES: Record<TemplateFontRole, TemplateFontChoice[]> = {
  display: [
    { id: "josefin", label: "Josefin Sans", stack: "'Josefin Sans', 'Century Gothic', Futura, system-ui, sans-serif", weight: 600, scale: 1 },
    { id: "jost", label: "Jost", stack: "'Jost', 'Century Gothic', Futura, system-ui, sans-serif", weight: 600, scale: 0.96 },
    { id: "montserrat", label: "Montserrat", stack: "'Montserrat', system-ui, sans-serif", weight: 600, scale: 0.86 },
    { id: "oswald", label: "Oswald", stack: "'Oswald', 'Arial Narrow', system-ui, sans-serif", weight: 500, scale: 1.06 },
  ],
  serif: [
    { id: "bodoni", label: "Bodoni Moda", stack: "'Bodoni Moda', Didot, 'Times New Roman', serif", weight: 600, scale: 1 },
    { id: "playfair", label: "Playfair Display", stack: "'Playfair Display', Georgia, serif", weight: 700, scale: 0.94 },
    { id: "dm_serif", label: "DM Serif Display", stack: "'DM Serif Display', Georgia, serif", weight: 400, scale: 0.96 },
    { id: "baskerville", label: "Libre Baskerville", stack: "'Libre Baskerville', Georgia, serif", weight: 700, scale: 0.84 },
  ],
  script: [
    { id: "delafield", label: "Mrs Saint Delafield", stack: "'Mrs Saint Delafield', 'Brush Script MT', cursive", weight: 400, scale: 1 },
    { id: "great_vibes", label: "Great Vibes", stack: "'Great Vibes', 'Brush Script MT', cursive", weight: 400, scale: 0.82 },
    { id: "allura", label: "Allura", stack: "'Allura', 'Brush Script MT', cursive", weight: 400, scale: 0.9 },
    { id: "dancing", label: "Dancing Script (easiest to read)", stack: "'Dancing Script', 'Brush Script MT', cursive", weight: 600, scale: 0.72 },
  ],
}

export const DEFAULT_TEMPLATE_FONTS: TemplateFonts = { display: "josefin", serif: "bodoni", script: "delafield" }

/** The choice for a role, falling back to the default if the saved id is unknown. */
export function templateFontChoice(role: TemplateFontRole, id: string | null | undefined): TemplateFontChoice {
  const list = TEMPLATE_FONT_CHOICES[role]
  return list.find((choice) => choice.id === id) ?? list.find((choice) => choice.id === DEFAULT_TEMPLATE_FONTS[role])!
}

/** Saved fonts (any shape) as a complete, valid set. */
export function resolveTemplateFonts(value: unknown): TemplateFonts {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<Record<string, unknown>>) : {}
  const pick = (role: TemplateFontRole) =>
    templateFontChoice(role, typeof saved[role] === "string" ? (saved[role] as string) : null).id
  return { display: pick("display"), serif: pick("serif"), script: pick("script") }
}

/** The CSS variables templates read: --kit-<role>, --kit-<role>-weight, --kit-<role>-scale. */
export function templateFontVars(fonts: TemplateFonts): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const role of ["display", "serif", "script"] as const) {
    const choice = templateFontChoice(role, fonts[role])
    vars[`--kit-${role}`] = choice.stack
    vars[`--kit-${role}-weight`] = String(choice.weight)
    vars[`--kit-${role}-scale`] = String(choice.scale)
  }
  return vars
}

import {
  resolveIndustryProfile,
  type BrandColorTheme,
} from "@/lib/brands/industry-templates"
import {
  visualPresetsSchema,
  type BrandIdentity,
  type VisualPresets,
} from "@/lib/entities/dna-schema"

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function normalizeHexColor(
  value: string | null | undefined,
  fallback: string
): string {
  const raw = value?.trim() || ""
  if (!HEX.test(raw)) return fallback
  if (raw.length === 4) {
    const [, r, g, b] = raw
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return raw.toUpperCase()
}

export function cssFontStack(fontFamily: string | null | undefined): string {
  const raw = (fontFamily || "sans").trim().toLowerCase()
  if (raw === "serif") {
    return "Georgia, 'Times New Roman', Times, serif"
  }
  if (raw === "mono" || raw === "monospace") {
    return "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  }
  if (raw === "sans" || raw === "sans-serif") {
    return "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
  }
  // Allow custom stacks from scrape / operator override.
  return fontFamily!.trim()
}

export function visualPresetsFromTheme(theme: BrandColorTheme): VisualPresets {
  return {
    canvas_color: theme.canvas,
    accent_color: theme.accent,
    text_color: theme.onCanvas,
    font_family:
      theme.id.includes("obsidian") || theme.id.includes("kinetic")
        ? "sans"
        : theme.id.includes("warm")
          ? "sans"
          : "sans",
  }
}

/**
 * Starting brand palette and headline font per brand profile, used until the
 * brand saves its own in Brand Brain → Visual presets.
 */
const BRAND_DEFAULTS: Record<
  string,
  { palette: string[]; headingFontId: string }
> = {
  // Gold, beige, black, white — quiet luxury.
  worn_label: {
    palette: ["#C5A46D", "#E8DCC4", "#111111", "#FFFFFF"],
    headingFontId: "editorial_serif",
  },
  fudi: {
    palette: ["#CCFF00", "#FF007F", "#0A0A0A", "#FFFFFF"],
    headingFontId: "impact_bold",
  },
  generic: {
    palette: ["#111111", "#FFFFFF", "#F5F5F5", "#6B6B6B"],
    headingFontId: "inter_clean",
  },
}

export type BrandSwatch = { hex: string; label: string }

/** The brand's colours for on-image text and story backgrounds (deduped). */
export function brandSwatches(presets: VisualPresets): BrandSwatch[] {
  const seen = new Set<string>()
  const out: BrandSwatch[] = []
  for (const raw of [
    ...(presets.palette ?? []),
    presets.text_color,
    presets.canvas_color,
    presets.accent_color,
  ]) {
    const hex = normalizeHexColor(raw, "")
    if (!hex || seen.has(hex)) continue
    seen.add(hex)
    out.push({ hex, label: hex })
  }
  return out.slice(0, 10)
}

export function resolveVisualPresets(input: {
  brandName?: string | null
  industry?: string | null
  brandIdentity?: Partial<BrandIdentity> | null
}): VisualPresets {
  const profile = resolveIndustryProfile({
    name: input.brandName,
    industry: input.industry,
  })
  const defaults = BRAND_DEFAULTS[profile.id] ?? BRAND_DEFAULTS.generic
  const fallback: VisualPresets = {
    ...visualPresetsFromTheme(profile.theme),
    palette: defaults.palette,
    heading_font_id: defaults.headingFontId,
  }
  const raw = input.brandIdentity?.visual_presets
  const parsed = visualPresetsSchema.safeParse(raw)
  if (!parsed.success) return fallback

  const savedPalette = (parsed.data.palette ?? [])
    .map((hex) => normalizeHexColor(hex, ""))
    .filter(Boolean)

  return {
    palette: savedPalette.length ? savedPalette : defaults.palette,
    heading_font_id: parsed.data.heading_font_id || defaults.headingFontId,
    canvas_color: normalizeHexColor(
      parsed.data.canvas_color,
      fallback.canvas_color
    ),
    accent_color: normalizeHexColor(
      parsed.data.accent_color,
      fallback.accent_color
    ),
    text_color: normalizeHexColor(parsed.data.text_color, fallback.text_color),
    font_family: parsed.data.font_family || fallback.font_family,
    logo_url: parsed.data.logo_url?.trim() || undefined,
    logo_corner: parsed.data.logo_corner,
  }
}

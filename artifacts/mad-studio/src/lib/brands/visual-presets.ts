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

export function resolveVisualPresets(input: {
  brandName?: string | null
  industry?: string | null
  brandIdentity?: Partial<BrandIdentity> | null
}): VisualPresets {
  const profile = resolveIndustryProfile({
    name: input.brandName,
    industry: input.industry,
  })
  const fallback = visualPresetsFromTheme(profile.theme)
  const raw = input.brandIdentity?.visual_presets
  const parsed = visualPresetsSchema.safeParse(raw)
  if (!parsed.success) return fallback

  return {
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
  }
}

import type { WornLabelTagColorName } from "@/types/social-creative"

export const WLS_PROMO_THEME = {
  bg: "#09090B",
  surface: "#121214",
  champagneGold: "#C5A880",
  champagneGoldMuted: "rgba(197, 168, 128, 0.25)",
  border: "rgba(255, 255, 255, 0.08)",
} as const

export type WornLabelTagColorSpec = {
  hex: string
  contrastText: "#111111" | "#FFFFFF"
  /** Light ring on dot for dark tag colors */
  borderHighlight: boolean
}

export const WORN_LABEL_TAG_COLORS: Record<
  WornLabelTagColorName,
  WornLabelTagColorSpec
> = {
  PURPLE: { hex: "#7B2CBF", contrastText: "#FFFFFF", borderHighlight: false },
  ORANGE: { hex: "#FF7A00", contrastText: "#FFFFFF", borderHighlight: false },
  BLACK: { hex: "#111111", contrastText: "#FFFFFF", borderHighlight: true },
  PINK: { hex: "#FF2D75", contrastText: "#FFFFFF", borderHighlight: false },
  GREEN: { hex: "#00C853", contrastText: "#FFFFFF", borderHighlight: false },
  RED: { hex: "#EF233C", contrastText: "#FFFFFF", borderHighlight: false },
  BLUE: { hex: "#0066FF", contrastText: "#FFFFFF", borderHighlight: false },
  YELLOW: { hex: "#FFD600", contrastText: "#111111", borderHighlight: false },
}

export function tagColorSpec(name: WornLabelTagColorName): WornLabelTagColorSpec {
  return WORN_LABEL_TAG_COLORS[name]
}

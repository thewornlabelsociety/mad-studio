import type { CSSProperties } from "react"

export type CanvasTextFontId =
  | "impact_bold"
  | "ig_modern"
  | "editorial_serif"
  | "typewriter_mono"

export type CanvasTextShadow = "none" | "soft" | "hard"

export type CanvasTextHighlight = "none" | "black_pill" | "brand_pill"

export type CanvasTextAnimation =
  | "none"
  | "fade"
  | "pop"
  | "typewriter"
  | "slide_up"

export type CanvasTextOverlayState = {
  enabled: boolean
  headline: string
  subhead: string
  fontId: CanvasTextFontId
  color: string
  shadow: CanvasTextShadow
  highlight: CanvasTextHighlight
  animation: CanvasTextAnimation
}

export const DEFAULT_CANVAS_TEXT_OVERLAY: CanvasTextOverlayState = {
  enabled: false,
  headline: "",
  subhead: "",
  fontId: "impact_bold",
  color: "#FFFFFF",
  shadow: "hard",
  highlight: "black_pill",
  animation: "none",
}

export const CANVAS_TEXT_FONTS: Array<{
  id: CanvasTextFontId
  label: string
  className: string
  style: CSSProperties
}> = [
  {
    id: "impact_bold",
    label: "Impact Bold",
    className: "uppercase tracking-tight font-black",
    style: { fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif" },
  },
  {
    id: "ig_modern",
    label: "Instagram Modern Grotesk",
    className: "font-semibold tracking-normal",
    style: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
  },
  {
    id: "editorial_serif",
    label: "Editorial Serif",
    className: "font-serif italic tracking-wide",
    style: { fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' },
  },
  {
    id: "typewriter_mono",
    label: "Typewriter Mono",
    className: "font-mono uppercase tracking-widest",
    style: { fontFamily: '"Courier New", Courier, monospace' },
  },
]

export const CANVAS_BRAND_SWATCHES = [
  { id: "lime", label: "Acid Lime", hex: "#CCFF00" },
  { id: "pink", label: "Hot Pink", hex: "#FF007F" },
  { id: "obsidian", label: "Obsidian", hex: "#121211" },
  { id: "white", label: "Pure White", hex: "#FFFFFF" },
] as const

export function canvasTextShadowClass(shadow: CanvasTextShadow): string {
  switch (shadow) {
    case "soft":
      return "drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
    case "hard":
      return "[text-shadow:2px_2px_0_#000,3px_3px_0_rgba(0,0,0,0.35)]"
    default:
      return ""
  }
}

export function canvasTextHighlightClass(highlight: CanvasTextHighlight): string {
  switch (highlight) {
    case "black_pill":
      return "rounded-sm bg-black/55 px-2 py-0.5"
    case "brand_pill":
      return "rounded-sm bg-[#CCFF00] px-2 py-0.5 text-black"
    default:
      return ""
  }
}

export function canvasTextAnimationClass(
  animation: CanvasTextAnimation,
  isVideo: boolean
): string {
  if (!isVideo || animation === "none") return ""
  switch (animation) {
    case "fade":
      return "animate-pulse"
    case "pop":
      return "animate-bounce"
    case "typewriter":
      return "tracking-widest"
    case "slide_up":
      return "animate-[slideUp_0.6s_ease-out]"
    default:
      return ""
  }
}

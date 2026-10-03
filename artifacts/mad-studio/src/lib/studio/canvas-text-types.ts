import type { CSSProperties } from "react"



export const CANVAS_TEXT_FONT_IDS = [

  "impact_bold",

  "ig_modern",

  "editorial_serif",

  "typewriter_mono",

  "syne_display",

  "bebas_neue",

  "oswald_condensed",

  "anton_heavy",

  "montserrat_bold",

  "libre_baskerville",

  "marker_hand",

  "archivo_black",

  "inter_clean",

] as const



export type CanvasTextFontId = (typeof CANVAS_TEXT_FONT_IDS)[number]



export type CanvasTextShadow = "none" | "soft" | "hard"



export type CanvasTextHighlight = "none" | "black_pill" | "brand_pill"



export type CanvasTextAnimation =

  | "none"

  | "fade"

  | "pop"

  | "typewriter"

  | "slide_up"

  | "wiggle"

  | "glow"



export const CANVAS_STICKER_IDS = [

  "link_pill",

  "emoji_fire",

  "emoji_sparkles",

  "emoji_point",

  "emoji_hundred",

  "emoji_timer",

  "badge_new",

  "badge_sale",

] as const



export type CanvasStickerId = (typeof CANVAS_STICKER_IDS)[number]



export type CanvasStickerKind = "link_pill" | "emoji" | "badge"



export type CanvasTextAlign = "left" | "center" | "right"



export type CanvasLinkPillShape = "pill" | "rounded" | "square"



export const STORY_STICKER_MODES = [

  "none",

  "link_badge",

  "editorial_poll",

  "countdown_timer",

] as const



export type StoryStickerMode = (typeof STORY_STICKER_MODES)[number]



export type StoryStickerTheme = "noir" | "linen"



export const STORY_LINK_BADGE_LABELS = [

  "VIEW PIECE ↗",

  "RESERVE TABLE ↗",

  "EXPLORE DROP ↗",

  "ORDER NOW ↗",

] as const



export type StoryLinkBadgeLabel = (typeof STORY_LINK_BADGE_LABELS)[number]



export type CanvasTextOverlayState = {

  enabled: boolean

  headline: string

  subhead: string

  fontId: CanvasTextFontId

  color: string

  shadow: CanvasTextShadow

  highlight: CanvasTextHighlight

  animation: CanvasTextAnimation

  /** 0–100 — anchor point on the media frame (not the caption strip). */

  positionX: number

  positionY: number

  /** Multiplier on baked/preview font size (0.5–2.5). */

  fontScale: number

  /** Degrees, applied around the position anchor (−180…180). */

  rotationDeg: number

  textAlign: CanvasTextAlign

  stickerEnabled: boolean

  stickerId: CanvasStickerId

  stickerLabel: string

  stickerX: number

  stickerY: number

  /** Link pill background (hex). */

  stickerLinkBg: string

  /** Link pill label color (hex). */

  stickerLinkText: string

  stickerLinkShape: CanvasLinkPillShape

  storyStickerMode: StoryStickerMode

  storyStickerTheme: StoryStickerTheme

  linkBadgeLabel: string

  pollQuestion: string

  pollOptionA: string

  pollOptionB: string

  pollPercentA: number

  countdownTitle: string

  /** ISO datetime for countdown target. */

  countdownTargetAt: string

}



export const DEFAULT_CANVAS_TEXT_OVERLAY: CanvasTextOverlayState = {

  enabled: false,

  headline: "",

  subhead: "",

  fontId: "impact_bold",

  color: "#FFFFFF",

  shadow: "hard",

  highlight: "none",

  animation: "none",

  positionX: 50,

  positionY: 72,

  fontScale: 1,

  rotationDeg: 0,

  textAlign: "center",

  stickerEnabled: false,

  stickerId: "link_pill",

  stickerLabel: "Shop now",

  stickerX: 50,

  stickerY: 88,

  stickerLinkBg: "#FFFFFF",

  stickerLinkText: "#111111",

  stickerLinkShape: "pill",

  storyStickerMode: "none",

  storyStickerTheme: "noir",

  linkBadgeLabel: "EXPLORE DROP ↗",

  pollQuestion: "Which look wins?",

  pollOptionA: "Studio cut",

  pollOptionB: "On location",

  pollPercentA: 54,

  countdownTitle: "Drop opens",

  countdownTargetAt: "",

}



export function isCanvasTextFontId(value: string): value is CanvasTextFontId {

  return (CANVAS_TEXT_FONT_IDS as readonly string[]).includes(value)

}



export function isCanvasStickerId(value: string): value is CanvasStickerId {

  return (CANVAS_STICKER_IDS as readonly string[]).includes(value)

}



/** True when baked PNG / preview should show on-image headline or subhead. */
export function canvasOverlayHasDecor(overlay: CanvasTextOverlayState): boolean {
  return (
    overlay.enabled &&
    Boolean(overlay.headline.trim() || overlay.subhead.trim())
  )
}

/** Poll, countdown, emoji, and link-pill overlays are no longer supported on export. */
export function clearCanvasTextOverlay(): CanvasTextOverlayState {
  return {
    ...DEFAULT_CANVAS_TEXT_OVERLAY,
    enabled: false,
    headline: "",
    subhead: "",
  }
}

/** Drop ghost on-image text synced from caption/hook by mistake. */
export function reconcileUnwantedCanvasTextOverlay(
  overlay: CanvasTextOverlayState,
  draft: { hook?: string; caption?: string }
): CanvasTextOverlayState {
  const next = normalizeCanvasTextOverlay(overlay)
  if (!next.enabled) return next
  const headline = next.headline.trim()
  if (!headline && !next.subhead.trim()) {
    return clearCanvasTextOverlay()
  }
  if (!headline) return next

  const hook = (draft.hook ?? "").trim()
  const caption = (draft.caption ?? "").trim()
  const captionFirstWord =
    caption.split(/\s+/).find((word) => word.length > 0) ?? ""

  const isSingleWord = headline.split(/\s+/).length === 1
  const matchesCaptionLead =
    captionFirstWord.length > 0 &&
    headline.localeCompare(captionFirstWord, undefined, {
      sensitivity: "accent",
    }) === 0
  const matchesHook =
    hook.length > 0 &&
    headline.localeCompare(hook, undefined, { sensitivity: "accent" }) === 0

  if (isSingleWord && matchesCaptionLead && !matchesHook) {
    return clearCanvasTextOverlay()
  }

  return next
}

export function stripLegacyCanvasStickers(
  overlay: CanvasTextOverlayState
): CanvasTextOverlayState {
  if (overlay.storyStickerMode === "none" && !overlay.stickerEnabled) {
    return overlay
  }
  return {
    ...overlay,
    storyStickerMode: "none",
    stickerEnabled: false,
  }
}



export function normalizeCanvasTextOverlay(

  value: unknown

): CanvasTextOverlayState {

  if (!value || typeof value !== "object" || Array.isArray(value)) {

    return { ...DEFAULT_CANVAS_TEXT_OVERLAY }

  }

  const row = value as Record<string, unknown>

  const num = (key: string, fallback: number) => {

    const n = typeof row[key] === "number" ? row[key] : Number(row[key])

    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback

  }

  const str = (key: string, fallback: string) =>

    typeof row[key] === "string" ? row[key] : fallback

  const align = str("textAlign", "center")

  const rawFont = str("fontId", "impact_bold")

  const rawSticker = str("stickerId", "link_pill")

  const rawAnim = str("animation", "none")

  const animation = (

    [

      "none",

      "fade",

      "pop",

      "typewriter",

      "slide_up",

      "wiggle",

      "glow",

    ] as const

  ).includes(rawAnim as CanvasTextAnimation)

    ? (rawAnim as CanvasTextAnimation)

    : "none"

  const base: CanvasTextOverlayState = {

    enabled: Boolean(row.enabled),

    headline: str("headline", ""),

    subhead: str("subhead", ""),

    fontId: isCanvasTextFontId(rawFont) ? rawFont : "impact_bold",

    color: str("color", "#FFFFFF"),

    shadow: (str("shadow", "hard") as CanvasTextShadow) || "hard",

    highlight: (str("highlight", "black_pill") as CanvasTextHighlight) ||

      "black_pill",

    animation,

    positionX: num("positionX", DEFAULT_CANVAS_TEXT_OVERLAY.positionX),

    positionY: num("positionY", DEFAULT_CANVAS_TEXT_OVERLAY.positionY),

    fontScale: (() => {
      const raw = row.fontScale
      const n = typeof raw === "number" ? raw : Number(raw)
      if (!Number.isFinite(n)) return DEFAULT_CANVAS_TEXT_OVERLAY.fontScale
      return Math.min(2.5, Math.max(0.5, n))
    })(),

    rotationDeg: (() => {
      const raw = row.rotationDeg
      const n = typeof raw === "number" ? raw : Number(raw)
      if (!Number.isFinite(n)) return DEFAULT_CANVAS_TEXT_OVERLAY.rotationDeg
      let deg = n % 360
      if (deg > 180) deg -= 360
      if (deg < -180) deg += 360
      return deg
    })(),

    textAlign:

      align === "left" || align === "right" || align === "center"

        ? align

        : "center",

    stickerEnabled: false,

    stickerId: isCanvasStickerId(rawSticker) ? rawSticker : "link_pill",

    stickerLabel: str("stickerLabel", DEFAULT_CANVAS_TEXT_OVERLAY.stickerLabel),

    stickerX: num("stickerX", DEFAULT_CANVAS_TEXT_OVERLAY.stickerX),

    stickerY: num("stickerY", DEFAULT_CANVAS_TEXT_OVERLAY.stickerY),

    stickerLinkBg: str("stickerLinkBg", DEFAULT_CANVAS_TEXT_OVERLAY.stickerLinkBg),

    stickerLinkText: str(
      "stickerLinkText",
      DEFAULT_CANVAS_TEXT_OVERLAY.stickerLinkText
    ),

    stickerLinkShape: ((): CanvasLinkPillShape => {
      const rawShape = str("stickerLinkShape", "pill")
      return rawShape === "rounded" || rawShape === "square"
        ? rawShape
        : "pill"
    })(),

    storyStickerMode: "none" as StoryStickerMode,

    storyStickerTheme:
      str("storyStickerTheme", "noir") === "linen" ? "linen" : "noir",

    linkBadgeLabel: str(
      "linkBadgeLabel",
      str("stickerLabel", DEFAULT_CANVAS_TEXT_OVERLAY.linkBadgeLabel)
    ),

    pollQuestion: str("pollQuestion", DEFAULT_CANVAS_TEXT_OVERLAY.pollQuestion),

    pollOptionA: str("pollOptionA", DEFAULT_CANVAS_TEXT_OVERLAY.pollOptionA),

    pollOptionB: str("pollOptionB", DEFAULT_CANVAS_TEXT_OVERLAY.pollOptionB),

    pollPercentA: num(
      "pollPercentA",
      DEFAULT_CANVAS_TEXT_OVERLAY.pollPercentA
    ),

    countdownTitle: str(
      "countdownTitle",
      DEFAULT_CANVAS_TEXT_OVERLAY.countdownTitle
    ),

    countdownTargetAt: str(
      "countdownTargetAt",
      DEFAULT_CANVAS_TEXT_OVERLAY.countdownTargetAt
    ),

  }

  return stripLegacyCanvasStickers(base)

}



export function canvasLinkPillBorderRadius(
  shape: CanvasLinkPillShape,
  boxHeightPx: number
): number {
  switch (shape) {
    case "square":
      return Math.max(2, boxHeightPx * 0.1)
    case "rounded":
      return Math.max(8, boxHeightPx * 0.22)
    case "pill":
    default:
      return boxHeightPx / 2
  }
}



export function canvasLinkPillShapeClass(shape: CanvasLinkPillShape): string {
  switch (shape) {
    case "square":
      return "rounded-sm"
    case "rounded":
      return "rounded-lg"
    case "pill":
    default:
      return "rounded-full"
  }
}



export type CanvasTextFontDefinition = {

  id: CanvasTextFontId

  label: string

  className: string

  style: CSSProperties

  /** Primary family for canvas `document.fonts.load`. */

  primaryFamily: string

  canvasWeight?: number

  canvasStyle?: "normal" | "italic"

}



export const CANVAS_TEXT_FONTS: CanvasTextFontDefinition[] = [

  {

    id: "impact_bold",

    label: "Impact Bold",

    className: "uppercase tracking-tight font-black",

    primaryFamily: "Impact",

    canvasWeight: 900,

    style: {

      fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",

    },

  },

  {

    id: "ig_modern",

    label: "Instagram Modern Grotesk",

    className: "font-semibold tracking-normal",

    primaryFamily: "Inter",

    canvasWeight: 600,

    style: {

      fontFamily:

        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

    },

  },

  {

    id: "inter_clean",

    label: "Inter Clean",

    className: "font-semibold tracking-tight",

    primaryFamily: "Inter",

    canvasWeight: 700,

    style: { fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },

  },

  {

    id: "editorial_serif",

    label: "Editorial Serif",

    className: "font-serif italic tracking-wide",

    primaryFamily: "Playfair Display",

    canvasWeight: 700,

    canvasStyle: "italic",

    style: {

      fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',

    },

  },

  {

    id: "libre_baskerville",

    label: "Libre Baskerville",

    className: "font-serif tracking-normal",

    primaryFamily: "Libre Baskerville",

    canvasWeight: 700,

    style: {

      fontFamily: '"Libre Baskerville", Georgia, "Times New Roman", serif',

    },

  },

  {

    id: "syne_display",

    label: "Syne Display",

    className: "font-bold uppercase tracking-tight",

    primaryFamily: "Syne",

    canvasWeight: 800,

    style: { fontFamily: 'Syne, ui-sans-serif, system-ui, sans-serif' },

  },

  {

    id: "bebas_neue",

    label: "Bebas Neue",

    className: "uppercase tracking-wide font-normal",

    primaryFamily: "Bebas Neue",

    canvasWeight: 400,

    style: { fontFamily: '"Bebas Neue", Impact, sans-serif' },

  },

  {

    id: "oswald_condensed",

    label: "Oswald Condensed",

    className: "uppercase tracking-tight font-semibold",

    primaryFamily: "Oswald",

    canvasWeight: 600,

    style: { fontFamily: 'Oswald, "Arial Narrow", sans-serif' },

  },

  {

    id: "anton_heavy",

    label: "Anton Heavy",

    className: "uppercase tracking-tight font-normal",

    primaryFamily: "Anton",

    canvasWeight: 400,

    style: { fontFamily: 'Anton, Impact, sans-serif' },

  },

  {

    id: "archivo_black",

    label: "Archivo Black",

    className: "uppercase tracking-tight font-black",

    primaryFamily: "Archivo Black",

    canvasWeight: 400,

    style: { fontFamily: '"Archivo Black", Impact, sans-serif' },

  },

  {

    id: "montserrat_bold",

    label: "Montserrat Bold",

    className: "font-bold tracking-tight",

    primaryFamily: "Montserrat",

    canvasWeight: 800,

    style: { fontFamily: 'Montserrat, Inter, sans-serif' },

  },

  {

    id: "typewriter_mono",

    label: "Space Mono",

    className: "font-mono uppercase tracking-widest",

    primaryFamily: "Space Mono",

    canvasWeight: 700,

    style: { fontFamily: '"Space Mono", "Courier New", Courier, monospace' },

  },

  {

    id: "marker_hand",

    label: "Permanent Marker",

    className: "tracking-normal",

    primaryFamily: "Permanent Marker",

    canvasWeight: 400,

    style: {

      fontFamily: '"Permanent Marker", "Comic Sans MS", cursive, sans-serif',

    },

  },

]



export function resolveCanvasTextFont(

  fontId: CanvasTextFontId

): CanvasTextFontDefinition {

  return (

    CANVAS_TEXT_FONTS.find((row) => row.id === fontId) ?? CANVAS_TEXT_FONTS[0]

  )

}



export const CANVAS_STICKERS: Array<{

  id: CanvasStickerId

  label: string

  kind: CanvasStickerKind

  glyph: string

}> = [

  { id: "link_pill", label: "Link pill", kind: "link_pill", glyph: "🔗" },

  { id: "emoji_fire", label: "Fire", kind: "emoji", glyph: "🔥" },

  { id: "emoji_sparkles", label: "Sparkles", kind: "emoji", glyph: "✨" },

  { id: "emoji_point", label: "Point up", kind: "emoji", glyph: "👆" },

  { id: "emoji_hundred", label: "100", kind: "emoji", glyph: "💯" },

  { id: "emoji_timer", label: "Limited time", kind: "emoji", glyph: "⏰" },

  { id: "badge_new", label: "NEW badge", kind: "badge", glyph: "NEW" },

  { id: "badge_sale", label: "SALE badge", kind: "badge", glyph: "SALE" },

]



export function resolveCanvasSticker(stickerId: CanvasStickerId) {

  return (

    CANVAS_STICKERS.find((row) => row.id === stickerId) ?? CANVAS_STICKERS[0]

  )

}



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
      return "rounded-md bg-black/60 px-3 py-1"
    case "brand_pill":
      return "rounded-sm bg-[#CCFF00] px-2 py-0.5 text-black"
    default:
      return "bg-transparent"
  }
}



export function canvasTextAnimationClass(

  animation: CanvasTextAnimation,

  options?: { motionPreview?: boolean }

): string {

  const motionPreview = options?.motionPreview ?? true

  if (!motionPreview || animation === "none") return ""

  switch (animation) {

    case "fade":

      return "mad-canvas-anim-fade"

    case "pop":

      return "mad-canvas-anim-pop"

    case "typewriter":

      return "mad-canvas-anim-typewriter tracking-widest"

    case "slide_up":

      return "mad-canvas-anim-slide-up"

    case "wiggle":

      return "mad-canvas-anim-wiggle"

    case "glow":

      return "mad-canvas-anim-glow"

    default:

      return ""

  }

}



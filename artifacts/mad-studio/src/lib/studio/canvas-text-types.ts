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

  /** Subhead is its own layer: font, colour, size, position and tilt. */
  subFontId: CanvasTextFontId
  subColor: string
  subFontScale: number
  subPositionX: number
  subPositionY: number
  subRotationDeg: number
  /** Solid block behind each line (hex); "" means no background. */
  bgColor: string
  subBgColor: string

  /**
   * Tags line: optional item facts as one pill ("New consignment · Brand ·
   * Sz 10 · $180 · Vibe"). Each is ticked on or off; the values are editable.
   */
  tagShowNew: boolean
  tagShowBrand: boolean
  tagShowSize: boolean
  tagShowPrice: boolean
  tagShowVibe: boolean
  tagNewLabel: string
  tagBrand: string
  tagSize: string
  tagPrice: string
  tagVibe: string
  tagFontId: CanvasTextFontId
  tagColor: string
  tagFontScale: number
  /** Each tag is its own box, placed on its own (0–100 of the frame). */
  tagNewX: number
  tagNewY: number
  tagBrandX: number
  tagBrandY: number
  tagSizeX: number
  tagSizeY: number
  tagPriceX: number
  tagPriceY: number
  tagVibeX: number
  tagVibeY: number
  tagRotationDeg: number
  tagBgColor: string
  /** Per-tag overrides of the shared tag style (set by clicking a tag). */
  tagStyles: Partial<Record<CanvasTagId, Partial<CanvasLayerStyle>>>

  /** Brand logo on the image: centre point and width (% of the frame). */
  logoEnabled: boolean
  logoUrl: string
  logoX: number
  logoY: number
  logoScale: number

  /**
   * Backdrop: the item cut out and placed on a solid colour instead of the
   * original photo. cutoutUrl is the background-removed PNG.
   */
  backdropEnabled: boolean
  backdropColor: string
  cutoutUrl: string
  /** Photo the cutout was made from — redo it if the slide's photo changes. */
  cutoutSourceUrl: string
  subjectScale: number
  subjectOffsetY: number

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

  subFontId: "impact_bold",
  subColor: "#FFFFFF",
  subFontScale: 0.6,
  subPositionX: 50,
  subPositionY: 80,
  subRotationDeg: 0,
  bgColor: "",
  subBgColor: "",

  tagShowNew: false,
  tagShowBrand: false,
  tagShowSize: false,
  tagShowPrice: false,
  tagShowVibe: false,
  tagNewLabel: "New consignment",
  tagBrand: "",
  tagSize: "",
  tagPrice: "",
  tagVibe: "",
  tagFontId: "impact_bold",
  tagColor: "#FFFFFF",
  tagFontScale: 0.5,
  tagNewX: 50,
  tagNewY: 8,
  tagBrandX: 50,
  tagBrandY: 17,
  tagSizeX: 50,
  tagSizeY: 26,
  tagPriceX: 50,
  tagPriceY: 35,
  tagVibeX: 50,
  tagVibeY: 44,
  tagRotationDeg: 0,
  tagBgColor: "#111111",
  tagStyles: {},

  logoEnabled: false,
  logoUrl: "",
  logoX: 85,
  logoY: 8,
  logoScale: 18,

  backdropEnabled: false,
  backdropColor: "#F2EDE4",
  cutoutUrl: "",
  cutoutSourceUrl: "",
  subjectScale: 0.9,
  subjectOffsetY: 0,

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
    Boolean(
      overlay.headline.trim() ||
        overlay.subhead.trim() ||
        canvasTagItems(overlay).length > 0 ||
        canvasLogoOn(overlay) ||
        canvasBackdropOn(overlay)
    )
  )
}

export function canvasLogoOn(overlay: CanvasTextOverlayState): boolean {
  return Boolean(overlay.logoEnabled && overlay.logoUrl)
}

export function canvasBackdropOn(overlay: CanvasTextOverlayState): boolean {
  return Boolean(overlay.backdropEnabled && overlay.cutoutUrl)
}

/** Text only (headline, subhead, tags) — for the Story card, which has its own logo and cutout. */
export function canvasTextOnly(
  overlay: CanvasTextOverlayState
): CanvasTextOverlayState {
  return { ...overlay, logoEnabled: false, backdropEnabled: false }
}

function clampNumber(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
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

  // Older saved text has no subhead layer: it inherits the headline's look,
  // sits just below it, and starts a little smaller.
  const headFontId: CanvasTextFontId = isCanvasTextFontId(rawFont)
    ? rawFont
    : "impact_bold"
  const rawSubFont = str("subFontId", headFontId)
  const scaleOf = (key: string, fallback: number) => {
    const raw = row[key]
    const n = typeof raw === "number" ? raw : Number(raw)
    return Number.isFinite(n) ? Math.min(2.5, Math.max(0.5, n)) : fallback
  }
  const degreesOf = (key: string, fallback: number) => {
    const raw = row[key]
    const n = typeof raw === "number" ? raw : Number(raw)
    if (!Number.isFinite(n)) return fallback
    let deg = n % 360
    if (deg > 180) deg -= 360
    if (deg < -180) deg += 360
    return deg
  }
  const headPositionY = num("positionY", DEFAULT_CANVAS_TEXT_OVERLAY.positionY)

  const base: CanvasTextOverlayState = {

    enabled: Boolean(row.enabled),

    headline: str("headline", ""),

    subhead: str("subhead", ""),

    fontId: isCanvasTextFontId(rawFont) ? rawFont : "impact_bold",

    color: str("color", "#FFFFFF"),

    shadow: (str("shadow", "hard") as CanvasTextShadow) || "hard",

    highlight: "none",

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

    subFontId: isCanvasTextFontId(rawSubFont) ? rawSubFont : headFontId,
    subColor: str("subColor", str("color", "#FFFFFF")),
    subFontScale: scaleOf("subFontScale", DEFAULT_CANVAS_TEXT_OVERLAY.subFontScale),
    subPositionX: num(
      "subPositionX",
      num("positionX", DEFAULT_CANVAS_TEXT_OVERLAY.positionX)
    ),
    subPositionY: num("subPositionY", Math.min(96, headPositionY + 8)),
    subRotationDeg: degreesOf("subRotationDeg", degreesOf("rotationDeg", 0)),
    bgColor: str("bgColor", ""),
    subBgColor: str("subBgColor", ""),

    tagShowNew: row.tagShowNew === true,
    tagShowBrand: row.tagShowBrand === true,
    tagShowSize: row.tagShowSize === true,
    tagShowPrice: row.tagShowPrice === true,
    tagShowVibe: row.tagShowVibe === true,
    tagNewLabel: str("tagNewLabel", DEFAULT_CANVAS_TEXT_OVERLAY.tagNewLabel),
    tagBrand: str("tagBrand", ""),
    tagSize: str("tagSize", ""),
    tagPrice: str("tagPrice", ""),
    tagVibe: str("tagVibe", ""),
    tagFontId:
      typeof row.tagFontId === "string" && isCanvasTextFontId(row.tagFontId)
        ? row.tagFontId
        : DEFAULT_CANVAS_TEXT_OVERLAY.tagFontId,
    tagColor: str("tagColor", DEFAULT_CANVAS_TEXT_OVERLAY.tagColor),
    tagFontScale: scaleOf("tagFontScale", DEFAULT_CANVAS_TEXT_OVERLAY.tagFontScale),
    tagNewX: num("tagNewX", DEFAULT_CANVAS_TEXT_OVERLAY.tagNewX),
    tagNewY: num("tagNewY", DEFAULT_CANVAS_TEXT_OVERLAY.tagNewY),
    tagBrandX: num("tagBrandX", DEFAULT_CANVAS_TEXT_OVERLAY.tagBrandX),
    tagBrandY: num("tagBrandY", DEFAULT_CANVAS_TEXT_OVERLAY.tagBrandY),
    tagSizeX: num("tagSizeX", DEFAULT_CANVAS_TEXT_OVERLAY.tagSizeX),
    tagSizeY: num("tagSizeY", DEFAULT_CANVAS_TEXT_OVERLAY.tagSizeY),
    tagPriceX: num("tagPriceX", DEFAULT_CANVAS_TEXT_OVERLAY.tagPriceX),
    tagPriceY: num("tagPriceY", DEFAULT_CANVAS_TEXT_OVERLAY.tagPriceY),
    tagVibeX: num("tagVibeX", DEFAULT_CANVAS_TEXT_OVERLAY.tagVibeX),
    tagVibeY: num("tagVibeY", DEFAULT_CANVAS_TEXT_OVERLAY.tagVibeY),
    tagRotationDeg: degreesOf("tagRotationDeg", 0),
    tagBgColor: str("tagBgColor", DEFAULT_CANVAS_TEXT_OVERLAY.tagBgColor),
    tagStyles: normalizeTagStyles(row.tagStyles),

    logoEnabled: row.logoEnabled === true,
    logoUrl: str("logoUrl", ""),
    logoX: num("logoX", DEFAULT_CANVAS_TEXT_OVERLAY.logoX),
    logoY: num("logoY", DEFAULT_CANVAS_TEXT_OVERLAY.logoY),
    logoScale: clampNumber(row.logoScale, 6, 60, DEFAULT_CANVAS_TEXT_OVERLAY.logoScale),

    backdropEnabled: row.backdropEnabled === true,
    backdropColor: str("backdropColor", DEFAULT_CANVAS_TEXT_OVERLAY.backdropColor),
    cutoutUrl: str("cutoutUrl", ""),
    cutoutSourceUrl: str("cutoutSourceUrl", ""),
    subjectScale: clampNumber(row.subjectScale, 0.3, 1.8, DEFAULT_CANVAS_TEXT_OVERLAY.subjectScale),
    subjectOffsetY: clampNumber(row.subjectOffsetY, -45, 45, 0),

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



/** Wraps the whole text block — use on container, not each line. */
export function canvasTextHighlightClass(highlight: CanvasTextHighlight): string {
  switch (highlight) {
    case "black_pill":
      return "w-fit max-w-full rounded-md bg-black/60 px-2 py-1"
    case "brand_pill":
      return "w-fit max-w-full rounded-sm bg-[#CCFF00] px-2 py-0.5 text-black"
    default:
      return ""
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



export type CanvasTextLayerId = "headline" | "subhead"

/** "$180" from "180"; anything else ("$180", "NZ$180") is kept as typed. */
function priceLabel(raw: string): string {
  const value = raw.trim()
  return /^\d+(?:[.,]\d+)?$/.test(value) ? `$${value}` : value
}

/** "Sz 10" from "10"; "Size M", "Sz M" and "One size" kept as typed. */
function sizeLabel(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  return /^sz\b|\bsize\b/i.test(value) ? value : `Sz ${value}`
}

/** The item-fact tags, each drawn as its own box. */
export const CANVAS_TAGS = [
  { id: "tag_new", show: "tagShowNew", text: "tagNewLabel", x: "tagNewX", y: "tagNewY", label: "New" },
  { id: "tag_brand", show: "tagShowBrand", text: "tagBrand", x: "tagBrandX", y: "tagBrandY", label: "Brand" },
  { id: "tag_size", show: "tagShowSize", text: "tagSize", x: "tagSizeX", y: "tagSizeY", label: "Size" },
  { id: "tag_price", show: "tagShowPrice", text: "tagPrice", x: "tagPriceX", y: "tagPriceY", label: "Price" },
  { id: "tag_vibe", show: "tagShowVibe", text: "tagVibe", x: "tagVibeX", y: "tagVibeY", label: "Vibe" },
] as const

export type CanvasTagId = (typeof CANVAS_TAGS)[number]["id"]
export type CanvasTagPositionKey = (typeof CANVAS_TAGS)[number]["x" | "y"]

/** Any box of text on the image that can be clicked and styled. */
export type CanvasStyleTarget = CanvasTextLayerId | CanvasTagId

/** Anything on the image that can be selected (text boxes and the logo). */
export type CanvasSelectable = CanvasStyleTarget | "logo"

export type CanvasLayerStyle = {
  fontId: CanvasTextFontId
  color: string
  fontScale: number
  rotationDeg: number
  /** Block colour behind the text; "" for none. */
  bgColor: string
}

export function isCanvasTagId(value: string): value is CanvasTagId {
  return CANVAS_TAGS.some((tag) => tag.id === value)
}

export function canvasSelectableLabel(target: CanvasSelectable): string {
  if (target === "headline") return "Headline"
  if (target === "subhead") return "Subhead"
  if (target === "logo") return "Logo"
  return CANVAS_TAGS.find((tag) => tag.id === target)?.label ?? "Tag"
}

/** Position fields for each movable thing on the image. */
export function canvasPositionKeys(target: CanvasSelectable): {
  x: keyof CanvasTextOverlayState & string
  y: keyof CanvasTextOverlayState & string
} {
  if (target === "headline") return { x: "positionX", y: "positionY" }
  if (target === "subhead") return { x: "subPositionX", y: "subPositionY" }
  if (target === "logo") return { x: "logoX", y: "logoY" }
  const tag = CANVAS_TAGS.find((row) => row.id === target)!
  return { x: tag.x, y: tag.y }
}

/** The style a box is drawn with (a tag's own style over the shared tag style). */
export function readLayerStyle(
  overlay: CanvasTextOverlayState,
  target: CanvasStyleTarget
): CanvasLayerStyle {
  if (target === "headline") {
    return {
      fontId: overlay.fontId,
      color: overlay.color,
      fontScale: overlay.fontScale,
      rotationDeg: overlay.rotationDeg,
      bgColor: overlay.bgColor ?? "",
    }
  }
  if (target === "subhead") {
    return {
      fontId: overlay.subFontId ?? overlay.fontId,
      color: overlay.subColor ?? overlay.color,
      fontScale: overlay.subFontScale ?? overlay.fontScale,
      rotationDeg: overlay.subRotationDeg ?? overlay.rotationDeg,
      bgColor: overlay.subBgColor ?? "",
    }
  }
  const own = overlay.tagStyles?.[target] ?? {}
  return {
    fontId: own.fontId ?? overlay.tagFontId ?? overlay.fontId,
    color: own.color ?? overlay.tagColor ?? "#FFFFFF",
    fontScale: own.fontScale ?? overlay.tagFontScale ?? 0.5,
    rotationDeg: own.rotationDeg ?? overlay.tagRotationDeg ?? 0,
    bgColor: own.bgColor ?? overlay.tagBgColor ?? "",
  }
}

/** The overlay fields to change so one box gets the new style. */
export function layerStylePatch(
  overlay: CanvasTextOverlayState,
  target: CanvasStyleTarget,
  style: Partial<CanvasLayerStyle>
): Partial<CanvasTextOverlayState> {
  if (target === "headline") return { ...style }
  if (target === "subhead") {
    const patch: Partial<CanvasTextOverlayState> = {}
    if (style.fontId !== undefined) patch.subFontId = style.fontId
    if (style.color !== undefined) patch.subColor = style.color
    if (style.fontScale !== undefined) patch.subFontScale = style.fontScale
    if (style.rotationDeg !== undefined) patch.subRotationDeg = style.rotationDeg
    if (style.bgColor !== undefined) patch.subBgColor = style.bgColor
    return patch
  }
  return {
    tagStyles: {
      ...(overlay.tagStyles ?? {}),
      [target]: { ...(overlay.tagStyles?.[target] ?? {}), ...style },
    },
  }
}

/** Give every tag the same style as this one. */
export function matchAllTagsPatch(
  overlay: CanvasTextOverlayState,
  from: CanvasTagId
): Partial<CanvasTextOverlayState> {
  const style = readLayerStyle(overlay, from)
  return {
    tagFontId: style.fontId,
    tagColor: style.color,
    tagFontScale: style.fontScale,
    tagRotationDeg: style.rotationDeg,
    tagBgColor: style.bgColor,
    tagStyles: {},
  }
}

function normalizeTagStyles(raw: unknown): CanvasTextOverlayState["tagStyles"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: CanvasTextOverlayState["tagStyles"] = {}
  for (const tag of CANVAS_TAGS) {
    const row = (raw as Record<string, unknown>)[tag.id]
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const style: Partial<CanvasLayerStyle> = {}
    if (typeof r.fontId === "string" && isCanvasTextFontId(r.fontId)) style.fontId = r.fontId
    if (typeof r.color === "string") style.color = r.color
    if (typeof r.bgColor === "string") style.bgColor = r.bgColor
    if (typeof r.fontScale === "number" && Number.isFinite(r.fontScale)) {
      style.fontScale = Math.min(2.5, Math.max(0.3, r.fontScale))
    }
    if (typeof r.rotationDeg === "number" && Number.isFinite(r.rotationDeg)) {
      style.rotationDeg = Math.min(180, Math.max(-180, r.rotationDeg))
    }
    out[tag.id] = style
  }
  return out
}

/** Ticked tags with their display text (sizes and prices tidied). */
export function canvasTagItems(
  overlay: CanvasTextOverlayState
): Array<{ id: CanvasTagId; text: string; x: number; y: number }> {
  return CANVAS_TAGS.flatMap((tag) => {
    if (!overlay[tag.show]) return []
    const raw = overlay[tag.text] ?? ""
    const text =
      tag.id === "tag_size"
        ? sizeLabel(raw)
        : tag.id === "tag_price"
          ? priceLabel(raw)
          : raw.trim()
    if (!text) return []
    return [{ id: tag.id, text, x: overlay[tag.x] ?? 50, y: overlay[tag.y] ?? 10 }]
  })
}

/** One box of on-image text with its own style and placement. */
export type CanvasTextLayer = CanvasLayerStyle & {
  id: CanvasStyleTarget
  text: string
  positionX: number
  positionY: number
}

/**
 * Every text box (headline, subhead, each tag), empty ones left out. Both the
 * preview and the baked image draw from this, so they always match.
 */
export function canvasTextLayers(
  overlay: CanvasTextOverlayState
): CanvasTextLayer[] {
  if (!overlay.enabled) return []
  const layers: CanvasTextLayer[] = []
  const headline = overlay.headline.trim()
  if (headline) {
    layers.push({
      id: "headline",
      text: headline,
      positionX: overlay.positionX,
      positionY: overlay.positionY,
      ...readLayerStyle(overlay, "headline"),
    })
  }
  const subhead = overlay.subhead.trim()
  if (subhead) {
    layers.push({
      id: "subhead",
      text: subhead,
      positionX: overlay.subPositionX ?? overlay.positionX,
      positionY: overlay.subPositionY ?? Math.min(96, overlay.positionY + 8),
      ...readLayerStyle(overlay, "subhead"),
    })
  }
  for (const tag of canvasTagItems(overlay)) {
    layers.push({
      id: tag.id,
      text: tag.text,
      positionX: tag.x,
      positionY: tag.y,
      ...readLayerStyle(overlay, tag.id),
    })
  }
  return layers
}

/** Padding around text on a background block, as a share of font size. */
export const CANVAS_TEXT_BG_PAD_X = 0.35
export const CANVAS_TEXT_BG_PAD_Y = 0.12

/**
 * Customer-facing copy hygiene shared by the pack generator, inventory hooks,
 * and the publish route: clean product titles, no repeated draft fragments,
 * no internal test markers in hashtags, and platform-correct link placement.
 */

export const IG_LINK_CTA = "Tap link in bio to shop."
export const SHOWROOM_CTA = "Try on in our Whangārei showroom today."

const COLOUR_WORDS =
  "black|white|cream|ivory|green|blue|red|pink|brown|navy|beige|grey|gray|olive|burgundy|gold|silver|yellow|orange|purple|tan|khaki|camel|charcoal|mint|lilac|teal|rust|mustard|sage"

const COLOUR_PART = new RegExp(
  `^(?:(?:light|dark|pale|deep|bright)\\s+)?(?:${COLOUR_WORDS})(?:\\s*(?:&|and)\\s*(?:${COLOUR_WORDS}))?$`,
  "i"
)

const FABRIC_PART =
  /^(?:100%\s*)?(?:silk|linen|wool|cashmere|cotton|leather|denim|chiffon|tweed|satin|velvet|knit|polyester|viscose|nylon|suede|lace|merino)(?:\s+blend)?$/i

const GARMENT_WORD =
  /\b(?:skirt|dress|coat|blazer|jeans?|trousers?|pants?|top|shirt|blouse|knit|jumper|sweater|jacket|bag|shoes?|boots?|heels?|slip|tee|hoodie|shorts?|romper|jumpsuit|cardigan|vest|scarf|belt|sandals?|loafers?|tote|clutch|gown|kimono|trench|parka|bodysuit|camisole|corset|culottes)\b/i

const SIZE_PART =
  /^(?:size\s*)?(?:xxs|xs|s|m|l|xl|xxl|xxxl|os|one size|\d{1,2}(?:\/\d{1,2})?|(?:au|nz|uk|us|eu)\s*\d{1,2})$/i

/** Internal catalog / draft markers that must never reach a product title. */
const TITLE_MARKERS: RegExp[] = [
  /[[(]\s*(?:draft|test|internal|wip|sample|tbc|tbd|hold|copy|do not (?:post|publish))[^\])]*[\])]/gi,
  /\btest(?:ing)?(?:\s+(?:item|listing|product|post|upload|drop))?\b/gi,
  /\bsample(?:\s+(?:item|listing|product))?\b/gi,
  /\bsku\s*[:#-]?\s*[a-z0-9][a-z0-9-]*/gi,
  /\b(?:draft|wip|tbc|tbd|placeholder|dummy|internal only|copy of|lorem ipsum|do not (?:post|publish))\b/gi,
  /\b(?:nwt|nwot|bnwt|bnwot|euc|vguc|guc)\b/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /#?\b(?!(?:19|20)\d{2}s?\b)(?=[a-z0-9-]*\d)[a-z]{0,5}-?\d{4,}[a-z0-9-]*\b/gi,
  /\S+(?:\.{3}|…)(?=\s|$)/g,
]

/** Lighter pass for body copy — keeps legit words like "sample sale" or "taste test". */
const COPY_MARKERS: RegExp[] = [
  /[[(]\s*(?:draft|test|internal|wip|tbc|tbd|hold|do not (?:post|publish))[^\])]*[\])]/gi,
  /\s*[-–—]?\s*\btest\s+(?:item|listing|product|post|upload)\b/gi,
  /\bsku\s*[:#-]?\s*[a-z0-9][a-z0-9-]*/gi,
  /\b(?:lorem ipsum|internal only|do not (?:post|publish))\b/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
]

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
])

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)[^\s)]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:replit\.app|replit\.dev)(?:\/[^\s)]*)?/gi

const CTA_PATTERN =
  /\b(?:link in bio|showroom|in[- ]store|dm to hold|tap to shop|shop now|shop online|book a table|view menu)\b/i

const BANNED_TAG =
  /test(?:item|listing|product|post)|^test|sample|^sku|sku\d|draft|placeholder|dummy|lorem|untitled|copyof/

function cleanSeparators(text: string): string {
  return text
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/(?:\s*[-–—|·•]\s*){2,}/g, " - ")
    .replace(/^\s*[-–—|·•,:;]+\s*|\s*[-–—|·•,:;]+\s*$/g, "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function applyPatterns(text: string, patterns: RegExp[]): string {
  return patterns.reduce((acc, pattern) => acc.replace(pattern, " "), text)
}

/** Remove internal test / SKU / draft markers and tidy the separators left behind. */
export function stripInternalMarkers(text: string): string {
  return cleanSeparators(applyPatterns(text, TITLE_MARKERS))
}

/** Body-copy variant of {@link stripInternalMarkers}. */
export function scrubCopyMarkers(text: string): string {
  return applyPatterns(text, COPY_MARKERS)
    .replace(/(?:\s*[-–—|·•]\s*){2,}/g, " — ")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

/** Title-case lowercase / shouty words; keep intentional casing (COS, H&M, McQueen). */
export function toEditorialCase(text: string): string {
  return text
    .split(" ")
    .map((word, index) => {
      if (!word) return word
      const lower = word.toLowerCase()
      if (index > 0 && SMALL_WORDS.has(lower)) return lower
      const letters = word.replace(/[^a-zāēīōū]/gi, "")
      if (!letters) return word
      const isLower = word === lower
      const isShouty = word === word.toUpperCase() && letters.length > 3
      if (!isLower && !isShouty) return word
      return lower.replace(/(^|-)([a-zāēīōū])/g, (_m, lead: string, ch: string) =>
        `${lead}${ch.toUpperCase()}`
      )
    })
    .join(" ")
}

function dropRepeatedWords(text: string): string {
  return text.replace(/\b([\wāēīōū]+)(?:\s+\1\b)+/gi, "$1")
}

export function sanitizeBrandName(brand: string): string {
  return toEditorialCase(stripInternalMarkers(brand))
}

/**
 * Clean fashion title from a raw catalog title, e.g.
 * "Maxi Skirt - Zara - Test item - Cotton - M - Green" → "Zara Cotton Maxi Skirt in Green".
 */
export function sanitizeItemTitle(
  title: string,
  options: { brand?: string | null } = {}
): string {
  const stripped = stripInternalMarkers(title).replace(/\(\s*size[^)]*\)/gi, "")
  const brand = options.brand ? sanitizeBrandName(options.brand).toLowerCase() : ""
  const parts = stripped
    .split(/\s+[-–—|·•]\s+|\s*[|·•]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  let composed = parts[0] ?? ""
  if (parts.length >= 2) {
    let garment: string | null = null
    let fabric: string | null = null
    let colour: string | null = null
    let brandPart: string | null = null
    const others: string[] = []
    for (const part of parts) {
      if (SIZE_PART.test(part)) continue
      if (!colour && COLOUR_PART.test(part)) colour = part
      else if (!fabric && FABRIC_PART.test(part)) fabric = part
      else if (!garment && GARMENT_WORD.test(part)) garment = part
      else if (!brandPart && (!brand || part.toLowerCase() === brand)) brandPart = part
      else others.push(part)
    }
    composed = [brandPart, ...others, fabric, garment].filter(Boolean).join(" ")
    if (colour && !composed.toLowerCase().includes(colour.toLowerCase())) {
      composed = composed ? `${composed} in ${colour}` : colour
    }
  }

  const result = dropRepeatedWords(toEditorialCase(cleanSeparators(composed)))
  return result || "New arrival"
}

function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9āēīōū]+/gi, "")
}

/** Long numeric / hex tokens (listing IDs), not short years like 1905 or nz2024. */
function isLikelySkuNumericTag(normalized: string): boolean {
  if (/^\d{6,}$/.test(normalized)) return true
  if (/^[0-9a-f]{8,}$/i.test(normalized) && /\d/.test(normalized)) return true
  const digitCount = (normalized.match(/\d/g) ?? []).length
  return (
    normalized.length >= 5 &&
    digitCount >= 5 &&
    digitCount / normalized.length >= 0.85
  )
}

/** False for internal test titles, raw item IDs, and SKU-like tokens. */
export function isCleanHashtag(tag: string, bannedSeeds: string[] = []): boolean {
  const normalized = normalizeTag(tag)
  if (normalized.length < 2 || normalized.length > 30) return false
  if (BANNED_TAG.test(normalized)) return false
  if (isLikelySkuNumericTag(normalized)) return false
  return !bannedSeeds.some((seed) => seed && normalizeTag(seed) === normalized)
}

export function cleanHashtags(
  tags: string[],
  options: { max?: number; bannedSeeds?: string[] } = {}
): string[] {
  const out: string[] = []
  for (const tag of tags) {
    const normalized = normalizeTag(tag)
    if (!normalized || out.includes(normalized)) continue
    if (!isCleanHashtag(normalized, options.bannedSeeds)) continue
    out.push(normalized)
  }
  return out.slice(0, options.max ?? 8)
}

/** Drop banned inline #tags and cap the total so captions stay at 6–8 tags. */
export function scrubInlineHashtags(
  text: string,
  options: { max?: number; bannedSeeds?: string[] } = {}
): string {
  const seen = new Set<string>()
  const max = options.max ?? 8
  return text
    .replace(/#([a-z0-9āēīōū_]+)/gi, (match, tag: string) => {
      const normalized = normalizeTag(tag)
      if (seen.has(normalized) || seen.size >= max) return ""
      if (!isCleanHashtag(normalized, options.bannedSeeds)) return ""
      seen.add(normalized)
      return match
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function sentenceKey(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/#\S+/g, "")
    .replace(/[^a-z0-9āēīōū]+/gi, " ")
    .trim()
}

const HASHTAG_LINE = /^(?:#\S+\s*)+$/

/**
 * Remove repeated sentences and truncated draft fragments (a sentence that is
 * a cut-off prefix of another), keeping paragraph / line structure.
 */
export function dedupeSentences(text: string): string {
  type Unit = { para: number; line: number; text: string; key: string }
  const units: Unit[] = []
  text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .forEach((para, paraIndex) => {
      para.split("\n").forEach((line, lineIndex) => {
        const trimmed = line.trim()
        if (!trimmed) return
        if (HASHTAG_LINE.test(trimmed)) {
          units.push({ para: paraIndex, line: lineIndex, text: trimmed, key: "" })
          return
        }
        for (const sentence of trimmed.split(/(?<=[.!?…])\s+/)) {
          const cleaned = sentence.trim()
          if (cleaned) {
            units.push({
              para: paraIndex,
              line: lineIndex,
              text: cleaned,
              key: sentenceKey(cleaned),
            })
          }
        }
      })
    })

  const seenKeys = new Set<string>()
  const seenTagLines = new Set<string>()
  const kept = units.filter((unit) => {
    if (!unit.key) {
      if (seenTagLines.has(unit.text)) return false
      seenTagLines.add(unit.text)
      return true
    }
    if (seenKeys.has(unit.key)) return false
    const truncatedPrefix =
      unit.key.length >= 15 &&
      units.some(
        (other) =>
          other !== unit &&
          other.key.length > unit.key.length &&
          other.key.startsWith(unit.key)
      )
    if (truncatedPrefix) return false
    seenKeys.add(unit.key)
    return true
  })

  const paragraphs: string[] = []
  let currentPara = -1
  let currentLine = -1
  let lines: string[] = []
  let lineParts: string[] = []
  const flushLine = () => {
    if (lineParts.length) lines.push(lineParts.join(" "))
    lineParts = []
  }
  const flushPara = () => {
    flushLine()
    if (lines.length) paragraphs.push(lines.join("\n"))
    lines = []
  }
  for (const unit of kept) {
    if (unit.para !== currentPara) {
      flushPara()
      currentPara = unit.para
      currentLine = unit.line
    } else if (unit.line !== currentLine) {
      flushLine()
      currentLine = unit.line
    }
    lineParts.push(unit.text)
  }
  flushPara()
  return paragraphs.join("\n\n")
}

/** Join headline + body without echoing the headline when the body already says it. */
export function composeCaption(
  headline: string | null | undefined,
  body: string | null | undefined
): string {
  const head = headline?.trim() ?? ""
  const main = body?.trim() ?? ""
  if (!head) return dedupeSentences(main)
  if (!main) return dedupeSentences(head)
  const headKey = sentenceKey(head)
  if (headKey && sentenceKey(main).includes(headKey)) return dedupeSentences(main)
  return dedupeSentences(`${head}\n\n${main}`)
}

export function stripBareUrls(text: string): string {
  return text
    .replace(
      /\b(?:shop(?: here| now| online| the drop)?|link|tap here|click here|visit|see more)[ \t]*[:→-]?[ \t]*(?=https?:\/\/|www\.)/gi,
      ""
    )
    .replace(URL_PATTERN, "")
    .replace(/[ \t]*[:→]+[ \t]*$/gm, "")
    .replace(
      /^[ \t]*(?:shop(?: here| now| online)?|link|tap here|click here)[ \t]*[:.!]?[ \t]*$/gim,
      ""
    )
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function splitTrailingHashtags(text: string): { body: string; tags: string } {
  const paragraphs = text.split(/\n{2,}/)
  const tagParas: string[] = []
  while (paragraphs.length > 0 && HASHTAG_LINE.test(paragraphs.at(-1)!.trim())) {
    tagParas.unshift(paragraphs.pop()!.trim())
  }
  return { body: paragraphs.join("\n\n").trim(), tags: tagParas.join("\n\n") }
}

function withTerminalPunctuation(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`
}

export function hasNaturalCta(text: string): boolean {
  return CTA_PATTERN.test(text)
}

export function withNaturalCta(text: string, cta: string = IG_LINK_CTA): string {
  if (hasNaturalCta(text)) return text
  const { body, tags } = splitTrailingHashtags(text)
  const joined = body ? `${withTerminalPunctuation(body)} ${cta}` : cta
  return tags ? `${joined}\n\n${tags}` : joined
}

function insertBeforeHashtags(text: string, line: string): string {
  const { body, tags } = splitTrailingHashtags(text)
  return [body, line, tags].filter(Boolean).join("\n\n")
}

export type CaptionPlatform = "instagram" | "facebook" | "tiktok" | "email"

/**
 * Final caption for a dispatch. Tracking links go only on Facebook / Email;
 * IG Feed + TikTok get a natural CTA instead of a bare URL, and IG Story
 * carries its link in the sticker payload.
 */
export function finalizePlatformCaption(input: {
  caption: string
  platform: CaptionPlatform
  placement?: "feed" | "story"
  shortUrl?: string | null
  cta?: string
  bannedSeeds?: string[]
}): string {
  const text = dedupeSentences(
    scrubInlineHashtags(scrubCopyMarkers(input.caption), {
      bannedSeeds: input.bannedSeeds,
    })
  )

  if (input.platform === "facebook" || input.platform === "email") {
    if (!input.shortUrl || text.includes(input.shortUrl)) return text
    return insertBeforeHashtags(text, input.shortUrl)
  }

  const clean = stripBareUrls(text)
  if (input.platform === "instagram" && input.placement === "story") return clean
  return withNaturalCta(clean, input.cta ?? IG_LINK_CTA)
}

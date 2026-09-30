import {
  pickDefaultVibeTag,
  resolveIndustryProfile,
} from "@/lib/brands/industry-templates"
import {
  sanitizeBrandName,
  scrubCopyMarkers,
  stripInternalMarkers,
  toEditorialCase,
} from "@/lib/copy/caption-hygiene"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"

export type ContextHookId = "vibe" | "investment" | "local"

export type ContextHook = {
  id: ContextHookId
  label: string
  hook: string
}

const META_LABEL =
  /\b(Brand|Size|Condition|Material|Colour|Color|Category|Fabric)\s*:\s*/i

const GARMENT_WORD =
  /\b(skirt|dress|coat|blazer|jean|trouser|pant|top|shirt|blouse|knit|jumper|sweater|jacket|bag|shoe|boot|heel|maxi|mini|midi|slip|tee|hoodie|short|romper|jumpsuit)\b/i

const FABRIC_WORD =
  /\b(silk|linen|wool|cashmere|cotton|leather|denim|chiffon|tweed|satin|velvet|ribbed|knit|polyester|viscose|nylon)\b/i

const SIZE_TOKEN = /^(xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,2})$/i

function softCue(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.length < 6) return null
  if (isMetadataDump(trimmed)) return null
  const bite = trimmed.split(/[.!?]/)[0]?.trim() || trimmed
  if (isMetadataDump(bite)) return null
  return bite.slice(0, max).trim() || null
}

function softenFeature(feature: string): string {
  return feature
    .replace(
      /^(fabric|color|colour|cut|silhouette|neckline|ingredient|plating|texture|hardware)\s*:\s*/i,
      ""
    )
    .replace(/^(camera sees|visual details|inspected)\s*:?\s*/i, "")
    .trim()
}

function ensurePeriod(text: string): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[—–·,;:\-]\s*$/, "")
    .trim()
  if (!cleaned) return cleaned
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

/** Catalog sync often dumps "Brand: X · Size: Y · Condition:" into description. */
function isMetadataDump(text: string): boolean {
  const labeled = (text.match(META_LABEL) || []).length
  if (labeled >= 1) return true
  const parts = splitAttrParts(text)
  if (parts.length < 4) return false
  const shortTokens = parts.filter((part) => part.length <= 18).length
  return shortTokens / parts.length >= 0.6
}

function splitAttrParts(text: string): string[] {
  return text
    .split(/\s*[-–—·|,/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function stripLabeledMeta(text: string): string {
  return text
    .replace(
      /\b(Brand|Size|Condition|Material|Colour|Color|Category|Fabric)\s*:\s*[^·\-—|]*/gi,
      ""
    )
    .replace(/\s*[·|]\s*/g, " · ")
    .replace(/(?:\s*[·|]\s*)+/g, " · ")
    .replace(/^\s*[·|.\-–—]+\s*|\s*[·|.\-–—]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function parseLabeledFields(description: string): {
  brand?: string
  size?: string
  condition?: string
  material?: string
  colour?: string
} {
  const out: {
    brand?: string
    size?: string
    condition?: string
    material?: string
    colour?: string
  } = {}
  const patterns: Array<[keyof typeof out, RegExp]> = [
    [
      "brand",
      /\bBrand\s*:\s*(.+?)(?=\s*(?:·|\||\b(?:Size|Condition|Material|Fabric|Colour|Color|Category)\s*:)|$)/i,
    ],
    [
      "size",
      /\bSize\s*:\s*(.+?)(?=\s*(?:·|\||\b(?:Brand|Condition|Material|Fabric|Colour|Color|Category)\s*:)|$)/i,
    ],
    [
      "condition",
      /\bCondition\s*:\s*(.+?)(?=\s*(?:·|\||\b(?:Brand|Size|Material|Fabric|Colour|Color|Category)\s*:)|$)/i,
    ],
    [
      "material",
      /\b(?:Material|Fabric)\s*:\s*(.+?)(?=\s*(?:·|\||\b(?:Brand|Size|Condition|Colour|Color|Category)\s*:)|$)/i,
    ],
    [
      "colour",
      /\b(?:Colour|Color)\s*:\s*(.+?)(?=\s*(?:·|\||\b(?:Brand|Size|Condition|Material|Fabric|Category)\s*:)|$)/i,
    ],
  ]
  for (const [key, pattern] of patterns) {
    const match = description.match(pattern)
    const value = match?.[1]?.replace(/[\s.\-–—·|,;:]+$/g, "").trim()
    if (value) out[key] = value
  }
  return out
}

function normalizeBrand(brand: string): string {
  // Keep hyphenated test/consignor names readable without turning them into em-dash soup.
  return brand.replace(/\s{2,}/g, " ").trim()
}

function cleanProductTitle(title: string, brand: string): string {
  let next = stripLabeledMeta(title)
  const brandLower = brand.toLowerCase()
  if (brandLower && next.toLowerCase().startsWith(brandLower)) {
    next = next.slice(brand.length).replace(/^[\s\-–—:]+/, "").trim()
  }
  if (!isMetadataDump(next)) {
    return next || title.trim()
  }

  const parts = splitAttrParts(next).filter(
    (part) => part.toLowerCase() !== brandLower && !SIZE_TOKEN.test(part)
  )
  const garment = parts.find((part) => GARMENT_WORD.test(part))
  if (garment) return garment
  return parts[0] || title.trim()
}

function pickFabric(
  features: string[],
  description: string,
  labeledMaterial?: string
): string | null {
  if (labeledMaterial?.trim()) return labeledMaterial.trim().toLowerCase()
  const fromFeature = features.find((row) => FABRIC_WORD.test(row))
  if (fromFeature) {
    const match = fromFeature.match(FABRIC_WORD)
    return match?.[0]?.toLowerCase() ?? null
  }
  return description.match(FABRIC_WORD)?.[0]?.toLowerCase() ?? null
}

function pickColour(
  features: string[],
  description: string,
  labeledColour?: string
): string | null {
  if (labeledColour?.trim()) return labeledColour.trim().toLowerCase()
  const parts = splitAttrParts(stripLabeledMeta(description))
  const colourish = parts.find((part) =>
    /^(black|white|cream|ivory|green|blue|red|pink|brown|navy|beige|grey|gray|olive|burgundy|gold|silver|yellow|orange|purple|tan|khaki)$/i.test(
      part
    )
  )
  if (colourish) return colourish.toLowerCase()
  const fromFeature = features.find((row) =>
    /\b(black|white|cream|green|blue|red|pink|navy|beige|grey|gray|olive)\b/i.test(
      row
    )
  )
  return fromFeature?.match(
    /\b(black|white|cream|green|blue|red|pink|navy|beige|grey|gray|olive)\b/i
  )?.[0]?.toLowerCase() ?? null
}

function pickSize(
  description: string,
  title: string,
  labeledSize?: string
): string | null {
  const labeled = labeledSize?.replace(/[\s.\-–—·|,;:]+$/g, "").trim()
  if (labeled) {
    const token = labeled.split(/\s+/)[0] ?? labeled
    return SIZE_TOKEN.test(token) ? token.toUpperCase() : labeled.toUpperCase()
  }
  const fromParts = [...splitAttrParts(title), ...splitAttrParts(description)].find(
    (part) => SIZE_TOKEN.test(part)
  )
  return fromParts ? fromParts.toUpperCase() : null
}

function editorialFeature(
  features: string[],
  visualDescription: string | null | undefined,
  used: Set<string>
): string | null {
  for (const raw of features) {
    const cleaned = softenFeature(raw)
    if (!cleaned || isMetadataDump(cleaned) || overlapsAny(cleaned, used)) {
      continue
    }
    return cleaned
  }
  const visual = softCue(visualDescription, 72)
  if (visual && !overlapsAny(visual, used)) return visual
  return null
}

function overlapsAny(candidate: string, used: Set<string>): boolean {
  const needle = candidate.toLowerCase()
  for (const prior of used) {
    const hay = prior.toLowerCase()
    if (!hay || !needle) continue
    if (hay.includes(needle) || needle.includes(hay)) return true
    // Token overlap for short catalog phrases
    const a = new Set(needle.split(/[^a-z0-9āēīōū]+/i).filter((t) => t.length > 2))
    const b = hay.split(/[^a-z0-9āēīōū]+/i).filter((t) => t.length > 2)
    if (a.size === 0) continue
    const hits = b.filter((t) => a.has(t)).length
    if (hits >= Math.min(2, a.size) && hits / a.size >= 0.6) return true
  }
  return false
}

function joinUnique(parts: Array<string | null | undefined>): string {
  const used = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const cleaned = part?.replace(/\s+/g, " ").trim()
    if (!cleaned) continue
    if (overlapsAny(cleaned, used)) continue
    out.push(cleaned)
    used.add(cleaned)
  }
  return out.join(" ")
}

function productPhrase(input: {
  designer: string
  product: string
  fabric?: string | null
  colour?: string | null
}): string {
  const designer = input.designer.replace(/[\s\-–—]+$/g, "").trim()
  const product = input.product.replace(/^[\s\-–—]+/g, "").trim()
  const fabric = input.fabric?.trim() || null
  const colour = input.colour?.trim() || null

  // Prefer "Designer fabric Product in colour" without reusing dash-separated catalog dumps.
  const core = [designer, fabric, product]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (colour && !core.toLowerCase().includes(colour.toLowerCase())) {
    return `${core} in ${colour}`
  }
  return core
}

/**
 * Three click-to-apply hooks grounded in the garment / brand — never agency jargon.
 * Blends catalog text (title/description) with media-inspection visuals into editorial prose.
 */
export function buildContextAwareHooks(input: {
  item: MarketingEntity
  brandName: string
  industry?: string | null
  vibeCategory?: string | null
  visualDescription?: string | null
  concreteFeatures?: string[] | null
  aestheticTags?: string[] | null
}): ContextHook[] {
  const profile = resolveIndustryProfile({
    name: input.brandName,
    industry: input.industry,
  })

  if (profile.id === "fudi") {
    return buildFudiHooks(input, profile.displayName)
  }

  const labeled = parseLabeledFields(input.item.description ?? "")
  const designer = normalizeBrand(
    sanitizeBrandName(
      labeled.brand?.trim() || input.item.brand?.trim() || input.brandName
    ) || input.brandName
  )
  const rawTitle = stripInternalMarkers(input.item.title.trim())
  const product = cleanProductTitle(rawTitle, designer)
  const description = stripLabeledMeta(
    scrubCopyMarkers(input.item.description?.trim() || "")
  )
  const proseCue = softCue(description, 90)
  const price = formatInventoryPrice(input.item.price)
  const features = (input.concreteFeatures ?? [])
    .map((row) => softenFeature(row))
    .filter(Boolean)
    .filter((row) => !isMetadataDump(row))

  const aesthetic =
    input.vibeCategory?.trim() ||
    input.aestheticTags?.[0]?.trim() ||
    pickDefaultVibeTag(
      profile,
      `${product} ${description} ${input.item.brand ?? ""}`
    ) ||
    profile.contentPillars[0] ||
    "Quiet Luxury"

  const fabric = pickFabric(
    features,
    `${description} ${rawTitle}`,
    labeled.material
  )
  const colour = pickColour(
    features,
    `${description} - ${rawTitle}`,
    labeled.colour
  )
  const size = pickSize(description, rawTitle, labeled.size)
  const usedCore = new Set(
    [designer, product, fabric, colour, size].filter(Boolean) as string[]
  )
  const featureCue = editorialFeature(
    features,
    input.visualDescription,
    usedCore
  )

  const piece = toEditorialCase(
    productPhrase({ designer, product, fabric, colour })
  )
  const sizeBit = size ? `(Size ${size})` : null
  const conditionWord = /\b(pristine|excellent|like new|deadstock|sample)\b/i.test(
    `${rawTitle} ${input.item.description ?? ""} ${labeled.condition ?? ""}`
  )
    ? "Pristine"
    : "Archival"

  const vibeHook = ensurePeriod(
    joinUnique([
      `The ${aesthetic} edit: ${piece}`,
      featureCue ? `— ${featureCue}` : null,
      proseCue && !featureCue ? `— ${proseCue}` : null,
      sizeBit,
    ])
  )

  const investmentHook = ensurePeriod(
    joinUnique([
      `${conditionWord} designer consignment`,
      price !== "—" ? `at ${price}` : "at a fraction of retail",
      `— ${piece}`,
      featureCue && !overlapsAny(featureCue, new Set([piece]))
        ? `· ${featureCue}`
        : null,
      sizeBit,
    ])
  )

  const localHook = ensurePeriod(
    [
      `Just arrived on our Whangārei showroom rack today — ${[piece, sizeBit].filter(Boolean).join(" ")}.`,
      "Try it on in store or shop online",
    ].join(" ")
  )

  return [
    {
      id: "vibe",
      label: "Vibe / Styling Hook",
      hook: scrubAgencyLeak(vibeHook),
    },
    {
      id: "investment",
      label: "Investment Value Hook",
      hook: scrubAgencyLeak(investmentHook),
    },
    {
      id: "local",
      label: "Whangārei Showroom Hook",
      hook: scrubAgencyLeak(localHook),
    },
  ]
}

function buildFudiHooks(
  input: {
    item: MarketingEntity
    brandName: string
    vibeCategory?: string | null
    visualDescription?: string | null
    concreteFeatures?: string[] | null
    aestheticTags?: string[] | null
  },
  brandDisplay: string
): ContextHook[] {
  const title = cleanProductTitle(
    stripInternalMarkers(input.item.title.trim()),
    input.item.brand?.trim() || input.brandName
  )
  const description = stripLabeledMeta(
    scrubCopyMarkers(input.item.description?.trim() || "")
  )
  const textCue = softCue(description, 90)
  const features = (input.concreteFeatures ?? [])
    .map((row) => softenFeature(row))
    .filter(Boolean)
    .filter((row) => !isMetadataDump(row))
  const vibe =
    input.vibeCategory?.trim() ||
    input.aestheticTags?.[0]?.trim() ||
    "Neighborhood Special"
  const dish = title || "tonight's special"
  const used = new Set([dish])
  const plateCue = editorialFeature(
    features,
    input.visualDescription,
    used
  )
  const craftCue =
    features.find((row) => row !== plateCue && !overlapsAny(row, used)) ||
    null

  return [
    {
      id: "vibe",
      label: "Craving / Dish Hook",
      hook: scrubAgencyLeak(
        ensurePeriod(
          joinUnique([
            `${vibe}:`,
            dish,
            plateCue ? `with ${plateCue}` : null,
            textCue ? `— ${textCue}` : null,
          ])
        )
      ),
    },
    {
      id: "investment",
      label: "Weekend Dining Guide",
      hook: scrubAgencyLeak(
        ensurePeriod(
          joinUnique([
            "Your Whangārei weekend shortlist:",
            dish,
            craftCue ? `finished with ${craftCue}` : textCue,
            `— claim it on ${brandDisplay} Tap`,
          ])
        )
      ),
    },
    {
      id: "local",
      label: "Local Eatery Spotlight",
      hook: scrubAgencyLeak(
        ensurePeriod(
          joinUnique([
            "Independent kitchen spotlight:",
            dish,
            plateCue ? `with ${plateCue}` : textCue,
            `Meet the neighbourhood table on ${brandDisplay}`,
          ])
        )
      ),
    },
  ]
}

const AGENCY_LEAK =
  /\b(sartorial|marketplace headache|lowballers?|mad studio|\bmad\b|synergy|funnel|roas|ctr|disruptive|operator|asset pack|multiplexer)\b/gi

const META_VISION_LEAK =
  /\b(camera sees|visual details|inspected|concrete (camera )?features|in the frame)\s*:?\s*/gi

export type ScrubAgencyLeakOptions = {
  /** When false, keep leading/trailing spaces (use while typing in controlled fields). Default true. */
  trim?: boolean
}

export function scrubAgencyLeak(
  text: string,
  options: ScrubAgencyLeakOptions = {}
): string {
  const trim = options.trim !== false
  let out = text
    .replace(AGENCY_LEAK, "")
    .replace(META_VISION_LEAK, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s*[—–]\s*[—–]\s*/g, " — ")
  if (trim) out = out.trim()
  return out
}

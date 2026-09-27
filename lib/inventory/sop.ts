import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"
import {
  pickDefaultVibeTag,
  resolveIndustryProfile,
} from "@/lib/brands/industry-templates"
import {
  sanitizeBrandName,
  sanitizeItemTitle,
  scrubCopyMarkers,
} from "@/lib/copy/caption-hygiene"

export type SopCriterionId =
  | "asset"
  | "pricing"
  | "sizing"
  | "tone"
  | "cta"

export type SopCriterion = {
  id: SopCriterionId
  label: string
  hint: string
  suggestion: string
  passed: boolean
}

export type SopDraft = {
  headline: string
  caption: string
  tags: string[]
}

const BANNED_CLICHES = [
  "check out this",
  "must-have",
  "must have",
  "hurry before it's gone",
  "hurry before its gone",
  "don't miss out",
  "dont miss out",
  "limited time only!!!",
  "omg you need this",
]

const SIZE_SPEC_PATTERN =
  /\b(size|sizes|xs|s\b|m\b|l\b|xl|xxl|fabric|cotton|linen|silk|wool|leather|denim|cashmere|length|fit|measurement|cm|mm)\b/i

const CTA_PATTERN =
  /\b(dm to hold|shop link in bio|link in bio|in[- ]store now|shop now|tap to shop|enquire today|book a fitting|available in store|reserve now|shop here|view menu|fudi tap|book a table)\b/i

export function buildDefaultDraft(
  item: MarketingEntity,
  brandContext?: { brandName?: string; industry?: string | null }
): SopDraft {
  const priceLabel = formatInventoryPrice(item.price)
  const brand =
    (item.brand?.trim() && sanitizeBrandName(item.brand)) || "New arrival"
  const headline = sanitizeItemTitle(item.title, { brand: item.brand }).slice(0, 80)
  const baseDescription = scrubCopyMarkers(item.description?.trim() || "")
  const profile = resolveIndustryProfile({
    name: brandContext?.brandName ?? brand,
    industry: brandContext?.industry,
  })

  if (profile.id === "fudi") {
    const caption = [
      `${headline}.`,
      baseDescription ? baseDescription.slice(0, 140) : null,
      "Neighborhood special — tap FÜDI / View Menu.",
    ]
      .filter(Boolean)
      .join(" ")
    return { headline, caption, tags: [] }
  }

  if (profile.id === "worn_label") {
    const vibe = pickDefaultVibeTag(profile, `${headline} ${baseDescription}`)
    const brandBit = brand.toLowerCase()
    const titleBit = headline
    const titleClean = titleBit.toLowerCase().startsWith(brandBit)
      ? titleBit.slice(brand.length).replace(/^[\s\-–—:]+/, "").trim() || titleBit
      : titleBit
    // Skip catalog metadata dumps (Brand:/Size:/dash piles) in captions.
    const prose =
      baseDescription &&
      !/\b(Brand|Size|Condition|Material)\s*:/i.test(baseDescription) &&
      baseDescription.split(/\s*[-–—·]\s*/).length < 5
        ? baseDescription.slice(0, 120)
        : null
    const caption = [
      vibe ? `${vibe} edit.` : null,
      `${brand} — ${titleClean}.`,
      prose,
      priceLabel !== "—" ? `${priceLabel}.` : null,
      "Shop Here · Worn Label Society • Whangārei.",
    ]
      .filter(Boolean)
      .join(" ")
    return { headline: titleClean.slice(0, 80), caption, tags: [] }
  }

  const caption = [
    headline.toLowerCase().startsWith(brand.toLowerCase())
      ? `${headline}.`
      : `${brand} — ${headline}.`,
    baseDescription ? baseDescription.slice(0, 160) : null,
    priceLabel !== "—" ? `${priceLabel}.` : null,
    "DM to hold or shop link in bio.",
  ]
    .filter(Boolean)
    .join(" ")

  return { headline, caption, tags: [] }
}

export function evaluateSopChecklist(
  item: MarketingEntity,
  draft: SopDraft
): SopCriterion[] {
  const combined = `${item.description ?? ""}\n${draft.headline}\n${draft.caption}`.toLowerCase()
  const priceMentioned =
    item.price != null &&
    item.price > 0 &&
    (combined.includes(String(Math.round(item.price))) ||
      combined.includes(item.price.toFixed(2)) ||
      /\$|nzd|price/i.test(combined))

  const hasBannedCliche = BANNED_CLICHES.some((phrase) =>
    draft.caption.toLowerCase().includes(phrase)
  )

  return [
    {
      id: "asset",
      label: "Image resolution / asset attached",
      hint: "Attach at least one product photo from sync or upload.",
      suggestion: "",
      passed: item.images.length > 0,
    },
    {
      id: "pricing",
      label: "Pricing transparency",
      hint: "Price must be set and referenced in the caption or specs.",
      suggestion:
        item.price != null && item.price > 0
          ? ` ${formatInventoryPrice(item.price)}.`
          : " Add the retail price once it is confirmed.",
      passed: Boolean(item.price && item.price > 0 && priceMentioned),
    },
    {
      id: "sizing",
      label: "Essential sizing & specs",
      hint: "Mention size, fit, or fabric so shoppers know the piece.",
      suggestion: " Available in key sizes — soft fabric, considered fit.",
      passed: SIZE_SPEC_PATTERN.test(combined),
    },
    {
      id: "tone",
      label: "Editorial tone / hook check",
      hint: "Avoid generic clichés like “must-have” or “check out this”.",
      suggestion: "",
      passed: draft.caption.trim().length > 12 && !hasBannedCliche,
    },
    {
      id: "cta",
      label: "Call to action",
      hint: "Include a clear next step (DM to hold, link in bio, in-store now).",
      suggestion: " DM to hold or shop link in bio.",
      passed: CTA_PATTERN.test(draft.caption),
    },
  ]
}

export function isSopValid(criteria: SopCriterion[]): boolean {
  return criteria.every((item) => item.passed)
}

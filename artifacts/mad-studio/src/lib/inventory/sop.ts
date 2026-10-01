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

const FUDI_CAPTION_CTA = "Neighborhood special — tap FÜDI / View Menu."

function appendFudiDefaultCta(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return FUDI_CAPTION_CTA
  if (/neighborhood special/i.test(trimmed)) return trimmed
  return `${trimmed} ${FUDI_CAPTION_CTA}`
}

function captionWordKey(text: string, count = 4): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, count)
    .join(" ")
}

function normalizeHookLead(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .toLowerCase()
}

function peelCaseInsensitiveLead(lead: string, caption: string): string {
  const leadTrim = lead.trim()
  const cap = caption.trim()
  if (!leadTrim || !cap) return cap

  const escaped = leadTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const prefixPattern = new RegExp(`^${escaped}\\s*[.!?,:;\\-–—]*\\s*`, "i")
  if (prefixPattern.test(cap)) {
    return cap.replace(prefixPattern, "").trim()
  }

  const firstMatch = cap.match(/^[^.!?]+[.!?]?/)
  const firstSentence = firstMatch?.[0]?.trim() ?? ""
  if (
    firstSentence &&
    normalizeHookLead(firstSentence) === normalizeHookLead(leadTrim)
  ) {
    return cap.slice(firstSentence.length).replace(/^[\s.!?]+/, "").trim()
  }

  return cap
}

/** Remove a leading hook sentence from caption when it duplicates the Hook field. */
export function stripDuplicateHookFromCaption(
  headline: string,
  caption: string
): string {
  const h = headline.trim()
  let c = caption.trim()
  if (!h || !c) return c

  const leads = [h]
  const afterLabel = h.match(/^[^:]{1,48}:\s*(.+)$/s)?.[1]?.trim()
  if (afterLabel) leads.push(afterLabel)

  for (const lead of leads) {
    const peeled = peelCaseInsensitiveLead(lead, c)
    if (peeled !== c && peeled.length >= 8) return peeled
    if (peeled !== c && peeled.length > 0 && c.length > lead.length + 12) {
      return peeled
    }
  }

  if (isDoubledFudiCaption(h, c)) {
    return peelDoubledFudiLeadIn(h, c)
  }

  return c
}

export function resolveWorkbenchCaptionBody(input: {
  headline: string
  item: MarketingEntity
  fallbackCaption: string
  isFudi: boolean
}): string {
  const headline = input.headline.trim()
  const description = scrubCopyMarkers(input.item.description?.trim() || "")
  const sources = [description, input.fallbackCaption.trim()].filter(Boolean)

  for (const source of sources) {
    let body = stripDuplicateHookFromCaption(headline, source)
    if (input.isFudi) {
      body = appendFudiDefaultCta(body)
    }
    const bodyLead = normalizeHookLead(body)
    const hookLead = normalizeHookLead(headline)
    if (body && bodyLead !== hookLead && body.length >= 8) {
      return body
    }
  }

  const stripped = stripDuplicateHookFromCaption(
    headline,
    input.fallbackCaption.trim()
  )
  return input.isFudi ? appendFudiDefaultCta(stripped) : stripped
}

/** Legacy drafts: hook sentence + same post text repeated (not hook === first line of body). */
function isDoubledFudiCaption(headline: string, caption: string): boolean {
  const h = headline.trim().replace(/\.$/, "")
  const c = caption.trim()
  if (!h || c.length <= h.length + 16) return false

  const leadPattern = new RegExp(
    `^${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\s+`,
    "i"
  )
  if (!leadPattern.test(c)) return false

  const after = c.replace(leadPattern, "").trim()
  const hookKey = captionWordKey(h)
  const afterKey = captionWordKey(after)
  return hookKey.length > 0 && hookKey === afterKey
}

function peelDoubledFudiLeadIn(headline: string, caption: string): string {
  const h = headline.trim().replace(/\.$/, "")
  const c = caption.trim()
  const leadPattern = new RegExp(
    `^${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\s+`,
    "i"
  )
  const peeled = c.replace(leadPattern, "").trim()
  return peeled || c
}

function looksLikePeelMangledCaption(caption: string): boolean {
  const t = caption.trim()
  if (t.length < 8) return false
  return /^[a-z]\s/.test(t) || /^[a-z]{1,2}\sfor\s/i.test(t)
}

/** Avoid mid-word chops in workbench hook fields (legacy `.slice(0, 80)`). */
export function truncateAtWordBoundary(text: string, maxLen: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  const window = trimmed.slice(0, maxLen)
  const lastSpace = window.lastIndexOf(" ")
  if (lastSpace >= Math.floor(maxLen * 0.45)) {
    return window.slice(0, lastSpace).trim()
  }
  return window.trim()
}

function firstSentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  const match = trimmed.match(/^[^.!?]+[.!?]?/)
  return match?.[0]?.trim() ?? trimmed
}

export function workbenchHeadlineFromTitle(
  title: string,
  options: { brand?: string | null; profileId?: string } = {}
): string {
  const sanitized = sanitizeItemTitle(title, { brand: options.brand }).trim()
  if (!sanitized) return ""
  if (options.profileId === "fudi") {
    const hook = firstSentence(sanitized)
    return truncateAtWordBoundary(hook, 160)
  }
  return truncateAtWordBoundary(sanitized, 100)
}

/** Expand hooks saved with an old 80-char mid-word truncate when title has more text. */
export function reconcileFudiWorkbenchHeadline(
  savedHeadline: string,
  item: MarketingEntity
): string {
  const saved = savedHeadline.trim()
  const fresh = workbenchHeadlineFromTitle(item.title, {
    brand: item.brand,
    profileId: "fudi",
  })
  if (!saved || !fresh) return fresh || saved
  const title = sanitizeItemTitle(item.title, { brand: item.brand }).trim()
  if (
    title.length > saved.length &&
    title.toLowerCase().startsWith(saved.toLowerCase().replace(/…$/, ""))
  ) {
    return fresh
  }
  return saved
}

/** Fix legacy doubled captions; recover from a bad peel using catalog description. */
export function repairFudiCaptionDoubling(
  headline: string,
  caption: string,
  fallbackDescription?: string | null
): string {
  let next = stripDuplicateHookFromCaption(headline, caption)
  if (isDoubledFudiCaption(headline, next)) {
    next = peelDoubledFudiLeadIn(headline, next)
  }
  const fallback = fallbackDescription?.trim()
  if (fallback && looksLikePeelMangledCaption(next)) {
    return appendFudiDefaultCta(
      stripDuplicateHookFromCaption(
        headline,
        scrubCopyMarkers(fallback)
      )
    )
  }
  return next
}

export function buildDefaultDraft(
  item: MarketingEntity,
  brandContext?: { brandName?: string; industry?: string | null }
): SopDraft {
  const priceLabel = formatInventoryPrice(item.price)
  const brand =
    (item.brand?.trim() && sanitizeBrandName(item.brand)) || "New arrival"
  const profile = resolveIndustryProfile({
    name: brandContext?.brandName ?? brand,
    industry: brandContext?.industry,
  })
  const headline = workbenchHeadlineFromTitle(item.title, {
    brand: item.brand,
    profileId: profile.id,
  })
  const baseDescription = scrubCopyMarkers(item.description?.trim() || "")

  if (profile.id === "fudi") {
    const caption = appendFudiDefaultCta(
      stripDuplicateHookFromCaption(
        headline,
        baseDescription || `${headline}.`
      )
    )
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
    return {
      headline: truncateAtWordBoundary(titleClean, 100),
      caption,
      tags: [],
    }
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

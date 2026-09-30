import { mergeCaptionWithTags } from "@/lib/inventory/optimization-tags"
import { conciseProductLabel } from "@/lib/marketing/story-presets"
import type { TodayQueueView } from "@/lib/today/queue"

const INTAKE_ID_SEGMENT =
  /^(?:FUDI[-_\s]?[A-Z0-9]+|fudi[-_][\w-]+|partner-[a-f0-9-]+)$/i

/** Remove sync IDs and slug noise from operator-facing titles. */
export function sanitizeFudiDisplayTitle(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim()
  if (!trimmed) return ""

  const segments = trimmed
    .split(/\s*[•·|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !INTAKE_ID_SEGMENT.test(part))

  if (segments.length > 0) {
    return segments.join(" · ")
  }

  return trimmed
    .replace(/\bFUDI[-_\s]?[A-Z0-9]+\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function captionWithoutHeadlineLead(headline: string, body: string): string {
  const h = headline.trim()
  const c = body.trim()
  if (!h || !c) return c
  if (c === h) return ""
  const lead = new RegExp(
    `^${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.?\\s*`,
    "i"
  )
  if (lead.test(c)) return c.replace(lead, "").trim()
  const firstLine = c.split(/\n+/)[0]?.trim() ?? ""
  if (firstLine.toLowerCase() === h.toLowerCase()) {
    return c.split(/\n+/).slice(1).join("\n").trim()
  }
  return c
}

export type TodayLivePostCopy = {
  /** On-screen hook (story / bold feed line). */
  headline: string
  /** Caption body without repeating the hook. */
  captionBody: string
  /** Full post text as published (hook + body + tags). */
  fullCaption: string
  /** Venue or foodie name when present. */
  byline: string | null
}

export function resolveTodayLivePostCopy(
  view: TodayQueueView,
  entityName: string
): TodayLivePostCopy {
  const draft = view.item.copy_draft
  const brand = view.item.brand?.trim() || null

  const rawHeadline =
    draft.headline?.trim() ||
    view.recommendedHook ||
    view.displayTitle ||
    view.item.title

  const headline = sanitizeFudiDisplayTitle(
    conciseProductLabel(rawHeadline, brand)
  )

  const rawBody =
    draft.caption?.trim() ||
    view.item.description?.trim() ||
    view.recommendedHook ||
    ""

  const captionBody = sanitizeFudiDisplayTitle(
    captionWithoutHeadlineLead(headline, rawBody)
  )

  const fullCaption =
    mergeCaptionWithTags(
      [headline, captionBody].filter(Boolean).join("\n\n").trim(),
      draft.tags ?? []
    ) || headline

  const byline =
    brand &&
    brand.toLowerCase() !== headline.toLowerCase() &&
    !headline.toLowerCase().includes(brand.toLowerCase())
      ? brand
      : view.isFudi
        ? entityName
        : brand

  return { headline, captionBody, fullCaption, byline }
}

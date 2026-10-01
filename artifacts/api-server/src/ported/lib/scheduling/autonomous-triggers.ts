import type { Json } from "@/lib/database.types"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import type { createAdminClient } from "@/lib/supabase/admin"

export type TriggerEntityRow = {
  id: string
  name: string
  industry: string
}

export type AutonomousTriggerResult = {
  entityId: string
  templateId: string
  created: boolean
  marketingEntityId?: string
  reason?: string
}

type TriggerTemplate = {
  id: string
  slug: "fudi" | "worn-label"
  /** Local NZ hour (0–23) when this template may fire. */
  hour: number
  minute: number
  /** 0 = Sunday … 6 = Saturday; null = any day. */
  weekday: number | null
  title: string
  caption: string
}

const TEMPLATES: TriggerTemplate[] = [
  {
    id: "fudi-lunch-craving",
    slug: "fudi",
    hour: 11,
    minute: 0,
    weekday: null,
    title: "Lunch Craving",
    caption:
      "Midday pull: spotlight one dish or deal that solves lunch now — tight hook, venue tag, and a single CTA to order or book.",
  },
  {
    id: "fudi-knockoff-drinks",
    slug: "fudi",
    hour: 15,
    minute: 30,
    weekday: 5,
    title: "Knock-off Drinks & Specials",
    caption:
      "Friday knock-off: feature happy-hour drinks or end-of-week specials. Lead with motion/sizzle and a reserve-or-walk-in CTA.",
  },
  {
    id: "worn-label-weekend-archive",
    slug: "worn-label",
    hour: 9,
    minute: 0,
    weekday: 6,
    title: "Weekend Archive Edit",
    caption:
      "Saturday archive drop: one hero consignment piece, editorial stills, scarcity framing, and shop-the-look CTA for IG Story.",
  },
]

function resolveTriggerSlug(entity: TriggerEntityRow): string | null {
  const profile = resolveIndustryProfile({
    name: entity.name,
    industry: entity.industry,
  })
  if (profile.id === "fudi") return "fudi"
  if (profile.id === "worn_label") return "worn-label"
  return null
}

function nzLocalParts(now: Date): {
  hour: number
  minute: number
  weekday: number
  dayKey: string
} {
  const formatter = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0"
  const hour = Number(read("hour"))
  const minute = Number(read("minute"))
  const weekdayShort = read("weekday").toLowerCase()
  const weekdayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  }
  const weekday = weekdayMap[weekdayShort.slice(0, 3)] ?? now.getDay()
  const dayKey = `${read("year")}-${read("month")}-${read("day")}`
  return { hour, minute, weekday, dayKey }
}

function templateMatchesNow(template: TriggerTemplate, now: Date): boolean {
  const local = nzLocalParts(now)
  if (local.hour !== template.hour || local.minute !== template.minute) {
    return false
  }
  if (template.weekday != null && template.weekday !== local.weekday) {
    return false
  }
  return true
}

async function alreadyQueuedToday(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  templateId: string,
  dayKey: string
): Promise<boolean> {
  const websiteItemId = `auto-trigger-${templateId}-${dayKey}`
  const { data } = await admin
    .from("marketing_entities")
    .select("id")
    .eq("entity_id", entityId)
    .eq("website_item_id", websiteItemId)
    .maybeSingle()
  return Boolean(data?.id)
}

export async function runAutonomousTriggers(input: {
  admin: ReturnType<typeof createAdminClient>
  now?: Date
}): Promise<AutonomousTriggerResult[]> {
  const now = input.now ?? new Date()
  const local = nzLocalParts(now)

  const { data: entities, error } = await input.admin
    .from("entities")
    .select("id, name, industry")

  if (error) {
    throw new Error(error.message)
  }

  const results: AutonomousTriggerResult[] = []

  for (const entity of entities ?? []) {
    const slug = resolveTriggerSlug(entity)
    if (!slug) continue

    for (const template of TEMPLATES.filter((row) => row.slug === slug)) {
      if (!templateMatchesNow(template, now)) continue

      const websiteItemId = `auto-trigger-${template.id}-${local.dayKey}`
      const exists = await alreadyQueuedToday(
        input.admin,
        entity.id,
        template.id,
        local.dayKey
      )
      if (exists) {
        results.push({
          entityId: entity.id,
          templateId: template.id,
          created: false,
          reason: "already_queued_today",
        })
        continue
      }

      const copyDraft = {
        headline: template.title,
        caption: template.caption,
        metadata: {
          origin: "auto_trigger",
          auto_template: template.id,
        },
      } satisfies Record<string, unknown>

      const { data: row, error: insertError } = await input.admin
        .from("marketing_entities")
        .insert({
          entity_id: entity.id,
          website_item_id: websiteItemId,
          title: template.title,
          description: template.caption,
          images: [],
          status: "unfeatured",
          copy_draft: copyDraft as Json,
          updated_at: now.toISOString(),
        })
        .select("id")
        .single()

      if (insertError) {
        results.push({
          entityId: entity.id,
          templateId: template.id,
          created: false,
          reason: insertError.message,
        })
        continue
      }

      results.push({
        entityId: entity.id,
        templateId: template.id,
        created: true,
        marketingEntityId: row.id,
      })
    }
  }

  return results
}

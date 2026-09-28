import { z } from "zod"

import { parsePrice } from "@/lib/inventory/types"

export const FUDI_FEED_ITEM_TYPES = [
  "drop",
  "deal",
  "event",
  "marketplace",
] as const

export type FudiFeedItemType = (typeof FUDI_FEED_ITEM_TYPES)[number]

export const fudiFeedItemSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  type: z.enum(FUDI_FEED_ITEM_TYPES),
  title: z.string().min(1).max(500),
  brand: z.string().min(1).max(200),
  description: z.string().max(8000).optional().nullable(),
  price: z.union([z.number(), z.string()]).optional().nullable(),
  images: z.array(z.string().min(1)).max(20).optional().default([]),
  location: z.string().max(500).optional().nullable(),
  target_url: z.string().url().max(2000).optional().nullable(),
})

export const fudiFeedRequestSchema = z.object({
  entity_id: z.string().uuid().optional(),
  entity_slug: z.string().min(1).max(200).optional(),
  item: fudiFeedItemSchema.optional(),
  items: z.array(fudiFeedItemSchema).max(100).optional(),
})

export type FudiFeedItem = z.infer<typeof fudiFeedItemSchema>
export type FudiFeedRequest = z.infer<typeof fudiFeedRequestSchema>

export function fudiFeedWebsiteItemId(item: FudiFeedItem): string {
  const stem =
    item.id ??
    item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48)
  return `fudi-${item.type}-${stem || "item"}`
}

export function fudiFeedCopyDraft(item: FudiFeedItem): Record<string, unknown> {
  return {
    source: "fudi_feed_intake",
    metadata: {
      item_type: item.type,
      location: item.location ?? null,
      target_url: item.target_url ?? null,
    },
  }
}

export function fudiFeedPrice(item: FudiFeedItem): number | null {
  if (item.price == null) return null
  return parsePrice(item.price)
}

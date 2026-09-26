import { HttpResponse } from "@server/http-response"
import { timingSafeEqual } from "crypto"

import {
  parsePrice,
  websiteSyncRequestSchema,
} from "@/lib/inventory/types"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/database.types"

export const runtime = "nodejs"

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractSyncSecret(request: Request): string | null {
  const headerSecret = request.headers.get("x-sync-secret")
  if (headerSecret?.trim()) return headerSecret.trim()

  const auth = request.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  return null
}

export async function POST(request: Request) {
  try {
    const expected = process.env.SYNC_WEBHOOK_SECRET?.trim()
    if (!expected) {
      return HttpResponse.json(
        { error: "SYNC_WEBHOOK_SECRET is not configured." },
        { status: 500 }
      )
    }

    const provided = extractSyncSecret(request)
    if (!provided || !secretsMatch(provided, expected)) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = websiteSyncRequestSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "Invalid sync payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const batch = [
      ...(payload.item ? [payload.item] : []),
      ...(payload.items ?? []),
    ]

    if (batch.length === 0) {
      return HttpResponse.json(
        { error: "Provide item or items to sync." },
        { status: 400 }
      )
    }

    if (!payload.entity_id && !payload.entity_slug) {
      return HttpResponse.json(
        { error: "entity_id or entity_slug is required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    let entityId = payload.entity_id ?? null
    if (!entityId && payload.entity_slug) {
      const slug = payload.entity_slug.trim()
      const { data: byName } = await admin
        .from("entities")
        .select("id")
        .ilike("name", slug)
        .limit(1)
        .maybeSingle()
      entityId = byName?.id ?? null
    }

    if (!entityId) {
      return HttpResponse.json(
        { error: "Brand entity not found for sync target." },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const synced: Array<Record<string, unknown>> = []

    for (const item of batch) {
      const { data: existing } = await admin
        .from("marketing_entities")
        .select("id, status")
        .eq("entity_id", entityId)
        .eq("website_item_id", item.website_item_id)
        .maybeSingle()

      const base = {
        entity_id: entityId,
        website_item_id: item.website_item_id,
        title: item.title,
        brand: item.brand ?? null,
        price: parsePrice(item.price),
        description: item.description ?? null,
        images: item.images ?? [],
        updated_at: now,
      }

      if (existing) {
        const { data, error } = await admin
          .from("marketing_entities")
          .update(base)
          .eq("id", existing.id)
          .select(
            "id, entity_id, website_item_id, title, brand, price, status, images, created_at, updated_at"
          )
          .single()
        if (error) {
          return HttpResponse.json({ error: error.message }, { status: 500 })
        }
        if (data) synced.push(data)
      } else {
        const { data, error } = await admin
          .from("marketing_entities")
          .insert({
            ...base,
            status: "unfeatured",
            metrics: { views: 0, clicks: 0, sales: 0 } as Json,
          })
          .select(
            "id, entity_id, website_item_id, title, brand, price, status, images, created_at, updated_at"
          )
          .single()
        if (error) {
          return HttpResponse.json({ error: error.message }, { status: 500 })
        }
        if (data) synced.push(data)
      }
    }

    return HttpResponse.json({
      ok: true,
      synced: synced.length,
      items: synced,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Website sync failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}

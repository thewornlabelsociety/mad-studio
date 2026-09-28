import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

import {
  fudiFeedCopyDraft,
  fudiFeedPrice,
  fudiFeedRequestSchema,
  fudiFeedWebsiteItemId,
  type FudiFeedItem,
} from "@/lib/inventory/fudi-feed"
import { FUDI_ENTITY_ID } from "@/lib/studio/fudi-platform"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/lib/database.types"

export const runtime = "nodejs"

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractIntakeSecret(request: Request): string | null {
  const headerSecret = request.headers.get("x-fudi-feed-secret")
  if (headerSecret?.trim()) return headerSecret.trim()
  const syncHeader = request.headers.get("x-sync-secret")
  if (syncHeader?.trim()) return syncHeader.trim()
  const auth = request.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  return null
}

async function resolveEntityId(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string | undefined,
  entitySlug: string | undefined
): Promise<string | null> {
  if (entityId) return entityId
  const slug = (entitySlug ?? "fudi").trim()
  const { data: byId } = await admin
    .from("entities")
    .select("id")
    .eq("id", FUDI_ENTITY_ID)
    .maybeSingle()
  if (byId?.id && (slug.toLowerCase() === "fudi" || slug.toLowerCase() === "füdi")) {
    return byId.id
  }
  const { data: byName } = await admin
    .from("entities")
    .select("id")
    .ilike("name", slug)
    .limit(1)
    .maybeSingle()
  return byName?.id ?? null
}

function normalizeImages(images: string[]): string[] {
  return images
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 20)
}

async function upsertFeedItem(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string,
  item: FudiFeedItem,
  now: string
) {
  const websiteItemId = fudiFeedWebsiteItemId(item)
  const base = {
    entity_id: entityId,
    website_item_id: websiteItemId,
    title: item.title.trim(),
    brand: item.brand.trim(),
    price: fudiFeedPrice(item),
    description: item.description?.trim() ?? null,
    images: normalizeImages(item.images ?? []),
    copy_draft: fudiFeedCopyDraft(item) as Json,
    updated_at: now,
  }

  const { data: existing } = await admin
    .from("marketing_entities")
    .select("id, status")
    .eq("entity_id", entityId)
    .eq("website_item_id", websiteItemId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await admin
      .from("marketing_entities")
      .update(base)
      .eq("id", existing.id)
      .select(
        "id, entity_id, website_item_id, title, brand, price, status, images, copy_draft, created_at, updated_at"
      )
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  const { data, error } = await admin
    .from("marketing_entities")
    .insert({
      ...base,
      status: "unfeatured",
      metrics: { views: 0, clicks: 0, sales: 0 } as Json,
      channels: [],
    })
    .select(
      "id, entity_id, website_item_id, title, brand, price, status, images, copy_draft, created_at, updated_at"
    )
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function POST(request: Request) {
  try {
    const expected =
      process.env.FUDI_FEED_WEBHOOK_SECRET?.trim() ??
      process.env.SYNC_WEBHOOK_SECRET?.trim()
    if (!expected) {
      return NextResponse.json(
        { error: "FUDI_FEED_WEBHOOK_SECRET or SYNC_WEBHOOK_SECRET is not configured." },
        { status: 500 }
      )
    }

    const provided = extractIntakeSecret(request)
    if (!provided || !secretsMatch(provided, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = fudiFeedRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid FÜDI feed payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const batch = [
      ...(parsed.data.item ? [parsed.data.item] : []),
      ...(parsed.data.items ?? []),
    ]
    if (batch.length === 0) {
      return NextResponse.json(
        { error: "Provide item or items to ingest." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const entityId = await resolveEntityId(
      admin,
      parsed.data.entity_id,
      parsed.data.entity_slug
    )
    if (!entityId) {
      return NextResponse.json(
        { error: "FÜDI entity not found for intake." },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const synced = []
    for (const item of batch) {
      synced.push(await upsertFeedItem(admin, entityId, item, now))
    }

    return NextResponse.json({
      ok: true,
      entity_id: entityId,
      count: synced.length,
      items: synced,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "FÜDI feed intake failed."
    console.error("[intake/fudi-feed]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

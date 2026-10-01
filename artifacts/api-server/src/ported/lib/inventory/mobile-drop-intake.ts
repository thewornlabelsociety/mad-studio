import { randomUUID } from "crypto"

import type { Json } from "@/lib/database.types"
import type { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

export const mobileDropPayloadSchema = z.object({
  entityId: z.string().uuid(),
  text_caption: z.string().min(1).max(8000),
  media_urls: z.array(z.string().url()).max(12).default([]),
  sender_role: z.string().min(1).max(120).default("field"),
})

export type MobileDropPayload = z.infer<typeof mobileDropPayloadSchema>

function titleFromCaption(caption: string): string {
  const words = caption.trim().split(/\s+/).filter(Boolean).slice(0, 5)
  return words.join(" ") || "Mobile drop"
}

function guessExtension(url: string, contentType: string | null): string {
  if (contentType?.includes("video/mp4")) return "mp4"
  if (contentType?.includes("image/png")) return "png"
  if (contentType?.includes("image/webp")) return "webp"
  if (contentType?.includes("image/jpeg")) return "jpg"
  const pathMatch = url.match(/\.([a-z0-9]{2,4})(?:\?|$)/i)
  if (pathMatch) return pathMatch[1].toLowerCase()
  return "jpg"
}

async function downloadMedia(url: string): Promise<{
  buffer: Buffer
  contentType: string
}> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    })
    if (!response.ok) {
      throw new Error(`Media fetch failed (${response.status}) for ${url}`)
    }
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream"
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 20 * 1024 * 1024) {
      throw new Error("Incoming media exceeds 20MB limit.")
    }
    return { buffer, contentType }
  } finally {
    clearTimeout(timeout)
  }
}

export async function ingestMobileDrop(
  admin: ReturnType<typeof createAdminClient>,
  payload: MobileDropPayload
): Promise<{ id: string; website_item_id: string; images: string[] }> {
  const { entityId, text_caption, media_urls, sender_role } = payload
  const now = new Date().toISOString()
  const dropId = randomUUID()
  const websiteItemId = `mobile-drop-${dropId}`

  const storedUrls: string[] = []

  for (let index = 0; index < media_urls.length; index += 1) {
    const sourceUrl = media_urls[index]?.trim()
    if (!sourceUrl) continue
    try {
      const { buffer, contentType } = await downloadMedia(sourceUrl)
      const ext = guessExtension(sourceUrl, contentType)
      const path = `mobile-drops/${entityId}/${Date.now()}-${index}.${ext}`
      const { error: uploadError } = await admin.storage
        .from("entity-assets")
        .upload(path, buffer, {
          contentType,
          upsert: false,
        })
      if (uploadError) {
        throw new Error(uploadError.message)
      }
      const { data: publicUrl } = admin.storage
        .from("entity-assets")
        .getPublicUrl(path)
      if (publicUrl.publicUrl) storedUrls.push(publicUrl.publicUrl)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Media download failed."
      throw new Error(`Could not ingest media[${index}]: ${message}`)
    }
  }

  const copyDraft = {
    caption: text_caption.trim(),
    headline: titleFromCaption(text_caption),
    metadata: {
      origin: "mobile_drop",
      sender: sender_role.trim(),
    },
  } satisfies Record<string, unknown>

  const { data, error } = await admin
    .from("marketing_entities")
    .insert({
      entity_id: entityId,
      website_item_id: websiteItemId,
      title: titleFromCaption(text_caption),
      description: text_caption.trim(),
      images: storedUrls,
      status: "unfeatured",
      copy_draft: copyDraft as Json,
      updated_at: now,
    })
    .select("id, website_item_id, images")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    id: data.id,
    website_item_id: data.website_item_id,
    images: data.images ?? storedUrls,
  }
}

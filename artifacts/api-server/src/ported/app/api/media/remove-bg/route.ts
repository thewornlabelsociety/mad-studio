import { HttpResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { fetchPublicImage } from "@/lib/media/safe-image-fetch"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  imageUrl: z.string().url(),
  entityId: z.string().uuid(),
  /** Optional marketing entity id for path namespacing */
  itemId: z.string().uuid().optional(),
})

/**
 * Drop near-white / studio-backdrop pixels to transparent.
 * Works well for flat white product photography without an external rembg key.
 */
async function loadSharp() {
  try {
    return (await import("sharp")).default
  } catch (error) {
    throw new Error(
      `Image processor unavailable on server (${error instanceof Error ? error.message : "sharp failed to load"}).`
    )
  }
}

async function removeNearWhiteBackground(input: Buffer): Promise<Buffer> {
  const sharp = await loadSharp()
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = Buffer.from(data)
  const channels = info.channels
  const threshold = 248
  const softness = 18

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const min = Math.min(r, g, b)
    const max = Math.max(r, g, b)
    const chroma = max - min

    // Near-white + low chroma → treat as studio backdrop
    if (min >= threshold - softness && chroma <= 18) {
      const whiteness = (r + g + b) / 3
      const alpha =
        whiteness >= threshold
          ? 0
          : Math.round(
              255 * (1 - (whiteness - (threshold - softness)) / softness)
            )
      pixels[i + 3] = Math.max(0, Math.min(255, alpha))
    }
  }

  return sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer()
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "imageUrl and entityId are required." },
        { status: 400 }
      )
    }

    const { imageUrl, entityId, itemId } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError || !canEdit) {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const source = await fetchPublicImage(imageUrl)
    const pngBuffer = await removeNearWhiteBackground(source.bytes)

    const path = `cutouts/${entityId}/${itemId ?? "item"}/${Date.now()}-cutout.png`
    const { error: uploadError } = await supabase.storage
      .from("entity-assets")
      .upload(path, pngBuffer, {
        contentType: "image/png",
        upsert: false,
      })

    if (uploadError) {
      return HttpResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("entity-assets").getPublicUrl(path)

    return HttpResponse.json({
      transparentUrl: publicUrl,
      mode: "sharp_threshold",
    })
  } catch (error) {
    console.error("[media/remove-bg]", error)
    const message =
      error instanceof Error ? error.message : "Background removal failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}

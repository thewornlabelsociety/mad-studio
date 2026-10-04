import { NextResponse } from "next/server"
import { z } from "zod"

import { prepareVideoForSocialPublish } from "@/lib/social/prepare-publish-video"
import {
  resolveVideoAudioMode,
  videoAudioModeSchema,
} from "@/lib/social/types"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 120

const bodySchema = z.object({
  entityId: z.string().uuid(),
  mediaUrl: z.string().min(1).max(4000),
  videoAudioMode: videoAudioModeSchema.optional(),
  tiktokVideoAudioMode: videoAudioModeSchema.optional(),
  optimizeAudioForTikTok: z.boolean().optional(),
})

/** Prepare a video URL for download or client-side preview (mute / AAC). */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const input = parsed.data
    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: input.entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 })
    }
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const audioMode = resolveVideoAudioMode(input)
    const prepared = await prepareVideoForSocialPublish({
      mediaUrl: input.mediaUrl,
      entityId: input.entityId,
      audioMode,
      optimizeAudioForTikTok: input.optimizeAudioForTikTok ?? false,
    })

    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      url: prepared.url,
      transformed: prepared.transformed,
      note: prepared.note ?? null,
      videoAudioMode: audioMode,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Video preparation failed.",
      },
      { status: 500 }
    )
  }
}

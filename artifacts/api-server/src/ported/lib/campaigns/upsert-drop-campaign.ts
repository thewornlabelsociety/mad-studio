"use server"

import type { Json } from "@/lib/database.types"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "@server/http-response"

export type DropCampaignStatus = "draft" | "scheduled" | "published"

function buildMinimalDropPack(input: {
  title: string
  headline?: string | null
  caption?: string | null
}): CampaignPack {
  const headline = (input.headline || input.title).trim() || "Drop"
  const caption = (input.caption || headline).trim()
  return {
    campaign_title: input.title.slice(0, 120) || headline,
    creative_hooks: {
      vibe_styling: headline,
      investment_condition: caption.slice(0, 160),
      local_instore: `See it in store — ${input.title}`,
    },
    algorithmic_signals: {
      spoken_hook: headline.slice(0, 120),
      on_screen_text: headline.slice(0, 48),
      search_keywords: [input.title, "new arrival", "shop"].map((row) =>
        row.slice(0, 40)
      ),
    },
    short_video_script: {
      hook_visual: "Product hero on clean canvas",
      spoken_lines: [headline, caption.slice(0, 120)],
      b_roll_cues: ["Product hero", "Detail close-up"],
      cta_spoken: "Shop the piece",
    },
    carousel: {
      title: input.title,
      slides: [
        {
          slide_number: 1,
          headline,
          body_text: caption.slice(0, 180),
        },
        {
          slide_number: 2,
          headline: "Details",
          body_text: caption.slice(0, 180),
        },
        {
          slide_number: 3,
          headline: "Shop",
          body_text: "Available now.",
        },
      ],
    },
    seo_caption: {
      caption_body: caption,
      search_optimized_tags: ["newarrival", "shop", "style"],
    },
    email_drop: {
      subject_line: headline.slice(0, 80),
      preview_text: caption.slice(0, 90),
      body_markdown: `## ${headline}\n\n${caption}`,
    },
    b2b_dm: {
      platform: "instagram",
      message_text: `Quick note on ${input.title} — ${headline}`,
    },
  }
}

/**
 * Upsert a campaigns row for an inventory/marketing drop so completed work
 * lands on /campaigns with draft | scheduled | published status.
 */
export async function upsertDropCampaign(input: {
  entityId: string
  marketingEntityId: string
  title: string
  headline?: string | null
  caption?: string | null
  mediaUrl?: string | null
  status: DropCampaignStatus
  scheduledFor?: string | null
  targetGoal?: string | null
}): Promise<{ ok: true; campaignId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data: canEdit, error: accessError } = await supabase.rpc(
    "has_entity_access",
    {
      ent_id: input.entityId,
      allowed_roles: ["entity_manager", "creator"],
    }
  )
  if (accessError) {
    return { ok: false, error: accessError.message }
  }
  if (!canEdit) {
    return { ok: false, error: "You do not have access to this brand." }
  }

  const pack = buildMinimalDropPack({
    title: input.title,
    headline: input.headline,
    caption: input.caption,
  })

  const studioContext = {
    source: "drop",
    marketing_entity_id: input.marketingEntityId,
    event_description: input.caption || input.headline || input.title,
    intent: "Drive Sales",
  }

  const { data: existingRows } = await supabase
    .from("campaigns")
    .select("id, studio_context")
    .eq("entity_id", input.entityId)
    .order("updated_at", { ascending: false })
    .limit(40)

  const existing = (existingRows ?? []).find((row) => {
    const ctx = row.studio_context
    return (
      ctx &&
      typeof ctx === "object" &&
      !Array.isArray(ctx) &&
      (ctx as { marketing_entity_id?: string }).marketing_entity_id ===
        input.marketingEntityId
    )
  })

  const now = new Date().toISOString()
  const payload = {
    entity_id: input.entityId,
    created_by: user.id,
    title: pack.campaign_title,
    target_goal: input.targetGoal?.trim() || "Sell Through Drop",
    target_segment: null as string | null,
    status: input.status,
    media_url: input.mediaUrl ?? null,
    algorithmic_signals: pack.algorithmic_signals as unknown as Json,
    asset_pack: {
      short_video: pack.short_video_script,
      carousel: pack.carousel,
      seo_caption: pack.seo_caption,
      email_drop: pack.email_drop,
      b2b_dm: pack.b2b_dm,
      creative_hooks: pack.creative_hooks,
    } as unknown as Json,
    studio_context: studioContext as unknown as Json,
    scheduled_for:
      input.status === "scheduled" ? input.scheduledFor ?? null : null,
    published_at: input.status === "published" ? now : null,
    updated_at: now,
  }

    if (existing?.id) {
    const { error } = await supabase
      .from("campaigns")
      .update(payload)
      .eq("id", existing.id)
      .eq("entity_id", input.entityId)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/campaigns")
    revalidatePath("/studio")
    revalidatePath("/today")
    return { ok: true, campaignId: existing.id }
  }

  const { data: inserted, error } = await supabase
    .from("campaigns")
    .insert({ ...payload, created_at: now })
    .select("id")
    .single()

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Failed to save campaign." }
  }

  revalidatePath("/campaigns")
  revalidatePath("/studio")
  revalidatePath("/today")

  return { ok: true, campaignId: inserted.id }
}

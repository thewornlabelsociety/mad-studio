"use server"

import { revalidatePath } from "next/cache"

import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import type { Json } from "@/lib/database.types"
import {
  dispatchImmediateRows,
  resolveSlotTimes,
  validateArmSlots,
  type ArmDispatchResult,
} from "@/lib/scheduling/arm-queue"
import type { ChannelSlot, SchedulerChannel } from "@/lib/scheduling/brain-timing"
import { tikTokMediaGuardError } from "@/lib/social/tiktok-media-guard"
import { packPayloadFor } from "@/lib/scheduling/pack-payload"
import { createClient } from "@/lib/supabase/server"

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

async function authorize(entityId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: "You must be signed in." }

  const { data: canEdit, error } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager", "creator"],
  })
  if (error) return { supabase, user, error: error.message }
  if (!canEdit) {
    return {
      supabase,
      user,
      error: "You need creator or manager access to schedule.",
    }
  }
  return { supabase, user, error: null }
}

async function cancelCampaignQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityId: string,
  campaignId: string
) {
  return supabase
    .from("scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("entity_id", entityId)
    .eq("campaign_id", campaignId)
    .is("marketing_entity_id", null)
    .eq("status", "scheduled")
}

/** Confirm & Arm for Studio campaign packs (no inventory item). */
export async function armCampaignMultiChannelDispatch(input: {
  entityId: string
  campaignId: string
  pack: CampaignPack
  slots: ChannelSlot[]
  mediaUrl: string | null
  /**
   * Finished artwork per channel (on-image text baked in, story template
   * rendered), from the review screen. Channels left out use `mediaUrl`.
   */
  mediaByChannel?: Partial<Record<SchedulerChannel, string>> | null
  destinationUrl?: string | null
  slugSeed?: string | null
}): Promise<ActionResult<ArmDispatchResult>> {
  const auth = await authorize(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const nowMs = Date.now()
  const validated = validateArmSlots(input.slots, nowMs)
  if (!validated.ok) return validated
  const slots = validated.slots

  if (!input.mediaUrl || !/^https?:\/\//i.test(input.mediaUrl)) {
    return {
      ok: false,
      error:
        "Arming needs a public https media URL — add or finish uploading media first.",
    }
  }

  const mediaUrl = input.mediaUrl
  const mediaFor = (channel: SchedulerChannel) =>
    input.mediaByChannel?.[channel]?.trim() || mediaUrl
  for (const slot of slots) {
    if (!/^https?:\/\//i.test(mediaFor(slot.channel))) {
      return {
        ok: false,
        error: `Artwork for ${slot.channel} isn't a public https URL — review again.`,
      }
    }
  }

  if (slots.some((slot) => slot.channel === "tiktok")) {
    const tiktokMediaError = tikTokMediaGuardError(mediaFor("tiktok"))
    if (tiktokMediaError) {
      return { ok: false, error: tiktokMediaError }
    }
  }

  const { data: campaign, error: campaignError } = await auth.supabase
    .from("campaigns")
    .select("id")
    .eq("id", input.campaignId)
    .eq("entity_id", input.entityId)
    .maybeSingle()
  if (campaignError || !campaign) {
    return {
      ok: false,
      error: campaignError?.message ?? "Campaign not found for this brand.",
    }
  }

  const nowIso = new Date(nowMs).toISOString()
  const { times, firstScheduledAt } = resolveSlotTimes(slots, nowIso)

  const { error: cancelError } = await cancelCampaignQueue(
    auth.supabase,
    input.entityId,
    input.campaignId
  )
  if (cancelError) {
    return {
      ok: false,
      error: `Publishing queue unavailable: ${cancelError.message}. Apply the scheduled_posts migration.`,
    }
  }

  const base = {
    media_url: input.mediaUrl,
    destination_url: input.destinationUrl ?? null,
    slug_seed: input.slugSeed?.trim() || input.pack.campaign_title,
  }

  const { data: inserted, error: insertError } = await auth.supabase
    .from("scheduled_posts")
    .insert(
      slots.map((slot, index) => ({
        entity_id: input.entityId,
        campaign_id: input.campaignId,
        platform: slot.channel,
        mode: slot.mode,
        status: "scheduled",
        scheduled_time: times[index],
        timing_source: slot.mode === "immediate" ? "immediate" : slot.timingSource,
        demographic_tag: slot.demographicTag.slice(0, 120),
        payload: packPayloadFor(slot.channel, input.pack, {
          ...base,
          media_url: mediaFor(slot.channel),
        }) as Json,
        created_by: auth.user.id,
      }))
    )
    .select("id, mode")

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Failed to write the publishing queue.",
    }
  }

  const { error: updateError } = await auth.supabase
    .from("campaigns")
    .update({
      status: "scheduled",
      scheduled_for: firstScheduledAt ?? nowIso,
      media_url: input.mediaUrl,
      updated_at: nowIso,
    })
    .eq("id", input.campaignId)
    .eq("entity_id", input.entityId)

  if (updateError) {
    await cancelCampaignQueue(auth.supabase, input.entityId, input.campaignId)
    return { ok: false, error: updateError.message }
  }

  const immediateIds = inserted
    .filter((row) => row.mode === "immediate")
    .map((row) => row.id)
  const immediate = await dispatchImmediateRows(immediateIds)

  revalidatePath("/studio")
  revalidatePath("/campaigns")

  return {
    ok: true,
    data: {
      campaignId: input.campaignId,
      armed: inserted.length,
      scheduled: inserted.length - immediateIds.length,
      firstScheduledAt,
      immediate,
    },
  }
}

/** Save Draft from the pack scheduler: disarms any queued channels. */
export async function disarmCampaignQueue(input: {
  entityId: string
  campaignId: string
}): Promise<ActionResult<{ cancelled: boolean }>> {
  const auth = await authorize(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }
  const { error } = await cancelCampaignQueue(
    auth.supabase,
    input.entityId,
    input.campaignId
  )
  return { ok: true, data: { cancelled: !error } }
}

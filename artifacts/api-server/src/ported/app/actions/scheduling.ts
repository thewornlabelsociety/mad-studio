"use server"

import { revalidatePath } from "@server/http-response"

import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import { composeCaption, dedupeSentences } from "@/lib/copy/caption-hygiene"
import type { Json } from "@/lib/database.types"
import { mergeCaptionWithTags } from "@/lib/inventory/optimization-tags"
import {
  dispatchImmediateRows,
  resolveSlotTimes,
  validateArmSlots,
  type ArmDispatchResult,
} from "@/lib/scheduling/arm-queue"
import type { ChannelSlot, SchedulerChannel } from "@/lib/scheduling/brain-timing"
import type { ScheduledPostPayload } from "@/lib/scheduling/process-scheduled-posts"
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

function stripMarkdown(value: string): string {
  return value
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim()
}

function packPayloadFor(
  channel: SchedulerChannel,
  pack: CampaignPack,
  base: Pick<ScheduledPostPayload, "media_url" | "destination_url" | "slug_seed">
): ScheduledPostPayload {
  const socialCaption = mergeCaptionWithTags(
    dedupeSentences(pack.seo_caption.caption_body),
    pack.seo_caption.search_optimized_tags
  )
  if (channel === "email") {
    return {
      ...base,
      title: pack.campaign_title,
      headline: pack.email_drop.subject_line,
      caption: [pack.email_drop.preview_text, stripMarkdown(pack.email_drop.body_markdown)]
        .filter(Boolean)
        .join("\n\n"),
    }
  }
  if (channel === "tiktok") {
    return {
      ...base,
      title: pack.campaign_title,
      headline: pack.algorithmic_signals.on_screen_text,
      caption: composeCaption(pack.algorithmic_signals.spoken_hook, socialCaption),
    }
  }
  return {
    ...base,
    title: pack.campaign_title,
    headline: pack.algorithmic_signals.on_screen_text,
    caption: socialCaption,
  }
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
        payload: packPayloadFor(slot.channel, input.pack, base) as Json,
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

const EDITABLE_QUEUE_STATUSES = ["scheduled", "failed"]
const QUEUE_ROW_COLUMNS =
  "id, campaign_id, marketing_entity_id, platform, mode, status, scheduled_time, published_at, last_error, attempts"

export type QueuePostRow = {
  id: string
  campaign_id: string | null
  marketing_entity_id: string | null
  platform: string
  mode: string
  status: string
  scheduled_time: string
  published_at: string | null
  last_error: string | null
  attempts: number
}

/** Keeps campaigns.scheduled_for / status in step with its remaining queue rows. */
async function syncCampaignSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityId: string,
  campaignId: string | null
) {
  if (!campaignId) return
  const { data: rows } = await supabase
    .from("scheduled_posts")
    .select("status, scheduled_time")
    .eq("entity_id", entityId)
    .eq("campaign_id", campaignId)
    .neq("status", "cancelled")

  const list = rows ?? []
  const active = list
    .filter((row) => row.status === "scheduled" || row.status === "processing")
    .map((row) => row.scheduled_time)
    .sort()
  const anyPublished = list.some((row) => row.status === "published")
  const now = new Date().toISOString()

  if (active.length > 0) {
    await supabase
      .from("campaigns")
      .update({ status: "scheduled", scheduled_for: active[0], updated_at: now })
      .eq("id", campaignId)
      .eq("entity_id", entityId)
      .in("status", ["draft", "scheduled"])
  } else if (!anyPublished) {
    await supabase
      .from("campaigns")
      .update({ status: "draft", scheduled_for: null, updated_at: now })
      .eq("id", campaignId)
      .eq("entity_id", entityId)
      .eq("status", "scheduled")
  }
}

/** Push Now: pulls a queued (or failed) post forward to now and dispatches it. */
export async function pushScheduledPostNow(input: {
  entityId: string
  postId: string
}): Promise<ActionResult<{ post: QueuePostRow; dispatch: ArmDispatchResult["immediate"] }>> {
  const auth = await authorize(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const nowIso = new Date().toISOString()
  const { data: armed, error } = await auth.supabase
    .from("scheduled_posts")
    .update({
      status: "scheduled",
      mode: "immediate",
      timing_source: "immediate",
      scheduled_time: nowIso,
      attempts: 0,
      last_error: null,
      updated_at: nowIso,
    })
    .eq("id", input.postId)
    .eq("entity_id", input.entityId)
    .in("status", EDITABLE_QUEUE_STATUSES)
    .select("id")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!armed) {
    return { ok: false, error: "Only scheduled or failed posts can be pushed now." }
  }

  const dispatch = await dispatchImmediateRows([armed.id])

  const { data: post, error: readError } = await auth.supabase
    .from("scheduled_posts")
    .select(QUEUE_ROW_COLUMNS)
    .eq("id", armed.id)
    .single()
  if (readError || !post) {
    return { ok: false, error: readError?.message ?? "Post vanished after dispatch." }
  }

  await syncCampaignSchedule(auth.supabase, input.entityId, post.campaign_id)
  revalidatePath("/campaigns")
  return { ok: true, data: { post, dispatch } }
}

export async function rescheduleScheduledPost(input: {
  entityId: string
  postId: string
  scheduledTime: string
}): Promise<ActionResult<{ post: QueuePostRow }>> {
  const auth = await authorize(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const when = new Date(input.scheduledTime)
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: "Pick a valid date and time." }
  }
  if (when.getTime() < Date.now() + 60_000) {
    return { ok: false, error: "Pick a time at least a minute from now, or use Push Now." }
  }

  const { data: post, error } = await auth.supabase
    .from("scheduled_posts")
    .update({
      status: "scheduled",
      mode: "scheduled",
      timing_source: "manual",
      scheduled_time: when.toISOString(),
      attempts: 0,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.postId)
    .eq("entity_id", input.entityId)
    .in("status", EDITABLE_QUEUE_STATUSES)
    .select(QUEUE_ROW_COLUMNS)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!post) {
    return { ok: false, error: "Only scheduled or failed posts can be rescheduled." }
  }

  await syncCampaignSchedule(auth.supabase, input.entityId, post.campaign_id)
  revalidatePath("/campaigns")
  return { ok: true, data: { post } }
}

/** Cancels a queued post; the row is kept (status cancelled) for the audit trail. */
export async function cancelScheduledPost(input: {
  entityId: string
  postId: string
}): Promise<ActionResult<{ post: QueuePostRow }>> {
  const auth = await authorize(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: post, error } = await auth.supabase
    .from("scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", input.postId)
    .eq("entity_id", input.entityId)
    .in("status", EDITABLE_QUEUE_STATUSES)
    .select(QUEUE_ROW_COLUMNS)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!post) {
    return { ok: false, error: "Only scheduled or failed posts can be cancelled." }
  }

  await syncCampaignSchedule(auth.supabase, input.entityId, post.campaign_id)
  revalidatePath("/campaigns")
  return { ok: true, data: { post } }
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

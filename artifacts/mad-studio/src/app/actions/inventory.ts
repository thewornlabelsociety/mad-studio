"use server"

import { revalidatePath } from "next/cache"

import type { Json } from "@/lib/database.types"
import { upsertDropCampaign } from "@/lib/campaigns/upsert-drop-campaign"
import { mergeCaptionWithTags } from "@/lib/inventory/optimization-tags"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import {
  dispatchImmediateRows,
  resolveSlotTimes,
  validateArmSlots,
  type ArmDispatchResult,
} from "@/lib/scheduling/arm-queue"
import { CHANNEL_META, type ChannelSlot } from "@/lib/scheduling/brain-timing"
import { tikTokMediaGuardError } from "@/lib/social/tiktok-media-guard"
import type { ScheduledPostPayload } from "@/lib/scheduling/process-scheduled-posts"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type InventoryActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function assertCanEdit(entityId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null as null, error: "You must be signed in." }
  }

  const { data: canEdit, error } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager", "creator"],
  })

  if (error) {
    return { supabase, user, error: error.message }
  }

  if (!canEdit) {
    return {
      supabase,
      user,
      error: "You need creator or manager access to edit inventory.",
    }
  }

  return { supabase, user, error: null as null }
}

type SessionClient = Awaited<ReturnType<typeof createClient>>

async function cancelPendingQueueRows(
  supabase: SessionClient,
  entityId: string,
  itemId: string
) {
  return supabase
    .from("scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("entity_id", entityId)
    .eq("marketing_entity_id", itemId)
    .eq("status", "scheduled")
}

export async function appendInventoryImage(input: {
  entityId: string
  itemId: string
  imageUrl: string
}): Promise<InventoryActionResult<{ images: string[] }>> {
  if (!/^https?:\/\//i.test(input.imageUrl)) {
    return { ok: false, error: "Image URL must be a public http(s) link." }
  }

  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: row, error: fetchError } = await auth.supabase
    .from("marketing_entities")
    .select("id, images")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Inventory item not found." }
  }

  const existing = Array.isArray(row.images) ? row.images : []
  if (existing.includes(input.imageUrl)) {
    return { ok: true, data: { images: existing } }
  }

  const images = [...existing, input.imageUrl]
  const { data: updated, error } = await auth.supabase
    .from("marketing_entities")
    .update({
      images,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .select("images")
    .single()

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Failed to save image." }
  }

  revalidatePath(`/inventory/${input.itemId}`)
  revalidatePath("/inventory")
  return { ok: true, data: { images: updated.images ?? images } }
}

export async function removeInventoryImage(input: {
  entityId: string
  itemId: string
  imageUrl: string
}): Promise<InventoryActionResult<{ images: string[] }>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: row, error: fetchError } = await auth.supabase
    .from("marketing_entities")
    .select("id, images")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Inventory item not found." }
  }

  const images = (Array.isArray(row.images) ? row.images : []).filter(
    (url) => url !== input.imageUrl
  )

  const { data: updated, error } = await auth.supabase
    .from("marketing_entities")
    .update({
      images,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .select("images")
    .single()

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Failed to remove image." }
  }

  revalidatePath(`/inventory/${input.itemId}`)
  revalidatePath("/inventory")
  return { ok: true, data: { images: updated.images ?? images } }
}

/** Remove an unfeatured intake row from MAD Studio (does not delete anything in FÜDI). */
export async function removeInventoryItem(input: {
  entityId: string
  itemId: string
}): Promise<InventoryActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: row, error: fetchError } = await auth.supabase
    .from("marketing_entities")
    .select("id, status, title")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Inventory item not found." }
  }

  if (row.status !== "unfeatured") {
    return {
      ok: false,
      error:
        "Only unfeatured intake items can be removed. Scheduled or published drops must stay in the ledger.",
    }
  }

  await cancelPendingQueueRows(auth.supabase, input.entityId, input.itemId)

  const admin = createAdminClient()
  const { error: deleteError } = await admin
    .from("marketing_entities")
    .delete()
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .eq("status", "unfeatured")

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  await auth.supabase.from("activity_logs").insert({
    entity_id: input.entityId,
    user_id: auth.user.id,
    action: "removed_inventory_item",
    details: { item_id: input.itemId, title: row.title },
  })

  revalidatePath("/today")
  revalidatePath("/inventory")
  revalidatePath("/studio")
  return { ok: true, data: undefined }
}

export async function approveMarketingEntity(input: {
  entityId: string
  itemId: string
}): Promise<InventoryActionResult<{ status: string }>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: row, error: fetchError } = await auth.supabase
    .from("marketing_entities")
    .select("id, status")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Inventory item not found." }
  }

  if (row.status === "scheduled" || row.status === "published") {
    return {
      ok: false,
      error: "This item is already beyond approval — open the scheduler instead.",
    }
  }

  const { data: updated, error } = await auth.supabase
    .from("marketing_entities")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .select("status")
    .single()

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Failed to approve item." }
  }

  revalidatePath("/studio")
  revalidatePath("/today")
  revalidatePath("/campaigns")
  return { ok: true, data: { status: updated.status } }
}

export async function scheduleMarketingEntity(input: {
  entityId: string
  itemId: string
  scheduledAt: string
  channels: string[]
  copyDraft?: {
    headline?: string
    caption?: string
    tags?: string[]
    platform?: "feed" | "story" | "email"
    media_url?: string
    placement?: "feed" | "story"
  }
}): Promise<
  InventoryActionResult<{
    status: string
    scheduled_at: string
    channels: string[]
    nextUnfeaturedId: string | null
    campaignId: string | null
  }>
> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  if (!input.scheduledAt || Number.isNaN(Date.parse(input.scheduledAt))) {
    return { ok: false, error: "Pick a valid schedule time." }
  }

  const when = new Date(input.scheduledAt)
  if (when.getTime() < Date.now() - 30_000) {
    return {
      ok: false,
      error: "Pick a time in the future — or use Dispatch now instead.",
    }
  }

  if (!input.channels.length) {
    return { ok: false, error: "Select at least one destination channel." }
  }

  const { data: row, error: fetchError } = await auth.supabase
    .from("marketing_entities")
    .select("id, status, title, images, copy_draft")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Inventory item not found." }
  }

  if (
    row.status !== "approved" &&
    row.status !== "scheduled" &&
    row.status !== "draft" &&
    row.status !== "unfeatured"
  ) {
    return {
      ok: false,
      error: "Approve the piece before scheduling it.",
    }
  }

  const existingDraft =
    row.copy_draft &&
    typeof row.copy_draft === "object" &&
    !Array.isArray(row.copy_draft)
      ? (row.copy_draft as Record<string, unknown>)
      : {}

  const mediaFromImages = Array.isArray(row.images)
    ? row.images.find(
        (url) => typeof url === "string" && /^https?:\/\//i.test(url)
      )
    : null

  const nextDraft: Json = {
    ...existingDraft,
    headline:
      input.copyDraft?.headline ??
      (typeof existingDraft.headline === "string"
        ? existingDraft.headline
        : null),
    caption:
      input.copyDraft?.caption ??
      (typeof existingDraft.caption === "string" ? existingDraft.caption : null),
    tags:
      input.copyDraft?.tags ??
      (Array.isArray(existingDraft.tags) ? existingDraft.tags : null),
    platform:
      input.copyDraft?.platform ??
      (typeof existingDraft.platform === "string"
        ? existingDraft.platform
        : null),
    placement:
      input.copyDraft?.placement ??
      (typeof existingDraft.placement === "string"
        ? existingDraft.placement
        : null),
    media_url:
      input.copyDraft?.media_url ||
      (typeof existingDraft.media_url === "string"
        ? existingDraft.media_url
        : null) ||
      mediaFromImages ||
      null,
  }

  const lockedMedia =
    typeof nextDraft === "object" &&
    nextDraft &&
    !Array.isArray(nextDraft) &&
    typeof nextDraft.media_url === "string"
      ? nextDraft.media_url
      : null

  if (!lockedMedia || !/^https?:\/\//i.test(lockedMedia)) {
    return {
      ok: false,
      error:
        "Schedule needs a public https media URL — wait for upload to finish, then try again.",
    }
  }

  const { data: updated, error } = await auth.supabase
    .from("marketing_entities")
    .update({
      status: "scheduled",
      scheduled_at: when.toISOString(),
      channels: input.channels,
      copy_draft: nextDraft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .select("status, scheduled_at, channels")
    .single()

  if (error || !updated || !updated.scheduled_at) {
    return { ok: false, error: error?.message ?? "Failed to schedule drop." }
  }

  const { data: next } = await auth.supabase
    .from("marketing_entities")
    .select("id")
    .eq("entity_id", input.entityId)
    .eq("status", "unfeatured")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  revalidatePath(`/studio`)
  revalidatePath("/today")
  revalidatePath("/campaigns")

  const campaign = await upsertDropCampaign({
    entityId: input.entityId,
    marketingEntityId: input.itemId,
    title: row.title || "Scheduled drop",
    headline:
      typeof nextDraft === "object" &&
      nextDraft &&
      !Array.isArray(nextDraft) &&
      typeof (nextDraft as { headline?: unknown }).headline === "string"
        ? String((nextDraft as { headline: string }).headline)
        : null,
    caption:
      typeof nextDraft === "object" &&
      nextDraft &&
      !Array.isArray(nextDraft) &&
      typeof (nextDraft as { caption?: unknown }).caption === "string"
        ? String((nextDraft as { caption: string }).caption)
        : null,
    mediaUrl: lockedMedia,
    status: "scheduled",
    scheduledFor: updated.scheduled_at,
  })

  return {
    ok: true,
    data: {
      status: updated.status,
      scheduled_at: updated.scheduled_at,
      channels: updated.channels ?? input.channels,
      nextUnfeaturedId: next?.id ?? null,
      campaignId: campaign.ok ? campaign.campaignId : null,
    },
  }
}

export async function saveDropDraft(input: {
  entityId: string
  itemId: string
  copyDraft: {
    headline?: string
    caption?: string
    tags?: string[]
    platform?: "feed" | "story" | "email"
    media_url?: string
    placement?: "feed" | "story"
  }
  /** Channel timings kept on the draft so Step 3 restores them; nothing is queued. */
  dispatchPlan?: ChannelSlot[]
}): Promise<
  InventoryActionResult<{ status: string; campaignId: string | null }>
> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: row, error: fetchError } = await auth.supabase
    .from("marketing_entities")
    .select("id, status, title, images, copy_draft")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Inventory item not found." }
  }

  if (row.status === "published") {
    return { ok: false, error: "This drop is already published." }
  }

  const existingDraft =
    row.copy_draft &&
    typeof row.copy_draft === "object" &&
    !Array.isArray(row.copy_draft)
      ? (row.copy_draft as Record<string, unknown>)
      : {}

  const mediaFromImages = Array.isArray(row.images)
    ? row.images.find(
        (url) => typeof url === "string" && /^https?:\/\//i.test(url)
      )
    : null

  const nextDraft = {
    ...existingDraft,
    dispatch_queue: null,
    dispatch_plan: (input.dispatchPlan ??
      (Array.isArray(existingDraft.dispatch_plan)
        ? existingDraft.dispatch_plan
        : null)) as Json,
    headline:
      input.copyDraft.headline ??
      (typeof existingDraft.headline === "string"
        ? existingDraft.headline
        : null),
    caption:
      input.copyDraft.caption ??
      (typeof existingDraft.caption === "string" ? existingDraft.caption : null),
    tags:
      input.copyDraft.tags ??
      (Array.isArray(existingDraft.tags) ? existingDraft.tags : null),
    platform:
      input.copyDraft.platform ??
      (typeof existingDraft.platform === "string"
        ? existingDraft.platform
        : null),
    placement:
      input.copyDraft.placement ??
      (typeof existingDraft.placement === "string"
        ? existingDraft.placement
        : null),
    media_url:
      input.copyDraft.media_url ||
      (typeof existingDraft.media_url === "string"
        ? existingDraft.media_url
        : null) ||
      (typeof mediaFromImages === "string" ? mediaFromImages : null) ||
      null,
  } as Json

  const { data: updated, error } = await auth.supabase
    .from("marketing_entities")
    .update({
      status: "draft",
      scheduled_at: null,
      copy_draft: nextDraft,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .select("status, title")
    .single()

  if (error || !updated) {
    return { ok: false, error: error?.message ?? "Failed to save draft." }
  }

  await cancelPendingQueueRows(auth.supabase, input.entityId, input.itemId)

  const mediaUrl =
    typeof nextDraft === "object" &&
    nextDraft &&
    !Array.isArray(nextDraft) &&
    typeof (nextDraft as { media_url?: unknown }).media_url === "string"
      ? String((nextDraft as { media_url: string }).media_url)
      : null

  const campaign = await upsertDropCampaign({
    entityId: input.entityId,
    marketingEntityId: input.itemId,
    title: updated.title || "Draft drop",
    headline:
      typeof nextDraft === "object" &&
      nextDraft &&
      !Array.isArray(nextDraft) &&
      typeof (nextDraft as { headline?: unknown }).headline === "string"
        ? String((nextDraft as { headline: string }).headline)
        : null,
    caption:
      typeof nextDraft === "object" &&
      nextDraft &&
      !Array.isArray(nextDraft) &&
      typeof (nextDraft as { caption?: unknown }).caption === "string"
        ? String((nextDraft as { caption: string }).caption)
        : null,
    mediaUrl,
    status: "draft",
  })

  revalidatePath("/studio")
  revalidatePath("/today")
  revalidatePath("/campaigns")

  return {
    ok: true,
    data: {
      status: updated.status,
      campaignId: campaign.ok ? campaign.campaignId : null,
    },
  }
}

/**
 * Confirm & Arm: approves + schedules in one action. Writes one
 * `public.scheduled_posts` row per enabled channel and dispatches Immediate
 * rows right away through /api/social/publish.
 */
export async function armMultiChannelDispatch(input: {
  entityId: string
  itemId: string
  slots: ChannelSlot[]
  slugSeed?: string | null
  copyDraft: {
    headline?: string
    caption?: string
    tags?: string[]
    media_url?: string
    placement?: "feed" | "story"
    platform?: "feed" | "story" | "email"
  }
}): Promise<InventoryActionResult<ArmDispatchResult>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const nowMs = Date.now()
  const validated = validateArmSlots(input.slots, nowMs)
  if (!validated.ok) return validated
  const slots = validated.slots

  const { data: row, error: fetchError } = await auth.supabase
    .from("marketing_entities")
    .select("id, status, title, images, copy_draft, website_item_id")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Inventory item not found." }
  }
  if (row.status === "published") {
    return { ok: false, error: "This drop is already published." }
  }

  const existingDraft =
    row.copy_draft &&
    typeof row.copy_draft === "object" &&
    !Array.isArray(row.copy_draft)
      ? (row.copy_draft as Record<string, unknown>)
      : {}

  const mediaUrl =
    [
      input.copyDraft.media_url,
      typeof existingDraft.media_url === "string"
        ? existingDraft.media_url
        : null,
      ...(Array.isArray(row.images) ? row.images : []),
    ].find(
      (url): url is string =>
        typeof url === "string" && /^https?:\/\//i.test(url)
    ) ?? null

  if (!mediaUrl) {
    return {
      ok: false,
      error:
        "Arming needs a public https media URL — wait for upload to finish, then try again.",
    }
  }

  if (slots.some((slot) => slot.channel === "tiktok")) {
    const tiktokMediaError = tikTokMediaGuardError(mediaUrl)
    if (tiktokMediaError) {
      return { ok: false, error: tiktokMediaError }
    }
  }

  const { data: entity } = await auth.supabase
    .from("entities")
    .select("website_url")
    .eq("id", input.entityId)
    .maybeSingle()

  const headline = input.copyDraft.headline?.trim() || row.title
  const captionBody = input.copyDraft.caption?.trim() || ""
  const tags = input.copyDraft.tags ?? []
  const caption =
    mergeCaptionWithTags(
      [headline, captionBody].filter(Boolean).join("\n\n").trim() || row.title,
      tags
    ) || row.title

  const payload: ScheduledPostPayload = {
    title: row.title,
    headline,
    caption,
    media_url: mediaUrl,
    destination_url: resolveItemDestinationUrl({
      websiteUrl: entity?.website_url ?? null,
      websiteItemId: row.website_item_id,
    }),
    slug_seed: input.slugSeed?.trim() || row.title,
  }

  const nowIso = new Date(nowMs).toISOString()
  const { times: scheduledTimes, firstScheduledAt } = resolveSlotTimes(
    slots,
    nowIso
  )

  const { error: cancelError } = await cancelPendingQueueRows(
    auth.supabase,
    input.entityId,
    input.itemId
  )
  if (cancelError) {
    return {
      ok: false,
      error: `Publishing queue unavailable: ${cancelError.message}. Apply the scheduled_posts migration.`,
    }
  }

  const { data: inserted, error: insertError } = await auth.supabase
    .from("scheduled_posts")
    .insert(
      slots.map((slot, index) => ({
        entity_id: input.entityId,
        marketing_entity_id: input.itemId,
        platform: slot.channel,
        mode: slot.mode,
        status: "scheduled",
        scheduled_time: scheduledTimes[index],
        timing_source: slot.mode === "immediate" ? "immediate" : slot.timingSource,
        demographic_tag: slot.demographicTag.slice(0, 120),
        payload: payload as Json,
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

  const channels = Array.from(
    new Set(slots.map((slot) => CHANNEL_META[slot.channel].dispatchChannel))
  )
  const nextDraft = {
    ...existingDraft,
    headline,
    caption: captionBody,
    tags,
    media_url: mediaUrl,
    placement: input.copyDraft.placement ?? existingDraft.placement ?? null,
    platform: input.copyDraft.platform ?? existingDraft.platform ?? null,
    dispatch_queue: "scheduled_posts",
    dispatch_plan: slots,
    _dispatch_claim_at: null,
  } as Json

  const { error: updateError } = await auth.supabase
    .from("marketing_entities")
    .update({
      status: "scheduled",
      scheduled_at: firstScheduledAt ?? nowIso,
      channels,
      copy_draft: nextDraft,
      updated_at: nowIso,
    })
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)

  if (updateError) {
    await cancelPendingQueueRows(auth.supabase, input.entityId, input.itemId)
    return { ok: false, error: updateError.message }
  }

  const campaign = await upsertDropCampaign({
    entityId: input.entityId,
    marketingEntityId: input.itemId,
    title: row.title || "Scheduled drop",
    headline,
    caption,
    mediaUrl,
    status: "scheduled",
    scheduledFor: firstScheduledAt ?? nowIso,
  })
  const campaignId = campaign.ok ? campaign.campaignId : null

  if (campaignId) {
    await auth.supabase
      .from("scheduled_posts")
      .update({ campaign_id: campaignId })
      .in(
        "id",
        inserted.map((entry) => entry.id)
      )
  }

  const immediateIds = inserted
    .filter((entry) => entry.mode === "immediate")
    .map((entry) => entry.id)

  const immediate = await dispatchImmediateRows(immediateIds)

  revalidatePath("/studio")
  revalidatePath("/today")
  revalidatePath("/campaigns")

  return {
    ok: true,
    data: {
      campaignId,
      armed: inserted.length,
      scheduled: inserted.length - immediateIds.length,
      firstScheduledAt,
      immediate,
    },
  }
}

export async function repurposeMarketingEntity(input: {
  entityId: string
  sourceItemId: string
  targetItemId?: string
}): Promise<InventoryActionResult<{ targetId: string }>> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: source, error: sourceError } = await auth.supabase
    .from("marketing_entities")
    .select("id, copy_draft, title, status")
    .eq("id", input.sourceItemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (sourceError || !source) {
    return {
      ok: false,
      error: sourceError?.message ?? "Source drop not found.",
    }
  }

  let targetId = input.targetItemId ?? null
  if (!targetId) {
    const { data: next } = await auth.supabase
      .from("marketing_entities")
      .select("id")
      .eq("entity_id", input.entityId)
      .in("status", ["unfeatured", "draft"])
      .neq("id", input.sourceItemId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    targetId = next?.id ?? null
  }

  if (!targetId) {
    return {
      ok: false,
      error: "No unfeatured stock ready to receive this playbook. Sync new inventory first.",
    }
  }

  const copyDraft =
    source.copy_draft && typeof source.copy_draft === "object"
      ? source.copy_draft
      : {
          headline: source.title,
          caption: `Re-drop angle from ${source.title}. DM to hold or shop link in bio.`,
        }

  const { error } = await auth.supabase
    .from("marketing_entities")
    .update({
      copy_draft: copyDraft,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetId)
    .eq("entity_id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath(`/inventory/${targetId}`)
  revalidatePath("/inventory")
  return { ok: true, data: { targetId } }
}

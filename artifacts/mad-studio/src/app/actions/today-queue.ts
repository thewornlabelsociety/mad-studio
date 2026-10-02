"use server"

import { revalidatePath } from "next/cache"

import { approveMarketingEntity } from "@/app/actions/inventory"
import { createClient } from "@/lib/supabase/server"

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

export type TodayQueueActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export async function archiveDailyQueueItem(input: {
  entityId: string
  queueId: string
  itemId: string
}): Promise<TodayQueueActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { error: queueError } = await auth.supabase
    .from("daily_queue")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.queueId)
    .eq("entity_id", input.entityId)

  if (queueError) {
    return { ok: false, error: queueError.message }
  }

  const approved = await approveMarketingEntity({
    entityId: input.entityId,
    itemId: input.itemId,
  })
  if (!approved.ok) {
    return { ok: false, error: approved.error }
  }

  revalidatePath("/today")
  return { ok: true }
}

export async function skipDailyQueueItem(input: {
  entityId: string
  queueId: string
}): Promise<TodayQueueActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { error } = await auth.supabase
    .from("daily_queue")
    .update({
      status: "skipped",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.queueId)
    .eq("entity_id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/today")
  return { ok: true }
}

export async function markDailyQueuePublished(input: {
  entityId: string
  queueId: string
}): Promise<TodayQueueActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { error } = await auth.supabase
    .from("daily_queue")
    .update({
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.queueId)
    .eq("entity_id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/today")
  return { ok: true }
}

export async function updateDailyQueueCopy(input: {
  entityId: string
  queueId: string
  itemId: string
  hook: string
  headline: string
}): Promise<TodayQueueActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const hook = input.hook.trim()
  const headline = input.headline.trim()

  const { data: row } = await auth.supabase
    .from("marketing_entities")
    .select("copy_draft")
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  const existing =
    row?.copy_draft &&
    typeof row.copy_draft === "object" &&
    !Array.isArray(row.copy_draft)
      ? (row.copy_draft as Record<string, unknown>)
      : {}

  const { error: itemError } = await auth.supabase
    .from("marketing_entities")
    .update({
      copy_draft: {
        ...existing,
        headline: headline || existing.headline,
        caption: hook || existing.caption,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("entity_id", input.entityId)

  if (itemError) {
    return { ok: false, error: itemError.message }
  }

  const { error: queueError } = await auth.supabase
    .from("daily_queue")
    .update({
      proposed_hook: hook || null,
      proposed_headline: headline || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.queueId)
    .eq("entity_id", input.entityId)

  if (queueError) {
    return { ok: false, error: queueError.message }
  }

  revalidatePath("/today")
  return { ok: true }
}

"use server"

import { revalidatePath } from "next/cache"

import { approveMarketingEntity } from "@/app/actions/inventory"
import { createClient } from "@/lib/supabase/server"
import {
  isPostgrestMissingRelationError,
  resilientTableUpdate,
} from "@/lib/today/resilient-table-update"
import { persistTodayDeckDismissal } from "@/lib/today/today-deck-dismiss"

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

async function updateDailyQueueStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { entityId: string; queueId: string; status: string }
) {
  const { error, droppedColumns } = await resilientTableUpdate(
    supabase,
    "daily_queue",
    {
      status: input.status,
      updated_at: new Date().toISOString(),
    },
    [
      ["id", input.queueId],
      ["entity_id", input.entityId],
    ]
  )

  if (error) {
    if (isPostgrestMissingRelationError(error)) {
      return { ok: false as const, error: "daily_queue table is not migrated yet." }
    }
    return { ok: false as const, error: error.message ?? "Queue update failed." }
  }

  if (droppedColumns.includes("updated_at")) {
    console.warn("[today-queue] daily_queue.updated_at omitted (schema cache).")
  }

  return { ok: true as const }
}

export async function archiveDailyQueueItem(input: {
  entityId: string
  queueId: string
  itemId: string
}): Promise<TodayQueueActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const dismissMeta = await persistTodayDeckDismissal({
    supabase: auth.supabase,
    entityId: input.entityId,
    itemId: input.itemId,
    status: "archived",
  })
  if (!dismissMeta.ok) {
    return { ok: false, error: dismissMeta.error }
  }

  const queueResult = await updateDailyQueueStatus(auth.supabase, {
    entityId: input.entityId,
    queueId: input.queueId,
    status: "archived",
  })
  if (!queueResult.ok && !queueResult.error.includes("not migrated")) {
    return { ok: false, error: queueResult.error }
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
  itemId: string
}): Promise<TodayQueueActionResult> {
  const auth = await assertCanEdit(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const dismissMeta = await persistTodayDeckDismissal({
    supabase: auth.supabase,
    entityId: input.entityId,
    itemId: input.itemId,
    status: "skipped",
  })
  if (!dismissMeta.ok) {
    return { ok: false, error: dismissMeta.error }
  }

  const queueResult = await updateDailyQueueStatus(auth.supabase, {
    entityId: input.entityId,
    queueId: input.queueId,
    status: "skipped",
  })
  if (!queueResult.ok && !queueResult.error.includes("not migrated")) {
    return { ok: false, error: queueResult.error }
  }

  revalidatePath("/today")
  revalidatePath("/inventory")
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

  const queueResult = await updateDailyQueueStatus(auth.supabase, {
    entityId: input.entityId,
    queueId: input.queueId,
    status: "published",
  })
  if (!queueResult.ok) {
    return { ok: false, error: queueResult.error }
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

  const { error: itemError, droppedColumns: itemDropped } =
    await resilientTableUpdate(
      auth.supabase,
      "marketing_entities",
      {
        copy_draft: {
          ...existing,
          headline: headline || existing.headline,
          caption: hook || existing.caption,
        },
        updated_at: new Date().toISOString(),
      },
      [
        ["id", input.itemId],
        ["entity_id", input.entityId],
      ]
    )

  if (itemError) {
    return {
      ok: false,
      error: itemError.message ?? "Could not save copy on marketing item.",
    }
  }

  if (itemDropped.includes("updated_at")) {
    console.warn(
      "[today-queue] marketing_entities.updated_at omitted (schema cache)."
    )
  }

  const { error: queueError, droppedColumns: queueDropped } =
    await resilientTableUpdate(
      auth.supabase,
      "daily_queue",
      {
        proposed_hook: hook || null,
        proposed_headline: headline || null,
        updated_at: new Date().toISOString(),
      },
      [
        ["id", input.queueId],
        ["entity_id", input.entityId],
      ]
    )

  if (queueError) {
    console.warn(
      "[today-queue] daily_queue copy mirror skipped:",
      queueError.message ?? "unknown",
      queueDropped.length ? `(dropped: ${queueDropped.join(", ")})` : ""
    )
  }

  if (queueDropped.length > 0) {
    console.warn("[today-queue] daily_queue columns omitted:", queueDropped.join(", "))
  }

  revalidatePath("/today")
  return { ok: true }
}

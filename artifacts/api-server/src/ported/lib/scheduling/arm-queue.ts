import { getInternalApiOrigin } from "@server/request-context"

import {
  CHANNEL_META,
  SCHEDULER_CHANNELS,
  type ChannelSlot,
} from "@/lib/scheduling/brain-timing"
import {
  processScheduledPosts,
  type ProcessScheduledPostsResult,
} from "@/lib/scheduling/process-scheduled-posts"
import {
  resolveCronSecret,
} from "@/lib/social/publish-campaign"

export type ImmediateDispatchResult = ProcessScheduledPostsResult & {
  skippedReason?: string
}

export type ArmDispatchResult = {
  campaignId: string | null
  armed: number
  scheduled: number
  firstScheduledAt: string | null
  immediate: ImmediateDispatchResult
}

/** Dedupes enabled slots and rejects invalid / past scheduled times. */
export function validateArmSlots(
  input: ChannelSlot[],
  nowMs: number = Date.now()
): { ok: true; slots: ChannelSlot[] } | { ok: false; error: string } {
  const seen = new Set<string>()
  const slots = input.filter((slot) => {
    if (!slot.enabled) return false
    if (!(SCHEDULER_CHANNELS as readonly string[]).includes(slot.channel)) {
      return false
    }
    if (seen.has(slot.channel)) return false
    seen.add(slot.channel)
    return true
  })

  if (slots.length === 0) {
    return { ok: false, error: "Select at least one channel to arm." }
  }

  for (const slot of slots) {
    if (slot.mode === "immediate") continue
    const at = Date.parse(slot.scheduledAt)
    if (!Number.isFinite(at)) {
      return {
        ok: false,
        error: `${CHANNEL_META[slot.channel].label}: pick a valid date and time.`,
      }
    }
    if (at < nowMs - 30_000) {
      return {
        ok: false,
        error: `${CHANNEL_META[slot.channel].label} is set in the past — pick a future time or switch it to Immediate.`,
      }
    }
  }

  return { ok: true, slots }
}

export function resolveSlotTimes(slots: ChannelSlot[], nowIso: string) {
  const times = slots.map((slot) =>
    slot.mode === "immediate" ? nowIso : new Date(slot.scheduledAt).toISOString()
  )
  const firstScheduledAt =
    slots
      .map((slot, index) => (slot.mode === "scheduled" ? times[index] : null))
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null
  return { times, firstScheduledAt }
}

function resolveRequestOrigin(): string {
  return getInternalApiOrigin()
}

/** Dispatches freshly armed Immediate rows through /api/social/publish. */
export async function dispatchImmediateRows(
  ids: string[]
): Promise<ImmediateDispatchResult> {
  const empty: ImmediateDispatchResult = {
    processed: 0,
    successes: 0,
    failures: 0,
    errors: [],
  }
  if (ids.length === 0) return empty

  const secret = resolveCronSecret()
  if (!secret) {
    return {
      ...empty,
      skippedReason:
        "CRON_SECRET is not configured — Immediate channels will go out on the next dispatch tick.",
    }
  }

  try {
    return await processScheduledPosts({
      ctx: { origin: await resolveRequestOrigin(), secret },
      ids,
      limit: ids.length,
    })
  } catch (error) {
    return {
      ...empty,
      skippedReason:
        error instanceof Error
          ? `${error.message} — the dispatch worker will retry.`
          : "Immediate dispatch failed — the dispatch worker will retry.",
    }
  }
}

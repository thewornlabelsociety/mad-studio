import type { ChannelSlot, SchedulerChannel } from "@/lib/scheduling/brain-timing"

export type SparkDispatchFeature = "events" | "deals" | "dish_drop"

export function detectSparkDispatchFeature(input: {
  spark?: string | null
  hookId?: string | null
  intentChipId?: string | null
}): SparkDispatchFeature | null {
  const id = input.hookId ?? input.intentChipId
  if (id === "weekend_event" || id === "weekend") return "events"
  if (id === "live_deal") return "deals"
  if (id === "dish_drop" || id === "pantry_maker") return "dish_drop"

  const text = `${input.spark ?? ""}`.toLowerCase()
  if (/\bevent|weekend|tour|ticket|rsvp|lineup\b/.test(text)) return "events"
  if (/\bdish|plated|kitchen|pass drop|fresh dish\b/.test(text)) return "dish_drop"
  if (/\bdeal|mid-?week|perk|special|drop\b/.test(text)) return "deals"
  return null
}

function channelsForFeature(feature: SparkDispatchFeature): SchedulerChannel[] {
  if (feature === "events") return ["instagram_feed", "facebook"]
  return ["tiktok", "instagram_story"]
}

/**
 * Pre-checks dispatch channels when a spark/hook maps to Events vs Deals/Dish Drop.
 */
export function applySparkChannelPreset(
  plan: ChannelSlot[],
  feature: SparkDispatchFeature | null
): ChannelSlot[] {
  if (!feature) return plan
  const enable = new Set(channelsForFeature(feature))
  return plan.map((slot) =>
    enable.has(slot.channel) ? { ...slot, enabled: true } : slot
  )
}

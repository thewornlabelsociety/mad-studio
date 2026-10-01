import type { MarketingEntity } from "@/lib/inventory/types"

export type TodayIntakeBadge = {
  emoji: string
  label: string
}

export function resolveTodayIntakeBadge(
  item: MarketingEntity
): TodayIntakeBadge | null {
  const origin = item.copy_draft?.metadata?.origin?.trim().toLowerCase()
  if (origin === "mobile_drop") {
    return { emoji: "📱", label: "Mobile Drop" }
  }
  if (origin === "auto_trigger") {
    return { emoji: "🤖", label: "Auto-Triggered" }
  }
  return null
}

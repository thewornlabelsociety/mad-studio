import type { MarketingEntity } from "@/lib/inventory/types"

export type TodayIntakeBadge = {
  /** Picks the Lucide icon (see IntakeBadgeIcon); the app never shows emoji. */
  kind: "mobile" | "auto"
  label: string
}

export function resolveTodayIntakeBadge(
  item: MarketingEntity
): TodayIntakeBadge | null {
  const origin = item.copy_draft?.metadata?.origin?.trim().toLowerCase()
  if (origin === "mobile_drop") {
    return { kind: "mobile", label: "Mobile Drop" }
  }
  if (origin === "auto_trigger") {
    return { kind: "auto", label: "Auto-Triggered" }
  }
  return null
}

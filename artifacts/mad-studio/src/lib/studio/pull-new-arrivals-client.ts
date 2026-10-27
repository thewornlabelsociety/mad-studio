/** Fired after a successful website/FÜDI intake pull so Studio can refresh catalog UIs. */
export const INVENTORY_SYNCED_EVENT = "mad-studio:inventory-synced"

export function notifyInventorySynced(entityId: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(INVENTORY_SYNCED_EVENT, { detail: { entityId } })
  )
}

/** Client wrapper for Inventory sync — shared by strip and legacy suggestions. */
export async function pullNewArrivalsForEntityClient(entityId: string): Promise<{
  imported?: number
  updated?: number
  markedUnavailable?: number
}> {
  const response = await fetch("/api/sync/pull-new-arrivals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    imported?: number
    updated?: number
    marked_unavailable?: number
    error?: string
  }
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not sync from the website.")
  }
  notifyInventorySynced(entityId)
  return {
    imported: payload.imported,
    updated: payload.updated,
    markedUnavailable: payload.marked_unavailable,
  }
}

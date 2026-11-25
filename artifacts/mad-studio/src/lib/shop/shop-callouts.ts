import type { WantsItem } from "@/lib/entities/dna-schema"

/** A "Wanted" call-out from the shop feed (see the api-server's lib/shop/shop-callouts.ts). */
export type ShopCallout = {
  id: number
  template: string
  sentAt: string
  title: string
  kicker: string
  headline: string
  headlineAccent: string
  message: string
  items: { label: string; audience: string; typeKey: string }[]
  images: string[]
  links: { book: string; online: string; join: string; shop: string }
  nextDropOff: string | null
  leadOnline: boolean
  caption: string
}

/** Call-outs older than this stop showing on Today. */
export const SHOP_CALLOUT_FRESH_DAYS = 14

export function isFreshCallout(callout: Pick<ShopCallout, "sentAt">, now = new Date()): boolean {
  const sent = Date.parse(callout.sentAt)
  return Number.isFinite(sent) && now.getTime() - sent < SHOP_CALLOUT_FRESH_DAYS * 86_400_000
}

/** The Wants list lines and sign-off for a call-out: one line per type, up to 10. */
export function calloutToWants(callout: ShopCallout): { items: WantsItem[]; note: string } {
  const items = callout.items.slice(0, 10).map((item, index) => ({
    id: `c${callout.id}_${index}`,
    label: item.label.slice(0, 60),
    detail: "",
  }))
  const note = callout.leadOnline ? "List online today, or book a drop-off" : "Book a drop-off, or list online"
  return { items, note }
}

/** Photo URL routed through Mad Studio's image proxy, so baked images can read it. */
export function proxiedCalloutPhoto(url: string, entityId: string): string {
  return `/api/media/image-proxy?url=${encodeURIComponent(url)}&entityId=${encodeURIComponent(entityId)}`
}

export function formatCalloutDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })
}

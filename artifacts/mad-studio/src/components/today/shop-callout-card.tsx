"use client"

import { useEffect, useState } from "react"
import { Link } from "wouter"
import { ArrowRight, Copy, Megaphone } from "lucide-react"
import { toast } from "sonner"

import { getShopCallouts } from "@/lib/actions"
import { formatCalloutDate, isFreshCallout, type ShopCallout } from "@/lib/shop/shop-callouts"
import { cn } from "@/lib/utils"

/**
 * The newest "Wanted" call-out the shop emailed to consignors, ready to become
 * a post and a Story. Hidden when there's no call-out from the last two weeks.
 */
export function ShopCalloutCard({ entityId, className }: { entityId: string; className?: string }) {
  const [callout, setCallout] = useState<ShopCallout | null>(null)

  useEffect(() => {
    let cancelled = false
    getShopCallouts(entityId)
      .then((result: { ok: boolean; data?: { callouts: ShopCallout[] } }) => {
        if (cancelled || !result?.ok) return
        setCallout(result.data?.callouts.find((c) => isFreshCallout(c)) ?? null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [entityId])

  if (!callout) return null

  const href = `/templates/wls-wants?eid=${encodeURIComponent(entityId)}&callout=${callout.id}`

  async function copyCaption() {
    if (!callout) return
    try {
      await navigator.clipboard.writeText(callout.caption)
      toast.success("Caption copied.")
    } catch {
      toast.error("Couldn't copy. Open the call-out and copy it from there.")
    }
  }

  return (
    <section
      aria-labelledby="shop-callout-heading"
      className={cn("grid gap-3 border-2 border-mad-black bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto]", className)}
    >
      <div className="flex min-w-0 items-center gap-3">
        {callout.images.length > 0 ? (
          <div className="flex shrink-0 gap-1">
            {callout.images.slice(0, 3).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-14 w-11 rounded-sm object-cover" />
            ))}
          </div>
        ) : (
          <Megaphone className="size-6 shrink-0" aria-hidden />
        )}
        <div className="min-w-0">
          <h2 id="shop-callout-heading" className="font-typewriter text-xs font-bold uppercase tracking-widest">
            Shop call-out
          </h2>
          <p className="truncate text-sm font-medium">{callout.title}</p>
          <p className="text-xs text-mad-black/60">
            Emailed to consignors {formatCalloutDate(callout.sentAt)}. Turn it into a post and a Story.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyCaption()}
          className="flex items-center gap-1.5 border border-mad-black/40 px-3 py-1.5 text-xs hover:border-mad-black"
        >
          <Copy className="size-3.5" aria-hidden /> Copy caption
        </button>
        <Link
          href={href}
          className="flex items-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 py-1.5 text-xs text-mad-white"
        >
          Make post and Story <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

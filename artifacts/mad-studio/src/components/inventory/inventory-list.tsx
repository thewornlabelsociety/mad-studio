"use client"

import { Link } from "wouter"
import { useRouter } from "@/lib/next-compat"
import { useTransition } from "react"
import { toast } from "sonner"

import { repurposeMarketingEntity } from "@/lib/actions"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  items: MarketingEntity[]
}

const STATUS_TONE: Record<string, string> = {
  unfeatured: "bg-neutral-100 text-neutral-700",
  draft: "bg-white text-neutral-700",
  approved: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-neutral-900 text-white",
  published: "bg-neutral-800 text-white",
}

function RepurposeButton({
  entityId,
  sourceItemId,
}: {
  entityId: string
  sourceItemId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await repurposeMarketingEntity({
            entityId,
            sourceItemId,
          })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Playbook copied into the next draft.")
          router.push(
            `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(result.data.targetId)}`
          )
          router.refresh()
        })
      }}
      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:opacity-60"
    >
      {pending ? "Copying…" : "Repurpose / Re-Drop"}
    </button>
  )
}

export function InventoryList({ entityId, items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-neutral-900">
          No inventory entities yet
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Use{" "}
          <strong className="font-medium">Pull Eatery / App Feed</strong> for FÜDI,
          or POST to{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
            /api/sync/website
          </code>{" "}
          for website catalog sync.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const thumb = item.images[0]
        const isPublished = item.status === "published"
        const isScheduled = item.status === "scheduled"

        return (
          <article
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start gap-4">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt=""
                  className="size-16 rounded-lg border border-neutral-200 object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-[0.65rem] text-neutral-400">
                  No media
                </div>
              )}

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(item.id)}`}
                      className="text-base font-semibold text-neutral-900 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {item.website_item_id}
                      {item.brand ? ` · ${item.brand}` : ""}
                      {" · "}
                      {formatInventoryPrice(item.price)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wide",
                      STATUS_TONE[item.status] ?? STATUS_TONE.unfeatured
                    )}
                  >
                    {item.status}
                  </span>
                </div>

                {(isPublished || isScheduled) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {isPublished ? (
                      <>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                          {item.metrics.views} views
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                          {item.metrics.clicks} clicks
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                          {item.metrics.sales} sales
                        </span>
                        <RepurposeButton
                          entityId={entityId}
                          sourceItemId={item.id}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-neutral-500">
                        Scheduled
                        {item.scheduled_at
                          ? ` · ${new Date(item.scheduled_at).toLocaleString()}`
                          : ""}
                        {item.channels.length
                          ? ` · ${item.channels.join(", ")}`
                          : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

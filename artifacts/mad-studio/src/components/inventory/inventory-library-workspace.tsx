"use client"

import { useEffect, useMemo, useState } from "react"

import { InventoryItemInspector } from "@/components/inventory/inventory-item-inspector"
import {
  StudioDetailDrawer,
  StudioMasterDetailLayout,
} from "@/components/layout/studio-master-detail"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  brandName: string
  websiteUrl?: string | null
  items: MarketingEntity[]
}

const STATUS_DOT: Record<string, string> = {
  unfeatured: "bg-neutral-400",
  draft: "bg-amber-400",
  approved: "bg-emerald-500",
  scheduled: "bg-blue-600",
  published: "bg-neutral-900",
}

export function InventoryLibraryWorkspace({
  entityId,
  brandName,
  websiteUrl = null,
  items,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  )

  useEffect(() => {
    if (!selectedId) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedId])

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(null)
    }
  }, [items, selectedId])

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
        <p className="text-sm font-semibold text-neutral-900">
          No library items yet
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Pull intake from the button above, or sync website catalog via{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
            /api/sync/website
          </code>
          .
        </p>
      </div>
    )
  }

  return (
    <StudioMasterDetailLayout
      detailOpen={Boolean(selected)}
      className="min-h-0 flex-1"
      mainClassName="px-0 pb-6 lg:pr-2"
      main={
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => {
            const thumb = item.images[0]
            const active = item.id === selectedId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setSelectedId((current) =>
                    current === item.id ? null : item.id
                  )
                }
                className={cn(
                  "group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mad-black focus-visible:ring-offset-2",
                  active
                    ? "border-mad-black ring-2 ring-mad-black ring-offset-2"
                    : "border-neutral-200"
                )}
              >
                <div className="relative aspect-square bg-neutral-100">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-[0.65rem] text-neutral-400">
                      No media
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute left-2 top-2 size-2 rounded-full ring-2 ring-white",
                      STATUS_DOT[item.status] ?? STATUS_DOT.unfeatured
                    )}
                    title={item.status}
                  />
                </div>
                <div className="space-y-0.5 p-2.5">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-mad-black">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {formatInventoryPrice(item.price)}
                    {item.status !== "unfeatured"
                      ? ` · ${item.status}`
                      : ""}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      }
      detail={
        selected ? (
          <StudioDetailDrawer
            open
            onClose={() => setSelectedId(null)}
            headerSlot={
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Library item
                </p>
                <p className="truncate text-sm font-semibold text-mad-black">
                  {selected.title}
                </p>
              </div>
            }
          >
            <InventoryItemInspector
              item={selected}
              entityId={entityId}
              brandName={brandName}
              websiteUrl={websiteUrl}
            />
          </StudioDetailDrawer>
        ) : null
      }
    />
  )
}

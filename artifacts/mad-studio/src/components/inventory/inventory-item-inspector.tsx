"use client"

import { Link } from "wouter"
import { ExternalLink } from "lucide-react"

import {
  RepurposeButton,
  RemoveIntakeButton,
} from "@/components/inventory/inventory-list-actions"
import { Button } from "@/components/ui/button"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<string, string> = {
  unfeatured: "bg-neutral-100 text-neutral-700",
  draft: "bg-white text-neutral-700 border border-neutral-200",
  approved: "bg-emerald-50 text-emerald-800",
  scheduled: "bg-neutral-900 text-white",
  published: "bg-neutral-800 text-white",
}

function externalLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes("instagram")) return "Open Instagram"
    if (host.includes("facebook")) return "Open Facebook"
    if (host.includes("tiktok")) return "Open TikTok"
    if (host.includes("fudi")) return "Open FÜDI"
  } catch {
    /* ignore */
  }
  return "Open link"
}

function resolveCaption(item: MarketingEntity): string {
  const draft = item.copy_draft?.caption?.trim()
  if (draft) return draft
  const headline = item.copy_draft?.headline?.trim()
  if (headline && headline !== item.title) {
    return `${headline}\n\n${item.description ?? ""}`.trim()
  }
  return item.description?.trim() || "No caption yet — open in Studio to generate copy."
}

type Props = {
  item: MarketingEntity
  entityId: string
  brandName: string
  websiteUrl?: string | null
}

export function InventoryItemInspector({
  item,
  entityId,
  brandName,
  websiteUrl = null,
}: Props) {
  const thumb = item.images[0]
  const caption = resolveCaption(item)
  const destinationUrl = resolveItemDestinationUrl({
    entityId,
    websiteUrl,
    websiteItemId: item.website_item_id,
    copyDraft: item.copy_draft,
  })

  const studioHref = `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(item.id)}&step=2`

  const views = item.metrics.views ?? 0
  const clicks = item.metrics.clicks ?? 0
  const engagement =
    views > 0 ? `${((clicks / views) * 100).toFixed(2)}%` : null

  const isPublished = item.status === "published"
  const isScheduled = item.status === "scheduled"

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
              STATUS_TONE[item.status] ?? STATUS_TONE.unfeatured
            )}
          >
            {item.status}
          </span>
          {item.channels.length ? (
            <span className="text-xs text-neutral-500">
              {item.channels.join(" · ")}
            </span>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold leading-snug text-mad-black">
          {item.title}
        </h3>
        <p className="text-xs text-neutral-500">
          {brandName}
          {item.brand ? ` · ${item.brand}` : ""}
          {" · "}
          {formatInventoryPrice(item.price)}
        </p>
        <p className="text-[11px] text-neutral-400">
          Intake {new Date(item.created_at).toLocaleString()}
          {item.published_at
            ? ` · Published ${new Date(item.published_at).toLocaleString()}`
            : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="aspect-[4/5] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center text-sm text-neutral-400">
            No media
          </div>
        )}
      </div>

      {(isPublished || isScheduled || views > 0) && (
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 text-sm">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Views
            </dt>
            <dd className="font-semibold tabular-nums text-mad-black">
              {views.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Clicks
            </dt>
            <dd className="font-semibold tabular-nums text-mad-black">
              {clicks.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Sales
            </dt>
            <dd className="font-semibold tabular-nums text-mad-black">
              {item.metrics.sales.toLocaleString()}
            </dd>
          </div>
          {engagement ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Click rate
              </dt>
              <dd className="font-semibold tabular-nums text-mad-black">
                {engagement}
              </dd>
            </div>
          ) : null}
          {isScheduled && item.scheduled_at ? (
            <div className="col-span-2 text-xs text-neutral-600">
              Scheduled {new Date(item.scheduled_at).toLocaleString()}
            </div>
          ) : null}
        </dl>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Caption
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
          {caption}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
        {destinationUrl ? (
          <Button
            asChild
            className="w-full gap-2 rounded-lg bg-mad-black text-mad-white hover:bg-neutral-800"
          >
            <a href={destinationUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              {externalLinkLabel(destinationUrl)}
            </a>
          </Button>
        ) : null}
        <Button
          asChild
          variant="outline"
          className="w-full rounded-lg border-neutral-300"
        >
          <Link href={studioHref}>Open in Studio</Link>
        </Button>
        {item.status === "unfeatured" ? (
          <RemoveIntakeButton
            entityId={entityId}
            itemId={item.id}
            title={item.title}
            className="w-full justify-center"
          />
        ) : null}
        {isPublished ? (
          <RepurposeButton
            entityId={entityId}
            sourceItemId={item.id}
            className="w-full justify-center"
          />
        ) : null}
      </div>
    </div>
  )
}

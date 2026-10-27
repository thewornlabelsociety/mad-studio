"use client"

import { useMemo, useState } from "react"
import { Loader2, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  formatWlsExclusionSummary,
  firstUsableProductImageUrl,
  ownerHintForSoftWarnings,
  ownerLabelForHardBlock,
  WLS_AVAILABILITY_BADGE_LABELS,
  type WlsHardBlockReason,
  type WlsProductSelection,
} from "@/lib/inventory/wls-product-eligibility"
import { pullNewArrivalsForEntityClient } from "@/lib/studio/pull-new-arrivals-client"
import {
  filterWlsStripCatalog,
  WLS_STRIP_FILTER_LABELS,
  type WlsStripCatalogFilter,
} from "@/lib/studio/wls-strip-catalog"
import { suggestFormatForWlsSelection } from "@/lib/studio/wls-strip-format"
import { formatWlsNzdPrice } from "@/lib/templates/format-wls-nzd-price"
import { WLS_DAILY_STORY_STUDIO_MAX_FRAMES } from "@/lib/templates/wls-daily-story-studio-seed"
import { proxiedImageUrl } from "@/lib/studio/final-artwork"
import { cn } from "@/lib/utils"

export type WlsEligibleProductStripProps = {
  entityId: string
  catalog: WlsProductSelection[]
  loading?: boolean
  excludedCount?: number
  selectableCount?: number
  syncedCount?: number | null
  exclusionSummary?: Partial<Record<WlsHardBlockReason, number>>
  storySequenceMode?: boolean
  sequenceMarketingEntityIds: string[]
  activeMarketingEntityId: string | null
  maxFrames?: number
  onRefresh?: () => void
  onNavigateToFrame: (marketingEntityId: string) => void
  onAddToSequence: (selection: WlsProductSelection) => void
  onAddToMedia: (selection: WlsProductSelection) => void
  onRemoveFromSequence: (marketingEntityId: string) => void
  onReplaceActiveFrame: (selection: WlsProductSelection) => void
  disabled?: boolean
}

export function WlsEligibleProductStrip({
  entityId,
  catalog,
  loading = false,
  excludedCount = 0,
  selectableCount = 0,
  syncedCount = null,
  exclusionSummary = {},
  storySequenceMode = false,
  sequenceMarketingEntityIds,
  activeMarketingEntityId,
  maxFrames = WLS_DAILY_STORY_STUDIO_MAX_FRAMES,
  onRefresh,
  onNavigateToFrame,
  onAddToSequence,
  onAddToMedia,
  onRemoveFromSequence,
  onReplaceActiveFrame,
  disabled = false,
}: WlsEligibleProductStripProps) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<WlsStripCatalogFilter>("fresh_drops")
  const [syncing, setSyncing] = useState(false)

  const inSequence = new Set(sequenceMarketingEntityIds)
  const atCapacity = sequenceMarketingEntityIds.length >= maxFrames

  const visible = useMemo(
    () =>
      filterWlsStripCatalog({
        catalog,
        filter,
        searchQuery: search,
      }),
    [catalog, filter, search]
  )

  async function syncFromWebsite() {
    setSyncing(true)
    try {
      const result = await pullNewArrivalsForEntityClient(entityId)
      const parts: string[] = []
      if (result.imported) parts.push(`${result.imported} new`)
      if (result.updated) parts.push(`${result.updated} updated`)
      if (result.markedUnavailable) {
        parts.push(`${result.markedUnavailable} marked unavailable`)
      }
      toast.success(
        parts.length > 0
          ? `Sync complete — ${parts.join(", ")}`
          : "Up to date — catalogue matches the website"
      )
      onRefresh?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not sync from website."
      )
    } finally {
      setSyncing(false)
    }
  }

  function blockExplanation(row: WlsProductSelection): string | null {
    if (storySequenceMode) {
      if (!row.storySelectable) {
        if (
          row.feedSelectable &&
          row.storyHardBlockers.includes("missing_shop_link")
        ) {
          return "Needs shop link for Story"
        }
        const reason = row.storyHardBlockers[0] ?? row.hardBlockers[0]
        return reason ? ownerLabelForHardBlock(reason) : "Not for Story"
      }
      return null
    }
    if (!row.feedSelectable) {
      const reason = row.hardBlockers[0]
      return reason ? ownerLabelForHardBlock(reason) : "Not for Feed"
    }
    return null
  }

  function canActivate(row: WlsProductSelection): boolean {
    return storySequenceMode ? row.storySelectable : row.feedSelectable
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1 px-1.5 py-1.5 sm:px-2"
      aria-label="WLS synced products"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-typewriter text-[9px] uppercase tracking-widest text-neutral-600">
          Synced products
          {storySequenceMode ? (
            <span className="text-neutral-500">
              {" "}
              · {sequenceMarketingEntityIds.length}/{maxFrames}
            </span>
          ) : null}
          <span className="text-neutral-500">
            {" "}
            · {selectableCount} ready
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[9px]"
          disabled={disabled || syncing || loading}
          onClick={() => void syncFromWebsite()}
        >
          {syncing ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            "Sync"
          )}
        </Button>
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={disabled || loading || syncing}
            onClick={onRefresh}
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3" aria-hidden />
            )}
            <span className="sr-only">Refresh catalogue</span>
          </Button>
        ) : null}
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search…"
          className="h-6 min-w-[6rem] flex-1 text-[11px] sm:max-w-[10rem]"
          disabled={disabled}
        />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
        {(Object.keys(WLS_STRIP_FILTER_LABELS) as WlsStripCatalogFilter[]).map(
          (key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={filter === key ? "default" : "outline"}
              className="h-6 shrink-0 px-2 text-[9px]"
              disabled={disabled}
              onClick={() => setFilter(key)}
            >
              {WLS_STRIP_FILTER_LABELS[key]}
            </Button>
          )
        )}
      </div>

      <div className="shrink-0 overflow-x-auto overflow-y-visible pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
        {loading && catalog.length === 0 ? (
          <div className="flex h-full items-center gap-2 text-[11px] text-neutral-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <p className="py-2 text-[11px] text-neutral-600">
            {catalog.length === 0
              ? "Sync from website to load products."
              : "No matches."}
            {Object.keys(exclusionSummary).length > 0 ? (
              <span className="text-neutral-500">
                {" "}
                {formatWlsExclusionSummary(exclusionSummary, 2)}
              </span>
            ) : null}
          </p>
        ) : (
          <div className="flex min-w-min items-start gap-1.5">
            {visible.map((row) => {
              const selected = inSequence.has(row.marketingEntityId)
              const active =
                activeMarketingEntityId === row.marketingEntityId && selected
              const thumb = firstUsableProductImageUrl(row.sourceImageUrls)
              const orderIndex = selected
                ? sequenceMarketingEntityIds.indexOf(row.marketingEntityId) + 1
                : null
              const blocked = !canActivate(row)
              const blockLabel = blockExplanation(row)
              const softHint = ownerHintForSoftWarnings(row.softWarnings, 1)
              const stockLabel =
                WLS_AVAILABILITY_BADGE_LABELS[row.availabilityBadge]
              const formatHint = suggestFormatForWlsSelection(row)

              return (
                <div
                  key={row.marketingEntityId}
                  className={cn(
                    "relative flex w-[4.75rem] shrink-0 flex-col overflow-hidden rounded-sm border bg-[#F4EFE6]/90",
                    blocked && "opacity-50",
                    active
                      ? "border-mad-black ring-1 ring-mad-black"
                      : selected
                        ? "border-mad-black/70"
                        : "border-neutral-200"
                  )}
                >
                  {row.availabilityBadge !== "in_stock" ? (
                    <span className="absolute top-0 left-0 z-10 rounded-br bg-neutral-800 px-1 py-px font-typewriter text-[7px] uppercase text-white">
                      {stockLabel}
                    </span>
                  ) : null}
                  {selected && storySequenceMode ? (
                    <button
                      type="button"
                      className="absolute top-0 right-0 z-10 flex size-4 items-center justify-center bg-white/95 text-mad-black"
                      aria-label="Remove from sequence"
                      disabled={disabled}
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveFromSequence(row.marketingEntityId)
                      }}
                    >
                      <X className="size-2.5" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={disabled || blocked}
                    className="flex flex-col text-left disabled:cursor-not-allowed"
                    title={
                      blocked
                        ? blockLabel ?? "Can't use"
                        : `${formatHint.label} — add to tray`
                    }
                    onClick={(event) => {
                      if (blocked) return
                      if (storySequenceMode) {
                        if (selected) {
                          onNavigateToFrame(row.marketingEntityId)
                          return
                        }
                        if (event.shiftKey && activeMarketingEntityId) {
                          onReplaceActiveFrame(row)
                          return
                        }
                        if (atCapacity) {
                          onReplaceActiveFrame(row)
                          return
                        }
                        onAddToSequence(row)
                        return
                      }
                      onAddToMedia(row)
                    }}
                  >
                    <div className="relative aspect-[3/4] w-full bg-[#E8DCC4]">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={proxiedImageUrl(thumb, entityId)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-0.5 pt-3 pb-0.5">
                        <p className="truncate text-[8px] font-semibold leading-tight text-white">
                          {formatWlsNzdPrice(row)}
                        </p>
                        {blockLabel ? (
                          <p className="truncate text-[7px] text-red-200">
                            {blockLabel}
                          </p>
                        ) : softHint ? (
                          <p className="truncate text-[7px] text-white/75">
                            {softHint}
                          </p>
                        ) : !blocked ? (
                          <p className="truncate text-[7px] text-white/80">
                            {formatHint.label}
                          </p>
                        ) : null}
                      </div>
                      {orderIndex != null ? (
                        <span className="absolute top-0 left-0 bg-mad-black/75 px-1 text-[8px] text-white">
                          {orderIndex}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

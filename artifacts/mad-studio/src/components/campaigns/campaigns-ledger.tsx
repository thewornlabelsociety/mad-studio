"use client"

import { Link } from "wouter"
import { useMemo, useState, type ReactNode } from "react"
import { ChevronDown, Plus } from "lucide-react"

import { CampaignRoiCard } from "@/components/analytics/campaign-roi-card"
import { CampaignPostMortem } from "@/components/campaigns/campaign-post-mortem"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  channelLabelFromAssetPack,
  formatMoney,
  type AnalyticsSnapshot,
  type CampaignLedgerItem,
  type OutcomeRating,
} from "@/lib/campaigns/ledger"
import { cn } from "@/lib/utils"

type CampaignsLedgerProps = {
  entityId: string
  entityName: string
  campaigns: CampaignLedgerItem[]
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode
  tone: "default" | "lime" | "vermillion" | "muted"
}) {
  return (
    <span
      className={cn(
        "inline-flex border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-widest uppercase shadow-keycap-sm",
        tone === "lime" && "bg-mad-lime text-mad-black",
        tone === "vermillion" && "bg-mad-vermillion text-mad-white",
        tone === "muted" && "bg-neutral-100 text-mad-black",
        tone === "default" && "bg-mad-white text-mad-black"
      )}
    >
      {children}
    </span>
  )
}

function statusBadge(status: string | null) {
  const value = status ?? "draft"
  if (value === "published") {
    return <StatusChip tone="lime">Published</StatusChip>
  }
  if (value === "scheduled") {
    return <StatusChip tone="muted">Scheduled</StatusChip>
  }
  if (value === "archived") {
    return <StatusChip tone="muted">Archived</StatusChip>
  }
  return <StatusChip tone="default">Draft</StatusChip>
}

function CampaignAccordionRow({
  campaign,
  entityId,
  expanded,
  onToggle,
}: {
  campaign: CampaignLedgerItem
  entityId: string
  expanded: boolean
  onToggle: () => void
}) {
  const [logOpen, setLogOpen] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(
    campaign.analytics
  )

  const spend = Number(analytics?.spend ?? 0)
  const sales = Number(analytics?.revenue ?? 0)
  const displayDate = campaign.published_at ?? campaign.created_at

  return (
    <article className="border-2 border-mad-black bg-mad-white shadow-keycap-sm">
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-mad-black transition-transform duration-200",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              {campaign.title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-neutral-500">
              {channelLabelFromAssetPack(campaign.asset_pack)}
              {campaign.target_goal ? ` · ${campaign.target_goal}` : ""}
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span
            className="font-typewriter text-[0.6rem] tracking-wider text-neutral-600 uppercase"
            suppressHydrationWarning
          >
            {new Date(displayDate).toLocaleDateString()}
          </span>
          {statusBadge(campaign.status)}
          <span className="hidden font-typewriter text-[0.65rem] tracking-wider text-mad-black uppercase md:inline">
            Spend: {formatMoney(spend)}
            <span className="mx-1 text-neutral-400">|</span>
            Sales: {formatMoney(sales)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation()
              setLogOpen(true)
            }}
            className="rounded-none border-2 border-mad-black font-typewriter text-[0.6rem] uppercase shadow-keycap-sm hover:bg-mad-lime"
          >
            <Plus data-icon="inline-start" />
            Log Spend / Sales
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-6 border-t-2 border-mad-black px-4 py-5 sm:px-5">
            <p className="font-typewriter text-[0.65rem] tracking-wider text-neutral-600 uppercase md:hidden">
              Spend: {formatMoney(spend)}
              <span className="mx-1 text-neutral-400">|</span>
              Sales: {formatMoney(sales)}
            </p>

            <CampaignRoiCard
              campaignId={campaign.id}
              entityId={entityId}
              analytics={analytics}
              showLogButton={false}
              logOpen={logOpen}
              onLogOpenChange={setLogOpen}
              onAnalyticsChange={setAnalytics}
            />

            <div className="border-t-2 border-mad-black pt-5">
              <CampaignPostMortem
                campaignId={campaign.id}
                entityId={entityId}
                initialOutcome={
                  (campaign.outcome_rating as OutcomeRating | null) ?? null
                }
                initialWhatWorked={campaign.what_worked}
                initialWhatDidntWork={campaign.what_didnt_work}
                initialTakeaway={campaign.ai_takeaway}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export function CampaignsLedger({
  entityId,
  entityName,
  campaigns,
}: CampaignsLedgerProps) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [outcomeFilter, setOutcomeFilter] = useState("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return campaigns.filter((campaign) => {
      const status = campaign.status ?? "draft"
      const outcome = campaign.outcome_rating ?? "none"
      const statusOk =
        statusFilter === "all" ? true : status === statusFilter
      const outcomeOk =
        outcomeFilter === "all"
          ? true
          : outcomeFilter === "none"
            ? !campaign.outcome_rating
            : outcome === outcomeFilter
      return statusOk && outcomeOk
    })
  }, [campaigns, outcomeFilter, statusFilter])

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-mad-black pb-4">
        <div className="space-y-2">
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Drop Performance
          </p>
          <h1 className="brand-typewriter text-xl text-mad-black sm:text-2xl">
            {entityName}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
            Expand a drop for performance overview and playbook notes. Keep the
            list tight — open only what you need.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] uppercase shadow-keycap-sm hover:bg-mad-lime"
        >
          <Link href={`/studio?eid=${encodeURIComponent(entityId)}`}>
            Back to Studio
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[10rem] rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-xs uppercase shadow-keycap-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="w-[11rem] rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-xs uppercase shadow-keycap-sm">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="winner">Winner</SelectItem>
            <SelectItem value="consistent">On Target</SelectItem>
            <SelectItem value="loss">Low Return</SelectItem>
            <SelectItem value="none">No rating yet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="border-2 border-dashed border-mad-black bg-mad-white px-6 py-16 text-center shadow-keycap-sm">
          <p className="font-typewriter text-sm font-bold tracking-wider text-mad-black uppercase">
            No campaigns match these filters.
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Generate a pack in Studio, then save or dispatch it to appear here.
          </p>
          <Button
            asChild
            size="sm"
            className="mt-4 rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.65rem] uppercase text-mad-white shadow-keycap-sm hover:bg-mad-vermillion"
          >
            <Link href={`/studio?eid=${encodeURIComponent(entityId)}`}>
              Open Studio
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((campaign) => (
            <CampaignAccordionRow
              key={campaign.id}
              campaign={campaign}
              entityId={entityId}
              expanded={expandedId === campaign.id}
              onToggle={() => toggleExpanded(campaign.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

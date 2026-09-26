"use client"

import { useState } from "react"
import { ChevronDown, Plus } from "lucide-react"

import { LogNumbersModal } from "@/components/analytics/log-numbers-modal"
import { Button } from "@/components/ui/button"
import {
  formatMoney,
  formatMultiplier,
  type AnalyticsSnapshot,
} from "@/lib/campaigns/ledger"
import { cn } from "@/lib/utils"

type CampaignRoiCardProps = {
  campaignId: string
  entityId: string
  analytics: AnalyticsSnapshot | null
  /** Hide the header "Log Spend" button when the parent provides one. */
  showLogButton?: boolean
  logOpen?: boolean
  onLogOpenChange?: (open: boolean) => void
  onAnalyticsChange?: (analytics: AnalyticsSnapshot) => void
}

function MetricCard({
  label,
  value,
  valueClassName,
  hint,
}: {
  label: string
  value: string
  valueClassName?: string
  hint?: string
}) {
  return (
    <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-neutral-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-typewriter text-2xl font-bold tracking-tight text-mad-black",
          valueClassName
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function CampaignRoiCard({
  campaignId,
  entityId,
  analytics: initialAnalytics,
  showLogButton = true,
  logOpen: controlledLogOpen,
  onLogOpenChange,
  onAnalyticsChange,
}: CampaignRoiCardProps) {
  const [analytics, setAnalytics] = useState(initialAnalytics)
  const [internalLogOpen, setInternalLogOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const logOpen = controlledLogOpen ?? internalLogOpen
  const setLogOpen = onLogOpenChange ?? setInternalLogOpen

  function handleSaved(next: AnalyticsSnapshot) {
    setAnalytics(next)
    onAnalyticsChange?.(next)
  }

  const spend = Number(analytics?.spend ?? 0)
  const revenue = Number(analytics?.revenue ?? 0)
  const netProfit = Number(analytics?.net_profit ?? revenue - spend)
  const roas = Number(analytics?.roas ?? 0)
  const cpa = Number(analytics?.cpa ?? 0)
  const conversions = Number(analytics?.conversions_count ?? 0)
  const impressions = Number(analytics?.impressions ?? 0)
  const clicks = Number(analytics?.clicks ?? 0)
  const ctr = Number(analytics?.ctr ?? 0)
  const cpc = Number(analytics?.cpc ?? 0)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
            Performance Overview
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            Spend, sales, and return for this drop
          </p>
        </div>
        {showLogButton ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLogOpen(true)}
            className="rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] uppercase shadow-keycap-sm hover:bg-mad-lime"
          >
            <Plus data-icon="inline-start" />
            Log Spend / Sales
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Money Spent" value={formatMoney(spend)} />
        <MetricCard label="Sales Made" value={formatMoney(revenue)} />
        <MetricCard
          label="Profit in Pocket"
          value={`${netProfit >= 0 ? "+" : ""}${formatMoney(netProfit)}`}
          valueClassName={
            netProfit >= 0 ? "text-emerald-700" : "text-mad-vermillion"
          }
        />
        <MetricCard label="Return Multiplier" value={formatMultiplier(roas)} />
        <MetricCard
          label="Cost per Customer"
          value={formatMoney(cpa)}
          hint={`${conversions} customers`}
        />
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase underline-offset-2 hover:underline"
        onClick={() => setInspectorOpen((value) => !value)}
      >
        Inspect diagnostic metrics
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${inspectorOpen ? "rotate-180" : ""}`}
        />
      </button>

      {inspectorOpen ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Views" value={impressions.toLocaleString()} />
          <MetricCard label="Link Visits" value={clicks.toLocaleString()} />
          <MetricCard label="Click Rate" value={`${ctr.toFixed(2)}%`} />
          <MetricCard label="Cost Per Click" value={formatMoney(cpc)} />
        </div>
      ) : null}

      <LogNumbersModal
        open={logOpen}
        onOpenChange={setLogOpen}
        campaignId={campaignId}
        entityId={entityId}
        initial={analytics}
        onSaved={handleSaved}
      />
    </section>
  )
}

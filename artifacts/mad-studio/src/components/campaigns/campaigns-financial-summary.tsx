"use client"

import {
  aggregateFinancialSummary,
  formatMoney,
  formatMultiplier,
  type CampaignLedgerItem,
} from "@/lib/campaigns/ledger"
import { cn } from "@/lib/utils"

type Props = {
  campaigns: CampaignLedgerItem[]
}

function MetricBlock({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string
  value: string
  sub?: string
  valueClassName?: string
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
      {sub ? <p className="mt-1 text-xs text-neutral-500">{sub}</p> : null}
    </div>
  )
}

export function CampaignsFinancialSummary({ campaigns }: Props) {
  const summary = aggregateFinancialSummary(campaigns)
  const roasLabel =
    summary.returnMultiplier == null
      ? "—"
      : formatMultiplier(summary.returnMultiplier)

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricBlock
        label="Money Spent"
        value={formatMoney(summary.moneySpent)}
        sub="Ad spend + production logged"
      />
      <MetricBlock
        label="Sales Made"
        value={formatMoney(summary.salesMade)}
        sub="Direct attribution revenue"
      />
      <MetricBlock
        label="Net Profit"
        value={formatMoney(summary.netProfit)}
        sub="Sales minus spend"
        valueClassName={
          summary.netProfit >= 0 ? "text-emerald-700" : "text-mad-vermillion"
        }
      />
      <MetricBlock
        label="Return Multiplier"
        value={roasLabel}
        sub="ROAS (sales ÷ spend)"
      />
    </section>
  )
}

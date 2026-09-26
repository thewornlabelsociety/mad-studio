"use client"

import { useState } from "react"
import { Link } from "wouter"

import {
  breakdownByAgent,
  formatCompactTime,
  formatLatency,
  formatNzd,
  formatTokens,
  summarizeMetering,
  type AgentBreakdown,
  type MeteringRow,
  type MeteringSummary,
  type OperationalHealth,
} from "@/lib/analytics/metering"
import { MeteringRangeFilter } from "@/components/analytics/metering-range-filter"
import type { MeteringRange } from "@/lib/analytics/metering"

const TELEMETRY_PREVIEW = 5
const TELEMETRY_MAX = 50

type Props = {
  entityId: string
  entityName: string
  range: MeteringRange
  rows: MeteringRow[]
  health: OperationalHealth
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <p className="font-typewriter text-[0.6rem] tracking-widest text-neutral-500 uppercase">
        {label}
      </p>
      <p className="mt-2 font-typewriter text-2xl tracking-tight text-mad-black">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  )
}

function AgentCostCard({ item }: { item: AgentBreakdown }) {
  return (
    <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <p className="font-typewriter text-sm font-bold text-mad-black">
        {item.agentLabel}
      </p>
      <p className="mt-2 font-typewriter text-[0.7rem] tracking-typewriter-tight text-neutral-600 uppercase">
        {item.runs} runs · {formatNzd(item.costNzd)} · {formatTokens(item.tokens)}{" "}
        tokens
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Avg latency {formatLatency(item.avgLatencyMs)}
      </p>
    </div>
  )
}

export function EntityMeteringDashboard({
  entityId,
  entityName,
  range,
  rows,
  health,
}: Props) {
  const [showAllTelemetry, setShowAllTelemetry] = useState(false)
  const summary: MeteringSummary = summarizeMetering(rows)
  const agents = breakdownByAgent(rows)
  const allLogRows = rows.slice(0, TELEMETRY_MAX)
  const logRows = showAllTelemetry
    ? allLogRows
    : allLogRows.slice(0, TELEMETRY_PREVIEW)
  const canExpand = allLogRows.length > TELEMETRY_PREVIEW

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-mad-black pb-4">
        <div className="space-y-2">
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Usage &amp; Cost Intelligence
          </p>
          <h1 className="brand-typewriter text-xl text-mad-black sm:text-2xl">
            {entityName}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
            Exact token capture, model latency, and calculated provider cost —
            scoped to this brand.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <MeteringRangeFilter entityId={entityId} activeRange={range} />
          <Link
            href={`/settings/social?eid=${encodeURIComponent(entityId)}`}
            className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase underline decoration-2 underline-offset-4 hover:text-mad-vermillion"
          >
            Social connections
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Raw API Cost (NZD)"
          value={formatNzd(summary.totalCostNzd)}
        />
        <MetricCard
          label="Agent Invocations"
          value={formatTokens(summary.totalRuns)}
        />
        <MetricCard
          label="Avg Cost / Run"
          value={formatNzd(summary.avgCostPerRunNzd)}
        />
        <MetricCard
          label="Tokens Consumed"
          value={formatTokens(summary.totalTokens)}
        />
        <MetricCard
          label="Average Latency"
          value={formatLatency(summary.avgLatencyMs)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-typewriter text-sm tracking-typewriter-tight uppercase">
          Cost Breakdown by Agent
        </h2>
        {agents.length === 0 ? (
          <p className="border-2 border-dashed border-mad-black p-4 text-sm text-neutral-600">
            No metered agent calls in this range yet. Run the Campaign
            Multiplexer to start the audit trail.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {agents.map((item) => (
              <AgentCostCard key={item.agentType} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-typewriter text-sm tracking-typewriter-tight uppercase">
          Operational Entity Health
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
            <p className="font-typewriter text-[0.6rem] tracking-widest text-neutral-500 uppercase">
              Campaigns Generated vs Logged
            </p>
            <p className="mt-2 font-typewriter text-2xl text-mad-black">
              {health.packsGenerated}{" "}
              <span className="text-base text-neutral-500">packs</span>
              {" / "}
              {health.campaignsLogged}{" "}
              <span className="text-base text-neutral-500">logged</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Draft packs created vs campaigns with ledger spend/revenue.
            </p>
          </div>
          <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
            <p className="font-typewriter text-[0.6rem] tracking-widest text-neutral-500 uppercase">
              Top Converting Hooks
            </p>
            {health.topHooks.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600">
                Log ROAS on campaigns to surface winning 0–3s spoken hooks.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {health.topHooks.map((hook) => (
                  <li key={hook.campaignId} className="text-sm">
                    <span className="font-typewriter text-[0.65rem] text-mad-vermillion uppercase">
                      {hook.roas.toFixed(2)}x ROAS
                    </span>
                    <p className="text-mad-black">{hook.spokenHook}</p>
                    <p className="text-xs text-neutral-500">{hook.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-typewriter text-sm tracking-typewriter-tight uppercase">
          Call Telemetry Log
        </h2>
        <div className="overflow-x-auto border-2 border-mad-black bg-mad-white shadow-keycap-sm">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-mad-black bg-mad-black text-mad-white">
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Timestamp
                </th>
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Agent
                </th>
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Model
                </th>
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Prompt
                </th>
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Output
                </th>
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Speed
                </th>
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Cost NZD
                </th>
                <th className="px-3 py-2 font-typewriter text-[0.6rem] tracking-widest uppercase">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {logRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-neutral-500"
                  >
                    No telemetry rows yet for this range.
                  </td>
                </tr>
              ) : (
                logRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-mad-black/20 align-top last:border-b-0"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-neutral-600">
                      {formatCompactTime(row.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.agent_label}</span>
                      <span className="mt-0.5 block font-typewriter text-[0.55rem] text-neutral-500 uppercase">
                        {row.agent_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.model_used}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatTokens(row.prompt_tokens)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatTokens(row.completion_tokens)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatLatency(row.duration_ms)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {formatNzd(Number(row.raw_cost_nzd))}
                    </td>
                    <td className="max-w-[16rem] px-3 py-2 text-xs text-neutral-600">
                      {row.summary || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setShowAllTelemetry((open) => !open)}
            className="border-2 border-mad-black bg-mad-white px-3 py-1.5 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm transition hover:bg-mad-lime"
          >
            {showAllTelemetry
              ? "Show less"
              : `See more (${allLogRows.length - TELEMETRY_PREVIEW} more)`}
          </button>
        ) : null}
      </section>
    </div>
  )
}

"use client"

import { formatMoney, type PublishedDropRow } from "@/lib/campaigns/ledger"

type Props = {
  rows: PublishedDropRow[]
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value.toFixed(2)}%`
}

export function CampaignsConversionTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="border-2 border-dashed border-mad-black bg-mad-white px-4 py-10 text-center shadow-keycap-sm">
        <p className="font-typewriter text-sm font-bold tracking-wider text-mad-black uppercase">
          No published drops yet
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Published inventory drops appear here with CTR and conversion metrics.
        </p>
      </div>
    )
  }

  return (
    <section className="overflow-x-auto border-2 border-mad-black bg-mad-white shadow-keycap-sm">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-mad-black bg-mad-lime/30">
            <th className="px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-widest uppercase">
              Media
            </th>
            <th className="px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-widest uppercase">
              Drop Title
            </th>
            <th className="px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-widest uppercase">
              Target Audience
            </th>
            <th className="px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-widest uppercase">
              CTR
            </th>
            <th className="px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-widest uppercase">
              Direct Conversions
            </th>
            <th className="px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-widest uppercase">
              Cost-per-Click
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-mad-black/15">
              <td className="px-3 py-2">
                <div className="size-12 overflow-hidden border border-mad-black bg-neutral-100">
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center font-typewriter text-[0.45rem] text-neutral-400 uppercase">
                      —
                    </div>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 font-typewriter text-xs font-bold uppercase">
                {row.title}
              </td>
              <td className="px-3 py-2 text-xs text-neutral-700">
                {row.targetAudience ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs tabular-nums">
                {formatPercent(row.ctrPercent)}
              </td>
              <td className="px-3 py-2 font-mono text-xs tabular-nums">
                {row.directConversions}
              </td>
              <td className="px-3 py-2 font-mono text-xs tabular-nums">
                {row.costPerClick != null
                  ? formatMoney(row.costPerClick)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

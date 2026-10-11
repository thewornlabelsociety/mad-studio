"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { CampaignsLedger } from "@/components/campaigns/campaigns-ledger"
import type { CampaignLedgerPayload } from "@/lib/campaigns/load-ledger-data"

type Props = {
  entityId: string
  entityName: string
  active: boolean
}

export function PastLedgerTab({ entityId, entityName, active }: Props) {
  const [data, setData] = useState<CampaignLedgerPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!active || data != null) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const response = await fetch(
          `/api/campaigns/ledger?entityId=${encodeURIComponent(entityId)}`,
          { cache: "no-store" }
        )
        const payload = (await response.json()) as CampaignLedgerPayload & {
          error?: string
        }
        if (!response.ok) {
          throw new Error(payload.error || "Could not load ledger.")
        }
        if (!cancelled) {
          setData({
            campaigns: payload.campaigns ?? [],
            publishedDrops: payload.publishedDrops ?? [],
          })
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Could not load ledger."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [active, data, entityId])

  if (!active && data == null) {
    return null
  }

  if (loading && data == null) {
    return (
      <div className="flex min-h-[420px] items-center justify-center border-2 border-mad-black bg-mad-white shadow-keycap-sm">
        <Loader2 className="size-6 animate-spin text-mad-black" />
        <span className="sr-only">Loading ledger…</span>
      </div>
    )
  }

  if (error && data == null) {
    return (
      <div className="min-h-[420px] border-2 border-mad-black bg-mad-white px-6 py-12 text-center shadow-keycap-sm">
        <p className="font-typewriter text-sm font-bold tracking-wider text-mad-vermillion uppercase">
          Ledger unavailable
        </p>
        <p className="mt-2 text-sm text-neutral-600">{error}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <CampaignsLedger
      entityId={entityId}
      entityName={entityName}
      campaigns={data.campaigns}
      publishedDrops={data.publishedDrops}
    />
  )
}

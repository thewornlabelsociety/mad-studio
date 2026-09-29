"use client"

import { useRouter } from "@/lib/next-compat"
import { useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import {
  inventoryIntakeBusyLabel,
  inventoryIntakeLabel,
  type InventoryIntakeMode,
} from "@/lib/inventory/entity-intake"

type Props = {
  entityId: string
  intakeMode?: InventoryIntakeMode
  variant?: "default" | "agenda"
}

export function PullNewArrivalsButton({
  entityId,
  intakeMode = "website",
  variant = "default",
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onPull() {
    setLoading(true)
    try {
      const response = await fetch("/api/sync/pull-new-arrivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      })
      const payload = (await response.json()) as {
        imported?: number
        skipped?: number
        message?: string
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to pull new arrivals.")
      }

      const imported = payload.imported ?? 0
      toast.success(
        imported === 0
          ? payload.message ?? "No new arrivals to import."
          : `Imported ${imported} new arrival${imported === 1 ? "" : "s"}`
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not pull new arrivals."
      )
    } finally {
      setLoading(false)
    }
  }

  const agenda = variant === "agenda"

  return (
    <button
      type="button"
      onClick={onPull}
      disabled={loading}
      className={
        agenda
          ? "inline-flex items-center justify-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm transition hover:bg-mad-vermillion disabled:opacity-60"
          : "inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
      }
    >
      {loading ? (
        <>
          <Loader2 className={agenda ? "size-3.5 animate-spin" : "size-4 animate-spin"} />
          {agenda ? "Refreshing…" : inventoryIntakeBusyLabel(intakeMode)}
        </>
      ) : (
        <>
          <RefreshCw className={agenda ? "size-3.5" : "size-4"} />
          {agenda ? "[ ⟳ Refresh Feed ]" : inventoryIntakeLabel(intakeMode)}
        </>
      )}
    </button>
  )
}

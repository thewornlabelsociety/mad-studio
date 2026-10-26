"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  buildWlsDailyStoryTodayStudioHref,
  ensureWlsDailyStoryTemplateForEntity,
} from "@/lib/templates/wls-daily-story-today-client"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  /** When false, the control is not rendered (non-WLS brands). */
  show?: boolean
  className?: string
  /** Primary CTA styling on Today (WLS daily workflow). */
  variant?: "primary" | "compact"
}

export function DailyNewArrivalStoryButton({
  entityId,
  show = true,
  className,
  variant = "primary",
}: Props) {
  const [busy, setBusy] = useState(false)

  if (!show) return null

  async function onStart() {
    if (busy) return
    setBusy(true)
    try {
      const ensured = await ensureWlsDailyStoryTemplateForEntity(entityId)
      if (!ensured.ok) {
        toast.error(ensured.error)
        return
      }
      const href = buildWlsDailyStoryTodayStudioHref({
        entityId,
        instance: ensured.instance,
      })
      window.location.assign(href)
    } finally {
      setBusy(false)
    }
  }

  const base =
    "inline-flex items-center justify-center border-2 border-mad-black font-typewriter font-bold tracking-wider uppercase shadow-keycap-sm disabled:opacity-50"

  return (
    <button
      type="button"
      onClick={() => void onStart()}
      disabled={busy}
      className={cn(
        base,
        variant === "primary"
          ? "h-10 gap-1.5 bg-mad-black px-3 text-[0.7rem] text-mad-white hover:bg-mad-vermillion"
          : "h-9 gap-1 bg-mad-lime px-2.5 text-[0.65rem] text-mad-black hover:bg-[#CCFF00]",
        className
      )}
      aria-busy={busy}
    >
      {busy ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-3.5 shrink-0" aria-hidden />
      )}
      Daily New Arrival Story
    </button>
  )
}

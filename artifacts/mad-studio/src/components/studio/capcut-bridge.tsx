"use client"

import { useState } from "react"
import { Clapperboard, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

export type CapCutBridgePayload = {
  hook: string
  headline: string
  caption: string
  audioScript: string
  assetUrl: string | null
  /** Clipboard bundle fields for CapCut handoff. */
  spokenHook?: string
  onScreenHeadline?: string
  destinationUrl?: string | null
}

type Props = {
  payload: CapCutBridgePayload
  className?: string
}

export function CapCutBridge({ payload, className }: Props) {
  const [busy, setBusy] = useState(false)

  async function copyCapCutBundle() {
    setBusy(true)
    try {
      const bundle = JSON.stringify(
        {
          spokenHook: payload.spokenHook ?? payload.hook,
          onScreenHeadline: payload.onScreenHeadline ?? payload.headline,
          caption: payload.caption,
          destinationUrl: payload.destinationUrl ?? null,
          assetUrl: payload.assetUrl,
        },
        null,
        2
      )
      await navigator.clipboard.writeText(bundle)
      toast.success("CapCut bundle copied — opening editor…")
      window.open("https://www.capcut.com/editor", "_blank", "noopener,noreferrer")
      window.setTimeout(() => {
        window.location.href = "capcut://"
      }, 400)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void copyCapCutBundle()}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-60",
        className
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Clapperboard className="size-4" />
      )}
      Edit reel in CapCut
    </button>
  )
}

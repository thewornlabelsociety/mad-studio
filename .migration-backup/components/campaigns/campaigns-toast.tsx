"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

/** Shows a one-shot success toast from ?toast= on /campaigns. */
export function CampaignsToast() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const kind = searchParams.get("toast")
    if (!kind) return

    if (kind === "published") toast.success("Drop published — logged in Campaigns.")
    else if (kind === "scheduled")
      toast.success("Drop scheduled — logged in Campaigns.")
    else if (kind === "armed")
      toast.success("Multi-channel post armed — queue logged in Campaigns.")
    else if (kind === "draft") toast.success("Draft saved to Campaigns.")

    const next = new URLSearchParams(searchParams.toString())
    next.delete("toast")
    const qs = next.toString()
    router.replace(qs ? `/campaigns?${qs}` : "/campaigns")
  }, [router, searchParams])

  return null
}

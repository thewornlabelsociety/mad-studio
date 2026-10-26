"use client"

import { useState } from "react"
import { X } from "lucide-react"

type Props = {
  show: boolean
}

const GUIDANCE =
  "Choose up to five arrivals. Review your branded Story frames. Export your Story pack and matching shop links."

/** Shown for WLS Daily New Arrival Story session only (not other templates). */
export function WlsDailyStoryEntryBanner({ show }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (!show || dismissed) return null

  return (
    <div
      className="mt-2 flex items-start gap-2 border-2 border-mad-black bg-mad-lime/30 px-3 py-2 text-sm leading-snug text-mad-black"
      role="status"
    >
      <p className="min-w-0 flex-1 font-medium">{GUIDANCE}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="inline-flex size-8 shrink-0 items-center justify-center border-2 border-mad-black bg-mad-white hover:bg-mad-lime"
        aria-label="Dismiss guidance"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

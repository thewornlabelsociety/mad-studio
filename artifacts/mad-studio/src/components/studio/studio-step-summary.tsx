"use client"

import { cn } from "@/lib/utils"

type Props = {
  title: string
  summary: string
  onEdit: () => void
  className?: string
  previewUrl?: string | null
  editLabel?: string
}

export function StudioStepSummary({
  title,
  summary,
  onEdit,
  className,
  previewUrl = null,
  editLabel = "Edit",
}: Props) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-2 border-mad-black/25 bg-mad-white px-3 py-2 shadow-keycap-sm",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="size-10 shrink-0 border border-mad-black object-cover"
          />
        ) : (
          <span className="mt-0.5 font-typewriter text-[0.55rem] font-bold text-mad-vermillion">
            ✓
          </span>
        )}
        <div className="min-w-0">
          <p className="font-typewriter text-[0.5rem] font-bold tracking-widest text-mad-vermillion uppercase">
            {title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-700">{summary}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 border-2 border-mad-black bg-mad-white px-2 py-1 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
      >
        {editLabel}
      </button>
    </div>
  )
}

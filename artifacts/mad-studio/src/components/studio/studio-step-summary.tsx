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
        "flex shrink-0 items-start justify-between gap-4 rounded-sm border border-neutral-200/90 bg-white/80 px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="size-12 shrink-0 rounded-sm object-cover ring-1 ring-neutral-200"
          />
        ) : (
          <span className="mt-1 font-serif text-sm text-neutral-400">✓</span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.16em] text-neutral-500 uppercase">
            {title}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-neutral-700">
            {summary}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs font-medium tracking-wide text-mad-black underline-offset-4 hover:underline"
      >
        {editLabel}
      </button>
    </div>
  )
}

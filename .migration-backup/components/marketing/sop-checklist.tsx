"use client"

import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"

import {
  evaluateSopChecklist,
  isSopValid,
  type SopCriterion,
  type SopDraft,
} from "@/lib/inventory/sop"
import type { MarketingEntity } from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

type Props = {
  item: MarketingEntity
  draft: SopDraft
  onDraftChange: (draft: SopDraft) => void
  onValidityChange?: (valid: boolean) => void
}

export function SopChecklist({
  item,
  draft,
  onDraftChange,
  onValidityChange,
}: Props) {
  const criteria = useMemo(
    () => evaluateSopChecklist(item, draft),
    [item, draft]
  )
  const valid = isSopValid(criteria)
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    onValidityChange?.(valid)
  }, [onValidityChange, valid])

  function applySuggestion(criterion: SopCriterion) {
    if (criterion.passed) return
    setFocusId(criterion.id)

    if (criterion.id === "asset") {
      return
    }

    if (criterion.id === "tone") {
      const cleaned = draft.caption
        .replace(/check out this/gi, "")
        .replace(/must[- ]have/gi, "")
        .replace(/hurry before it'?s gone/gi, "")
        .replace(/don'?t miss out/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
      onDraftChange({
        ...draft,
        caption: cleaned || draft.headline,
      })
      return
    }

    if (!criterion.suggestion.trim()) return

    const nextCaption = draft.caption.includes(criterion.suggestion.trim())
      ? draft.caption
      : `${draft.caption.trim()}${criterion.suggestion}`

    onDraftChange({ ...draft, caption: nextCaption.trim() })
  }

  const passedCount = criteria.filter((c) => c.passed).length

  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">
            SOP Checklist
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Verify brand standards before approving this drop.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            valid
              ? "bg-emerald-50 text-emerald-700"
              : "bg-neutral-100 text-neutral-600"
          )}
        >
          {passedCount}/{criteria.length}
        </span>
      </div>

      <ul className="space-y-2">
        {criteria.map((criterion) => (
          <li key={criterion.id}>
            <button
              type="button"
              onClick={() => applySuggestion(criterion)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                criterion.passed
                  ? "border-emerald-100 bg-emerald-50/40"
                  : "border-neutral-200 bg-neutral-50/50 hover:border-neutral-300",
                focusId === criterion.id && !criterion.passed
                  ? "ring-1 ring-neutral-900"
                  : ""
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  criterion.passed
                    ? "border-emerald-400 bg-emerald-500 text-white"
                    : "border-neutral-300 bg-white"
                )}
                aria-hidden
              >
                {criterion.passed ? <Check className="size-3" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-900">
                  {criterion.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                  {criterion.passed
                    ? "Complete"
                    : criterion.id === "asset"
                      ? criterion.hint
                      : `${criterion.hint} Tap to apply a suggestion.`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

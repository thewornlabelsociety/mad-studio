"use client"

import { useEffect, useState, useTransition } from "react"
import { Check, Circle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { patchDropWorkbenchDraft } from "@/lib/actions"
import {
  getPostReadiness,
  postBrandFor,
} from "@/lib/inventory/post-readiness"
import type { MarketingEntity } from "@/lib/inventory/types"
import { extractSizeLabel } from "@/lib/marketing/story-presets"
import { cn } from "@/lib/utils"

type Props = {
  item: MarketingEntity
  entityId: string
  websiteUrl?: string | null
  requireSize: boolean
  onItemChange: (item: MarketingEntity) => void
}

/** Listing text with the sync's "Size: …" / "Condition: …" lines left in, trimmed. */
function startingDescription(item: MarketingEntity): string {
  const saved = item.copy_draft?.metadata?.post_description
  if (saved?.trim()) return saved
  return (item.description ?? "").trim()
}

/**
 * The "is this item ready to post?" checklist, plus the post details the
 * operator sets once: brand, size and an approved description. Saved on the
 * item's draft so a website re-sync can't overwrite them.
 */
export function ItemPostDetails({
  item,
  entityId,
  websiteUrl = null,
  requireSize,
  onItemChange,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [brand, setBrand] = useState(postBrandFor(item) ?? "")
  const [size, setSize] = useState(extractSizeLabel(item) ?? "")
  const [description, setDescription] = useState(startingDescription(item))

  useEffect(() => {
    setBrand(postBrandFor(item) ?? "")
    setSize(extractSizeLabel(item) ?? "")
    setDescription(startingDescription(item))
    // Reset only when switching items, not on every save of this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const readiness = getPostReadiness({
    item,
    entityId,
    websiteUrl,
    requireSize,
  })
  const meta = item.copy_draft?.metadata
  const approvedText = meta?.post_description_approved_at
    ? meta.post_description?.trim()
    : null
  const descriptionChanged = description.trim() !== (approvedText ?? "")
  const dirty =
    brand.trim() !== (postBrandFor(item) ?? "") ||
    size.trim().toUpperCase() !== (extractSizeLabel(item) ?? "") ||
    description.trim() !== (meta?.post_description?.trim() ?? "")

  function save(approve: boolean) {
    const text = description.trim()
    if (approve && text.length < 10) {
      toast.message("Write a short description before approving it.")
      return
    }
    const approvedAt = approve
      ? new Date().toISOString()
      : // Editing an approved description sends it back for approval.
        text === approvedText
        ? (meta?.post_description_approved_at ?? null)
        : null
    const metadata = {
      post_brand: brand.trim() || null,
      post_size: size.trim().toUpperCase() || null,
      post_description: text || null,
      post_description_approved_at: approvedAt,
    }
    startTransition(async () => {
      const result = await patchDropWorkbenchDraft({
        entityId,
        itemId: item.id,
        copyDraft: { metadata },
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onItemChange({
        ...item,
        copy_draft: {
          ...item.copy_draft,
          metadata: { ...item.copy_draft?.metadata, ...metadata },
        },
      })
      toast.success(approve ? "Description approved." : "Post details saved.")
    })
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-mad-black">Ready to post?</h4>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold tracking-wide uppercase",
            readiness.ready
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          )}
        >
          {readiness.ready
            ? "Ready"
            : `${readiness.missing.length} to fix`}
        </span>
      </div>

      <ul className="grid min-w-0 grid-cols-1 gap-1.5 text-sm">
        {readiness.checks.map((check) => (
          <li key={check.id} className="flex min-w-0 items-start gap-2">
            {check.ok ? (
              <Check
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <Circle
                className="mt-0.5 size-4 shrink-0 text-amber-500"
                aria-hidden
              />
            )}
            <span className="min-w-0">
              <span className="font-medium text-mad-black">{check.label}</span>
              <span className="block truncate text-xs text-neutral-500">
                {check.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid gap-3 border-t border-neutral-100 pt-4">
        <div className={cn("grid gap-3", requireSize && "grid-cols-2")}>
          <label className="grid gap-1 text-xs font-medium text-neutral-600">
            Brand on the post
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="e.g. Zimmermann"
              className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-mad-black"
            />
          </label>
          {requireSize ? (
            <label className="grid gap-1 text-xs font-medium text-neutral-600">
              Size
              <input
                value={size}
                onChange={(event) => setSize(event.target.value)}
                placeholder="e.g. 10 or M"
                className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm uppercase text-mad-black"
              />
            </label>
          ) : null}
        </div>
        <label className="grid gap-1 text-xs font-medium text-neutral-600">
          <span className="flex items-center justify-between gap-2">
            Description for posts
            {approvedText && !descriptionChanged ? (
              <span className="text-emerald-700">Approved ✓</span>
            ) : null}
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            placeholder="What makes this piece special — fabric, fit, condition."
            className="rounded-md border border-neutral-300 px-2.5 py-2 text-sm leading-relaxed text-mad-black"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save(true)}
            disabled={pending || (!descriptionChanged && !dirty && Boolean(approvedText))}
            className="inline-flex items-center gap-1.5 rounded-md bg-mad-black px-3 py-2 text-sm font-medium text-mad-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {approvedText && !descriptionChanged ? "Save" : "Save & approve"}
          </button>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={pending || !dirty}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Save draft
          </button>
        </div>
      </div>
    </section>
  )
}

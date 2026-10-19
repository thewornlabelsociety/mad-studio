"use client"

import { useRouter } from "@/lib/next-compat"
import { useTransition } from "react"
import { toast } from "sonner"

import { removeInventoryItem, repurposeMarketingEntity } from "@/lib/actions"
import { cn } from "@/lib/utils"

export function RemoveIntakeButton({
  entityId,
  itemId,
  title,
  className,
}: {
  entityId: string
  itemId: string
  title: string
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Remove "${title}" from MAD Studio intake? This does not delete anything in the FÜDI app.`
          )
        ) {
          return
        }
        startTransition(async () => {
          const result = await removeInventoryItem({ entityId, itemId })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Removed from intake.")
          router.refresh()
        })
      }}
      className={cn(
        "rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 disabled:opacity-60",
        className
      )}
    >
      {pending ? "Removing…" : "Remove from intake"}
    </button>
  )
}

export function RepurposeButton({
  entityId,
  sourceItemId,
  className,
}: {
  entityId: string
  sourceItemId: string
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await repurposeMarketingEntity({
            entityId,
            sourceItemId,
          })
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Playbook copied into the next draft.")
          router.push(
            `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(result.data.targetId)}`
          )
          router.refresh()
        })
      }}
      className={cn(
        "rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:opacity-60",
        className
      )}
    >
      {pending ? "Copying…" : "Repurpose / Re-Drop"}
    </button>
  )
}

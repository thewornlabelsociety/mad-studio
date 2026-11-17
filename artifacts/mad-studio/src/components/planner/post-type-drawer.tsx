"use client"

import { Suspense, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { DayDraftTargetProvider } from "@/components/planner/day-draft-target"
import type { PostType, TemplateProps } from "@/components/planner/post-types"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { dayLabel } from "@/lib/planner/day-drafts"
import { createClient } from "@/lib/supabase/client"

type Brand = Pick<TemplateProps, "entityName" | "industry" | "brandIdentity">

/**
 * A post type opened from Fill this day: its full editor in a wide side
 * drawer. Its "Add to <day>" puts the finished post on that day as a draft,
 * then the drawer closes and the calendar shows it waiting for approval.
 */
export function PostTypeDrawer({
  entityId,
  type,
  day,
  onClose,
  onDrafted,
}: {
  entityId: string
  /** The post type to make; null keeps the drawer closed. */
  type: PostType | null
  day: Date | null
  onClose: () => void
  /** After a draft is saved, to reload the calendar. */
  onDrafted: () => void
}) {
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    let cancelled = false
    void createClient()
      .from("entities")
      .select("name, industry, brand_identity")
      .eq("id", entityId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const identity =
          data.brand_identity && typeof data.brand_identity === "object" && !Array.isArray(data.brand_identity)
            ? (data.brand_identity as Brand["brandIdentity"])
            : null
        setBrand({ entityName: data.name ?? "", industry: data.industry ?? null, brandIdentity: identity })
      })
    return () => {
      cancelled = true
    }
  }, [entityId])

  const open = type != null && day != null

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-l-2 border-mad-black bg-mad-white p-0 sm:max-w-5xl">
        {type && day ? (
          <>
            <SheetHeader className="border-b-2 border-mad-black px-5 py-3 text-left">
              <SheetTitle className="font-typewriter text-sm font-bold tracking-wide uppercase">{type.title}</SheetTitle>
              <SheetDescription className="text-xs text-neutral-600">
                For {dayLabel(day)}. Make it here, then press Add to{" "}
                {day.toLocaleDateString("en-NZ", { weekday: "long" })} to put it on the day for approval.
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
              {brand ? (
                <DayDraftTargetProvider
                  target={{
                    day,
                    kind: type.id,
                    title: type.title,
                    hour: type.hour,
                    onDrafted: () => {
                      onClose()
                      onDrafted()
                    },
                  }}
                >
                  <Suspense fallback={<Loading />}>
                    <type.Editor entityId={entityId} {...brand} />
                  </Suspense>
                </DayDraftTargetProvider>
              ) : (
                <Loading />
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Loading() {
  return (
    <p className="flex items-center gap-2 text-sm text-mad-black/60">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Opening…
    </p>
  )
}

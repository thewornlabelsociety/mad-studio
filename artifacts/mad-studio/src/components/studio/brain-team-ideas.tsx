"use client"

import { useState } from "react"
import { Lightbulb, Loader2 } from "lucide-react"

import { ToolIconButton } from "@/components/studio/tool-icon-button"
import { BrainTeam } from "@/components/today/brain-team"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import type { MarketingEntity } from "@/lib/inventory/types"
import { createClient } from "@/lib/supabase/client"
import { fetchPendingTodayDeck } from "@/lib/today/daily-queue"

/**
 * Ideas from new stock in Create: the Brain team's carousel picks and
 * captions, opened from the Media tools. Loads the first time it's opened.
 */
export function BrainTeamIdeas({
  entityId,
  brandName,
  industry = null,
  disabled = false,
}: {
  entityId: string
  brandName: string
  industry?: string | null
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MarketingEntity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const supabase = createClient()
      const deck = await fetchPendingTodayDeck({ supabase, entityId, brandName, industry })
      setItems(deck.map((card) => card.item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load new stock.")
      setItems([])
    }
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next && items === null) void load()
  }

  return (
    <>
      <ToolIconButton
        label="Ideas from new stock"
        hint="The Brain team's carousel picks and captions from your newest arrivals."
        onClick={() => onOpenChange(true)}
        disabled={disabled}
        icon={<Lightbulb className="size-5" />}
      />
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-3 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Ideas from new stock</SheetTitle>
            <SheetDescription>
              Posts the Brain team would make from your newest arrivals. Build
              one to load its pieces into Create.
            </SheetDescription>
          </SheetHeader>
          {items === null ? (
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Looking at new stock…
            </p>
          ) : error ? (
            <p className="text-sm text-mad-vermillion">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-neutral-600">No new stock to suggest from right now.</p>
          ) : (
            <BrainTeam
              tabbed
              fullReloadLinks
              className="min-h-[28rem]"
              entityId={entityId}
              intakeCaptionDefault="listing_description"
              isFashion={resolveIndustryProfile({ name: brandName, industry }).id === "worn_label"}
              items={items}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

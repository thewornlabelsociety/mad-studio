"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useLocation } from "wouter"
import { toast } from "sonner"

import { dayLabel, saveDayDrafts } from "@/lib/planner/day-drafts"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"

/**
 * Set when a post type is opened from the planner's Fill this day: its
 * finished slides go onto that day as a draft to approve, not to Studio.
 */
export type DayDraftTarget = {
  day: Date
  /** The post type, e.g. "wants"; a new draft of it replaces the last one that day. */
  kind: string
  /** Shown on the calendar card. */
  title: string
  /** Hour it's set to go out; changeable before approving. */
  hour: number
  /** After the draft is saved (closes the drawer and reloads the calendar). */
  onDrafted: () => void
}

const DayDraftContext = createContext<DayDraftTarget | null>(null)

export function DayDraftTargetProvider({ target, children }: { target: DayDraftTarget; children: ReactNode }) {
  return <DayDraftContext.Provider value={target}>{children}</DayDraftContext.Provider>
}

/** The day being filled, when this screen is open in the planner's drawer. */
export function useDayDraftTarget(): DayDraftTarget | null {
  return useContext(DayDraftContext)
}

/**
 * Where a template's finished feed slides go: onto the planner day as a
 * draft (in the drawer), or into Studio (on its own screen).
 */
export function useSlidesOut(entityId: string) {
  const target = useDayDraftTarget()
  const [, navigate] = useLocation()
  const weekday = target?.day.toLocaleDateString("en-NZ", { weekday: "long" }) ?? ""

  async function sendOut(input: { urls: string[]; caption: string; title?: string }): Promise<void> {
    if (!target) {
      saveStudioSlidesHandoff(entityId, { urls: input.urls, caption: input.caption })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
      return
    }
    const { saved } = await saveDayDrafts({
      entityId,
      day: target.day,
      drafts: [
        {
          kind: target.kind,
          platforms: ["instagram_feed", "facebook"],
          title: input.title ?? target.title,
          caption: input.caption,
          mediaUrls: input.urls,
          hour: target.hour,
        },
      ],
    })
    if (saved.length === 0) {
      toast.message(`${dayLabel(target.day)} already has an approved ${target.title.toLowerCase()}. Unschedule it first to make a new one.`)
      return
    }
    toast.success(`Added to ${dayLabel(target.day)}. Approve it in the planner.`)
    target.onDrafted()
  }

  return {
    sendOut,
    inDrawer: target != null,
    /** Button text for a carousel or several slides. */
    label: target ? `Add to ${weekday}` : "Send to Studio",
    /** Button text for a single card. */
    cardLabel: target ? `Add to ${weekday}` : "Send card to Studio",
  }
}

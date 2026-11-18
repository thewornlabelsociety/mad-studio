"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useLocation } from "wouter"
import { requestFinish } from "@/components/planner/finish-panel"
import { postTypeByPath } from "@/components/planner/post-types"
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
 * Where a template's finished feed slides go: the finish panel, to pick the
 * day, time and channels, check the caption and hashtags, then add a draft or
 * schedule. In the planner's drawer it starts on that day and closes the
 * drawer after saving. "Open in Studio instead" keeps the old hand-off.
 */
export function useSlidesOut(entityId: string) {
  const target = useDayDraftTarget()
  const [location, navigate] = useLocation()
  const weekday = target?.day.toLocaleDateString("en-NZ", { weekday: "long" }) ?? ""
  // Off the planner, the screen's own post type names and times the post.
  const type = postTypeByPath(location)

  async function sendOut(input: {
    urls: string[]
    caption: string
    title?: string
    kind?: string
    /** The Story version, offered as Instagram Story in the finish panel. */
    story?: () => Promise<string[]>
  }): Promise<void> {
    await requestFinish({
      entityId,
      // A second post from the same screen (the dot special card) names its own kind.
      kind: input.kind ?? target?.kind ?? type?.id ?? "post",
      title: input.title ?? target?.title ?? type?.title ?? "Post",
      urls: input.urls,
      caption: input.caption,
      story: input.story,
      day: target?.day ?? null,
      hour: target?.hour ?? type?.hour ?? 11,
      onSaved: target?.onDrafted,
      onStudio: () => {
        saveStudioSlidesHandoff(entityId, { urls: input.urls, caption: input.caption })
        navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
      },
    })
  }

  return {
    sendOut,
    inDrawer: target != null,
    /** Button text for a carousel or several slides. */
    label: target ? `Add to ${weekday}` : "Schedule or draft",
    /** Button text for a single card. */
    cardLabel: target ? `Add to ${weekday}` : "Schedule or draft",
  }
}

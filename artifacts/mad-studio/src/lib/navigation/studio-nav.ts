import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Brain,
  CalendarDays,
  CircleHelp,
  FolderOpen,
  ListChecks,
  Share2,
  Sparkles,
} from "lucide-react"

import { resolveEntityType } from "@/lib/social-creative/resolve-entity-type"
import type { AccessibleEntity } from "@/lib/types"

export type StudioNavItem = {
  id: string
  href: string
  /** Path prefix(es) that mark this item active. */
  match: string | string[]
  label: string
  description: string
  icon: LucideIcon
  /** `main` = the four daily destinations; `settings` = set-up-once pages. */
  section: "main" | "settings"
}

export type CalendarView = {
  id: string
  href: string
  match: string
  label: string
  description: string
}

function showPromoFor(activeEntity: AccessibleEntity | null): boolean {
  return (
    resolveEntityType({
      name: activeEntity?.name,
      industry: activeEntity?.industry,
      entityId: activeEntity?.id,
    }) === "WORN_LABEL"
  )
}

/** Plan, Campaigns and Promo are views of one Calendar destination. */
export function buildCalendarViews(input: {
  entityQuery: string
  activeEntity: AccessibleEntity | null
}): CalendarView[] {
  const { entityQuery, activeEntity } = input
  const views: CalendarView[] = [
    {
      id: "plan",
      href: `/planner${entityQuery}`,
      match: "/planner",
      label: "Plan",
      description: "Week & month calendar",
    },
    {
      id: "campaigns",
      href: `/campaigns${entityQuery}`,
      match: "/campaigns",
      label: "Campaigns",
      description: "Queue, storyboard & results",
    },
  ]
  if (showPromoFor(activeEntity)) {
    views.push({
      id: "promo",
      href: `/promo${entityQuery}`,
      match: "/promo",
      label: "Promo",
      description: "Weekly tag specials",
    })
  }
  return views
}

export function buildStudioNavItems(input: {
  entityQuery: string
  activeEntity: AccessibleEntity | null
}): StudioNavItem[] {
  const { entityQuery } = input
  const studioHref = entityQuery
    ? `/studio${entityQuery}&step=2`
    : "/studio?step=2"

  const main: StudioNavItem[] = [
    {
      id: "today",
      href: `/today${entityQuery}`,
      match: "/today",
      label: "Today",
      description: "Your daily checklist",
      icon: ListChecks,
      section: "main",
    },
    {
      id: "create",
      href: studioHref,
      match: "/studio",
      label: "Create",
      description: "Make a post",
      icon: Sparkles,
      section: "main",
    },
    {
      id: "calendar",
      href: `/planner${entityQuery}`,
      match: buildCalendarViews(input).map((view) => view.match),
      label: "Calendar",
      description: "Plan, campaigns & promos",
      icon: CalendarDays,
      section: "main",
    },
    {
      id: "library",
      href: `/inventory${entityQuery}`,
      match: "/inventory",
      label: "Library",
      description: "Products & media",
      icon: FolderOpen,
      section: "main",
    },
  ]

  const settings: StudioNavItem[] = [
    {
      id: "brain",
      href: `/brain${entityQuery}`,
      match: "/brain",
      label: "Brand Brain",
      description: "Voice & memory",
      icon: Brain,
      section: "settings",
    },
    {
      id: "socials",
      href: `/settings/social${entityQuery}`,
      match: "/settings/social",
      label: "Socials",
      description: "Channel connections",
      icon: Share2,
      section: "settings",
    },
    {
      id: "usage",
      href: `/analytics${entityQuery}`,
      match: "/analytics",
      label: "Usage",
      description: "AI & ops meter",
      icon: BarChart3,
      section: "settings",
    },
    {
      id: "help",
      href: `/help${entityQuery}`,
      match: "/help",
      label: "Help",
      description: "Features & SOPs",
      icon: CircleHelp,
      section: "settings",
    },
  ]

  return [...main, ...settings]
}

export function isStudioNavActive(
  pathname: string,
  match: string | string[]
): boolean {
  const prefixes = Array.isArray(match) ? match : [match]
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

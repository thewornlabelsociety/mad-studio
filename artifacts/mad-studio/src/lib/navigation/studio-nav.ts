import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Brain,
  CalendarDays,
  CircleHelp,
  FolderOpen,
  LayoutTemplate,
  ListChecks,
  Share2,
  Sparkles,
} from "lucide-react"

import { resolveEntityType } from "@/lib/social-creative/resolve-entity-type"
import type { AccessibleEntity } from "@/lib/types"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"

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

/** Plan, Week, Dates, Campaigns and Promo are views of one Calendar destination. */
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
      id: "week",
      href: `/week${entityQuery}`,
      match: "/week",
      // "Grid", so it isn't confused with the calendar's week view.
      label: "Grid",
      description: "Your Instagram grid and the week's rhythm",
    },
    ...(showPromoFor(activeEntity)
      ? [
          {
            id: "dates",
            href: `/dates${entityQuery}`,
            match: "/dates",
            label: "Dates",
            description: "NZ holidays, sale days and seasons",
          },
        ]
      : []),
    {
      id: "campaigns",
      href: `/campaigns${entityQuery}`,
      match: "/campaigns",
      label: "Campaigns",
      description: "Queue, storyboard & results",
    },
  ]
  // No Promo tab: the dot special lives on the Sale rack and Specials (Create).
  // The /promo page still works for old links.
  return views
}

/** The Worn Label template screens, all reached from Create. */
const TEMPLATE_SCREENS = [
  "/templates/wls-sale-rack",
  "/templates/wls-specials",
  "/templates/wls-week-outfits",
  "/templates/wls-inspo",
  "/templates/wls-wants",
  "/templates/wls-edit",
  "/templates/wls-three-ways",
  "/templates/wls-staff-outfit",
  "/templates/wls-announcement",
  "/templates/wls-opening-hours",
  "/templates/wls-daily-story",
]

export function buildStudioNavItems(input: {
  entityQuery: string
  activeEntity: AccessibleEntity | null
}): StudioNavItem[] {
  const { entityQuery } = input
  // Worn Label makes posts from its templates: Create is their menu, with
  // Studio at the bottom for anything else. Other brands go straight to Studio.
  const wornLabel = input.activeEntity
    ? isWornLabelFashionEntity({ name: input.activeEntity.name, industry: input.activeEntity.industry })
    : false
  const studioHref = wornLabel
    ? `/create${entityQuery}`
    : entityQuery
      ? `/studio${entityQuery}&step=2`
      : "/studio?step=2"

  const main: StudioNavItem[] = [
    {
      id: "today",
      href: `/today${entityQuery}`,
      match: "/today",
      label: "Today",
      description: "Stories and today's post",
      icon: ListChecks,
      section: "main",
    },
    {
      id: "calendar",
      // The calendar: Fill this day, drafts to approve, and what's booked.
      href: `/planner${entityQuery}`,
      match: [...buildCalendarViews(input).map((view) => view.match), "/promo"],
      label: "Plan",
      description: "Calendar, drafts and approvals",
      icon: CalendarDays,
      section: "main",
    },
    {
      id: "create",
      href: studioHref,
      // The template screens are where Worn Label's posts are made.
      match: ["/create", "/studio", ...TEMPLATE_SCREENS],
      label: "Create",
      description: "Make a post",
      icon: Sparkles,
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
      id: "templates",
      href: `/templates${entityQuery}`,
      // Only its own page: the template screens under it belong to Create.
      match: "/templates$",
      label: "Templates",
      description: "Brand templates & starters",
      icon: LayoutTemplate,
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
  return prefixes.some((prefix) =>
    // A trailing $ means that page only, not the pages under it.
    prefix.endsWith("$")
      ? pathname === prefix.slice(0, -1)
      : pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

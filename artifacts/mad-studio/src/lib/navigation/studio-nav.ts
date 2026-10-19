import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Brain,
  CalendarDays,
  CircleDot,
  CircleHelp,
  FolderOpen,
  Inbox,
  Megaphone,
  Share2,
  Sparkles,
} from "lucide-react"

import { resolveEntityType } from "@/lib/social-creative/resolve-entity-type"
import type { AccessibleEntity } from "@/lib/types"

export type StudioNavItem = {
  id: string
  href: string
  match: string
  label: string
  description: string
  icon: LucideIcon
  section: "workflow" | "brand" | "settings"
}

export function buildStudioNavItems(input: {
  entityQuery: string
  activeEntity: AccessibleEntity | null
}): StudioNavItem[] {
  const { entityQuery, activeEntity } = input
  const studioHref = entityQuery
    ? `/studio${entityQuery}&step=2`
    : "/studio?step=2"

  const showPromo =
    resolveEntityType({
      name: activeEntity?.name,
      industry: activeEntity?.industry,
      entityId: activeEntity?.id,
    }) === "WORN_LABEL"

  const workflow: StudioNavItem[] = [
    {
      id: "inbox",
      href: `/today${entityQuery}`,
      match: "/today",
      label: "Inbox",
      description: "New from feed & queue",
      icon: Inbox,
      section: "workflow",
    },
    {
      id: "create",
      href: studioHref,
      match: "/studio",
      label: "Create",
      description: "Posts & captions",
      icon: Sparkles,
      section: "workflow",
    },
    {
      id: "plan",
      href: `/planner${entityQuery}`,
      match: "/planner",
      label: "Plan",
      description: "Multi-day campaigns",
      icon: CalendarDays,
      section: "workflow",
    },
    {
      id: "campaigns",
      href: `/campaigns${entityQuery}`,
      match: "/campaigns",
      label: "Campaigns",
      description: "Storyboard & ledger",
      icon: Megaphone,
      section: "workflow",
    },
  ]

  if (showPromo) {
    workflow.splice(2, 0, {
      id: "promo",
      href: `/promo${entityQuery}`,
      match: "/promo",
      label: "Promo",
      description: "Weekly tag specials",
      icon: CircleDot,
      section: "workflow",
    })
  }

  const brand: StudioNavItem[] = [
    {
      id: "brain",
      href: `/brain${entityQuery}`,
      match: "/brain",
      label: "Brain",
      description: "Voice & memory",
      icon: Brain,
      section: "brand",
    },
    {
      id: "library",
      href: `/inventory${entityQuery}`,
      match: "/inventory",
      label: "Library",
      description: "All intake items",
      icon: FolderOpen,
      section: "brand",
    },
    {
      id: "help",
      href: `/help${entityQuery}`,
      match: "/help",
      label: "Help",
      description: "Features & SOPs",
      icon: CircleHelp,
      section: "brand",
    },
  ]

  const settings: StudioNavItem[] = [
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
  ]

  return [...workflow, ...brand, ...settings]
}

export function isStudioNavActive(pathname: string, match: string): boolean {
  return pathname === match || pathname.startsWith(`${match}/`)
}

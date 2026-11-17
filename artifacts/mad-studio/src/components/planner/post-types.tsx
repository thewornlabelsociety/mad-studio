"use client"

import { lazy, type ComponentType, type LazyExoticComponent } from "react"
import {
  CalendarDays,
  Clock,
  Layers,
  Megaphone,
  Search,
  Shirt,
  Sparkles,
  Tag,
  Users,
  WandSparkles,
  type LucideIcon,
} from "lucide-react"

import type { VisualPresets } from "@/lib/entities/dna-schema"

/** What every template screen takes. */
export type TemplateProps = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

/** One kind of post that Fill this day can make in the drawer. */
export type PostType = {
  /** Also the draft's kind: a new one replaces the last draft of it that day. */
  id: string
  title: string
  detail: string
  icon: LucideIcon
  /** The template screen's path, for matching the week's rhythm. */
  path: string
  /** Default hour it's set to go out. */
  hour: number
  Editor: LazyExoticComponent<ComponentType<TemplateProps>>
}

// Loaded only when opened, so the planner stays quick.
const editor = <K extends string>(load: () => Promise<Record<K, ComponentType<TemplateProps>>>, name: K) =>
  lazy(() => load().then((module) => ({ default: module[name] })))

/** Worn Label's post types, in the order Fill this day lists them. */
export const WLS_POST_TYPES: PostType[] = [
  {
    id: "sale_rack",
    title: "Sale rack and dot special",
    detail: "Markdowns carousel, plus the dot special Story",
    icon: Tag,
    path: "/templates/wls-sale-rack",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-sale-rack-workspace"), "WlsSaleRackWorkspace"),
  },
  {
    id: "week_outfits",
    title: "A week of outfits",
    detail: "Carousel of seven looks from stock",
    icon: CalendarDays,
    path: "/templates/wls-week-outfits",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-week-outfits-workspace"), "WlsWeekOutfitsWorkspace"),
  },
  {
    id: "inspo",
    title: "Inspo vs WLS",
    detail: "The look, and your version from the racks",
    icon: Sparkles,
    path: "/templates/wls-inspo",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-inspo-workspace"), "WlsInspoWorkspace"),
  },
  {
    id: "wants",
    title: "We're searching for",
    detail: "Ask for the stock you want consigned",
    icon: Search,
    path: "/templates/wls-wants",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-wants-workspace"), "WlsWantsWorkspace"),
  },
  {
    id: "specials",
    title: "This week's specials",
    detail: "A dot special with was and now on every piece",
    icon: Tag,
    path: "/templates/wls-specials",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-specials-workspace"), "WlsSpecialsWorkspace"),
  },
  {
    id: "edit",
    title: "Themed edit",
    detail: "Race day, wedding guest: title, flatlay and pieces",
    icon: Layers,
    path: "/templates/wls-edit",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-edit-workspace"), "WlsEditWorkspace"),
  },
  {
    id: "three_ways",
    title: "One piece, three ways",
    detail: "One piece from the racks, styled three ways",
    icon: Shirt,
    path: "/templates/wls-three-ways",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-three-ways-workspace"), "WlsThreeWaysWorkspace"),
  },
  {
    id: "staff_outfit",
    title: "Staff outfit check",
    detail: "The team in pieces from the racks, every piece tagged",
    icon: Users,
    path: "/templates/wls-staff-outfit",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-staff-outfit-workspace"), "WlsStaffOutfitWorkspace"),
  },
  {
    id: "announcement",
    title: "Announcement",
    detail: "A sale, hours or an event",
    icon: Megaphone,
    path: "/templates/wls-announcement",
    hour: 11,
    Editor: editor(() => import("@/components/templates/wls-announcement-workspace"), "WlsAnnouncementWorkspace"),
  },
  {
    id: "opening_hours",
    title: "Opening hours",
    detail: "Today or the week, from the website",
    icon: Clock,
    path: "/templates/wls-opening-hours",
    hour: 9,
    Editor: editor(() => import("@/components/templates/wls-opening-hours-workspace"), "WlsOpeningHoursWorkspace"),
  },
]

/** Icon for the short video, which is still made in Studio. */
export const VIDEO_ICON: LucideIcon = WandSparkles

export function postTypeById(id: string | null | undefined): PostType | null {
  return WLS_POST_TYPES.find((type) => type.id === id) ?? null
}

export function postTypeByPath(path: string): PostType | null {
  return WLS_POST_TYPES.find((type) => type.path === path) ?? null
}

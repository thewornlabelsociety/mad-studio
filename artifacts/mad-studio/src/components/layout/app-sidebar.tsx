"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "wouter"
import { PanelLeft, Settings } from "lucide-react"

import { MadFavicon } from "@/components/brand/mad-logo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  buildStudioNavItems,
  isStudioNavActive,
  type StudioNavItem,
} from "@/lib/navigation/studio-nav"
import { usePathname } from "@/lib/next-compat"
import type { AccessibleEntity } from "@/lib/types"
import { cn } from "@/lib/utils"

const EXPANDED_KEY = "mad-studio-sidebar-expanded"

type Props = {
  entities: AccessibleEntity[]
  activeEntityId: string | null
  className?: string
  /** Brand Brain / SOP / Account — rendered above the collapse control. */
  utilitySlot?: (expanded: boolean) => ReactNode
}

function NavIconLink({
  item,
  pathname,
  expanded,
}: {
  item: StudioNavItem
  pathname: string
  expanded: boolean
}) {
  const active = isStudioNavActive(pathname, item.match)
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      aria-label={item.label}
      className={cn(
        "flex items-center gap-3 rounded-lg transition-colors",
        expanded ? "px-3 py-2 text-sm" : "size-10 justify-center",
        active
          ? "bg-mad-black text-mad-white shadow-sm"
          : "text-neutral-600 hover:bg-neutral-200/80 hover:text-mad-black"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-[1.15rem] shrink-0" aria-hidden />
      {expanded ? (
        <span className="truncate font-medium">{item.label}</span>
      ) : null}
    </Link>
  )

  if (expanded) return link

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="border border-neutral-200 bg-mad-black text-mad-white">
        <p className="font-semibold">{item.label}</p>
        <p className="text-neutral-300">{item.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function NavSection({
  items,
  pathname,
  expanded,
}: {
  items: StudioNavItem[]
  pathname: string
  expanded: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavIconLink
          key={item.id}
          item={item}
          pathname={pathname}
          expanded={expanded}
        />
      ))}
    </div>
  )
}

/** Set-up-once pages live behind one button so the sidebar stays at four. */
function SettingsMenu({
  items,
  pathname,
  expanded,
}: {
  items: StudioNavItem[]
  pathname: string
  expanded: boolean
}) {
  const active = items.some((item) => isStudioNavActive(pathname, item.match))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-3 rounded-lg transition-colors",
            expanded ? "px-3 py-2 text-sm" : "size-10 justify-center",
            active
              ? "bg-mad-black text-mad-white shadow-sm"
              : "text-neutral-600 hover:bg-neutral-200/80 hover:text-mad-black"
          )}
          aria-label="Settings"
        >
          <Settings className="size-[1.15rem] shrink-0" aria-hidden />
          {expanded ? (
            <span className="truncate font-medium">Settings</span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        className="min-w-[13rem] rounded-none border-2 border-mad-black shadow-keycap"
      >
        <DropdownMenuLabel className="font-typewriter text-[0.7rem] tracking-widest uppercase">
          Set up once
        </DropdownMenuLabel>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <DropdownMenuItem key={item.id} asChild className="rounded-none">
              <Link
                href={item.href}
                className={cn(
                  "flex items-start gap-2",
                  isStudioNavActive(pathname, item.match) && "font-bold"
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="text-xs text-neutral-500">
                    {item.description}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppSidebar({
  entities,
  activeEntityId,
  className,
  utilitySlot,
}: Props) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(EXPANDED_KEY) === "1") setExpanded(true)
    } catch {
      /* ignore */
    }
  }, [])

  function toggleExpanded() {
    setExpanded((value) => {
      const next = !value
      try {
        localStorage.setItem(EXPANDED_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const activeEntity =
    entities.find((entity) => entity.id === activeEntityId) ??
    entities[0] ??
    null

  const entityQuery = activeEntityId
    ? `?eid=${encodeURIComponent(activeEntityId)}`
    : ""

  const items = useMemo(
    () => buildStudioNavItems({ entityQuery, activeEntity }),
    [entityQuery, activeEntity]
  )

  const main = items.filter((item) => item.section === "main")
  const settings = items.filter((item) => item.section === "settings")

  const homeHref = `/today${entityQuery}`

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-neutral-200 bg-neutral-100/90 md:flex",
          expanded ? "w-[13.5rem]" : "w-[3.75rem]",
          className
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center py-3",
            expanded ? "px-3" : "justify-center px-2"
          )}
        >
          <Link href={homeHref} aria-label="MAD Studio home">
            <MadFavicon
              className={cn(
                "border-2 border-mad-black transition-transform hover:scale-105",
                expanded ? "size-9" : "size-8"
              )}
            />
          </Link>
        </div>

        <nav
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-2"
          aria-label="Studio"
        >
          <NavSection items={main} pathname={pathname} expanded={expanded} />
          <div className="min-h-2 flex-1" aria-hidden />
          <SettingsMenu
            items={settings}
            pathname={pathname}
            expanded={expanded}
          />
        </nav>

        <div
          className={cn(
            "shrink-0 space-y-1 border-t border-neutral-200 p-2",
            expanded ? "px-3" : ""
          )}
        >
          {utilitySlot ? (
            <div className={cn(!expanded && "flex flex-col items-center")}>
              {utilitySlot(expanded)}
            </div>
          ) : null}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleExpanded}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-200/80 hover:text-mad-black",
                  expanded ? "h-9 w-full gap-2 px-3 text-sm" : "size-10"
                )}
                aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              >
                <PanelLeft
                  className={cn("size-[1.15rem]", expanded && "rotate-180")}
                />
                {expanded ? (
                  <span className="text-sm font-medium">Collapse</span>
                ) : null}
              </button>
            </TooltipTrigger>
            {!expanded ? (
              <TooltipContent side="right">Expand menu</TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

/** Flat link list for mobile menu */
export function useStudioNavLinks(
  entities: AccessibleEntity[],
  activeEntityId: string | null
) {
  const activeEntity =
    entities.find((entity) => entity.id === activeEntityId) ??
    entities[0] ??
    null
  const entityQuery = activeEntityId
    ? `?eid=${encodeURIComponent(activeEntityId)}`
    : ""
  return useMemo(
    () => buildStudioNavItems({ entityQuery, activeEntity }),
    [entityQuery, activeEntity]
  )
}

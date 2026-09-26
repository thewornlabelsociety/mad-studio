"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import { Check, ChevronsUpDown, Menu, Plus } from "lucide-react"

import { setActiveEntity } from "@/app/actions/auth"
import { MadStudioLogo } from "@/components/brand/mad-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { AccessibleEntity } from "@/lib/types"

type BrandSwitcherProps = {
  entities: AccessibleEntity[]
  activeEntityId: string | null
  className?: string
}

export function BrandSwitcher({
  entities,
  activeEntityId,
  className,
}: BrandSwitcherProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const active =
    entities.find((entity) => entity.id === activeEntityId) ??
    entities[0] ??
    null

  function onSelect(entityId: string) {
    startTransition(async () => {
      await setActiveEntity(entityId, { redirectTo: pathname })
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "mad-keycap-sm max-w-[11rem] min-w-0 justify-between gap-2 rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-[0.65rem] tracking-typewriter-tight uppercase text-mad-black hover:bg-mad-lime hover:text-mad-black sm:max-w-[14rem]",
            className
          )}
          disabled={pending}
        >
          <span className="truncate">
            {active?.name ?? "Select a brand"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[14rem] rounded-none border-2 border-mad-black shadow-keycap"
      >
        <DropdownMenuLabel className="font-typewriter text-[0.65rem] tracking-typewriter uppercase">
          Switch brand
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-mad-black" />
        {entities.length === 0 ? (
          <DropdownMenuItem disabled>No brands yet</DropdownMenuItem>
        ) : (
          entities.map((entity) => (
            <DropdownMenuItem
              key={entity.id}
              onSelect={() => onSelect(entity.id)}
              className="flex items-center justify-between gap-3 rounded-none"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{entity.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {entity.industry}
                </span>
              </span>
              {entity.id === active?.id ? (
                <Check className="size-3.5 shrink-0 text-mad-vermillion" />
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="bg-mad-black" />
        <DropdownMenuItem
          onSelect={() => {
            router.push("/entities/new")
          }}
          className="gap-2 rounded-none"
        >
          <Plus className="size-3.5" />
          Add New Brand
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type NavLink = {
  href: string
  label: string
  match: string
}

type TopbarProps = {
  entities: AccessibleEntity[]
  activeEntityId: string | null
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
}

export function AppTopbar({
  entities,
  activeEntityId,
  userEmail,
  teamSlot,
}: TopbarProps) {
  const pathname = usePathname()
  const entityQuery = activeEntityId
    ? `?eid=${encodeURIComponent(activeEntityId)}`
    : ""

  // Primary ops nav — inventory retired into Studio; media tray lives on Studio step 1.
  const links: NavLink[] = [
    { href: `/today${entityQuery}`, label: "Today", match: "/today" },
    { href: `/studio${entityQuery}`, label: "Studio", match: "/studio" },
    { href: `/brain${entityQuery}`, label: "Brain", match: "/brain" },
    {
      href: `/campaigns${entityQuery}`,
      label: "Campaigns",
      match: "/campaigns",
    },
    {
      href: `/analytics${entityQuery}`,
      label: "Meter",
      match: "/analytics",
    },
    {
      href: `/settings/social${entityQuery}`,
      label: "Socials",
      match: "/settings/social",
    },
  ]

  function isActive(match: string) {
    return pathname === match || pathname.startsWith(`${match}/`)
  }

  return (
    <header className="sticky top-0 z-40 border-b-2 border-mad-black bg-mad-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <MadStudioLogo size="sm" href={`/today${entityQuery}`} />
            <BrandSwitcher
              entities={entities}
              activeEntityId={activeEntityId}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="lg:hidden">
              <MobileNav links={links} isActive={isActive} />
            </div>
            {teamSlot}
            {userEmail ? (
              <span className="hidden max-w-[10rem] truncate font-typewriter text-[0.55rem] tracking-typewriter-tight text-neutral-600 uppercase xl:inline">
                {userEmail}
              </span>
            ) : null}
          </div>
        </div>

        <nav className="hidden items-center gap-1 border-t-2 border-mad-black/10 pt-2 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "border-2 px-2.5 py-1 font-typewriter text-[0.65rem] tracking-typewriter-tight uppercase transition-colors",
                isActive(link.match)
                  ? "border-mad-black bg-mad-black text-mad-white shadow-keycap-sm"
                  : "border-transparent text-mad-black hover:border-mad-black hover:bg-mad-lime"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

function MobileNav({
  links,
  isActive,
}: {
  links: NavLink[]
  isActive: (match: string) => boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] uppercase shadow-keycap-sm"
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
          Menu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[12rem] rounded-none border-2 border-mad-black shadow-keycap"
      >
        {links.map((link) => (
          <DropdownMenuItem key={link.href} asChild className="rounded-none">
            <Link
              href={link.href}
              className={cn(isActive(link.match) && "font-bold")}
            >
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import { Link } from "wouter"
import { usePathname, useRouter } from "@/lib/next-compat"
import { useTransition } from "react"
import { Check, ChevronsUpDown, CircleHelp, Menu, Plus, User } from "lucide-react"

import { setActiveEntity, signOut } from "@/lib/actions"
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
          <span className="truncate">{active?.name ?? "Select a brand"}</span>
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

export type TopbarProps = {
  entities: AccessibleEntity[]
  activeEntityId: string | null
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
  /** Studio draft pill, restoring indicator, etc. */
  centerSlot?: React.ReactNode
}

export function AppTopbar({
  entities,
  activeEntityId,
  userEmail,
  isOrgAdmin,
  organizationId,
  teamSlot,
  centerSlot = null,
}: TopbarProps) {
  const pathname = usePathname()
  const entityQuery = activeEntityId
    ? `?eid=${encodeURIComponent(activeEntityId)}`
    : ""

  const studioHref = entityQuery
    ? `/studio${entityQuery}&step=2`
    : "/studio?step=2"

  const primaryLinks: NavLink[] = [
    { href: `/today${entityQuery}`, label: "Today", match: "/today" },
    { href: studioHref, label: "Studio", match: "/studio" },
    {
      href: `/campaigns${entityQuery}`,
      label: "Campaigns",
      match: "/campaigns",
    },
  ]

  function isActive(match: string) {
    return pathname === match || pathname.startsWith(`${match}/`)
  }

  return (
    <header className="sticky top-0 z-40 border-b-2 border-mad-black bg-mad-white">
      <div className="flex w-full items-center justify-between gap-2 py-2 pl-2 pr-3 sm:pl-3 sm:pr-4 lg:pr-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <MadStudioLogo size="sm" href={`/today${entityQuery}`} />
          <BrandSwitcher
            entities={entities}
            activeEntityId={activeEntityId}
          />
          <nav
            className="hidden min-w-0 items-center gap-1 md:flex"
            aria-label="Primary"
          >
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "shrink-0 border-2 px-2.5 py-1.5 font-typewriter text-[0.65rem] tracking-typewriter-tight uppercase transition-colors sm:px-3",
                  isActive(link.match)
                    ? "border-mad-black bg-mad-black text-mad-white shadow-keycap-sm"
                    : "border-transparent text-mad-black hover:border-mad-black hover:bg-mad-lime"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {centerSlot ? (
            <div className="hidden min-w-0 shrink sm:block">{centerSlot}</div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {centerSlot ? (
            <div className="min-w-0 shrink sm:hidden">{centerSlot}</div>
          ) : null}
          <Link
            href={`/help${entityQuery}`}
            className={cn(
              "hidden items-center gap-1.5 border-2 px-2.5 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase transition-colors sm:inline-flex",
              isActive("/help")
                ? "border-mad-black bg-mad-black text-mad-white"
                : "border-mad-black bg-mad-white text-mad-black hover:bg-mad-lime"
            )}
            title="Features, SOPs & workflows"
          >
            <CircleHelp className="size-3.5" aria-hidden />
            Help
          </Link>
          <div className="md:hidden">
            <MobileNav
              primaryLinks={primaryLinks}
              entityQuery={entityQuery}
              isActive={isActive}
              userEmail={userEmail}
              isOrgAdmin={isOrgAdmin}
              organizationId={organizationId}
              teamSlot={teamSlot}
            />
          </div>
          <AccountMenu
            entityQuery={entityQuery}
            userEmail={userEmail}
            isOrgAdmin={isOrgAdmin}
            organizationId={organizationId}
            teamSlot={teamSlot}
            isActive={isActive}
            className="hidden md:flex"
          />
        </div>
      </div>
    </header>
  )
}

function AccountMenu({
  entityQuery,
  userEmail,
  isOrgAdmin,
  organizationId,
  teamSlot,
  isActive,
  className,
}: {
  entityQuery: string
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
  isActive: (match: string) => boolean
  className?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 rounded-none border-2 border-mad-black font-typewriter text-[0.6rem] uppercase shadow-keycap-sm",
            className
          )}
        >
          <User className="size-3.5" />
          Account
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[12rem] rounded-none border-2 border-mad-black shadow-keycap"
      >
        {userEmail ? (
          <>
            <DropdownMenuLabel className="max-w-[14rem] truncate font-typewriter text-[0.55rem] normal-case">
              {userEmail}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-mad-black" />
          </>
        ) : null}
        <DropdownMenuItem asChild className="rounded-none">
          <Link href={`/analytics${entityQuery}`}>Meter</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-none">
          <Link href={`/settings/social${entityQuery}`}>Socials</Link>
        </DropdownMenuItem>
        {isOrgAdmin && organizationId && teamSlot ? (
          <DropdownMenuItem asChild className="rounded-none p-0">
            <div className="w-full px-2 py-1.5">{teamSlot}</div>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild className="rounded-none">
          <Link href={`/help${entityQuery}`} className={isActive("/help") ? "font-bold" : ""}>
            Help &amp; SOPs
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-mad-black" />
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => {
            startTransition(async () => {
              await signOut()
              window.location.assign("/login")
            })
          }}
          className="rounded-none font-bold"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileNav({
  primaryLinks,
  entityQuery,
  isActive,
  userEmail,
  isOrgAdmin,
  organizationId,
  teamSlot,
}: {
  primaryLinks: NavLink[]
  entityQuery: string
  isActive: (match: string) => boolean
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
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
        {primaryLinks.map((link) => (
          <DropdownMenuItem key={link.href} asChild className="rounded-none">
            <Link
              href={link.href}
              className={cn(isActive(link.match) && "font-bold")}
            >
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-mad-black" />
        <DropdownMenuItem asChild className="rounded-none">
          <Link href={`/analytics${entityQuery}`}>Meter</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-none">
          <Link href={`/settings/social${entityQuery}`}>Socials</Link>
        </DropdownMenuItem>
        {userEmail ? (
          <DropdownMenuLabel className="truncate font-typewriter text-[0.55rem] normal-case">
            {userEmail}
          </DropdownMenuLabel>
        ) : null}
        {isOrgAdmin && organizationId && teamSlot ? (
          <DropdownMenuItem asChild className="rounded-none p-0">
            <div className="w-full px-2 py-1.5">{teamSlot}</div>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild className="rounded-none">
          <Link href={`/help${entityQuery}`}>Help &amp; SOPs</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

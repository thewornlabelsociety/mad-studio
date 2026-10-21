"use client"

import { useEffect, useState } from "react"
import { Link } from "wouter"
import { usePathname, useRouter } from "@/lib/next-compat"
import { useTransition } from "react"
import { Brain, Check, ChevronsUpDown, Menu, Plus, User } from "lucide-react"

import { setActiveEntity, signOut } from "@/lib/actions"
import { useStudioNavLinks } from "@/components/layout/app-sidebar"
import { BrainDrawer } from "@/components/brain/brain-drawer"
import { TeamSopGuideDrawer, TeamSopGuideSheet } from "@/components/studio/sop-guide-drawer"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  isStudioNavActive,
  type StudioNavItem,
} from "@/lib/navigation/studio-nav"
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
            "mad-keycap-sm max-w-[11rem] min-w-0 justify-between gap-2 rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-[0.75rem] tracking-typewriter-tight uppercase text-mad-black hover:bg-mad-lime hover:text-mad-black sm:max-w-[14rem]",
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
        <DropdownMenuLabel className="font-typewriter text-[0.75rem] tracking-typewriter uppercase">
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

export type TopbarProps = {
  entities: AccessibleEntity[]
  activeEntityId: string | null
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
  centerSlot?: React.ReactNode
  /** Draft / studio actions rendered inside mobile Menu only (< md). */
  mobileMenuSlot?: React.ReactNode
  /** Brand Brain / SOP / Account live in the left sidebar (desktop). */
  utilitiesInSidebar?: boolean
  onOpenBrain?: () => void
  onOpenTeamSop?: () => void
  brainOpen?: boolean
}

export function AppTopbar({
  entities,
  activeEntityId,
  userEmail,
  isOrgAdmin,
  organizationId,
  teamSlot,
  centerSlot = null,
  mobileMenuSlot = null,
  utilitiesInSidebar = false,
  onOpenBrain,
  onOpenTeamSop,
  brainOpen = false,
}: TopbarProps) {
  const pathname = usePathname()
  const [localSopOpen, setLocalSopOpen] = useState(false)
  const [localBrainOpen, setLocalBrainOpen] = useState(false)

  const navItems = useStudioNavLinks(entities, activeEntityId)
  const activeEntity =
    entities.find((entity) => entity.id === activeEntityId) ?? null
  const sopOpen = utilitiesInSidebar ? false : localSopOpen
  const brainIsOpen = utilitiesInSidebar ? brainOpen : localBrainOpen

  // Ctrl+B when shell is not owning the drawer.
  useEffect(() => {
    if (!activeEntity || utilitiesInSidebar) return
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "b"
      ) {
        event.preventDefault()
        setLocalBrainOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeEntity, utilitiesInSidebar])

  const openBrain = () => {
    if (onOpenBrain) onOpenBrain()
    else setLocalBrainOpen((open) => !open)
  }
  const openSop = () => {
    if (onOpenTeamSop) onOpenTeamSop()
    else setLocalSopOpen(true)
  }

  const brainButton = (className?: string) =>
    activeEntity ? (
      <button
        type="button"
        onClick={openBrain}
        aria-pressed={brainIsOpen}
        title="Brand Brain (Ctrl+B)"
        className={cn(
          "inline-flex items-center gap-1.5 border-2 border-mad-black px-2.5 py-1.5 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase shadow-keycap-sm transition-colors hover:bg-mad-lime",
          brainIsOpen ? "bg-mad-lime" : "bg-mad-white",
          className
        )}
      >
        <Brain className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden md:inline">Brand Brain</span>
        <span className="sr-only md:hidden">Brand Brain</span>
      </button>
    ) : null

  function isActive(match: string | string[]) {
    return isStudioNavActive(pathname, match)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-mad-white md:border-b">
      {!utilitiesInSidebar ? (
        <>
          <TeamSopGuideSheet open={sopOpen} onOpenChange={setLocalSopOpen} />
          {activeEntity ? (
            <BrainDrawer
              open={localBrainOpen}
              onOpenChange={setLocalBrainOpen}
              entityId={activeEntity.id}
              entityName={activeEntity.name}
              industry={activeEntity.industry ?? ""}
            />
          ) : null}
        </>
      ) : null}

      <div className="flex w-full items-center justify-between gap-2 px-2 py-1.5 md:hidden">
        <div className="flex min-w-0 flex-1">
          <BrandSwitcher
            entities={entities}
            activeEntityId={activeEntityId}
            className="max-w-[min(100%,14rem)]"
          />
        </div>
        {brainButton("h-8 px-2")}
        <MobileNav
          navItems={navItems}
          isActive={isActive}
          userEmail={userEmail}
          isOrgAdmin={isOrgAdmin}
          organizationId={organizationId}
          teamSlot={teamSlot}
          mobileMenuSlot={mobileMenuSlot}
          onOpenTeamSop={openSop}
          triggerLabel="Menu"
        />
      </div>

      <div
        className={cn(
          "hidden w-full items-center justify-between gap-2 border-neutral-200 bg-mad-white md:flex",
          utilitiesInSidebar ? "py-1.5 pl-3 pr-3" : "py-2.5 pl-4 pr-4 lg:pr-5"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BrandSwitcher
            entities={entities}
            activeEntityId={activeEntityId}
            className="max-w-[min(100%,18rem)] border-neutral-300 font-sans text-sm normal-case tracking-normal"
          />
          {centerSlot ? (
            <div className="hidden min-w-0 shrink md:block">{centerSlot}</div>
          ) : null}
        </div>

        {!utilitiesInSidebar ? (
          <div className="flex shrink-0 items-center gap-2">
            {brainButton()}
            <TeamSopGuideDrawer className="hidden md:inline-flex" />
            <AccountMenu
              userEmail={userEmail}
              isOrgAdmin={isOrgAdmin}
              organizationId={organizationId}
              teamSlot={teamSlot}
            />
          </div>
        ) : null}
      </div>
    </header>
  )
}

export function AccountMenu({
  userEmail,
  isOrgAdmin,
  organizationId,
  teamSlot,
  className,
  iconOnly = false,
}: {
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
  className?: string
  iconOnly?: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1.5 rounded-none border-2 border-mad-black font-typewriter text-[0.72rem] uppercase shadow-keycap-sm",
            iconOnly && "border-0 shadow-none hover:bg-neutral-200/80",
            className
          )}
          aria-label="Account"
        >
          <User className="size-3.5 shrink-0" />
          {iconOnly ? (
            <span className="sr-only">Account</span>
          ) : (
            "Account"
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[12rem] rounded-none border-2 border-mad-black shadow-keycap"
      >
        {userEmail ? (
          <>
            <DropdownMenuLabel className="max-w-[14rem] truncate font-typewriter text-[0.7rem] normal-case">
              {userEmail}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-mad-black" />
          </>
        ) : null}
        {isOrgAdmin && organizationId && teamSlot ? (
          <DropdownMenuItem asChild className="rounded-none p-0">
            <div className="w-full px-2 py-1.5">{teamSlot}</div>
          </DropdownMenuItem>
        ) : null}
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
  navItems,
  isActive,
  userEmail,
  isOrgAdmin,
  organizationId,
  teamSlot,
  mobileMenuSlot,
  onOpenTeamSop,
  triggerLabel = "Menu",
}: {
  navItems: StudioNavItem[]
  isActive: (match: string | string[]) => boolean
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
  mobileMenuSlot?: React.ReactNode
  onOpenTeamSop?: () => void
  triggerLabel?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 rounded-none border-2 border-mad-black px-2.5 font-typewriter text-[0.75rem] font-bold uppercase shadow-keycap-sm"
          aria-label="Open menu"
        >
          <Menu className="size-4" />
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[12rem] rounded-none border-2 border-mad-black shadow-keycap"
      >
        {mobileMenuSlot ? (
          <>
            {mobileMenuSlot}
            <DropdownMenuSeparator className="bg-mad-black" />
          </>
        ) : null}
        {navItems
          .filter((item) => item.section === "main")
          .map((item) => (
            <DropdownMenuItem key={item.id} asChild className="rounded-none">
              <Link
                href={item.href}
                className={cn(isActive(item.match) && "font-bold")}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator className="bg-mad-black" />
        <DropdownMenuLabel className="font-typewriter text-[0.7rem] tracking-widest uppercase text-neutral-500">
          Settings
        </DropdownMenuLabel>
        {navItems
          .filter((item) => item.section === "settings")
          .map((item) => (
            <DropdownMenuItem key={item.id} asChild className="rounded-none">
              <Link
                href={item.href}
                className={cn(
                  "text-neutral-600",
                  isActive(item.match) && "font-bold text-mad-black"
                )}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator className="bg-mad-black" />
        <DropdownMenuItem
          className="rounded-none font-typewriter text-[0.75rem] font-bold uppercase"
          onSelect={() => onOpenTeamSop?.()}
        >
          Team SOP &amp; posting guide
        </DropdownMenuItem>
        {userEmail ? (
          <DropdownMenuLabel className="truncate font-typewriter text-[0.7rem] normal-case">
            {userEmail}
          </DropdownMenuLabel>
        ) : null}
        {isOrgAdmin && organizationId && teamSlot ? (
          <DropdownMenuItem asChild className="rounded-none p-0">
            <div className="w-full px-2 py-1.5">{teamSlot}</div>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="bg-mad-black" />
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => window.location.assign("/login"))
          }}
          className="rounded-none font-bold"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

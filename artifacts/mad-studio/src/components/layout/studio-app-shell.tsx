"use client"

import { useEffect, useState, type ReactNode } from "react"
import { BookOpen, Brain } from "lucide-react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  AccountMenu,
  AppTopbar,
  type TopbarProps,
} from "@/components/layout/app-topbar"
import { BrainDrawer } from "@/components/brain/brain-drawer"
import { TeamSopGuideSheet } from "@/components/studio/sop-guide-drawer"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = TopbarProps & {
  children: ReactNode
  className?: string
  mainClassName?: string
}

function SidebarUtilityButton({
  expanded,
  label,
  tooltip,
  active,
  onClick,
  children,
}: {
  expanded: boolean
  label: string
  tooltip: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-200/80 hover:text-mad-black",
        expanded ? "h-9 w-full gap-2 px-3 text-sm" : "size-10 justify-center",
        active && "bg-mad-lime text-mad-black"
      )}
    >
      {children}
      {expanded ? <span className="truncate font-medium">{label}</span> : null}
    </button>
  )
  if (expanded) return button
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        className="border border-neutral-200 bg-mad-black text-mad-white"
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export function StudioAppShell({
  children,
  className,
  mainClassName,
  ...topbarProps
}: Props) {
  const [brainOpen, setBrainOpen] = useState(false)
  const [sopOpen, setSopOpen] = useState(false)
  const activeEntity =
    topbarProps.entities.find(
      (entity) => entity.id === topbarProps.activeEntityId
    ) ?? null

  useEffect(() => {
    if (!activeEntity) return
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "b"
      ) {
        event.preventDefault()
        setBrainOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeEntity])

  return (
    <div
      className={cn(
        "flex h-svh max-h-svh overflow-hidden bg-neutral-100",
        className
      )}
    >
      <TeamSopGuideSheet open={sopOpen} onOpenChange={setSopOpen} />
      {activeEntity ? (
        <BrainDrawer
          open={brainOpen}
          onOpenChange={setBrainOpen}
          entityId={activeEntity.id}
          entityName={activeEntity.name}
          industry={activeEntity.industry ?? ""}
        />
      ) : null}

      <AppSidebar
        entities={topbarProps.entities}
        activeEntityId={topbarProps.activeEntityId}
        settingsActions={[
          {
            id: "team-sop",
            label: "Team SOP",
            description: "Posting guide for the team",
            icon: BookOpen,
            onSelect: () => setSopOpen(true),
          },
        ]}
        utilitySlot={(expanded) => (
          <div
            className={cn(
              "flex flex-col gap-0.5",
              !expanded && "items-center"
            )}
          >
            {activeEntity ? (
              <SidebarUtilityButton
                expanded={expanded}
                label="Brand Brain"
                tooltip="Brand Brain (Ctrl+B)"
                active={brainOpen}
                onClick={() => setBrainOpen((open) => !open)}
              >
                <Brain className="size-[1.15rem] shrink-0" aria-hidden />
              </SidebarUtilityButton>
            ) : null}
            <AccountMenu
              userEmail={topbarProps.userEmail}
              isOrgAdmin={topbarProps.isOrgAdmin}
              organizationId={topbarProps.organizationId}
              teamSlot={topbarProps.teamSlot}
              iconOnly={!expanded}
              className={cn(
                expanded
                  ? "h-9 w-full justify-start gap-2 px-3"
                  : "size-10 justify-center px-0"
              )}
            />
          </div>
        )}
      />
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar
          {...topbarProps}
          utilitiesInSidebar
          onOpenBrain={() => setBrainOpen((open) => !open)}
          onOpenTeamSop={() => setSopOpen(true)}
          brainOpen={brainOpen}
        />
        <main
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-mad-white",
            mainClassName
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

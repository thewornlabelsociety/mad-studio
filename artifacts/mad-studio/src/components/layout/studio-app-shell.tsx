"use client"

import type { ReactNode } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppTopbar, type TopbarProps } from "@/components/layout/app-topbar"
import { cn } from "@/lib/utils"

type Props = TopbarProps & {
  children: ReactNode
  className?: string
  mainClassName?: string
}

export function StudioAppShell({
  children,
  className,
  mainClassName,
  ...topbarProps
}: Props) {
  return (
    <div className={cn("flex h-svh max-h-svh overflow-hidden bg-neutral-100", className)}>
      <AppSidebar
        entities={topbarProps.entities}
        activeEntityId={topbarProps.activeEntityId}
      />
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar {...topbarProps} />
        <main
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-mad-white",
            mainClassName
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

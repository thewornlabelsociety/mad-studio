"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  className?: string
}

export function AnchoredPhoneShell({ children, className }: Props) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[272px] shrink-0 flex-col items-center justify-start",
        className
      )}
    >
      {children}
    </div>
  )
}

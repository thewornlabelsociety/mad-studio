"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Loader2 } from "lucide-react"

import { AppTopbar } from "@/components/layout/app-topbar"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
import { DraftActivePill } from "@/components/studio/draft-active-pill"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import type { AccessibleEntity } from "@/lib/types"

type StudioChromeState = {
  draftActive: boolean
  rehydrating: boolean
  onStartFresh: (() => void) | null
}

type StudioChromeContextValue = StudioChromeState & {
  setChrome: (patch: Partial<StudioChromeState>) => void
  clearChrome: () => void
}

const defaultChrome: StudioChromeState = {
  draftActive: false,
  rehydrating: false,
  onStartFresh: null,
}

const StudioChromeContext = createContext<StudioChromeContextValue | null>(null)

export function StudioChromeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(defaultChrome)

  const setChrome = useCallback((patch: Partial<StudioChromeState>) => {
    setState((current) => {
      const changed = (Object.keys(patch) as (keyof StudioChromeState)[]).some(
        (key) => patch[key] !== current[key]
      )
      return changed ? { ...current, ...patch } : current
    })
  }, [])

  const clearChrome = useCallback(() => {
    setState((current) =>
      current.draftActive === defaultChrome.draftActive &&
      current.rehydrating === defaultChrome.rehydrating &&
      current.onStartFresh === defaultChrome.onStartFresh
        ? current
        : defaultChrome
    )
  }, [])

  const value = useMemo(
    (): StudioChromeContextValue => ({
      ...state,
      setChrome,
      clearChrome,
    }),
    [state, setChrome, clearChrome]
  )

  return (
    <StudioChromeContext.Provider value={value}>
      {children}
    </StudioChromeContext.Provider>
  )
}

export function useStudioChrome() {
  const ctx = useContext(StudioChromeContext)
  if (!ctx) {
    throw new Error("useStudioChrome must be used within StudioChromeProvider")
  }
  return ctx
}

export function useStudioChromeOptional() {
  return useContext(StudioChromeContext)
}

type StudioChromeTopbarProps = {
  entities: AccessibleEntity[]
  activeEntityId: string | null
  userEmail: string | null
  isOrgAdmin: boolean
  organizationId: string | null
  teamSlot?: React.ReactNode
}

function useStudioChromeTopbarSlots() {
  const chrome = useContext(StudioChromeContext)
  const draftActive = chrome?.draftActive ?? false
  const rehydrating = chrome?.rehydrating ?? false
  const onStartFresh = chrome?.onStartFresh ?? null

  let centerSlot: ReactNode = null
  if (draftActive && onStartFresh) {
    centerSlot = <DraftActivePill onStartFresh={onStartFresh} />
  } else if (rehydrating) {
    centerSlot = (
      <span className="inline-flex items-center gap-1.5 font-typewriter text-[0.7rem] font-bold tracking-wider text-neutral-500 uppercase">
        <Loader2 className="size-3 animate-spin" />
        Restoring…
      </span>
    )
  }

  let mobileMenuSlot: ReactNode = null
  if (draftActive && onStartFresh) {
    mobileMenuSlot = (
      <>
        <DropdownMenuLabel className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">
          Draft active
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="rounded-none font-typewriter text-[0.75rem] font-bold uppercase text-mad-vermillion"
          onSelect={onStartFresh}
        >
          Start fresh
        </DropdownMenuItem>
      </>
    )
  } else if (rehydrating) {
    mobileMenuSlot = (
      <DropdownMenuLabel className="inline-flex items-center gap-1.5 font-typewriter text-[0.7rem] uppercase">
        <Loader2 className="size-3 animate-spin" />
        Restoring…
      </DropdownMenuLabel>
    )
  }

  return { centerSlot, mobileMenuSlot }
}

/** @deprecated Use StudioChromeShell */
export function StudioChromeTopbar(props: StudioChromeTopbarProps) {
  const { centerSlot, mobileMenuSlot } = useStudioChromeTopbarSlots()
  return (
    <AppTopbar
      {...props}
      centerSlot={centerSlot}
      mobileMenuSlot={mobileMenuSlot}
    />
  )
}

type StudioChromeShellProps = StudioChromeTopbarProps & {
  children: ReactNode
  mainClassName?: string
  className?: string
}

export function StudioChromeShell({
  children,
  mainClassName,
  className,
  ...topbarProps
}: StudioChromeShellProps) {
  const { centerSlot, mobileMenuSlot } = useStudioChromeTopbarSlots()
  return (
    <StudioAppShell
      {...topbarProps}
      className={className}
      mainClassName={mainClassName}
      centerSlot={centerSlot}
      mobileMenuSlot={mobileMenuSlot}
    >
      {children}
    </StudioAppShell>
  )
}

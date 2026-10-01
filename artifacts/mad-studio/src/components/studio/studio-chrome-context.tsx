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
import { DraftActivePill } from "@/components/studio/draft-active-pill"
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
    setState((current) => ({ ...current, ...patch }))
  }, [])

  const clearChrome = useCallback(() => {
    setState(defaultChrome)
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

export function StudioChromeTopbar(props: StudioChromeTopbarProps) {
  const chrome = useContext(StudioChromeContext)
  const draftActive = chrome?.draftActive ?? false
  const rehydrating = chrome?.rehydrating ?? false
  const onStartFresh = chrome?.onStartFresh ?? null

  let centerSlot: ReactNode = null
  if (draftActive && onStartFresh) {
    centerSlot = <DraftActivePill onStartFresh={onStartFresh} />
  } else if (rehydrating) {
    centerSlot = (
      <span className="inline-flex items-center gap-1.5 font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
        <Loader2 className="size-3 animate-spin" />
        Restoring…
      </span>
    )
  }

  return <AppTopbar {...props} centerSlot={centerSlot} />
}

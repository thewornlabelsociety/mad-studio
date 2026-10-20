"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "@/lib/next-compat"

import { MadStudioLogo } from "@/components/brand/mad-logo"
import { CampaignStoryboardTab } from "@/components/campaigns/campaign-storyboard-tab"
import { PastLedgerTab } from "@/components/campaigns/past-ledger-tab"
import { cn } from "@/lib/utils"

export type CampaignsWorkspaceTab = "storyboard" | "ledger"

type Props = {
  entityId: string
  entityName: string
  programId?: string | null
}

const TAB_OPTIONS: CampaignsWorkspaceTab[] = ["storyboard", "ledger"]

const TAB_LABEL_DISPLAY: Record<CampaignsWorkspaceTab, string> = {
  storyboard: "CAMPAIGN STORYBOARD",
  ledger: "PAST LEDGER",
}

function parseTabParam(value: string | null): CampaignsWorkspaceTab | null {
  if (value === "storyboard" || value === "ledger") return value
  return null
}

export function CampaignsWorkspace({ entityId, entityName, programId }: Props) {
  const searchParams = useSearchParams()
  const initialTab = parseTabParam(searchParams.get("tab")) ?? "storyboard"
  const [tab, setTab] = useState<CampaignsWorkspaceTab>(initialTab)
  const [ledgerActivated, setLedgerActivated] = useState(initialTab === "ledger")

  useEffect(() => {
    // Tab title is set by RouteTitle (App.tsx).
  }, [])

  useEffect(() => {
    if (tab === "ledger") setLedgerActivated(true)
  }, [tab])

  // One screen: title and tabs on one row, the open tab scrolls inside.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Campaigns · {entityName}
          </p>
          <h1 className="font-typewriter text-lg font-bold tracking-typewriter-tight uppercase">
            Storyboard &amp; ledger
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((optionId) => {
            const active = tab === optionId
            return (
              <button
                key={optionId}
                type="button"
                onClick={() => setTab(optionId)}
                className={cn(
                  "border-2 border-mad-black px-3 py-2 font-typewriter text-[0.75rem] font-bold tracking-widest uppercase transition-colors",
                  active
                    ? "bg-mad-black text-mad-white shadow-keycap"
                    : "bg-mad-white text-mad-black shadow-keycap-sm hover:bg-mad-lime"
                )}
              >
                {TAB_LABEL_DISPLAY[optionId]}
              </button>
            )
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={tab === "storyboard" ? "block" : "hidden"}>
          <CampaignStoryboardTab entityId={entityId} programId={programId} />
        </div>
        <div className={tab === "ledger" ? "block" : "hidden"}>
          <PastLedgerTab
            entityId={entityId}
            entityName={entityName}
            active={ledgerActivated}
          />
        </div>
      </div>
    </div>
  )
}

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
  storyboard: "📅 CAMPAIGN STORYBOARD",
  ledger: "📊 PAST LEDGER",
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
    document.title = "Campaigns | MAD Studio"
  }, [])

  useEffect(() => {
    if (tab === "ledger") setLedgerActivated(true)
  }, [tab])

  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b-2 border-mad-black pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <MadStudioLogo size="sm" />
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              MAD Studio · Campaigns
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
              Ops workspace for planning and ledger — not the public brand site.
              Active brand:{" "}
              <span className="font-semibold text-mad-black">{entityName}</span>{" "}
              (switch in the top bar).
            </p>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-20 -mx-4 border-b-2 border-mad-black bg-mad-white/95 px-4 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap gap-3">
          {TAB_OPTIONS.map((optionId) => {
            const active = tab === optionId
            return (
              <button
                key={optionId}
                type="button"
                onClick={() => setTab(optionId)}
                className={cn(
                  "border-2 border-mad-black px-4 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest uppercase transition-colors sm:text-xs",
                  active
                    ? "bg-mad-black text-mad-white shadow-keycap"
                    : "bg-mad-white text-mad-black shadow-keycap-sm hover:bg-mad-lime"
                )}
              >
                [ {TAB_LABEL_DISPLAY[optionId]} ]
              </button>
            )
          })}
        </div>
      </header>

      <div className="min-h-[420px]">
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

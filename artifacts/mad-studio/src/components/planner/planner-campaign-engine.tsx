"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import type { CampaignAutonomyMode } from "@/lib/campaigns/program-types"
import type { PlannerDuration } from "@/lib/planner/planner-timeline-types"
import { cn } from "@/lib/utils"

const DURATION_OPTIONS: { id: PlannerDuration; label: string }[] = [
  { id: "3-day", label: "3-Day" },
  { id: "5-day", label: "5-Day" },
  { id: "1-week", label: "1-Week" },
]

type Props = {
  className?: string
  generating?: boolean
  lastError?: string | null
  programTitle?: string | null
  onGenerate: (
    brief: string,
    duration: PlannerDuration,
    autonomyMode: CampaignAutonomyMode
  ) => void | Promise<void>
}

const AUTONOMY_OPTIONS: {
  id: CampaignAutonomyMode
  label: string
  hint: string
}[] = [
  {
    id: "suggest",
    label: "Suggest",
    hint: "Timeline + packs only — you arm manually",
  },
  {
    id: "arm",
    label: "Arm",
    hint: "Auto-generate packs and queue scheduled_posts",
  },
  {
    id: "full_auto",
    label: "Full auto",
    hint: "Arm + autonomous dispatch when cron runs",
  },
]

export function PlannerCampaignEngine({
  className,
  generating = false,
  lastError = null,
  programTitle = null,
  onGenerate,
}: Props) {
  const [brief, setBrief] = useState("")
  const [duration, setDuration] = useState<PlannerDuration>("5-day")
  const [autonomyMode, setAutonomyMode] = useState<CampaignAutonomyMode>("arm")

  const canGenerate = brief.trim().length >= 8 && !generating

  return (
    <aside
      className={cn(
        "flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-r-2 border-mad-black bg-mad-white xl:w-[400px]",
        className
      )}
    >
      <header className="shrink-0 border-b-2 border-mad-black px-4 py-3">
        <h2 className="font-typewriter text-xs font-bold tracking-widest text-mad-black uppercase">
          CAMPAIGN ENGINE
        </h2>
        {programTitle ? (
          <p className="mt-1 font-typewriter text-[0.55rem] leading-snug text-neutral-600">
            Active program: {programTitle}
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        <label className="flex min-h-0 flex-1 flex-col gap-2">
          <span className="font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
            Launch brief
          </span>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="Describe the multi-day event or launch (e.g., Worn Label Marketplace Launch)..."
            className="min-h-[8rem] flex-1 resize-none border-2 border-mad-black bg-mad-white p-3 font-typewriter text-xs leading-relaxed text-mad-black outline-none placeholder:text-neutral-400 focus:bg-mad-lime/10"
          />
        </label>

        <div className="shrink-0 space-y-2">
          <p className="font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
            Duration
          </p>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((option) => {
              const active = duration === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={generating}
                  onClick={() => setDuration(option.id)}
                  className={cn(
                    "border-2 border-mad-black px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase transition-colors disabled:opacity-50",
                    active
                      ? "bg-mad-black text-mad-white shadow-keycap-sm"
                      : "bg-mad-white text-mad-black shadow-keycap-sm hover:bg-mad-lime"
                  )}
                >
                  [ {option.label} ]
                </button>
              )
            })}
          </div>
        </div>

        <div className="shrink-0 space-y-2">
          <p className="font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
            Autonomy
          </p>
          <div className="flex flex-col gap-2">
            {AUTONOMY_OPTIONS.map((option) => {
              const active = autonomyMode === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={generating}
                  onClick={() => setAutonomyMode(option.id)}
                  className={cn(
                    "border-2 border-mad-black px-3 py-2 text-left font-typewriter text-[0.55rem] transition-colors disabled:opacity-50",
                    active
                      ? "bg-mad-black text-mad-white shadow-keycap-sm"
                      : "bg-mad-white text-mad-black shadow-keycap-sm hover:bg-mad-lime/40"
                  )}
                >
                  <span className="font-bold uppercase tracking-wider">{option.label}</span>
                  <span className="mt-0.5 block text-[0.5rem] leading-snug opacity-80">
                    {option.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {lastError ? (
          <p
            className="shrink-0 border-2 border-mad-black bg-mad-vermillion/10 p-3 font-typewriter text-[0.6rem] leading-relaxed text-mad-black"
            role="alert"
          >
            {lastError}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => void onGenerate(brief, duration, autonomyMode)}
          className="flex shrink-0 items-center justify-center gap-2 border-2 border-mad-black bg-[#FF5500] px-4 py-3 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Generating…
            </>
          ) : (
            "[ ✨ GENERATE TIMELINE ]"
          )}
        </button>
      </div>
    </aside>
  )
}

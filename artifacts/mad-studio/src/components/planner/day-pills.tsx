"use client"

import { useEffect, useState } from "react"
import { Link } from "wouter"

import { getCampaignPlans } from "@/lib/actions"
import { campaignCovers, campaignStepsOn, type CampaignPlan } from "@/lib/planner/campaign-recipes"
import { momentsOnDay } from "@/lib/planner/nz-moments"
import { cn } from "@/lib/utils"

/** This brand's saved campaigns; empty until loaded, or when `enabled` is false. */
export function useCampaignPlans(entityId: string, enabled: boolean): CampaignPlan[] {
  const [plans, setPlans] = useState<CampaignPlan[]>([])
  useEffect(() => {
    if (!enabled) return
    let live = true
    void (async () => {
      const result = (await getCampaignPlans({ entityId })) as { ok: boolean; data?: { plans: CampaignPlan[] } }
      if (live && result.ok && result.data) setPlans(result.data.plans)
    })()
    return () => {
      live = false
    }
  }, [entityId, enabled])
  return plans
}

/** NZ date pills for a day, minus any a campaign that day already shows. */
export function datePillsOn(campaigns: CampaignPlan[], date: Date) {
  return momentsOnDay(date).filter((moment) => !campaignCovers(campaigns, moment, date))
}

/** Pills for a calendar day: campaign steps, then NZ dates and school holidays. */
export function DayPills({
  date,
  entityId,
  campaigns,
  compact = false,
  className,
}: {
  date: Date
  entityId: string
  campaigns: CampaignPlan[]
  /** Month view: one line, cut short. */
  compact?: boolean
  className?: string
}) {
  const steps = campaignStepsOn(campaigns, date)
  const moments = datePillsOn(campaigns, date)
  if (steps.length === 0 && moments.length === 0) return null
  const eid = encodeURIComponent(entityId)
  const pill = "rounded-full px-2 py-px text-[10px] font-medium leading-4"
  return (
    <div className={cn("flex gap-1", compact ? "min-w-0 flex-col" : "flex-wrap", className)}>
      {steps.map(({ plan, step }) => (
        <Link
          key={step.id}
          href={`/campaigns?eid=${eid}`}
          title={`${plan.name}: ${step.detail}`}
          className={cn(
            pill,
            "border",
            compact && "truncate",
            step.done ? "border-mad-black/20 text-mad-black/45 line-through" : "border-mad-black bg-white text-mad-black"
          )}
        >
          {step.title.toLowerCase().includes(plan.name.toLowerCase()) ? step.title : `${plan.name}: ${step.title}`}
        </Link>
      ))}
      {moments.map((moment) => (
        <Link
          key={moment.id}
          href={`/dates?eid=${eid}`}
          title={moment.why}
          className={cn(
            pill,
            compact && "truncate",
            moment.kind === "school"
              ? "bg-[#D7C4A6]/60 text-mad-black"
              : moment.kind === "sale"
                ? "bg-mad-black text-mad-white"
                : "bg-mad-lime/50 text-mad-black"
          )}
        >
          {moment.name}
        </Link>
      ))}
    </div>
  )
}

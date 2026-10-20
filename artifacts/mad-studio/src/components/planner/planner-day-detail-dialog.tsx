"use client"

import { ArrowRight, Sparkles } from "lucide-react"

import { useRouter } from "wouter"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PlannerTimelineDay } from "@/lib/planner/planner-timeline-types"
import {
  buildPlannerStudioSpark,
  writeStudioPlannerHandoff,
} from "@/lib/planner/studio-handoff"
import { formatPlannerStartDate } from "@/lib/planner/planner-timeline-client"

type Props = {
  entityId: string
  day: PlannerTimelineDay | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlannerDayDetailDialog({
  entityId,
  day,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter()

  if (!day) return null

  function craftInStudio() {
    const handoff = {
      phase: day!.phase,
      hook: day!.hook,
      vibe: day!.vibe,
      directorialAction: day!.directorialAction,
      scheduledDate: formatPlannerStartDate(day!.date),
    }
    writeStudioPlannerHandoff(entityId, handoff)
    const spark = buildPlannerStudioSpark(handoff)
    const params = new URLSearchParams({
      eid: entityId,
      step: "3",
      prompt: spark.slice(0, 500),
    })
    onOpenChange(false)
    router.push(`/studio?${params.toString()}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-2 border-mad-black bg-mad-white shadow-keycap">
        <DialogHeader>
          <p className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">
            <span className="bg-[#CCFF00] px-1 py-0.5 text-mad-black">DRAFT</span>
          </p>
          <DialogTitle className="font-typewriter text-sm font-bold tracking-widest text-mad-black uppercase">
            {day.phase}
          </DialogTitle>
          <p className="font-typewriter text-[0.7rem] text-neutral-500 tabular-nums">
            {formatPlannerStartDate(day.date)}
          </p>
        </DialogHeader>

        <div className="space-y-3 font-typewriter text-xs leading-relaxed text-mad-black">
          <div>
            <p className="text-[0.7rem] font-bold tracking-wider text-neutral-500 uppercase">
              Hook
            </p>
            <p className="mt-1">{day.hook}</p>
          </div>
          <div>
            <p className="text-[0.7rem] font-bold tracking-wider text-neutral-500 uppercase">
              Vibe
            </p>
            <p className="mt-1">{day.vibe}</p>
          </div>
          <div>
            <p className="text-[0.7rem] font-bold tracking-wider text-neutral-500 uppercase">
              Directorial action
            </p>
            <p className="mt-1 italic">{day.directorialAction}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={craftInStudio}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black px-4 py-3 font-typewriter text-[0.75rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap hover:bg-neutral-900"
        >
          <Sparkles className="size-3.5" aria-hidden />
          Craft in Studio
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </DialogContent>
    </Dialog>
  )
}

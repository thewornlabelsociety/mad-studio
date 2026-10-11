"use client"



import { useCallback, useEffect, useState } from "react"

import { toast } from "sonner"



import { PlannerCalendarCanvas } from "@/components/planner/planner-calendar-canvas"

import { PlannerCampaignEngine } from "@/components/planner/planner-campaign-engine"

import { PlannerDayDetailDialog } from "@/components/planner/planner-day-detail-dialog"

import {

  fetchCampaignProgram,

  programDaysToTimeline,

} from "@/lib/campaigns/program-client"

import type {
  CampaignAutonomyMode,
  CampaignProgramRow,
} from "@/lib/campaigns/program-types"

import { useRouter, useSearchParams } from "@/lib/next-compat"

import { requestPlannerTimeline } from "@/lib/planner/planner-timeline-client"

import { resolvePlannerStartDate } from "@/lib/planner/planner-schedule-dates"

import type {

  PlannerDuration,

  PlannerTimelineDay,

} from "@/lib/planner/planner-timeline-types"



type Props = {

  entityId: string

}



export function PlannerWorkspace({ entityId }: Props) {

  const router = useRouter()

  const searchParams = useSearchParams()

  const programIdFromUrl = searchParams.get("programId")?.trim() || null



  const [anchorDate, setAnchorDate] = useState(() => new Date())

  const [timeline, setTimeline] = useState<PlannerTimelineDay[]>([])

  const [program, setProgram] = useState<CampaignProgramRow | null>(null)

  const [programId, setProgramId] = useState<string | null>(programIdFromUrl)

  const [generating, setGenerating] = useState(false)

  const [hydrating, setHydrating] = useState(true)

  const [lastError, setLastError] = useState<string | null>(null)

  const [selectedDay, setSelectedDay] = useState<PlannerTimelineDay | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)



  useEffect(() => {

    document.title = "Planner | MAD Studio"

  }, [])



  useEffect(() => {

    let cancelled = false

    async function hydrate() {

      setHydrating(true)

      try {

        const loaded = await fetchCampaignProgram({

          entityId,

          programId: programIdFromUrl,

        })

        if (cancelled) return

        if (loaded.program && loaded.days.length > 0) {

          setProgram(loaded.program)

          setProgramId(loaded.program.id)

          const days = programDaysToTimeline(loaded.days)

          setTimeline(days)

          if (days[0]?.date) setAnchorDate(days[0].date)

        }

      } catch (error) {

        if (!cancelled) {

          console.warn("[planner] hydrate", error)

        }

      } finally {

        if (!cancelled) setHydrating(false)

      }

    }

    void hydrate()

    return () => {

      cancelled = true

    }

  }, [entityId, programIdFromUrl])



  const syncProgramUrl = useCallback(

    (nextProgramId: string) => {

      const params = new URLSearchParams(searchParams.toString())

      params.set("eid", entityId)

      params.set("programId", nextProgramId)

      router.replace(`/planner?${params.toString()}`, { scroll: false })

    },

    [entityId, router, searchParams]

  )



  const handleGenerate = useCallback(

    async (brief: string, duration: PlannerDuration, autonomyMode: CampaignAutonomyMode) => {

      setGenerating(true)

      setLastError(null)

      const startDate = resolvePlannerStartDate({

        brief,

        duration,

        fallbackStart: new Date(),

      })



      try {

        const { days, programId: nextProgramId } = await requestPlannerTimeline({

          entityId,

          prompt: brief.trim(),

          duration,

          startDate,

          autonomyMode,

        })

        setTimeline(days)

        if (days[0]?.date) {

          setAnchorDate(days[0].date)

        }

        if (nextProgramId) {

          setProgramId(nextProgramId)

          syncProgramUrl(nextProgramId)

          const loaded = await fetchCampaignProgram({

            entityId,

            programId: nextProgramId,

          })

          setProgram(loaded.program)

        }

        toast.success(`Timeline saved — ${days.length} day${days.length === 1 ? "" : "s"}.`)

      } catch (error) {

        const message =

          error instanceof Error ? error.message : "Could not generate timeline."

        setLastError(message)

        toast.error(message)

      } finally {

        setGenerating(false)

      }

    },

    [entityId, syncProgramUrl]

  )



  const handleSelectDay = useCallback((day: PlannerTimelineDay) => {

    setSelectedDay(day)

    setDetailOpen(true)

  }, [])



  return (

    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-mad-white">

      <PlannerCampaignEngine

        generating={generating || hydrating}

        lastError={lastError}

        programTitle={program?.title ?? null}

        onGenerate={handleGenerate}

      />

      <PlannerCalendarCanvas

        anchorDate={anchorDate}

        timeline={timeline}

        onSelectDay={handleSelectDay}

      />

      <PlannerDayDetailDialog

        entityId={entityId}

        day={selectedDay}

        open={detailOpen}

        onOpenChange={setDetailOpen}

      />

    </div>

  )

}



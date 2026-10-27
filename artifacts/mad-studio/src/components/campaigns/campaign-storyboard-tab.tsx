"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "wouter"
import { toast } from "sonner"

import {
  armProgramDay,
  fetchCampaignProgram,
  generateProgramDayPack,
  orchestrateCampaignProgram,
  programDaysToTimeline,
} from "@/lib/campaigns/program-client"
import type {
  CampaignProgramDayRow,
  CampaignProgramRow,
} from "@/lib/campaigns/program-types"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  programId?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  generating: "Generating",
  ready: "Ready",
  armed: "Armed",
  published: "Published",
  failed: "Failed",
  skipped: "Skipped",
}

function DayRow({
  entityId,
  day,
  busy,
  onGenerate,
  onArm,
}: {
  entityId: string
  day: CampaignProgramDayRow
  busy: boolean
  onGenerate: (dayId: string) => void
  onArm: (dayId: string) => void
}) {
  const studioHref = `/studio?eid=${encodeURIComponent(entityId)}&step=4&programDayId=${encodeURIComponent(day.id)}`
  const canGenerate = day.status === "pending" || day.status === "failed"
  const canArm = day.status === "ready"

  return (
    <tr className="border-b border-mad-black/15 align-top last:border-b-0">
      <td className="px-3 py-3 font-typewriter text-xs tabular-nums whitespace-nowrap">
        {day.scheduled_date}
      </td>
      <td className="px-3 py-3">
        <p className="font-typewriter text-xs font-bold uppercase">{day.phase}</p>
        <p className="mt-1 text-xs text-neutral-600">{day.hook}</p>
        {day.last_error ? (
          <p className="mt-1 text-[0.75rem] text-mad-vermillion">{day.last_error}</p>
        ) : null}
      </td>
      <td className="px-3 py-3 text-xs text-neutral-600 italic max-w-[14rem]">
        {day.directorial_action ?? "—"}
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-block border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.7rem] font-bold uppercase",
            day.status === "armed" || day.status === "published"
              ? "bg-mad-lime"
              : day.status === "failed"
                ? "bg-mad-vermillion/20"
                : "bg-mad-white"
          )}
        >
          {STATUS_LABEL[day.status] ?? day.status}
        </span>
      </td>
      <td className="px-3 py-3 text-right space-y-1">
        <div className="flex flex-col items-end gap-1">
          {canGenerate ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onGenerate(day.id)}
              className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase underline hover:text-mad-vermillion disabled:opacity-40"
            >
              Generate pack
            </button>
          ) : null}
          {canArm ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onArm(day.id)}
              className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase underline hover:text-mad-vermillion disabled:opacity-40"
            >
              Arm posts
            </button>
          ) : null}
          <Link
            href={studioHref}
            className="font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase underline hover:text-mad-vermillion"
          >
            Craft →
          </Link>
        </div>
      </td>
    </tr>
  )
}

export function CampaignStoryboardTab({ entityId, programId }: Props) {
  const [program, setProgram] = useState<CampaignProgramRow | null>(null)
  const [days, setDays] = useState<CampaignProgramDayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchCampaignProgram({ entityId, programId })
      setProgram(result.program)
      setDays(result.days)
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load program."
      )
    } finally {
      setLoading(false)
    }
  }, [entityId, programId])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleGenerate(dayId: string) {
    setBusy(true)
    try {
      await generateProgramDayPack({ entityId, dayId })
      toast.success("Pack saved to program day.")
      await reload()
    } catch (generateError) {
      toast.error(
        generateError instanceof Error ? generateError.message : "Generate failed."
      )
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleArm(dayId: string) {
    setBusy(true)
    try {
      const result = await armProgramDay({ entityId, dayId })
      toast.success(`Armed ${result.armed} scheduled post(s).`)
      await reload()
    } catch (armError) {
      toast.error(armError instanceof Error ? armError.message : "Arm failed.")
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleBulkOrchestrate() {
    if (!program) return
    setBusy(true)
    try {
      await orchestrateCampaignProgram({
        entityId,
        programId: program.id,
        maxDays: 5,
      })
      toast.success("Headless worker finished batch.")
      await reload()
    } catch (orchestrateError) {
      toast.error(
        orchestrateError instanceof Error
          ? orchestrateError.message
          : "Orchestrate failed."
      )
      await reload()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <p className="font-typewriter text-[0.75rem] tracking-widest text-neutral-500 uppercase">
        Loading campaign program…
      </p>
    )
  }

  if (error) {
    return (
      <p className="border-2 border-mad-black bg-mad-vermillion/10 p-4 text-sm" role="alert">
        {error}
      </p>
    )
  }

  if (!program || days.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 border-2 border-dashed border-mad-black bg-mad-white px-6 py-16 text-center shadow-keycap-sm">
        <p className="font-typewriter text-sm tracking-widest text-neutral-500 uppercase">
          No saved campaign program yet
        </p>
        <p className="max-w-md text-sm text-neutral-600">
          Generate a timeline in{" "}
          <Link href={`/planner?eid=${encodeURIComponent(entityId)}`} className="font-bold underline">
            Planner
          </Link>{" "}
          — it persists to MAD Supabase as{" "}
          <code className="font-typewriter text-xs">campaign_programs</code> + day rows.
        </p>
      </div>
    )
  }

  const timelinePreview = programDaysToTimeline(days)
  const pendingCount = days.filter(
    (day) => day.status === "pending" || day.status === "failed"
  ).length

  return (
    <div className="space-y-4">
      <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
        <p className="font-typewriter text-[0.72rem] tracking-widest text-mad-vermillion uppercase">
          Active program
        </p>
        <h2 className="mt-1 font-typewriter text-lg font-bold text-mad-black">{program.title}</h2>
        <p className="mt-2 text-xs text-neutral-600">
          {program.start_date} → {program.end_date} · Autonomy:{" "}
          <span className="font-typewriter font-bold uppercase">{program.autonomy_mode}</span> ·{" "}
          {days.length} day{days.length === 1 ? "" : "s"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/planner?eid=${encodeURIComponent(entityId)}&programId=${encodeURIComponent(program.id)}`}
            className="border-2 border-mad-black bg-mad-black px-3 py-1.5 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase"
          >
            Open in Planner
          </Link>
          {pendingCount > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleBulkOrchestrate()}
              className="border-2 border-mad-black bg-mad-lime px-3 py-1.5 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase disabled:opacity-50"
            >
              Bulk generate ({Math.min(pendingCount, 5)} days)
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto border-2 border-mad-black bg-mad-white shadow-keycap-sm">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-mad-black bg-mad-black text-mad-white">
              <th className="px-3 py-2 font-typewriter text-[0.7rem] tracking-widest uppercase">
                Date
              </th>
              <th className="px-3 py-2 font-typewriter text-[0.7rem] tracking-widest uppercase">
                Phase / Hook
              </th>
              <th className="px-3 py-2 font-typewriter text-[0.7rem] tracking-widest uppercase">
                Directorial
              </th>
              <th className="px-3 py-2 font-typewriter text-[0.7rem] tracking-widest uppercase">
                Status
              </th>
              <th className="px-3 py-2 font-typewriter text-[0.7rem] tracking-widest uppercase text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <DayRow
                key={day.id}
                entityId={entityId}
                day={day}
                busy={busy}
                onGenerate={(id) => void handleGenerate(id)}
                onArm={(id) => void handleArm(id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-typewriter text-[0.7rem] text-neutral-500">
        Headless pack uses latest intake media + Gemini multiplexer; Arm writes{" "}
        <code className="text-xs">scheduled_posts</code> with Brain timing.{" "}
        {timelinePreview.length} calendar day{timelinePreview.length === 1 ? "" : "s"} synced.
      </p>
    </div>
  )
}

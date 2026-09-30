"use client"

import { useMemo, useState } from "react"
import { Link } from "wouter"

import { PullNewArrivalsButton } from "@/components/inventory/pull-new-arrivals-button"
import { BrainEmblemLink } from "@/components/brand/brain-emblem"
import { IntakeActionCard } from "@/components/today/intake-action-card"
import { FudiFeedCarouselDialog } from "@/components/today/fudi-feed-carousel-dialog"
import { IntakePreviewDialog } from "@/components/today/intake-preview-dialog"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"
import type { TodayQueueView } from "@/lib/today/queue"
import {
  formatAgendaLiveDate,
  platformEmoji,
  platformLabel,
} from "@/lib/today/agenda"
import { resolveInventoryIntakeMode } from "@/lib/inventory/entity-intake"
import { cn } from "@/lib/utils"

export type ArmedTodayRow = {
  id: string
  platform: string
  scheduledTime: string
  title: string
  status: string
}

type Props = {
  entityId: string
  entityName: string
  industry: string
  websiteUrl?: string | null
  liveDateLabel: string
  brainDirective: string
  unfeaturedCount: number
  armedCount: number
  initialQueue: TodayQueueView[]
  armedRows: ArmedTodayRow[]
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
  }).format(new Date(iso))
}

export function TodayCommandDashboard({
  entityId,
  entityName,
  industry,
  websiteUrl = null,
  liveDateLabel,
  brainDirective,
  unfeaturedCount,
  armedCount,
  initialQueue,
  armedRows,
}: Props) {
  const [queue, setQueue] = useState(initialQueue)
  const [preview, setPreview] = useState<TodayQueueView | null>(null)
  const [carouselOpen, setCarouselOpen] = useState(false)
  const isFudi = useMemo(
    () => isFudiStudioEntity({ name: entityName, industry }),
    [entityName, industry]
  )
  const intakeMode = useMemo(
    () => resolveInventoryIntakeMode({ name: entityName, industry }),
    [entityName, industry]
  )

  return (
    <div className="space-y-8">
      <header className="border-b-2 border-mad-black pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              {liveDateLabel} // Daily Agenda
            </p>
            <h1 className="font-typewriter text-2xl font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-3xl">
              Today&apos;s Command Hub // {entityName}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
              Autonomous marketing radar: incoming drops, scheduled dispatches,
              and brand priorities.
            </p>
          </div>
          <BrainEmblemLink entityId={entityId} size={96} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
            <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
              Intake Radar
            </p>
            <p className="mt-2 font-typewriter text-3xl font-bold text-mad-black">
              {unfeaturedCount}
            </p>
            <p className="mt-1 text-xs text-neutral-600">New unfeatured drops</p>
            <div className="mt-3">
              <PullNewArrivalsButton
                entityId={entityId}
                intakeMode={intakeMode}
                variant="agenda"
              />
            </div>
          </div>

          <div className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
            <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
              Armed Today
            </p>
            <p className="mt-2 font-typewriter text-3xl font-bold text-mad-black">
              {armedCount}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              Posts scheduled to dispatch today
            </p>
          </div>

          <div className="border-2 border-mad-black bg-[#CCFF00]/30 p-4 shadow-keycap-sm">
            <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-600 uppercase">
              Current Brain Directive
            </p>
            <p className="mt-2 text-sm font-medium leading-snug text-mad-black">
              {brainDirective}
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Priority action slate
            </p>
            <h2 className="mt-1 font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
              Incoming intake queue
            </h2>
          </div>
          {isFudi && queue.length >= 2 ? (
            <button
              type="button"
              onClick={() => setCarouselOpen(true)}
              className="border-2 border-mad-black bg-[#CCFF00] px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime"
            >
              Build feed carousel
            </button>
          ) : null}
        </div>

        {queue.length === 0 ? (
          <div className="border-2 border-dashed border-mad-black/40 bg-mad-white px-6 py-12 text-center shadow-keycap-sm">
            <p className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
              Intake clear
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              No unfeatured drops in radar. Refresh the feed or open Studio for a
              scratch campaign.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((view) => (
              <IntakeActionCard
                key={view.item.id}
                view={view}
                entityId={entityId}
                onSkip={(id) =>
                  setQueue((prev) => prev.filter((row) => row.item.id !== id))
                }
                onPreview={(row) => setPreview(row)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t-2 border-mad-black/15 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Armed for dispatch today
            </p>
            <h2 className="mt-1 font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
              {formatAgendaLiveDate().split(",")[0]} schedule
            </h2>
          </div>
          <Link
            href={`/campaigns?eid=${encodeURIComponent(entityId)}`}
            className="border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime"
          >
            [ Manage on Campaigns → ]
          </Link>
        </div>

        {armedRows.length === 0 ? (
          <p className="font-typewriter text-xs tracking-wider text-neutral-500 uppercase">
            Nothing armed for today — craft in Studio and schedule channels.
          </p>
        ) : (
          <ul className="space-y-2">
            {armedRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 border-2 border-mad-black bg-mad-white px-3 py-2.5 shadow-keycap-sm"
              >
                <span className="font-mono text-sm tabular-nums text-neutral-600">
                  {formatTime(row.scheduledTime)}
                </span>
                <span className="font-typewriter text-sm">
                  {platformEmoji(row.platform)} {platformLabel(row.platform)}
                </span>
                <span className="min-w-0 flex-1 truncate font-typewriter text-xs font-bold tracking-wide uppercase">
                  {row.title}
                </span>
                <span
                  className={cn(
                    "border border-mad-black px-2 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase",
                    row.status === "scheduled"
                      ? "bg-mad-lime text-mad-black"
                      : "bg-neutral-100"
                  )}
                >
                  [ 🟢 ARMED ]
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <IntakePreviewDialog
        view={preview}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
        entityId={entityId}
        entityName={entityName}
        industry={industry}
        websiteUrl={websiteUrl}
        onPublished={(itemId) =>
          setQueue((prev) => prev.filter((row) => row.item.id !== itemId))
        }
      />

      {isFudi ? (
        <FudiFeedCarouselDialog
          open={carouselOpen}
          onOpenChange={setCarouselOpen}
          entityId={entityId}
          queue={queue}
        />
      ) : null}
    </div>
  )
}

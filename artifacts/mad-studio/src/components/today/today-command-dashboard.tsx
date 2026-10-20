"use client"

import { useMemo, useState } from "react"
import { Link } from "wouter"

import { PullNewArrivalsButton } from "@/components/inventory/pull-new-arrivals-button"
import { BrainEmblemLink } from "@/components/brand/brain-emblem"
import { IntakeActionCard } from "@/components/today/intake-action-card"
import { TodayChecklist } from "@/components/today/today-checklist"
import { FudiFeedCarouselDialog } from "@/components/today/fudi-feed-carousel-dialog"
import { IntakePreviewDialog } from "@/components/today/intake-preview-dialog"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"
import type { TodayQueueView } from "@/lib/today/queue"
import {
  formatAgendaLiveDate,
  platformLabel,
} from "@/lib/today/agenda"
import { resolveInventoryIntakeMode } from "@/lib/inventory/entity-intake"
import type { DispatchCronHealth } from "@/lib/cron/read-dispatch-health"
import { cn } from "@/lib/utils"
import { PlatformIcon } from "@/components/ui/app-icons"
import { BrainTeam } from "@/components/today/brain-team"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"

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
  dispatchCronHealth?: DispatchCronHealth
  failedDispatchCount?: number
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
  dispatchCronHealth,
  failedDispatchCount = 0,
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
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              {liveDateLabel}
            </p>
            <h1 className="font-typewriter text-2xl font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-3xl">
              Today // {entityName}
            </h1>
          </div>
          <BrainEmblemLink entityId={entityId} size={72} />
        </div>

        <TodayChecklist
          entityId={entityId}
          failedCount={failedDispatchCount}
          scheduledCount={armedCount}
          newDropsCount={queue.length}
        />

        <p className="border-l-4 border-mad-lime pl-3 text-sm text-neutral-700">
          <span className="font-typewriter text-[0.6rem] font-bold tracking-widest text-neutral-500 uppercase">
            This week&apos;s focus ·{" "}
          </span>
          {brainDirective}
        </p>

        {dispatchCronHealth?.stale !== false ? (
          <p className="border-2 border-mad-vermillion bg-mad-vermillion/10 px-3 py-2 text-xs text-mad-black">
            <strong>Auto-posting may be paused.</strong> The scheduler last ran{" "}
            {dispatchCronHealth?.lastRunAt
              ? `at ${formatTime(dispatchCronHealth.lastRunAt)}`
              : "never"}
            {dispatchCronHealth?.lastStatus
              ? ` (${dispatchCronHealth.lastStatus})`
              : ""}
            .{" "}
            <Link
              href={`/campaigns?eid=${encodeURIComponent(entityId)}`}
              className="font-bold underline"
            >
              Check the queue
            </Link>
          </p>
        ) : null}
      </header>

      <BrainTeam
        entityId={entityId}
        websiteUrl={websiteUrl}
        isFashion={
          resolveIndustryProfile({ name: entityName, industry }).id === "worn_label"
        }
        items={queue.map((view) => view.item)}
      />

      <section
        id="going-out"
        className="scroll-mt-4 space-y-4 border-t-2 border-mad-black/15 pt-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Posts automatically
            </p>
            <h2 className="mt-1 font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
              Going out {formatAgendaLiveDate().split(",")[0].toLowerCase()}
            </h2>
          </div>
          <Link
            href={`/campaigns?eid=${encodeURIComponent(entityId)}`}
            className="border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime"
          >
            Edit in Calendar →
          </Link>
        </div>

        {armedRows.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing scheduled today. Make a post in Create and pick a time on
            the last step.
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
                <span className="inline-flex items-center gap-1.5 font-typewriter text-sm">
                  <PlatformIcon platform={row.platform} className="size-4" />
                  {platformLabel(row.platform)}
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
                  Scheduled
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        id="new-drops"
        className="scroll-mt-4 space-y-4 border-t-2 border-mad-black/15 pt-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Post from your phone
            </p>
            <h2 className="mt-1 font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
              New drops ({queue.length})
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              {unfeaturedCount} item{unfeaturedCount === 1 ? "" : "s"} in your
              library {unfeaturedCount === 1 ? "hasn't" : "haven't"} been
              posted yet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PullNewArrivalsButton
              entityId={entityId}
              intakeMode={intakeMode}
              variant="agenda"
            />
            <Link
              href={`/studio?eid=${encodeURIComponent(entityId)}&step=2&fresh=1`}
              className="inline-flex h-10 items-center justify-center gap-1 border-2 border-mad-black bg-mad-black px-3 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion"
            >
              Make a different post
            </Link>
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
        </div>

        {queue.length === 0 ? (
          <div className="border-2 border-dashed border-mad-black/40 bg-mad-white px-6 py-12 text-center shadow-keycap-sm">
            <p className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
              All caught up
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              No new drops waiting. Pull new arrivals if you&apos;ve added stock,
              or make a post from scratch.
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

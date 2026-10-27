"use client"

import { useMemo, useState } from "react"
import { Link } from "wouter"

import { DailyNewArrivalStoryButton } from "@/components/today/daily-new-arrival-story-button"
import { PullNewArrivalsButton } from "@/components/inventory/pull-new-arrivals-button"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
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
import type { IntakeCaptionDefaultSource } from "@/lib/inventory/intake-caption-default"
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
  intakeCaptionDefault: IntakeCaptionDefaultSource
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
  intakeCaptionDefault,
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
  const isWls = useMemo(
    () => isWornLabelFashionEntity({ name: entityName, industry }),
    [entityName, industry]
  )

  const goingOutLabel = formatAgendaLiveDate().split(",")[0].toLowerCase()
  const cronPaused = dispatchCronHealth?.stale !== false

  // Desktop Today is one screen: three columns that each scroll inside.
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
            {liveDateLabel}
          </p>
          <h1 className="font-typewriter text-xl font-bold tracking-typewriter-tight text-mad-black uppercase">
            Today // {entityName}
          </h1>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <p
            className="hidden max-w-xl truncate border-l-4 border-mad-lime pl-2 text-xs text-neutral-700 lg:block"
            title={brainDirective}
          >
            <span className="font-typewriter text-[0.7rem] font-bold tracking-widest text-neutral-500 uppercase">
              Focus ·{" "}
            </span>
            {brainDirective}
          </p>
          {cronPaused ? (
            <Link
              href={`/planner?eid=${encodeURIComponent(entityId)}`}
              title={`The scheduler last ran ${
                dispatchCronHealth?.lastRunAt ? `at ${formatTime(dispatchCronHealth.lastRunAt)}` : "never"
              }${dispatchCronHealth?.lastStatus ? ` (${dispatchCronHealth.lastStatus})` : ""}. Check the calendar.`}
              className="shrink-0 border-2 border-mad-vermillion bg-mad-vermillion/10 px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase hover:bg-mad-vermillion/20"
            >
              Auto-posting may be paused
            </Link>
          ) : null}
          <BrainEmblemLink entityId={entityId} size={44} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        {/* Left: the day's jobs and what goes out automatically. */}
        <div className="col-span-12 flex min-h-0 flex-col gap-3 overflow-y-auto lg:col-span-3">
          <TodayChecklist
            entityId={entityId}
            failedCount={failedDispatchCount}
            scheduledCount={armedCount}
            newDropsCount={queue.length}
          />

          <section
            id="going-out"
            className="border-2 border-mad-black bg-mad-white shadow-keycap-sm"
          >
            <div className="flex items-center justify-between gap-2 border-b-2 border-mad-black px-3 py-2">
              <div>
                <p className="font-typewriter text-[0.7rem] font-bold tracking-widest text-mad-vermillion uppercase">
                  Posts automatically
                </p>
                <h2 className="font-typewriter text-xs font-bold tracking-wide uppercase">
                  Going out {goingOutLabel}
                </h2>
              </div>
              <Link
                href={`/planner?eid=${encodeURIComponent(entityId)}`}
                className="shrink-0 border-2 border-mad-black px-2 py-1 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
              >
                Calendar →
              </Link>
            </div>
            {armedRows.length === 0 ? (
              <p className="px-3 py-3 text-xs text-neutral-500">
                Nothing scheduled today. Make a post in Create and pick a time on
                the last step.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {armedRows.map((row) => (
                  <li key={row.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="font-mono text-xs tabular-nums text-neutral-600">
                      {formatTime(row.scheduledTime)}
                    </span>
                    <PlatformIcon platform={row.platform} className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={`${platformLabel(row.platform)} · ${row.title}`}>
                      {row.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Middle: the Brain team, one role at a time. */}
        <BrainTeam
          tabbed
          className="col-span-12 min-h-[24rem] lg:col-span-5 lg:min-h-0"
          entityId={entityId}
          websiteUrl={websiteUrl}
          intakeCaptionDefault={intakeCaptionDefault}
          isFashion={
            resolveIndustryProfile({ name: entityName, industry }).id === "worn_label"
          }
          items={queue.map((view) => view.item)}
        />

        {/* Right: new drops to post. */}
        <section
          id="new-drops"
          className="col-span-12 flex min-h-[24rem] flex-col border-2 border-mad-black bg-mad-white shadow-keycap-sm lg:col-span-4 lg:min-h-0"
        >
          <div className="shrink-0 space-y-2 border-b-2 border-mad-black px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-typewriter text-xs font-bold tracking-wide uppercase">
                New drops ({queue.length})
              </h2>
              <p className="text-[0.75rem] text-neutral-500">
                {unfeaturedCount} unposted in Library
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <PullNewArrivalsButton
                entityId={entityId}
                intakeMode={intakeMode}
                variant="agenda"
              />
              <DailyNewArrivalStoryButton
                entityId={entityId}
                show={isWls}
              />
              <Link
                href={`/studio?eid=${encodeURIComponent(entityId)}&step=2&fresh=1`}
                className={cn(
                  "inline-flex h-10 items-center justify-center border-2 border-mad-black px-3 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase shadow-keycap-sm",
                  isWls
                    ? "bg-mad-white text-mad-black hover:bg-mad-lime"
                    : "bg-mad-black text-mad-white hover:bg-mad-vermillion"
                )}
              >
                New post
              </Link>
              {isFudi && queue.length >= 2 ? (
                <button
                  type="button"
                  onClick={() => setCarouselOpen(true)}
                  className="inline-flex h-10 items-center border-2 border-mad-black bg-[#CCFF00] px-3 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime"
                >
                  Feed carousel
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {queue.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="font-typewriter text-xs font-bold tracking-wide uppercase">
                  All caught up
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-neutral-600">
                  No new drops waiting. Pull new arrivals if you&apos;ve added
                  stock, or make a post from scratch.
                </p>
              </div>
            ) : (
              queue.map((view) => (
                <IntakeActionCard
                  key={view.item.id}
                  compact
                  view={view}
                  entityId={entityId}
                  onSkip={(id) =>
                    setQueue((prev) => prev.filter((row) => row.item.id !== id))
                  }
                  onPreview={(row) => setPreview(row)}
                />
              ))
            )}
          </div>
        </section>
      </div>

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

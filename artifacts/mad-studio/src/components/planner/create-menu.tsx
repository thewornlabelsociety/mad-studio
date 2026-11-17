"use client"

import { useEffect } from "react"
import { Link, useLocation } from "wouter"
import { ArrowRight, Clapperboard, Sparkles } from "lucide-react"

import { WLS_POST_TYPES, postTypeByPath, type PostType } from "@/components/planner/post-types"
import { WLS_WEEK_RHYTHM } from "@/lib/planner/week-rhythm"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { cn } from "@/lib/utils"

/**
 * Create, for Worn Label: the brand's post types, today's regular one first.
 * Each opens its template, which ends in the finish panel (day, time,
 * channels, caption, then draft or schedule). Studio stays for anything else.
 * Other brands go straight to Studio.
 */
export function CreateMenu({
  entityId,
  entityName,
  industry = null,
}: {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: unknown
}) {
  const [, navigate] = useLocation()
  const eid = encodeURIComponent(entityId)
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })

  useEffect(() => {
    if (!isWls) navigate(`/studio?eid=${eid}&step=2`, { replace: true })
  }, [isWls, eid, navigate])
  if (!isWls) return null

  // Monday first, as in the week's rhythm.
  const slot = WLS_WEEK_RHYTHM[(new Date().getDay() + 6) % 7]
  const todayType = postTypeByPath(slot.path)
  const weekday = new Date().toLocaleDateString("en-NZ", { weekday: "long" })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <header className="border-b-2 border-mad-black pb-3">
        <h1 className="brand-typewriter text-xl">Create</h1>
        <p className="mt-1 max-w-xl text-sm text-mad-black/70">
          Pick what to make. Each one finishes the same way: choose the day, time and where it goes, check
          the caption, then add it as a draft to approve or schedule it.
        </p>
      </header>

      <section aria-labelledby="create-today" className="grid gap-2">
        <h2 id="create-today" className="font-typewriter text-xs uppercase tracking-widest text-mad-black/60">
          {weekday}&apos;s post
        </h2>
        {todayType ? (
          <TypeCard type={todayType} detail={slot.detail} href={`${todayType.path}?eid=${eid}`} highlight />
        ) : (
          // The day's slot is a video (or open): made in Studio.
          <Link
            href={`/studio?eid=${eid}&step=2`}
            className="flex items-center gap-3 border-2 border-mad-black bg-mad-lime/20 p-4 hover:bg-mad-lime/40"
          >
            <Clapperboard className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{slot.title}</span>
              <span className="block text-xs text-mad-black/70">{slot.detail}. Made in Studio.</span>
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        )}
      </section>

      <section aria-labelledby="create-all" className="grid gap-2">
        <h2 id="create-all" className="font-typewriter text-xs uppercase tracking-widest text-mad-black/60">
          All post types
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {WLS_POST_TYPES.filter((type) => type.id !== todayType?.id).map((type) => (
            <li key={type.id}>
              <TypeCard type={type} href={`${type.path}?eid=${eid}`} />
            </li>
          ))}
          <li>
            <Link
              href={`/templates/wls-daily-story?eid=${eid}`}
              className="flex h-full items-center gap-3 border-2 border-mad-black bg-white p-3 hover:bg-[#F4EFE6]"
            >
              <Sparkles className="size-4 shrink-0 text-mad-black/60" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">New arrival Story</span>
                <span className="block text-xs text-mad-black/60">One piece, cut out on its vibe&apos;s colour</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-mad-black/40" aria-hidden />
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="create-other" className="grid gap-2">
        <h2 id="create-other" className="font-typewriter text-xs uppercase tracking-widest text-mad-black/60">
          Something else
        </h2>
        <Link
          href={`/studio?eid=${eid}&step=2`}
          className="flex items-center gap-3 border-2 border-dashed border-mad-black/50 p-3 hover:border-mad-black"
        >
          <Clapperboard className="size-4 shrink-0 text-mad-black/60" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Custom post or video in Studio</span>
            <span className="block text-xs text-mad-black/60">Try-ons, rack walks, or anything not covered above</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-mad-black/40" aria-hidden />
        </Link>
      </section>
    </div>
  )
}

function TypeCard({ type, href, detail, highlight = false }: { type: PostType; href: string; detail?: string; highlight?: boolean }) {
  const Icon = type.icon
  return (
    <Link
      href={href}
      className={cn(
        "flex h-full items-center gap-3 border-2 border-mad-black p-3",
        highlight ? "bg-mad-lime/20 p-4 hover:bg-mad-lime/40" : "bg-white hover:bg-[#F4EFE6]"
      )}
    >
      <Icon className={cn("shrink-0", highlight ? "size-5" : "size-4 text-mad-black/60")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{type.title}</span>
        <span className="block text-xs text-mad-black/60">{detail ?? type.detail}</span>
      </span>
      <ArrowRight className={cn("size-4 shrink-0", highlight ? "" : "text-mad-black/40")} aria-hidden />
    </Link>
  )
}

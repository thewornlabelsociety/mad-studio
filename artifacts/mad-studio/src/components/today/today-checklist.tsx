"use client"

import { useEffect, useState } from "react"
import { Link } from "wouter"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  failedCount: number
  scheduledCount: number
  newDropsCount: number
  /** Where "new drops" lives on this screen (desktop section or mobile deck). */
  newDropsHref?: string
  className?: string
}

type ManualCheck = "schedule" | "drops" | "ahead"

function todayKey(entityId: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
  }).format(new Date())
  return `mad-today-checks:${entityId}:${day}`
}

function readChecks(key: string): ManualCheck[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ManualCheck[]) : []
  } catch {
    return []
  }
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-NZ", {
      hour: "numeric",
      hour12: false,
      timeZone: "Pacific/Auckland",
    }).format(new Date())
  )
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

type Step = {
  id: string
  title: string
  detail: string
  done: boolean
  /** Auto steps finish themselves; manual ones get a tick button. */
  manual?: ManualCheck
  action?: { label: string; href: string }
}

/**
 * The day's jobs in order. Steps tick themselves off when the data says
 * they're done; the rest the operator ticks (remembered for today only).
 */
export function TodayChecklist({
  entityId,
  failedCount,
  scheduledCount,
  newDropsCount,
  newDropsHref = "#new-drops",
  className,
}: Props) {
  const eid = encodeURIComponent(entityId)
  const key = todayKey(entityId)
  const [checks, setChecks] = useState<ManualCheck[]>([])
  const [hello, setHello] = useState("Today")

  useEffect(() => {
    setChecks(readChecks(key))
    setHello(greeting())
  }, [key])

  function toggle(id: ManualCheck) {
    setChecks((prev) => {
      const next = prev.includes(id)
        ? prev.filter((value) => value !== id)
        : [...prev, id]
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const steps: Step[] = []

  if (failedCount > 0) {
    steps.push({
      id: "failed",
      title: `Fix ${failedCount} post${failedCount === 1 ? "" : "s"} that didn't go out`,
      detail: "Retry or reschedule them before anything else.",
      done: false,
      action: { label: "Open queue", href: `/campaigns?eid=${eid}` },
    })
  }

  steps.push({
    id: "schedule",
    title:
      scheduledCount > 0
        ? `Check the ${scheduledCount} post${scheduledCount === 1 ? "" : "s"} going out today`
        : "Nothing is scheduled to go out today",
    detail:
      scheduledCount > 0
        ? "These publish automatically. Give captions and times a quick look."
        : "Make one post in Create, or tick this if today is a rest day.",
    done: checks.includes("schedule"),
    manual: "schedule",
    action:
      scheduledCount > 0
        ? { label: "See schedule", href: "#going-out" }
        : {
            label: "Create a post",
            href: `/studio?eid=${eid}&step=2&fresh=1`,
          },
  })

  steps.push({
    id: "drops",
    title:
      newDropsCount > 0
        ? `Post ${newDropsCount} new drop${newDropsCount === 1 ? "" : "s"}`
        : "No new drops waiting",
    detail:
      newDropsCount > 0
        ? "Stories and TikToks are posted from your phone. Prep each one here."
        : "Pull new arrivals if you've added stock.",
    done: newDropsCount === 0 || checks.includes("drops"),
    manual: newDropsCount > 0 ? "drops" : undefined,
    action: { label: newDropsCount > 0 ? "Start" : "Check feed", href: newDropsHref },
  })

  steps.push({
    id: "ahead",
    title: "Look at the rest of the week",
    detail: "Spot gaps in the calendar and line up tomorrow's post.",
    done: checks.includes("ahead"),
    manual: "ahead",
    action: { label: "Open Calendar", href: `/planner?eid=${eid}` },
  })

  const doneCount = steps.filter((step) => step.done).length
  const allDone = doneCount === steps.length
  const nextId = steps.find((step) => !step.done)?.id

  return (
    <section
      aria-label="Today's checklist"
      className={cn(
        "border-2 border-mad-black bg-mad-white shadow-keycap-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-mad-black px-4 py-3">
        <h2 className="font-typewriter text-base font-bold tracking-typewriter-tight text-mad-black uppercase">
          {allDone ? "You're done for today ✓" : `${hello} — today's jobs`}
        </h2>
        <p className="font-typewriter text-xs font-bold text-neutral-600">
          {doneCount} of {steps.length} done
        </p>
      </div>
      <div
        className="h-1.5 bg-neutral-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div
          className="h-full bg-mad-lime transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="divide-y divide-neutral-200">
        {steps.map((step, index) => {
          const isNext = step.id === nextId
          const manual = step.manual
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3",
                isNext && "bg-[#CCFF00]/15"
              )}
            >
              <button
                type="button"
                disabled={!manual}
                onClick={() => manual && toggle(manual)}
                aria-pressed={step.done}
                aria-label={
                  manual
                    ? step.done
                      ? `Mark "${step.title}" not done`
                      : `Mark "${step.title}" done`
                    : step.done
                      ? "Done"
                      : "Finishes when the work is done"
                }
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center border-2 border-mad-black font-typewriter text-xs font-bold",
                  step.done ? "bg-mad-black text-mad-white" : "bg-mad-white",
                  manual ? "cursor-pointer hover:bg-mad-lime" : "cursor-default"
                )}
              >
                {step.done ? <Check className="size-4" /> : index + 1}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold text-mad-black",
                    step.done && "text-neutral-500 line-through"
                  )}
                >
                  {step.title}
                </p>
                {!step.done ? (
                  <p className="mt-0.5 text-xs text-neutral-600">{step.detail}</p>
                ) : null}
              </div>
              {step.action && !step.done ? (
                step.action.href.startsWith("#") ? (
                  <a
                    href={step.action.href}
                    className={cn(
                      "shrink-0 border-2 border-mad-black px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase",
                      isNext
                        ? "bg-mad-black text-mad-white hover:bg-mad-vermillion"
                        : "bg-mad-white hover:bg-mad-lime"
                    )}
                  >
                    {step.action.label}
                  </a>
                ) : (
                  <Link
                    href={step.action.href}
                    className={cn(
                      "shrink-0 border-2 border-mad-black px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase",
                      isNext
                        ? "bg-mad-black text-mad-white hover:bg-mad-vermillion"
                        : "bg-mad-white hover:bg-mad-lime"
                    )}
                  >
                    {step.action.label}
                  </Link>
                )
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

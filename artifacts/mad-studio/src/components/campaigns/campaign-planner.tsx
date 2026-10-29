"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, ChevronDown, Loader2, Megaphone, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { getCampaignPlans, saveCampaignPlans } from "@/lib/actions"
import {
  buildCampaign,
  CAMPAIGN_RECIPES,
  CAMPAIGN_TOOL_LABEL,
  parseYmd,
  recipeMoment,
  ymd,
  type CampaignPlan,
  type CampaignRecipe,
  type CampaignStep,
} from "@/lib/planner/campaign-recipes"
import { cn } from "@/lib/utils"

/** Session handoff read by the announcement screen (?prefill=1). */
export const ANNOUNCEMENT_PREFILL_KEY = "mad.announcement.prefill"

function dayLabel(text: string): string {
  return parseYmd(text).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" })
}

function rangeLabel(start: string, end: string): string {
  const a = parseYmd(start).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })
  if (start === end) return a
  const b = parseYmd(end).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
  return `${a} – ${b}`
}

/** Where a step's Make it goes. */
function stepHref(step: CampaignStep, entityId: string): string {
  const eid = `eid=${encodeURIComponent(entityId)}`
  switch (step.tool) {
    case "announcement":
      return `/templates/wls-announcement?${eid}${step.card ? "&prefill=1" : ""}`
    case "sale_rack":
      return `/templates/wls-sale-rack?${eid}`
    case "dot_special":
      return `/templates/wls-sale-rack?${eid}#dot-special`
    case "week_outfits":
      return `/templates/wls-week-outfits?${eid}`
    case "wants":
      return `/templates/wls-wants?${eid}`
    case "stories":
      return `/today?${eid}`
    case "studio":
      return `/studio?${eid}`
  }
}

/**
 * Campaigns from recipes: dates from the NZ calendar, each day a post made
 * with the brand kit tools. Saved with the brand, so phone and laptop match.
 */
export function CampaignPlanner({ entityId }: { entityId: string }) {
  const [, navigate] = useLocation()
  const today = useMemo(() => new Date(), [])
  const todayYmd = ymd(today)
  const [plans, setPlans] = useState<CampaignPlan[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [openRecipe, setOpenRecipe] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>("")

  useEffect(() => {
    let live = true
    void (async () => {
      const result = (await getCampaignPlans({ entityId })) as
        | { ok: true; data: { plans: CampaignPlan[] } }
        | { ok: false; error: string }
      if (!live) return
      if (result.ok) setPlans(result.data.plans)
      else {
        setPlans([])
        toast.error(result.error)
      }
    })()
    return () => {
      live = false
    }
  }, [entityId])

  async function persist(next: CampaignPlan[], success?: string) {
    const previous = plans
    setPlans(next)
    setSaving(true)
    try {
      const result = (await saveCampaignPlans({ entityId, plans: next })) as { ok: boolean; error?: string }
      if (!result.ok) throw new Error(result.error || "Didn't save.")
      if (success) toast.success(success)
    } catch (error) {
      setPlans(previous)
      toast.error(error instanceof Error ? error.message : "Didn't save.")
    } finally {
      setSaving(false)
    }
  }

  /** Recipes in date order: NZ-dated ones by their next date, pick-a-date ones last. */
  const recipes = useMemo(() => {
    return CAMPAIGN_RECIPES.map((recipe) => ({ recipe, moment: recipeMoment(recipe, today) })).sort((a, b) => {
      if (a.moment && b.moment) return a.moment.start.getTime() - b.moment.start.getTime()
      return a.moment ? -1 : b.moment ? 1 : 0
    })
  }, [today])

  function previewFor(recipe: CampaignRecipe, now: Date = today): CampaignPlan | null {
    const moment = recipeMoment(recipe, today)
    const chosen = startDate ? parseYmd(startDate) : null
    if (moment && !chosen) {
      return buildCampaign({ recipe, start: moment.start, end: moment.end, name: moment.card.headline, now })
    }
    if (chosen) {
      const length = moment ? Math.round((moment.end.getTime() - moment.start.getTime()) / 86_400_000) : null
      const end = length != null ? new Date(chosen.getFullYear(), chosen.getMonth(), chosen.getDate() + length) : undefined
      return buildCampaign({ recipe, start: chosen, end, name: moment?.card.headline, now })
    }
    return null
  }

  function toggleStep(planId: string, stepId: string) {
    if (!plans) return
    void persist(
      plans.map((plan) =>
        plan.id === planId
          ? { ...plan, steps: plan.steps.map((step) => (step.id === stepId ? { ...step, done: !step.done } : step)) }
          : plan
      )
    )
  }

  function makeIt(step: CampaignStep) {
    if (step.tool === "announcement" && step.card) {
      try {
        window.sessionStorage.setItem(ANNOUNCEMENT_PREFILL_KEY, JSON.stringify(step.card))
      } catch {
        /* opens with the usual cards instead */
      }
    }
    navigate(stepHref(step, entityId))
  }

  /** Recipes already on the calendar for these dates (pick-a-date ones can repeat). */
  const plannedRecipeIds = new Set(
    (plans ?? []).filter((plan) => plan.end >= todayYmd).map((plan) => plan.recipeId)
  )

  const current = (plans ?? []).filter((plan) => plan.end >= todayYmd || plan.steps.some((step) => step.date >= todayYmd))
  const finished = (plans ?? []).filter((plan) => !current.includes(plan))

  return (
    <div className="grid gap-8">
      <section aria-labelledby="your-campaigns" className="grid gap-3">
        <h2 id="your-campaigns" className="flex items-center gap-1.5 font-typewriter text-xs uppercase tracking-widest">
          <Megaphone className="size-3.5" aria-hidden />
          Your campaigns
        </h2>
        {plans == null ? (
          <p className="flex items-center gap-2 text-sm text-mad-black/60">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading
          </p>
        ) : current.length === 0 ? (
          <p className="border-2 border-dashed border-mad-black/25 px-3 py-4 text-sm text-mad-black/65">
            No campaigns yet. Pick one below and its days go on your Week planner.
          </p>
        ) : (
          current.map((plan) => <PlanCard key={plan.id} plan={plan} todayYmd={todayYmd} busy={saving} onToggle={toggleStep} onMake={makeIt} onRemove={(id) => void persist(plans!.filter((row) => row.id !== id), "Campaign removed.")} />)
        )}
        {finished.length > 0 ? (
          <details className="border border-mad-black/15 bg-white">
            <summary className="cursor-pointer px-3 py-2 text-sm">Finished ({finished.length})</summary>
            <div className="grid gap-3 p-3">
              {finished.map((plan) => (
                <PlanCard key={plan.id} plan={plan} todayYmd={todayYmd} busy={saving} onToggle={toggleStep} onMake={makeIt} onRemove={(id) => void persist(plans!.filter((row) => row.id !== id), "Campaign removed.")} />
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="plan-campaign" className="grid gap-3">
        <div>
          <h2 id="plan-campaign" className="font-typewriter text-xs uppercase tracking-widest">
            Plan a campaign
          </h2>
          <p className="mt-1 text-sm text-mad-black/70">
            Each day is a post you make with your templates. Dates come from the NZ calendar; change the start if you like.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map(({ recipe, moment }) => {
            const open = openRecipe === recipe.id
            const preview = open ? previewFor(recipe) : null
            return (
              <li key={recipe.id} className={cn("flex flex-col gap-2 border-2 bg-white p-3", open ? "border-mad-black sm:col-span-2 lg:col-span-3" : "border-mad-black/15")}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenRecipe(open ? null : recipe.id)
                    setStartDate("")
                  }}
                  aria-expanded={open}
                  className="flex items-start justify-between gap-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">
                      {moment ? rangeLabel(ymd(moment.start), ymd(moment.end)) : "Pick a date"} · {recipe.steps.length} posts
                    </span>
                    {moment && plannedRecipeIds.has(recipe.id) ? (
                      <span className="mb-0.5 inline-flex items-center gap-1 bg-mad-black px-1.5 py-px text-[10px] font-medium text-mad-white">
                        <Check className="size-3" aria-hidden /> On your calendar
                      </span>
                    ) : null}
                    <span className="block text-sm font-semibold">{recipe.name}</span>
                    <span className="block text-xs text-mad-black/70">{recipe.why}</span>
                  </span>
                  <ChevronDown className={cn("mt-1 size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
                </button>
                {open ? (
                  <div className="grid gap-3 border-t border-mad-black/15 pt-3">
                    <label className="grid max-w-xs gap-1 text-xs">
                      <span className="font-typewriter uppercase tracking-widest">{moment ? "Starts (change if you like)" : "Starts"}</span>
                      <input
                        id={`campaign-start-${recipe.id}`}
                        type="date"
                        className="h-9 border-2 border-mad-black bg-white px-2 text-sm"
                        value={startDate || (moment ? ymd(moment.start) : "")}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </label>
                    {preview ? (
                      <>
                        <ol className="grid gap-1.5">
                          {preview.steps.map((step) => (
                            <li key={step.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-sm">
                              <span className={cn("text-xs", step.date < todayYmd ? "text-mad-vermillion" : "text-mad-black/60")}>{dayLabel(step.date)}</span>
                              <span className="min-w-0">
                                <span className="font-medium">{step.title}</span>
                                <span className="text-mad-black/60"> · {CAMPAIGN_TOOL_LABEL[step.tool]}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                        {preview.steps.some((step) => step.date < todayYmd) ? (
                          <p className="text-xs text-mad-vermillion">Some days are already past. Pick a later start, or skip those.</p>
                        ) : null}
                        <Button
                          type="button"
                          className="justify-self-start border-2 border-mad-black bg-mad-black text-mad-white"
                          disabled={saving || plans == null}
                          onClick={() => {
                            // A fresh id each time, so the same recipe can be planned twice.
                            const plan = previewFor(recipe, new Date()) ?? preview
                            void persist([...(plans ?? []), plan], `${plan.name} is on your Week planner.`)
                            setOpenRecipe(null)
                          }}
                        >
                          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                          Add to my calendar
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-mad-black/60">Pick a start date to see the days.</p>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function PlanCard({
  plan,
  todayYmd,
  busy,
  onToggle,
  onMake,
  onRemove,
}: {
  plan: CampaignPlan
  todayYmd: string
  busy: boolean
  onToggle: (planId: string, stepId: string) => void
  onMake: (step: CampaignStep) => void
  onRemove: (planId: string) => void
}) {
  const done = plan.steps.filter((step) => step.done).length
  return (
    <article className="grid gap-2 border-2 border-mad-black bg-white p-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{plan.name}</h3>
          <p className="text-xs text-mad-black/60">
            {rangeLabel(plan.start, plan.end)} · {done} of {plan.steps.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Remove ${plan.name}? Its days come off the Week planner.`)) onRemove(plan.id)
          }}
          disabled={busy}
          title="Remove this campaign"
          aria-label={`Remove ${plan.name}`}
          className="flex size-8 items-center justify-center text-mad-black/55 hover:text-mad-vermillion"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </header>
      <ol className="grid gap-1.5">
        {plan.steps.map((step) => {
          const overdue = !step.done && step.date < todayYmd
          const isToday = step.date === todayYmd
          return (
            <li
              key={step.id}
              className={cn(
                "grid grid-cols-[auto_6.5rem_minmax(0,1fr)_auto] items-center gap-2 border px-2 py-1.5",
                isToday ? "border-mad-black bg-mad-lime/20" : "border-mad-black/10"
              )}
            >
              <button
                type="button"
                onClick={() => onToggle(plan.id, step.id)}
                disabled={busy}
                aria-pressed={step.done}
                title={step.done ? "Mark as not done" : "Mark as done"}
                aria-label={`${step.done ? "Undo" : "Done"}: ${step.title}`}
                className={cn(
                  "flex size-6 items-center justify-center border-2",
                  step.done ? "border-mad-black bg-mad-black text-mad-white" : "border-mad-black/40 bg-white"
                )}
              >
                {step.done ? <Check className="size-3.5" aria-hidden /> : null}
              </button>
              <span className={cn("text-xs", overdue ? "font-medium text-mad-vermillion" : "text-mad-black/60")}>
                {isToday ? "Today" : dayLabel(step.date)}
              </span>
              <span className={cn("min-w-0 text-sm", step.done && "text-mad-black/45 line-through")}>
                <span className="font-medium">{step.title}</span>
                <span className="hidden text-mad-black/60 sm:inline"> · {step.detail}</span>
              </span>
              <button
                type="button"
                onClick={() => onMake(step)}
                className="inline-flex shrink-0 items-center gap-1 border-2 border-mad-black px-2 py-0.5 text-xs font-medium hover:bg-mad-lime/40"
              >
                Make it <ArrowRight className="size-3" aria-hidden />
              </button>
            </li>
          )
        })}
      </ol>
    </article>
  )
}

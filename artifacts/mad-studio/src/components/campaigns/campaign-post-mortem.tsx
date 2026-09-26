"use client"

import { useState } from "react"
import { Flame, Loader2, ThumbsDown, ThumbsUp } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "@/lib/next-compat"

import { Label } from "@/components/ui/label"
import type { OutcomeRating } from "@/lib/campaigns/ledger"
import { cn } from "@/lib/utils"

type CampaignPostMortemProps = {
  campaignId: string
  entityId: string
  initialOutcome?: OutcomeRating | null
  initialWhatWorked?: string | null
  initialWhatDidntWork?: string | null
  initialTakeaway?: string | null
}

const OUTCOMES: Array<{
  value: OutcomeRating
  plain: string
  marketing: string
  icon: typeof Flame
}> = [
  {
    value: "winner",
    plain: "Big Winner",
    marketing: "High ROAS",
    icon: Flame,
  },
  {
    value: "consistent",
    plain: "Hit the Goal",
    marketing: "On Target",
    icon: ThumbsUp,
  },
  {
    value: "loss",
    plain: "Didn't Work",
    marketing: "Low Return",
    icon: ThumbsDown,
  },
]

export function CampaignPostMortem({
  campaignId,
  entityId,
  initialOutcome = null,
  initialWhatWorked = "",
  initialWhatDidntWork = "",
  initialTakeaway = null,
}: CampaignPostMortemProps) {
  const router = useRouter()
  const [outcome, setOutcome] = useState<OutcomeRating | null>(initialOutcome)
  const [whatWorked, setWhatWorked] = useState(initialWhatWorked ?? "")
  const [whatDidntWork, setWhatDidntWork] = useState(
    initialWhatDidntWork ?? ""
  )
  const [takeaway, setTakeaway] = useState(initialTakeaway)
  const [saving, setSaving] = useState(false)

  async function onSave() {
    if (!outcome) {
      toast.error("Pick an outcome rating first.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/campaigns/post-mortem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          entityId,
          outcomeRating: outcome,
          whatWorked,
          whatDidntWork,
        }),
      })
      const payload = (await response.json()) as {
        campaign?: {
          ai_takeaway: string | null
          outcome_rating: OutcomeRating
          what_worked: string | null
          what_didnt_work: string | null
        }
        error?: string
      }
      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? "Failed to save playbook notes.")
      }
      setTakeaway(payload.campaign.ai_takeaway)
      toast.success("Saved to Playbook.")
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save playbook notes."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
          Playbook Notes
        </h3>
        <p className="mt-1 text-sm text-neutral-600">
          Rate the outcome and capture what to reuse next time
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {OUTCOMES.map((item) => {
          const Icon = item.icon
          const active = outcome === item.value
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setOutcome(item.value)}
              className={cn(
                "flex items-center gap-2 border-2 border-mad-black px-3 py-3 text-left font-typewriter transition-colors shadow-keycap-sm",
                active
                  ? item.value === "winner"
                    ? "bg-mad-lime text-mad-black"
                    : item.value === "loss"
                      ? "bg-mad-vermillion text-mad-white"
                      : "bg-mad-black text-mad-white"
                  : "bg-mad-white text-mad-black hover:bg-mad-lime"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>
                <span className="block text-[0.7rem] font-bold tracking-wider uppercase">
                  {item.plain}
                </span>
                <span
                  className={cn(
                    "block text-[0.6rem] tracking-wider uppercase",
                    active && item.value === "loss"
                      ? "text-mad-white/80"
                      : active
                        ? "opacity-70"
                        : "text-neutral-500"
                  )}
                >
                  {item.marketing}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label
            htmlFor={`worked-${campaignId}`}
            className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase"
          >
            What Worked Well
          </Label>
          <textarea
            id={`worked-${campaignId}`}
            rows={4}
            value={whatWorked}
            onChange={(event) => setWhatWorked(event.target.value)}
            placeholder="Hooks, offers, formats, or angles to repeat…"
            className="min-h-[7rem] w-full resize-none border-2 border-mad-black bg-mad-white p-3 text-sm text-mad-black outline-none placeholder:text-neutral-400 focus:bg-mad-lime/20"
          />
        </div>
        <div className="grid gap-2">
          <Label
            htmlFor={`friction-${campaignId}`}
            className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase"
          >
            What Didn&apos;t Land
          </Label>
          <textarea
            id={`friction-${campaignId}`}
            rows={4}
            value={whatDidntWork}
            onChange={(event) => setWhatDidntWork(event.target.value)}
            placeholder="Fatigue, weak CTA, wrong persona, angles to skip…"
            className="min-h-[7rem] w-full resize-none border-2 border-mad-black bg-mad-white p-3 text-sm text-mad-black outline-none placeholder:text-neutral-400 focus:bg-mad-lime/20"
          />
        </div>
      </div>

      {takeaway ? (
        <div className="border-2 border-mad-black bg-mad-lime/40 px-4 py-3 text-sm text-mad-black shadow-keycap-sm">
          <p className="font-typewriter text-[0.6rem] font-bold tracking-widest uppercase">
            Playbook Directive
          </p>
          <p className="mt-1.5 leading-relaxed">{takeaway}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 border-2 border-mad-black bg-mad-black px-5 py-3 font-typewriter text-[0.7rem] font-bold tracking-widest text-mad-white uppercase shadow-keycap transition-colors hover:bg-mad-vermillion disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save to Playbook"
        )}
      </button>
    </section>
  )
}

"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "@/lib/next-compat"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { commitScrapedDna } from "@/lib/actions"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import type { EntityDna } from "@/lib/entities/dna-schema"
import {
  FUDI_BRAND_COLORS,
  isFudiHospitalityEntity,
} from "@/lib/studio/fudi-platform"
import { cn } from "@/lib/utils"

type WizardStep = "source" | "proofing" | "calibrated"

type DnaIntakeWizardProps = {
  entity: StudioEntityDna
}

function hasCoreDna(entity: StudioEntityDna): boolean {
  return Boolean(entity.brand_identity.tone?.trim())
}

function splitToneDescriptors(tone: string): string[] {
  return tone
    .split(/[,;/|•·\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function toEntityDna(entity: StudioEntityDna): EntityDna {
  return {
    industry: entity.industry,
    business_model: "",
    brand_identity: entity.brand_identity,
    audience_segments: entity.audience_segments,
    value_propositions: entity.value_propositions,
    conversion_goals: entity.conversion_goals,
    content_pillars: [],
    local_context: [],
  }
}

export function DnaIntakeWizard({ entity }: DnaIntakeWizardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<WizardStep>(
    hasCoreDna(entity) ? "calibrated" : "source"
  )
  const [sourceUrl, setSourceUrl] = useState(entity.website_url ?? "")
  const [scraping, setScraping] = useState(false)
  const [systemError, setSystemError] = useState<string | null>(null)
  const [draftDna, setDraftDna] = useState<EntityDna | null>(null)
  const [draftSourceUrl, setDraftSourceUrl] = useState<string | null>(null)

  const isFudi = isFudiHospitalityEntity({
    id: entity.id,
    name: entity.name,
    industry: entity.industry,
  })

  const displayDna =
    draftDna ??
    (hasCoreDna(entity) || step === "calibrated"
      ? toEntityDna(entity)
      : null)
  const toneChips = useMemo(
    () =>
      displayDna ? splitToneDescriptors(displayDna.brand_identity.tone) : [],
    [displayDna]
  )

  async function activateIntake(urlOverride?: string) {
    setSystemError(null)
    const url = (urlOverride ?? sourceUrl).trim()
    if (!url) {
      setSystemError("SOURCE REQUIRED. Enter a website URL to begin intake.")
      return
    }

    setScraping(true)
    setStep("source")
    try {
      const response = await fetch("/api/entities/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entity.name,
          url,
          entityId: entity.id,
        }),
      })
      const payload = (await response.json()) as {
        dna?: EntityDna
        sourceUrl?: string
        error?: string
      }

      if (!response.ok || !payload.dna) {
        throw new Error(payload.error ?? "SYSTEM HALTED. Intake scrape failed.")
      }

      setDraftDna(payload.dna)
      setDraftSourceUrl(payload.sourceUrl ?? url)
      setSourceUrl(payload.sourceUrl ?? url)
      setStep("proofing")
      toast.success("DNA matrix extracted — proof before commit.")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "SYSTEM HALTED. Intake scrape failed."
      setSystemError(message)
      toast.error(message)
    } finally {
      setScraping(false)
    }
  }

  function onResync() {
    const url = sourceUrl.trim() || entity.website_url || ""
    if (!url) {
      setStep("source")
      setSystemError(
        "No website on file. Paste a URL to re-sync this brand’s DNA."
      )
      return
    }
    void activateIntake(url)
  }

  function onCommit() {
    if (!draftDna) {
      setSystemError("Nothing to commit. Run intake first.")
      return
    }

    startTransition(async () => {
      const result = await commitScrapedDna({
        entityId: entity.id,
        websiteUrl: draftSourceUrl ?? sourceUrl,
        dna: draftDna,
      })
      if (!result.ok) {
        setSystemError(result.error)
        toast.error(result.error)
        return
      }
      setDraftDna(null)
      setDraftSourceUrl(null)
      setStep("calibrated")
      toast.success("DNA saved to Brain Lab.")
      router.refresh()
      router.push(`/studio?eid=${encodeURIComponent(entity.id)}`)
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Core DNA · Live Sync
          </p>
          <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
            Brand Intake Wizard
          </h2>
        </div>
        {(step === "calibrated" || step === "proofing") && (
          <button
            type="button"
            onClick={onResync}
            disabled={scraping || pending}
            className="inline-flex items-center gap-2 border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm hover:bg-mad-lime disabled:opacity-60"
          >
            {scraping ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Re-Sync from Website
          </button>
        )}
      </div>

      {systemError ? (
        <div
          className="border-2 border-mad-black bg-mad-vermillion px-4 py-3 text-sm font-bold text-mad-white shadow-keycap"
          role="alert"
        >
          {systemError}
        </div>
      ) : null}

      {step === "source" || (step === "calibrated" && !hasCoreDna(entity)) ? (
        <section className="border-2 border-mad-black bg-mad-white p-6 shadow-keycap">
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Step 01 // Locate the Source (Live Sync)
          </p>
          <h3 className="mt-2 font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
            Paste the brand URL
          </h3>
          <p className="mt-2 max-w-xl text-sm text-neutral-600">
            MAD Studio scrapes the live site via Jina, then Gemini synthesizes
            voice, vibe, brand safety, and audience intel.
          </p>

          <div className="mt-6 grid gap-4">
            <input
              type="text"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="e.g. wornlabelsociety.nz or https://…"
              className="w-full border-2 border-mad-black bg-mad-white px-4 py-3.5 font-mono text-sm text-mad-black outline-none placeholder:text-neutral-400 focus:ring-0"
              disabled={scraping}
            />
            <button
              type="button"
              onClick={() => void activateIntake()}
              disabled={scraping}
              className="w-full border-2 border-mad-black bg-mad-vermillion px-4 py-5 font-typewriter text-sm font-bold tracking-widest text-mad-white uppercase shadow-keycap-lg transition-all hover:bg-mad-black disabled:opacity-60"
            >
              {scraping ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Scraping {entity.name}…
                </span>
              ) : (
                "[ Activate Intake ]  ·  Analyze Site & Scrape Offer"
              )}
            </button>
          </div>
        </section>
      ) : null}

      {(step === "proofing" || step === "calibrated") && displayDna ? (
        <section className="space-y-4">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              {step === "proofing"
                ? `Step 02 // Intel Proofing (${entity.name})`
                : `Calibrated DNA // ${entity.name}`}
            </p>
            <h3 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              {step === "proofing"
                ? "Proof the brain before commit"
                : "Live brand intelligence on file"}
            </h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="border-2 border-mad-black bg-mad-white p-5 shadow-keycap">
              <div className="mb-3 inline-flex border border-mad-black bg-mad-lime px-2 py-0.5 font-typewriter text-[10px] font-bold tracking-wider text-mad-black uppercase">
                Brand Voice
              </div>
              <div className="flex flex-wrap gap-2">
                {toneChips.map((chip) => (
                  <span
                    key={chip}
                    className="border-2 border-mad-black bg-mad-white px-2.5 py-1.5 font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-neutral-600">
                Core objective: {displayDna.brand_identity.core_mission}
              </p>
            </article>

            <article className="border-2 border-mad-black bg-mad-white p-5 shadow-keycap">
              <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase">
                Visual Vibe
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">
                {displayDna.brand_identity.visual_vibe?.trim() || "—"}
              </p>
              {isFudi ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
                    Brand palette
                  </span>
                  {(
                    [
                      ["Canvas", FUDI_BRAND_COLORS.canvas],
                      ["Accent", FUDI_BRAND_COLORS.accent],
                      ["Pop", FUDI_BRAND_COLORS.pop],
                    ] as const
                  ).map(([label, hex]) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-white px-2 py-1 font-mono text-[0.6rem]"
                    >
                      <span
                        className="size-4 border border-mad-black"
                        style={{ background: hex }}
                        aria-hidden
                      />
                      {label} {hex}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-4 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
                Forbidden words · brand safety
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {displayDna.brand_identity.forbidden_words.length === 0 ? (
                  <span className="text-sm text-neutral-500">
                    No brand-safety tags on file — edit below on Core DNA.
                  </span>
                ) : (
                  displayDna.brand_identity.forbidden_words.map((word) => (
                    <span
                      key={word}
                      className="border-2 border-mad-black bg-mad-lime px-2.5 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase"
                    >
                      {word.startsWith("#") ? word : `#${word.replace(/^#/, "")}`}
                    </span>
                  ))
                )}
              </div>
            </article>

            <article className="border-2 border-mad-black bg-mad-white p-5 shadow-keycap lg:col-span-2">
              <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase">
                Target audiences · pains & desires
              </p>
              <div className="mt-4 space-y-4">
                {displayDna.audience_segments.map((segment) => (
                  <div
                    key={segment.name}
                    className="border border-mad-black/40 p-3"
                  >
                    <p className="font-typewriter text-xs font-bold tracking-wide text-mad-black uppercase">
                      {segment.name}
                    </p>
                    {segment.role ? (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {segment.role}
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <p className="text-sm leading-relaxed text-neutral-700">
                        <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
                          Pain we solve
                        </span>
                        <br />
                        {segment.pain || "—"}
                      </p>
                      <p className="text-sm leading-relaxed text-neutral-700">
                        <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
                          What they really want
                        </span>
                        <br />
                        {segment.desire || "—"}
                      </p>
                    </div>
                    {segment.winning_rebuttal ? (
                      <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                        <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
                          Objection / winning rebuttal
                        </span>
                        <br />
                        {segment.winning_rebuttal}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          </div>

          {step === "proofing" ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onCommit}
                disabled={pending}
                className={cn(
                  "border-2 border-mad-black bg-mad-vermillion px-6 py-4 font-typewriter text-xs font-bold tracking-widest text-mad-white uppercase shadow-keycap-lg hover:bg-mad-black disabled:opacity-60"
                )}
              >
                {pending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Committing…
                  </span>
                ) : (
                  "[ Save DNA to Brain Lab ] → Deploy Campaign Multiplexer"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftDna(null)
                  setStep(hasCoreDna(entity) ? "calibrated" : "source")
                }}
                disabled={pending}
                className="border-2 border-mad-black bg-mad-white px-4 py-4 font-typewriter text-xs font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm hover:bg-neutral-50"
              >
                Discard Draft
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStep("source")}
              className="border-2 border-mad-black bg-mad-white px-4 py-3 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm hover:bg-mad-lime"
            >
              Run Fresh Intake from New URL
            </button>
          )}
        </section>
      ) : null}

      {scraping && step === "source" ? (
        <p className="font-typewriter text-xs font-bold tracking-widest text-mad-black uppercase">
          Multiplexing live site intel…
        </p>
      ) : null}
    </div>
  )
}

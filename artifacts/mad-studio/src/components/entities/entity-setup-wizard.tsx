"use client"

import { useMemo, useState, useTransition } from "react"
import { Loader2, Plus, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { createEntity } from "@/lib/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  emptyDna,
  type AudienceSegment,
  type EntityDna,
  type SocialChannels,
} from "@/lib/entities/dna-schema"

type EntitySetupWizardProps = {
  organizationId: string
}

type WizardStep = 1 | 2 | 3 | 4

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Ingest",
  2: "Calibrate DNA",
  3: "Social Channels",
  4: "Automation Secrets",
}

function FieldLabel({
  plain,
  marketing,
  htmlFor,
}: {
  plain: string
  marketing: string
  htmlFor?: string
}) {
  return (
    <div className="space-y-0.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {plain}
      </Label>
      <p className="text-muted-foreground text-xs">{marketing}</p>
    </div>
  )
}

function StepRail({ step }: { step: WizardStep }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {([1, 2, 3, 4] as WizardStep[]).map((value) => {
        const active = value === step
        const done = value < step
        return (
          <li
            key={value}
            className={
              active
                ? "bg-foreground text-background rounded-full px-3 py-1 text-xs font-medium"
                : done
                  ? "bg-muted text-foreground rounded-full px-3 py-1 text-xs font-medium"
                  : "text-muted-foreground rounded-full border px-3 py-1 text-xs"
            }
          >
            {value}. {STEP_LABELS[value]}
          </li>
        )
      })}
    </ol>
  )
}

export function EntitySetupWizard({ organizationId }: EntitySetupWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [name, setName] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [dna, setDna] = useState<EntityDna>(() => emptyDna(""))
  const [forbiddenDraft, setForbiddenDraft] = useState("")
  const [social, setSocial] = useState<SocialChannels>({
    instagram: "",
    tiktok: "",
    facebook: "",
    linkedin: "",
  })
  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canCalibrate = useMemo(
    () =>
      Boolean(
        dna.industry &&
          dna.brand_identity.tone &&
          dna.audience_segments.length > 0
      ),
    [dna]
  )

  function updateIdentity<K extends keyof EntityDna["brand_identity"]>(
    key: K,
    value: EntityDna["brand_identity"][K]
  ) {
    setDna((prev) => ({
      ...prev,
      brand_identity: { ...prev.brand_identity, [key]: value },
    }))
  }

  function updateAudience(index: number, patch: Partial<AudienceSegment>) {
    setDna((prev) => ({
      ...prev,
      audience_segments: prev.audience_segments.map((segment, i) =>
        i === index ? { ...segment, ...patch } : segment
      ),
    }))
  }

  function addForbiddenWord() {
    const word = forbiddenDraft.trim()
    if (!word) return
    if (dna.brand_identity.forbidden_words.includes(word)) {
      setForbiddenDraft("")
      return
    }
    updateIdentity("forbidden_words", [
      ...dna.brand_identity.forbidden_words,
      word,
    ])
    setForbiddenDraft("")
  }

  function removeForbiddenWord(word: string) {
    updateIdentity(
      "forbidden_words",
      dna.brand_identity.forbidden_words.filter((item) => item !== word)
    )
  }

  async function analyzeWebsite() {
    setBannerError(null)
    if (!name.trim() || !websiteUrl.trim()) {
      const message = "Enter a brand name and website URL to continue."
      setBannerError(message)
      toast.error(message)
      return
    }

    setAnalyzing(true)
    try {
      const response = await fetch("/api/entities/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: websiteUrl.trim() }),
      })
      const payload = (await response.json()) as {
        dna?: EntityDna
        error?: string
        sourceUrl?: string
      }

      if (!response.ok || !payload.dna) {
        throw new Error(payload.error ?? "Analysis failed.")
      }

      setDna(payload.dna)
      if (payload.sourceUrl) {
        setWebsiteUrl(payload.sourceUrl)
      }
      toast.success("Brand DNA extracted. Review and calibrate.")
      setStep(2)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not analyze website."
      setBannerError(message)
      toast.error(message)
    } finally {
      setAnalyzing(false)
    }
  }

  function goNext() {
    setBannerError(null)
    if (step === 1) {
      void analyzeWebsite()
      return
    }
    if (step === 2 && !canCalibrate) {
      const message =
        "Add tone and at least one audience before continuing."
      setBannerError(message)
      toast.error(message)
      return
    }
    setStep((prev) => Math.min(4, prev + 1) as WizardStep)
  }

  function goBack() {
    setBannerError(null)
    setStep((prev) => Math.max(1, prev - 1) as WizardStep)
  }

  function initializeBrain() {
    setBannerError(null)
    startTransition(async () => {
      const result = await createEntity({
        organizationId,
        name: name.trim(),
        websiteUrl: websiteUrl.trim(),
        dna,
        social,
        outboundWebhookUrl: outboundWebhookUrl.trim() || null,
      })

      if (result && !result.ok) {
        setBannerError(result.error)
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Entity setup wizard
        </p>
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Click-and-enter brand DNA
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Drop in a name and website. We extract tone, audiences, and conversion
          signals — then you calibrate before the entity brain goes live.
        </p>
        <StepRail step={step} />
      </div>

      {bannerError ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm"
          role="alert"
        >
          {bannerError}
        </div>
      ) : null}

      {step === 1 ? (
        <section className="border-border grid gap-5 rounded-2xl border p-5">
          <div className="grid gap-2">
            <FieldLabel
              plain="Brand name"
              marketing="Entity identity"
              htmlFor="brand-name"
            />
            <Input
              id="brand-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Worn Label Society"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <FieldLabel
              plain="Website URL"
              marketing="Source of truth for DNA extraction"
              htmlFor="brand-url"
            />
            <Input
              id="brand-url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              inputMode="url"
            />
          </div>
          <Button
            type="button"
            size="lg"
            onClick={analyzeWebsite}
            disabled={analyzing}
            className="w-full sm:w-auto"
          >
            {analyzing ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {analyzing
              ? "Analyzing website…"
              : "Analyze Website & Extract DNA"}
          </Button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-6">
          <div className="border-border grid gap-4 rounded-2xl border p-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <FieldLabel
                  plain="Industry"
                  marketing="Market category"
                  htmlFor="industry"
                />
                <Input
                  id="industry"
                  value={dna.industry}
                  onChange={(event) =>
                    setDna((prev) => ({ ...prev, industry: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel
                  plain="How do you make money?"
                  marketing="Business model"
                  htmlFor="business-model"
                />
                <Input
                  id="business-model"
                  value={dna.business_model}
                  onChange={(event) =>
                    setDna((prev) => ({
                      ...prev,
                      business_model: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <FieldLabel
                plain="How does your brand speak?"
                marketing="Brand Tone & Voice"
                htmlFor="tone"
              />
              <Textarea
                id="tone"
                value={dna.brand_identity.tone}
                onChange={(event) => updateIdentity("tone", event.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <FieldLabel
                plain="Words to never use"
                marketing="Negative Keywords & Brand Safety"
              />
              <div className="flex flex-wrap gap-2">
                {dna.brand_identity.forbidden_words.map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {word}
                    <button
                      type="button"
                      aria-label={`Remove ${word}`}
                      className="hover:bg-foreground/10 rounded-full p-0.5"
                      onClick={() => removeForbiddenWord(word)}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={forbiddenDraft}
                  onChange={(event) => setForbiddenDraft(event.target.value)}
                  placeholder="Add word"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addForbiddenWord()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addForbiddenWord}>
                  <Plus data-icon="inline-start" />
                  Add word
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <FieldLabel
                plain="What does the brand look and feel like?"
                marketing="Visual vibe"
                htmlFor="visual-vibe"
              />
              <Input
                id="visual-vibe"
                value={dna.brand_identity.visual_vibe}
                onChange={(event) =>
                  updateIdentity("visual_vibe", event.target.value)
                }
              />
            </div>

            <div className="grid gap-2">
              <FieldLabel
                plain="Why does this brand exist?"
                marketing="Core mission"
                htmlFor="core-mission"
              />
              <Textarea
                id="core-mission"
                value={dna.brand_identity.core_mission}
                onChange={(event) =>
                  updateIdentity("core_mission", event.target.value)
                }
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Audience cards
            </h2>
            {dna.audience_segments.map((segment, index) => (
              <article
                key={`${segment.name}-${index}`}
                className="border-border grid gap-3 rounded-2xl border p-5"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <FieldLabel
                      plain="Who is this person?"
                      marketing="Audience segment"
                      htmlFor={`audience-name-${index}`}
                    />
                    <Input
                      id={`audience-name-${index}`}
                      value={segment.name}
                      onChange={(event) =>
                        updateAudience(index, { name: event.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldLabel
                      plain="What role do they play?"
                      marketing="Buyer role"
                      htmlFor={`audience-role-${index}`}
                    />
                    <Input
                      id={`audience-role-${index}`}
                      value={segment.role}
                      onChange={(event) =>
                        updateAudience(index, { role: event.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <FieldLabel
                    plain="What drives your customers crazy right now?"
                    marketing="Acute Pain Points"
                    htmlFor={`audience-pain-${index}`}
                  />
                  <Textarea
                    id={`audience-pain-${index}`}
                    value={segment.pain}
                    onChange={(event) =>
                      updateAudience(index, { pain: event.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <FieldLabel
                    plain="What life event makes them buy right now?"
                    marketing="Purchase Triggers"
                    htmlFor={`audience-trigger-${index}`}
                  />
                  <Textarea
                    id={`audience-trigger-${index}`}
                    value={segment.trigger}
                    onChange={(event) =>
                      updateAudience(index, { trigger: event.target.value })
                    }
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <FieldLabel
                    plain="Their #1 doubt & how you solve it"
                    marketing="Objection Handling / Rebuttal"
                    htmlFor={`audience-rebuttal-${index}`}
                  />
                  <Textarea
                    id={`audience-rebuttal-${index}`}
                    value={segment.winning_rebuttal}
                    onChange={(event) =>
                      updateAudience(index, {
                        winning_rebuttal: event.target.value,
                      })
                    }
                    rows={2}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="border-border grid gap-4 rounded-2xl border p-5">
          {(
            [
              ["instagram", "Instagram", "Handle or profile link"],
              ["tiktok", "TikTok", "Handle or profile link"],
              ["facebook", "Facebook", "Page name or profile link"],
              ["linkedin", "LinkedIn", "Company or profile link"],
            ] as const
          ).map(([key, plain, marketing]) => (
            <div key={key} className="grid gap-2">
              <FieldLabel plain={plain} marketing={marketing} htmlFor={key} />
              <Input
                id={key}
                value={social[key]}
                onChange={(event) =>
                  setSocial((prev) => ({ ...prev, [key]: event.target.value }))
                }
                placeholder={`@${key === "linkedin" ? "company" : "brand"}`}
              />
            </div>
          ))}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="border-border grid gap-4 rounded-2xl border p-5">
          <div className="grid gap-2">
            <FieldLabel
              plain="Where should scheduled posts get sent?"
              marketing="Make.com / n8n Outbound Webhook URL"
              htmlFor="outbound-webhook"
            />
            <Input
              id="outbound-webhook"
              type="password"
              autoComplete="off"
              value={outboundWebhookUrl}
              onChange={(event) => setOutboundWebhookUrl(event.target.value)}
              placeholder="https://hook.make.com/…"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Scheduled posts will automatically dispatch to this endpoint for
              publishing.
            </p>
          </div>
        </section>
      ) : null}

      <footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={step === 1 || analyzing || pending}
        >
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          {step < 4 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={analyzing || pending}
            >
              {step === 1 && analyzing ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Analyzing…
                </>
              ) : (
                "Next"
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={initializeBrain}
              disabled={pending || analyzing}
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Initializing…
                </>
              ) : (
                "Initialize Entity Brain"
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

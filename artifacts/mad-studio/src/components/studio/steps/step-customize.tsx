"use client"



import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"

import { Brain, Loader2, RotateCcw, Sparkles } from "lucide-react"

import { toast } from "sonner"



import { PostIntentEditor } from "@/components/inventory/post-intent-editor"
import { FUDI_DROP_KIND_OPTIONS } from "@/lib/inventory/post-intent"
import {
  extractVideoKeyframeFromUrl,
  requestMediaInspection,
} from "@/lib/media/client-inspect"
import type { MediaVisualInspection } from "@/lib/media/inspect-schema"
import {
  requestMapIntentFromMedia,
} from "@/lib/studio/map-intent-client"
import type { IntentAiSuggestedField } from "@/lib/studio/map-intent"
import type { CarouselPackContext } from "@/lib/studio/carousel-pack-context"

import type { PostIntentState } from "@/lib/inventory/post-intent"

import { stripDuplicateHookFromCaption } from "@/lib/inventory/sop"

import { AutoTextarea } from "@/components/studio/auto-textarea"
import { StepCopyEditor } from "@/components/studio/steps/step-copy-editor"
import { StudioStepPanel } from "@/components/studio/studio-step-panel"

import {
  CanvasTextOverlayEditor,
  type CanvasItemFacts,
} from "@/components/studio/canvas-text-overlay"

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select"

import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"

import { personasFromAudienceSegments } from "@/lib/campaigns/multiplexer"

import {
  resolveConversionActions,
  resolveFormulaBank,
} from "@/lib/studio/formula-bank"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"

import { requestFieldAssist } from "@/lib/studio/field-assist-client"

import {

  DEFAULT_CANVAS_TEXT_OVERLAY,

  type CanvasTextOverlayState,

} from "@/lib/studio/canvas-text-types"

import {
  STUDIO_WIZARD_STEP_SOP,
} from "@/lib/studio/studio-wizard-sop"
import {
  WORKBENCH_STEP_CANVAS,
  WORKBENCH_STEP_COPY,
  WORKBENCH_STEP_INTENT,
} from "@/lib/studio/workbench-steps"
import { brandSwatches, resolveVisualPresets } from "@/lib/brands/visual-presets"
import { cn } from "@/lib/utils"



type HookChip = { id: string; label: string; hook: string }

const DNA_SELECT_TRIGGER_CLASS =
  "h-9 w-full max-w-full min-w-0 overflow-hidden rounded-none border-2 border-mad-black text-xs shadow-none [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"

const INTENT_WIZARD_SELECT_CLASS =
  "h-10 w-full max-w-full min-w-0 overflow-hidden rounded-none border-2 border-mad-black text-sm shadow-none [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"

const SELECT_CUSTOM = "__custom__"
const SELECT_NONE = "__none__"

const DNA_SELECT_CONTENT_CLASS =
  "z-[100] rounded-none border-2 border-mad-black"

const AI_SELECT_TINT =
  "bg-[#CCFF00]/10 ring-1 ring-inset ring-[#CCFF00]/45"

function IntentSelectTrigger({
  aiSuggested = false,
  className,
  children,
  ...props
}: ComponentProps<typeof SelectTrigger> & {
  aiSuggested?: boolean
}) {
  return (
    <SelectTrigger
      className={cn(
        DNA_SELECT_TRIGGER_CLASS,
        aiSuggested && AI_SELECT_TINT,
        className
      )}
      {...props}
    >
      {children}
      {aiSuggested ? (
        <Sparkles className="size-3.5 shrink-0" aria-label="Suggested by AI" />
      ) : null}
    </SelectTrigger>
  )
}

function pickSelectValue(
  current: string | null | undefined,
  allowed: string[],
  fallback: string
): string {
  if (current && allowed.includes(current)) return current
  if (fallback && allowed.includes(fallback)) return fallback
  return allowed[0] ?? SELECT_NONE
}

export type CustomizeWizardPhase = "intent" | "canvas" | "copy" | "all"

type Props = {
  /** The item being posted — fills the tags line on the Canvas step. */
  itemFacts?: CanvasItemFacts | null
  /** Photo on the slide being edited (for the Canvas cutout backdrop). */
  canvasSourceUrl?: string | null
  onCutout?: (scope: "slide" | "all", on: boolean) => void | Promise<void>
  cutoutBusy?: boolean
  photoCount?: number

  phase?: CustomizeWizardPhase

  entity: StudioEntityDna

  entityId: string

  marketingEntityId?: string | null

  isFudi: boolean

  vibeOptions: string[]

  postIntent: PostIntentState

  onPostIntentChange: (next: PostIntentState) => void

  headline: string

  caption: string

  onHeadlineChange: (value: string) => void

  onCaptionChange: (value: string) => void

  hookChips: HookChip[]

  activeHookId: string | null

  onHookSelect: (hookId: string) => void

  tagsSlot?: ReactNode

  topSlot?: ReactNode
  /** Above the Canvas editor — e.g. which carousel slide is being edited. */
  canvasSlot?: ReactNode

  footerSlot?: ReactNode

  destinationUrl?: string | null

  onDestinationUrlChange?: (url: string) => void

  trackablePreview?: string | null

  textOverlay?: CanvasTextOverlayState

  onTextOverlayChange?: (next: CanvasTextOverlayState) => void

  visualDescription?: string | null

  visualInspection?: MediaVisualInspection | null

  /** Public HTTPS media URL — auto-suggest can inspect on click if Step 1 vision is missing. */
  inspectableMediaUrl?: string | null

  inspectableMediaType?: "image" | "video"

  onVisualInspectionResolved?: (inspection: MediaVisualInspection) => void

  isVideoPreview?: boolean

  contentPillar?: string

  onContentPillarChange?: (value: string) => void

  personaId?: string

  onPersonaIdChange?: (value: string) => void

  hookBlueprintId?: string | null

  onHookBlueprintIdChange?: (value: string) => void

  ctaId?: string | null

  onCtaIdChange?: (value: string) => void

  captionVariantLabel?: string | null

  onRotateCaption?: () => void

  onEnhanceCaption?: () => void

  enhancingCaption?: boolean

  /** Retail/fashion: audience + topic only; hook/CTA live on Schedule formula bank. */
  intentFieldSet?: "full" | "focus"

  audienceToneCue?: string
  postFocusLabel?: string | null
  stillPhotoCount?: number
  brandProfileId?: string | null

  carouselPackContext?: CarouselPackContext | null
  /** Vision merged across all tray stills (when inspected). */
  carouselMergedVision?: string | null

}



function AiAssistButton({

  label,

  busy,

  onClick,

}: {

  label: string

  busy: boolean

  onClick: () => void

}) {

  return (

    <button

      type="button"

      title={`AI suggest · ${label}`}

      disabled={busy}

      onClick={onClick}

      className="inline-flex size-7 shrink-0 items-center justify-center border-2 border-mad-black bg-mad-black text-mad-white hover:bg-mad-vermillion disabled:opacity-50"

    >

      {busy ? (

        <Loader2 className="size-3.5 animate-spin" />

      ) : (

        <Sparkles className="size-3.5" />

      )}

    </button>

  )

}



const PHASE_META: Record<
  CustomizeWizardPhase,
  { step: string; title: string; subtitle: string }
> = {
  all: {
    step: "Step 2 · Customize",
    title: "Intent, styling & copy",
    subtitle: "",
  },
  intent: {
    step: "II · Intent",
    title: "Audience & DNA",
    subtitle: STUDIO_WIZARD_STEP_SOP[WORKBENCH_STEP_INTENT].hint,
  },
  canvas: {
    step: "III · Canvas",
    title: "On-image text",
    subtitle: STUDIO_WIZARD_STEP_SOP[WORKBENCH_STEP_CANVAS].hint,
  },
  copy: {
    step: "IV · Copy",
    title: "Post copy",
    subtitle:
      "Write the caption as it should publish; optional opening line for Story/Reels.",
  },
}

export function StepCustomize({
  itemFacts = null,
  canvasSourceUrl = null,
  onCutout,
  cutoutBusy = false,
  photoCount = 1,

  phase = "all",

  entity,

  entityId,

  marketingEntityId = null,

  isFudi,

  vibeOptions,

  postIntent,

  onPostIntentChange,

  headline,

  caption,

  onHeadlineChange,

  onCaptionChange,

  hookChips,

  activeHookId,

  onHookSelect,

  tagsSlot,

  topSlot,
  canvasSlot = null,

  footerSlot,

  destinationUrl,

  onDestinationUrlChange,

  trackablePreview,

  textOverlay = DEFAULT_CANVAS_TEXT_OVERLAY,

  onTextOverlayChange,

  visualDescription = null,

  visualInspection = null,

  inspectableMediaUrl = null,

  inspectableMediaType = "image",

  onVisualInspectionResolved,

  isVideoPreview = false,

  contentPillar = "",

  onContentPillarChange,

  personaId = "",

  onPersonaIdChange,

  hookBlueprintId = null,

  onHookBlueprintIdChange,

  ctaId = null,

  onCtaIdChange,

  captionVariantLabel = null,

  onRotateCaption,

  onEnhanceCaption,

  enhancingCaption = false,

  intentFieldSet = "full",

  audienceToneCue = "",
  postFocusLabel = null,
  stillPhotoCount = 1,
  brandProfileId = null,

  carouselPackContext = null,
  carouselMergedVision = null,

}: Props) {

  const [assistField, setAssistField] = useState<"caption" | null>(null)

  const [captionVariations, setCaptionVariations] = useState<string[]>([])

  const [intentMapBusy, setIntentMapBusy] = useState(false)
  const [intentAdvancedOpen, setIntentAdvancedOpen] = useState(false)
  const [aiSuggested, setAiSuggested] = useState<
    Partial<Record<IntentAiSuggestedField, boolean>>
  >({})

  function clearAiField(field: IntentAiSuggestedField) {
    setAiSuggested((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const personas = personasFromAudienceSegments(entity.audience_segments)

  const bank = resolveFormulaBank(
    entity.brand_identity,
    resolveIndustryProfile({ name: entity.name, industry: entity.industry }).id
  )

  const industryProfile = resolveIndustryProfile({
    name: entity.name,
    industry: entity.industry,
  })
  const pillars =
    entity.content_pillars.length > 0
      ? entity.content_pillars
      : industryProfile.contentPillars.length > 0
        ? industryProfile.contentPillars
        : ["Brand story", "Product drop", "Community"]

  // Same list as the Schedule formula panel (they share the chosen CTA).
  const ctas = resolveConversionActions(
    entity.conversion_goals,
    resolveIndustryProfile({ name: entity.name, industry: entity.industry }).id
  )

  const pillarOptions = useMemo(() => [...pillars], [pillars])
  const [pillarCustom, setPillarCustom] = useState(
    () =>
      Boolean(contentPillar.trim()) &&
      !pillarOptions.some(
        (p) => p.toLowerCase() === contentPillar.trim().toLowerCase()
      )
  )
  useEffect(() => {
    const trimmed = contentPillar.trim()
    if (!trimmed) return
    const inList = pillarOptions.some(
      (p) => p.toLowerCase() === trimmed.toLowerCase()
    )
    if (!inList) setPillarCustom(true)
  }, [contentPillar, pillarOptions])

  const pillarSelectValue = pillarCustom
    ? SELECT_CUSTOM
    : pickSelectValue(
        contentPillar,
        pillarOptions,
        pillarOptions[0] ?? SELECT_CUSTOM
      )

  const personaIds = personas.map((p) => p.id)
  const personaSelectValue = pickSelectValue(
    personaId,
    personaIds,
    personas[0]?.id ?? SELECT_NONE
  )

  const hookIds = bank.hook_styles.map((h) => h.id)
  const hookSelectValue = pickSelectValue(
    hookBlueprintId,
    hookIds,
    bank.hook_styles[0]?.id ?? SELECT_NONE
  )

  const ctaIds = ctas.map((c) => c.id)
  const ctaSelectValue = pickSelectValue(
    ctaId,
    ctaIds,
    ctas[0]?.id ?? SELECT_NONE
  )

  const hasVisionCache = Boolean(
    visualDescription?.trim() ||
      visualInspection?.visualDescription?.trim() ||
      (visualInspection?.aestheticTags?.length ?? 0) > 0 ||
      (visualInspection?.concreteFeatures?.length ?? 0) > 0
  )

  const publicInspectableUrl = useMemo(() => {
    const trimmed = inspectableMediaUrl?.trim() ?? ""
    return /^https?:\/\//i.test(trimmed) ? trimmed : null
  }, [inspectableMediaUrl])

  const canAutoSuggestIntent = hasVisionCache || Boolean(publicInspectableUrl)

  async function resolveVisionForIntentMap(): Promise<{
    visualDescription: string
    aestheticTags: string[]
    concreteFeatures: string[]
  }> {
    if (hasVisionCache) {
      return {
        visualDescription:
          visualInspection?.visualDescription?.trim() ||
          visualDescription?.trim() ||
          "",
        aestheticTags: visualInspection?.aestheticTags ?? [],
        concreteFeatures: visualInspection?.concreteFeatures ?? [],
      }
    }
    if (!publicInspectableUrl) {
      throw new Error("Attach media on Step 1 (wait for upload to finish) first.")
    }
    const mediaType =
      inspectableMediaType ?? (isVideoPreview ? "video" : "image")
    let frameDataUrl: string | null = null
    if (mediaType === "video") {
      frameDataUrl = await extractVideoKeyframeFromUrl(publicInspectableUrl)
      if (!frameDataUrl) {
        throw new Error(
          "Could not sample a video frame. On Step 1 Media, wait for vision to finish or re-upload the reel."
        )
      }
    }
    const inspection = await requestMediaInspection({
      mediaUrl: publicInspectableUrl,
      mediaType,
      entityId,
      frameDataUrl,
    })
    onVisualInspectionResolved?.(inspection)
    return {
      visualDescription: inspection.visualDescription,
      aestheticTags: inspection.aestheticTags ?? [],
      concreteFeatures: inspection.concreteFeatures ?? [],
    }
  }

  async function runIntentAutoSuggest() {
    if (!canAutoSuggestIntent) {
      toast.message("Attach media on Step 1 (upload must finish) first.")
      return
    }
    const retailTopicOnly = intentFieldSet === "focus" && !isFudi
    if (
      !retailTopicOnly &&
      (personas.length === 0 ||
        bank.hook_styles.length === 0 ||
        ctas.length === 0)
    ) {
      toast.error("Add personas, hook blueprints, and CTAs in Brain DNA first.")
      return
    }
    setIntentMapBusy(true)
    try {
      const vision = await resolveVisionForIntentMap()
      const result = await requestMapIntentFromMedia({
        entityId,
        visualDescription: vision.visualDescription,
        activeBrand: entity.name,
        aestheticTags: vision.aestheticTags,
        concreteFeatures: vision.concreteFeatures,
        retailTopicOnly,
        audienceToneCue: audienceToneCue.trim() || undefined,
        postFocusLabel: postFocusLabel?.trim() || undefined,
        stillPhotoCount,
        brandProfileId: brandProfileId ?? undefined,
        optionSource: {
          dropTypes: isFudi
            ? FUDI_DROP_KIND_OPTIONS.map((row) => ({
                id: row.id,
                label: row.label,
              }))
            : undefined,
          listingVibes: vibeOptions,
          pillars: pillarOptions,
          personas: personas.map((row) => ({ id: row.id, name: row.name })),
          hookBlueprints: bank.hook_styles.map((row) => ({
            id: row.id,
            label: row.label,
          })),
          ctas: ctas.map((row) => ({ id: row.id, label: row.label })),
        },
      })

      if (isFudi) {
        onPostIntentChange({
          ...postIntent,
          dropKind: result.dropKind,
          channelHint: result.dropTypeCustom ?? "",
          listingVibe: result.listingVibe,
        })
      }
      setPillarCustom(result.contentPillarIsCustom)
      onContentPillarChange?.(result.contentPillar)
      if (!retailTopicOnly) {
        onPersonaIdChange?.(result.personaId)
        onHookBlueprintIdChange?.(result.hookBlueprintId)
        onCtaIdChange?.(result.ctaId)
      }
      setAiSuggested({
        dropType: isFudi,
        listingVibe: !retailTopicOnly,
        pillar: true,
        persona: !retailTopicOnly,
        hookBlueprint: !retailTopicOnly,
        cta: !retailTopicOnly,
      })
      toast.success(
        retailTopicOnly
          ? "Suggested topic from media — check “What is this post about?” and edit if needed."
          : "Intent mapped from media — review each field before continuing."
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Auto-suggest failed."
      )
    } finally {
      setIntentMapBusy(false)
    }
  }

  function commitCaption(next: string) {

    onCaptionChange(stripDuplicateHookFromCaption(headline, next))

  }



  function commitHeadline(next: string) {

    onHeadlineChange(next)

    onCaptionChange(stripDuplicateHookFromCaption(next, caption))

  }



  async function runCaptionAssist() {
    if (!canAutoSuggestIntent) {
      toast.message("Attach media on Step 1 (upload must finish) first.")
      return
    }
    setAssistField("caption")
    try {
      const vision = await resolveVisionForIntentMap()
      const visualDescription =
        carouselPackContext?.isCarousel && carouselMergedVision?.trim()
          ? carouselMergedVision.trim()
          : vision.visualDescription
      const persona = personas.find((row) => row.id === personaId)
      const hookBlueprint = bank.hook_styles.find(
        (row) => row.id === hookBlueprintId
      )
      const cta = ctas.find((row) => row.id === ctaId)
      const result = await requestFieldAssist({
        entityId,
        marketingEntityId,
        field: "caption",
        headline,
        caption,
        visualDescription,
        listingVibe: postIntent.listingVibe?.trim() || null,
        wizard: {
          listingVibe: postIntent.listingVibe?.trim() || null,
          dropKind: postIntent.dropKind,
          contentPillar: contentPillar?.trim() || null,
          personaName: persona?.name ?? null,
          hookBlueprintLabel: hookBlueprint?.label ?? null,
          ctaLabel: cta?.label ?? null,
          aestheticTags: vision.aestheticTags,
          concreteFeatures: vision.concreteFeatures,
          onCanvasHeadline: textOverlay.enabled
            ? textOverlay.headline
            : null,
          onCanvasSubhead: textOverlay.enabled ? textOverlay.subhead : null,
          audienceToneCue: audienceToneCue.trim() || null,
          postFocusLabel: postFocusLabel?.trim() || null,
          stillPhotoCount,
          carouselSlides: carouselPackContext?.slides.map((row) => ({
            index: row.index,
            brand: row.brand,
            vibe: row.vibe,
            listingLine: row.listingLine,
            visualSummary: row.visualSummary,
          })),
          carouselBrands: carouselPackContext?.brands,
          carouselVibes: carouselPackContext?.vibes,
          carouselEditorSummary: carouselPackContext?.editorSummary ?? null,
        },
      })
      setCaptionVariations(result.variations)
      toast.success(
        carouselPackContext?.isCarousel
          ? `${result.variations.length} carousel caption option(s) — whole-edit tone, all designers considered.`
          : `${result.variations.length} caption option(s) from your media & intent — tap to apply.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI assist failed.")
    } finally {
      setAssistField(null)
    }
  }



  const meta = PHASE_META[phase]
  const showIntent = phase === "all" || phase === "intent"
  const showCanvas = phase === "all" || phase === "canvas"
  const showCopy = phase === "all" || phase === "copy"
  const isIntentWizard = phase === "intent"
  const intentFocus = intentFieldSet === "focus" && !isFudi
  const isCanvasWizard = phase === "canvas"
  const isCopyWizard = phase === "copy"
  // Every wizard step shows the same "N · Step" header.
  const isStepWizard = isIntentWizard || isCanvasWizard || isCopyWizard
  // This brand's colours and headline font (Brand Brain → Visual presets).
  const brandPresets = resolveVisualPresets({
    brandName: entity.name,
    industry: entity.industry,
    brandIdentity: entity.brand_identity,
  })
  const intentFieldLabel = isIntentWizard
    ? "text-xs font-semibold tracking-wide text-neutral-600 uppercase"
    : "font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase"
  const intentSelectClass = isIntentWizard
    ? INTENT_WIZARD_SELECT_CLASS
    : DNA_SELECT_TRIGGER_CLASS

  return (

    <StudioStepPanel
      fill
      // Every step scrolls; Intent used to be fixed-height and clipped.
      scrollBody
      compactHeader={isStepWizard}
      kicker={meta.step}
      title={meta.title}
      description={
        meta.subtitle && phase === "all" ? meta.subtitle : undefined
      }
      className={cn(
        "min-w-0",
        isStepWizard && "p-4 md:p-5"
      )}
    >
      {showIntent ? (
        <div className={isIntentWizard ? "shrink-0" : "space-y-1"}>
          {intentFocus ? (
            <p className="mb-1.5 text-xs leading-relaxed text-neutral-600">
              AI suggestions are optional and often wrong for promos — set tone
              and focus yourself, then use the button below only to guess a{" "}
              <span className="font-semibold">topic</span> from your photo.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!canAutoSuggestIntent || intentMapBusy}
            onClick={() => void runIntentAutoSuggest()}
            className={cn(
              "flex w-full items-center justify-center gap-2 border-2 border-mad-black px-3 font-typewriter font-bold tracking-wide uppercase transition",
              isIntentWizard ? "py-2.5 text-sm" : "py-2 text-[0.7rem]",
              intentFocus
                ? "shadow-none"
                : "shadow-keycap-sm",
              canAutoSuggestIntent
                ? intentFocus
                  ? "bg-white text-mad-black hover:bg-mad-lime/40 disabled:opacity-60"
                  : "bg-mad-lime text-mad-black hover:bg-mad-black hover:text-mad-white disabled:opacity-60"
                : "cursor-not-allowed bg-neutral-100 text-neutral-400"
            )}
          >
            {intentMapBusy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Analyzing media…
              </>
            ) : (
              <>
                <Brain className="size-4" aria-hidden />
                {intentFocus
                  ? "Optional · suggest topic from media"
                  : "Auto-Suggest Intent from Media"}
              </>
            )}
          </button>
          {!isIntentWizard && !canAutoSuggestIntent ? (
            <p className="font-typewriter text-[0.68rem] text-neutral-500 normal-case">
              Attach media on Step 1 (upload must finish) to unlock auto-suggest.
            </p>
          ) : !isIntentWizard && !hasVisionCache ? (
            <p className="font-typewriter text-[0.68rem] text-neutral-500 normal-case">
              Step 1 vision not run yet — click above to inspect and map intent.
            </p>
          ) : null}
        </div>
      ) : null}

      {showIntent ? topSlot : null}



      {showIntent && isFudi ? (
        <PostIntentEditor
          wizardCompact={isIntentWizard}
          className={isIntentWizard ? "mt-2.5 shrink-0" : undefined}
          isFudi={isFudi}
          vibeOptions={vibeOptions}
          value={postIntent}
          onChange={onPostIntentChange}
          aiSuggested={{
            dropType: aiSuggested.dropType,
            listingVibe: aiSuggested.listingVibe,
          }}
          onManualFieldChange={(field) => clearAiField(field)}
        />
      ) : null}

      {showIntent && intentFocus ? (
        <p className="mt-2 text-xs leading-relaxed text-neutral-600">
          Pick who you are talking to above, then what this post is about for{" "}
          {entity.name}. Hook style and CTA are on{" "}
          <span className="font-semibold">Schedule</span> when you render a pack.
        </p>
      ) : null}

      {showIntent ? (
      <div
        className={cn(
          "grid min-w-0 sm:[&>*]:min-w-0",
          intentFocus
            ? "mt-2.5 gap-2.5"
            : isIntentWizard
              ? "mt-2.5 gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
              : "gap-2 sm:grid-cols-2"
        )}
      >

        <label
          className={cn(
            "grid min-w-0 gap-1.5",
            intentFocus && "sm:col-span-full"
          )}
        >

          <span className={intentFieldLabel}>
            {intentFocus ? "What is this post about?" : "Content pillar / vibe"}
          </span>

          <Select
            value={pillarSelectValue}
            onValueChange={(value) => {
              clearAiField("pillar")
              if (value === SELECT_CUSTOM) {
                setPillarCustom(true)
                onContentPillarChange?.("")
                return
              }
              setPillarCustom(false)
              onContentPillarChange?.(value)
            }}
          >
            <IntentSelectTrigger
              className={intentSelectClass}
              aiSuggested={Boolean(aiSuggested.pillar)}
            >
              <SelectValue placeholder="Content pillar" />
            </IntentSelectTrigger>
            <SelectContent position="popper" className={DNA_SELECT_CONTENT_CLASS}>
              {pillarOptions.map((pillar) => (
                <SelectItem key={pillar} value={pillar} title={pillar}>
                  <span className="block truncate">{pillar}</span>
                </SelectItem>
              ))}
              <SelectItem value={SELECT_CUSTOM}>Custom…</SelectItem>
            </SelectContent>
          </Select>
          {pillarSelectValue === SELECT_CUSTOM ? (
            <input
              type="text"
              value={contentPillar}
              onChange={(event) => {
                clearAiField("pillar")
                onContentPillarChange?.(event.target.value)
              }}
              placeholder="Custom pillar / vibe…"
              className={cn(
                "w-full border-2 border-mad-black bg-mad-white px-2 font-sans outline-none focus:bg-mad-lime/20",
                isIntentWizard ? "h-10 text-sm" : "h-9 text-base md:text-sm"
              )}
            />
          ) : null}
        </label>

        {intentFocus && !intentAdvancedOpen ? (
          <button
            type="button"
            className="border-2 border-dashed border-mad-black/40 px-3 py-2 text-left font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-600 uppercase hover:border-mad-black hover:bg-mad-lime/30 sm:col-span-full"
            onClick={() => setIntentAdvancedOpen(true)}
          >
            Optional: persona, hook blueprint, CTA
          </button>
        ) : null}

        {intentFocus && !intentAdvancedOpen ? null : (
        <>
        <label className="grid min-w-0 gap-1.5">

          <span className={intentFieldLabel}>Audience persona</span>

          {personas.length === 0 ? (
            <p className="font-typewriter text-[0.7rem] text-neutral-500 normal-case">
              Add audience segments in Brain to pick a persona.
            </p>
          ) : (
            <Select
              value={personaSelectValue}
              onValueChange={(value) => {
                clearAiField("persona")
                onPersonaIdChange?.(value === SELECT_NONE ? "" : value)
              }}
            >
              <IntentSelectTrigger
                className={intentSelectClass}
                aiSuggested={Boolean(aiSuggested.persona)}
              >
                <SelectValue placeholder="Persona" />
              </IntentSelectTrigger>
              <SelectContent position="popper" className={DNA_SELECT_CONTENT_CLASS}>
                {personas.map((persona) => (
                  <SelectItem key={persona.id} value={persona.id}>
                    {persona.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </label>



        <label className="grid min-w-0 gap-1.5">

          <span className={intentFieldLabel}>Hook blueprint</span>

          {bank.hook_styles.length === 0 ? (
            <p className="font-typewriter text-[0.7rem] text-neutral-500 normal-case">
              Add hook blueprints in Brain DNA presets.
            </p>
          ) : (
            <Select
              value={hookSelectValue}
              onValueChange={(value) => {
                clearAiField("hookBlueprint")
                if (value !== SELECT_NONE) {
                  onHookBlueprintIdChange?.(value)
                }
              }}
            >
              <IntentSelectTrigger
                className={intentSelectClass}
                aiSuggested={Boolean(aiSuggested.hookBlueprint)}
              >
                <SelectValue placeholder="Hook blueprint" />
              </IntentSelectTrigger>
              <SelectContent position="popper" className={DNA_SELECT_CONTENT_CLASS}>
                {bank.hook_styles.map((hook) => (
                  <SelectItem key={hook.id} value={hook.id}>
                    {hook.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </label>



        <label className="grid min-w-0 gap-1.5">

          <span className={intentFieldLabel}>Call to action (CTA)</span>

          {ctas.length === 0 ? (
            <p className="font-typewriter text-[0.7rem] text-neutral-500 normal-case">
              Add conversion goals in Brain to pick a CTA.
            </p>
          ) : (
            <Select
              value={ctaSelectValue}
              onValueChange={(value) => {
                clearAiField("cta")
                if (value !== SELECT_NONE) onCtaIdChange?.(value)
              }}
            >
              <IntentSelectTrigger
                className={intentSelectClass}
                aiSuggested={Boolean(aiSuggested.cta)}
              >
                <SelectValue placeholder="Call to action" />
              </IntentSelectTrigger>
              <SelectContent position="popper" className={DNA_SELECT_CONTENT_CLASS}>
                {ctas.map((cta) => (
                  <SelectItem key={cta.id} value={cta.id}>
                    {cta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </label>
        </>
        )}

      </div>
      ) : null}



      {showCanvas && onTextOverlayChange ? (
        <>
        {canvasSlot}
        <CanvasTextOverlayEditor
          wizardCompact={isCanvasWizard}
          className={isCanvasWizard ? "min-h-0 flex-1" : undefined}
          value={textOverlay}
          onChange={onTextOverlayChange}
          isVideo={isVideoPreview}
          destinationUrl={destinationUrl}
          swatches={brandSwatches(brandPresets)}
          brandFontId={brandPresets.heading_font_id ?? null}
          itemFacts={itemFacts}
          logoUrl={brandPresets.logo_url ?? null}
          sourceUrl={canvasSourceUrl}
          onCutout={onCutout}
          cutoutBusy={cutoutBusy}
          photoCount={photoCount}
          entityId={entityId}
        />
        </>

      ) : null}



      {showCopy ? (
      phase === "copy" ? (
        <>
          <StepCopyEditor
            wizardCompact={isCopyWizard}
            className={isCopyWizard ? "min-h-0 flex-1" : undefined}
            photoCount={stillPhotoCount}
            headline={headline}
            caption={caption}
            onHeadlineChange={commitHeadline}
            onCaptionChange={commitCaption}
            hookChips={hookChips}
            activeHookId={activeHookId}
            onHookSelect={onHookSelect}
            captionVariantLabel={captionVariantLabel}
            onRotateCaption={onRotateCaption}
            onEnhanceCaption={onEnhanceCaption}
            enhancingCaption={enhancingCaption}
            onAssistCaption={() => void runCaptionAssist()}
            assistField={assistField}
            captionVariations={captionVariations}
            onPickCaptionVariation={(variant) => {
              commitCaption(variant)
              setCaptionVariations([])
            }}
            tagsSlot={tagsSlot}
          />
          {footerSlot}
        </>
      ) : (
      <>
      <div className="space-y-2 border-t-2 border-mad-black/15 pt-3">

        <div className="flex flex-wrap items-end justify-between gap-2">

          <p className="font-typewriter text-[0.7rem] font-bold tracking-widest text-mad-vermillion uppercase">

            Copy engine

          </p>

          {onRotateCaption || onEnhanceCaption ? (

            <div className="flex flex-wrap items-center gap-1.5">

              {captionVariantLabel ? (

                <span className="font-typewriter text-[0.68rem] tracking-wider text-neutral-500 uppercase">

                  {captionVariantLabel}

                </span>

              ) : null}

              {onRotateCaption ? (

                <button

                  type="button"

                  onClick={onRotateCaption}

                  className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-2 py-1 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase hover:bg-mad-lime"

                >

                  <RotateCcw className="size-3" />

                  Rotate

                </button>

              ) : null}

              {onEnhanceCaption ? (

                <button

                  type="button"

                  onClick={() => onEnhanceCaption()}

                  disabled={enhancingCaption}

                  className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-2 py-1 font-typewriter text-[0.68rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-60"

                >

                  {enhancingCaption ? (

                    <Loader2 className="size-3 animate-spin" />

                  ) : (

                    <Sparkles className="size-3" />

                  )}

                  AI enhance

                </button>

              ) : null}

            </div>

          ) : null}

        </div>



        <div className="grid max-h-[10rem] gap-1 overflow-y-auto sm:grid-cols-2">

          {hookChips.map((hook) => {

            const active = activeHookId === hook.id

            return (

              <button

                key={hook.id}

                type="button"

                onClick={() => onHookSelect(hook.id)}

                className={cn(

                  "border-2 border-mad-black px-2 py-1.5 text-left transition",

                  active ? "bg-mad-black text-mad-white" : "bg-mad-white hover:bg-mad-lime"

                )}

              >

                <span

                  className={cn(

                    "block font-typewriter text-[0.68rem] font-bold tracking-wider uppercase",

                    active ? "text-mad-lime" : "text-mad-vermillion"

                  )}

                >

                  {hook.label}

                </span>

                <span className="mt-0.5 block text-xs leading-snug">{hook.hook}</span>

              </button>

            )

          })}

        </div>



        <label className="block space-y-1">

          <span className="font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase">

            Opening line — pick a Brain hook above or type your own

          </span>

          <AutoTextarea

            value={headline}

            onValueChange={commitHeadline}

            rows={1}

            placeholder="0–3s spoken / on-screen hook"

            className="rounded-none border-2 border-mad-black bg-mad-white px-2 py-1.5 text-base font-medium focus:bg-mad-lime/20 md:text-sm"

          />

        </label>



        <label className="block space-y-1">

          <span className="flex items-center gap-2 font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase">

            Caption

            <AiAssistButton

              label="caption"

              busy={assistField === "caption"}

              onClick={() => void runCaptionAssist()}

            />

          </span>

          <AutoTextarea

            value={caption}

            onValueChange={(value) => commitCaption(value)}

            rows={3}

            placeholder="Caption body (hook not repeated here)"

            className="rounded-none border-2 border-mad-black bg-mad-white px-2 py-1.5 text-base focus:bg-mad-lime/20 md:text-sm"

          />

          {captionVariations.length > 0 ? (

            <div className="flex flex-col gap-1 pt-1">

              {captionVariations.map((variant) => (

                <button

                  key={variant}

                  type="button"

                  onClick={() => commitCaption(variant)}

                  className="border-2 border-mad-black bg-mad-lime/30 px-2 py-1 text-left text-xs hover:bg-mad-lime"

                >

                  {variant}

                </button>

              ))}

            </div>

          ) : null}

        </label>

      </div>

      {tagsSlot}

      {onDestinationUrlChange ? (

        <label className="grid min-w-0 gap-1">

          <span className="font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase">

            Destination URL

          </span>

          <input

            type="url"

            value={destinationUrl ?? ""}

            onChange={(event) => onDestinationUrlChange(event.target.value)}

            placeholder="https://…"

            className="h-9 w-full border-2 border-mad-black px-2 text-xs outline-none focus:bg-mad-lime/20"

          />

          {trackablePreview ? (

            <p className="font-mono text-[0.72rem] text-neutral-600">

              Trackable · {trackablePreview}

            </p>

          ) : null}

        </label>

      ) : null}

      {footerSlot}
      </>
      )
      ) : null}

    </StudioStepPanel>

  )

}



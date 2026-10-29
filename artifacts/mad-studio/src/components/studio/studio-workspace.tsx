"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Link } from "wouter"
import { useRouter, useSearchParams } from "@/lib/next-compat"
import { ChevronDown, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  dispatchCampaignPack,
  getStudioPack,
  saveCampaign,
  type StudioPackSnapshot,
} from "@/lib/actions"
import { setActiveEntity } from "@/lib/actions"
import {
  armCampaignMultiChannelDispatch,
  disarmCampaignQueue,
} from "@/lib/actions"
import { MultiChannelScheduler } from "@/components/marketing/multi-channel-scheduler"
import { CanvasSlidePicker } from "@/components/studio/canvas-slide-picker"
import {
  ReviewBeforeSchedule,
  type MediaByChannel,
} from "@/components/studio/review-before-schedule"
import { resolveStoryKit } from "@/lib/brands/story-kit"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { SchedulerChannel } from "@/lib/scheduling/brain-timing"
import { stripMarkdown } from "@/lib/scheduling/pack-payload"
import { IntentMatrix } from "@/components/studio/intent-matrix"
import { PackResultsEditor } from "@/components/studio/pack-results-editor"
import { CompactChannelRail } from "@/components/studio/compact-channel-rail"
import { StepDock, type WorkbenchStepId } from "@/components/studio/step-stepper"
import { StudioCreateChrome } from "@/components/studio/studio-create-chrome"
import { StudioSplitShell } from "@/components/studio/studio-split-shell"
import { StudioStepSummary } from "@/components/studio/studio-step-summary"
import {
  buildPlannerStudioSpark,
  readStudioPlannerHandoff,
} from "@/lib/planner/studio-handoff"
import {
  WORKBENCH_STEP_CANVAS,
  WORKBENCH_STEP_CHANNELS,
  WORKBENCH_STEP_COPY,
  WORKBENCH_STEP_INTENT,
  WORKBENCH_STEP_MEDIA,
  nextWorkbenchStep,
  parseWorkbenchStepParam,
  prevWorkbenchStep,
} from "@/lib/studio/workbench-steps"
import {
  buildCreativeSequence,
  buildVisualOnlyCampaignPack,
  parseCreativeSequence,
  restoreCreativeSequence,
  type CreativeSurface,
} from "@/lib/studio/creative-sequence"
import type { CustomizeWizardPhase } from "@/components/studio/steps/step-customize"
import {
  DEFAULT_STORY_PREVIEW,
  MultiPlatformSimulator,
} from "@/components/marketing/multi-platform-simulator"
import {
  CANVAS_TEXT_FONTS,
  canvasBackdropOn,
  canvasOverlayHasDecor,
  normalizeCanvasTextOverlay,
  DEFAULT_CANVAS_TEXT_OVERLAY,
  canvasOverlayWithoutCopy,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"
import {
  mediaAssetsFromImageUrls,
  resolveActiveMedia,
  type MediaAsset,
} from "@/components/marketing/media-tray"
import { StepCustomize } from "@/components/studio/steps/step-customize"
import { StepMedia } from "@/components/studio/steps/step-media"
import type { PostIntentState } from "@/lib/inventory/post-intent"
import { stripDuplicateHookFromCaption } from "@/lib/inventory/sop"
import { OptimizationTagsEditor } from "@/components/inventory/optimization-tags-editor"
import {
  buildStudioOptimizationTags,
  mergeCaptionWithTags,
  OPTIMIZATION_TAG_MAX,
} from "@/lib/inventory/optimization-tags"
import {
  listingCaptionForPost,
  listingTagsForPost,
  mergeTagSuggestions,
  mergeTrayIntakeCaptions,
} from "@/lib/studio/intake-listing-copy"
import {
  isCatalogMetadataDump,
  readableListingCaption,
} from "@/lib/inventory/context-hooks"
import { buildWlsDestinationUrl } from "@/lib/inventory/wls-product-eligibility"
import {
  buildCarouselPackContext,
  mergedCarouselVision,
} from "@/lib/studio/carousel-pack-context"
import {
  sanitizeBrandName,
  scrubInlineHashtags,
} from "@/lib/copy/caption-hygiene"
import type { MediaKind } from "@/lib/media/kind"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import {
  personasFromAudienceSegments,
  type MultiplexerIntent,
  type CampaignPackOutputView,
} from "@/lib/campaigns/multiplexer"
import {
  clearActiveMultiplexerBuffer,
  formatDraftRestoredAt,
  readActiveMultiplexerBuffer,
  writeActiveMultiplexerBuffer,
} from "@/lib/campaigns/pack-hydrate"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import { packToStudioPreview } from "@/lib/campaigns/studio-preview"
import type { MediaVisualInspection } from "@/lib/media/inspect-schema"
import { formatScheduleToast } from "@/lib/inventory/schedule"
import {
  CHANNEL_META,
  hydrateDispatchPlan,
  type ChannelSlot,
} from "@/lib/scheduling/brain-timing"
import {
  AUDIENCE_TONE_META,
  audienceToneCue,
  type AudienceTone,
} from "@/lib/studio/audience-tone"
import { resolveForecastingTagForPersona } from "@/lib/brain/audience-segment-display"
import {
  buildStudioHookChips,
  resolveStudioPresets,
  type StudioIntentChip,
} from "@/lib/studio/entity-presets"
import {
  applySparkChannelPreset,
  detectSparkDispatchFeature,
} from "@/lib/studio/spark-dispatch-preset"
import {
  applyFudiTrackToStudioPresets,
  buildFudiRedirectSlugSeed,
  buildFudiTrackHookChips,
  isFudiStudioEntity,
  resolveFudiTrackPresets,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"
import { FormulaBankPanel } from "@/components/studio/formula-bank-panel"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import {
  objectiveForIntentChip,
  personaForAudienceTone,
  studioTargetGoal,
} from "@/lib/studio/intent-focus"
import { MediaLibraryDrawer } from "@/components/studio/media-library-drawer"
import type { MediaLibraryItem } from "@/lib/studio/media-library"
import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import { requestCutout } from "@/lib/media/request-cutout"
import { CanvasLayoutsBar } from "@/components/studio/canvas-layouts-bar"
import { CanvasLayoutSaveButton } from "@/components/studio/canvas-layout-save-button"
import {
  applyLayoutToOverlay,
  defaultLayoutOverlay,
  layoutFromOverlay,
  layoutWantsBackdrop,
  slideOverlayBeforeLayoutApply,
  type LayoutWordingMode,
  type SavedCanvasLayout,
} from "@/lib/studio/canvas-layouts"
import { saveCanvasLayouts } from "@/lib/actions"
import { NewArrivalSuggestions } from "@/components/studio/new-arrival-suggestions"
import {
  fetchItemFacts,
  fetchItemsForStudio,
  overlayPatchFromItemFacts,
  SUGGESTED_FORMAT_LABELS,
  type NewArrivalSuggestion,
} from "@/lib/studio/new-arrival-suggestions"
import { proxiedImageUrl } from "@/lib/studio/final-artwork"
import type {
  WlsHardBlockReason,
  WlsProductSelection,
} from "@/lib/inventory/wls-product-eligibility"
import { INVENTORY_SYNCED_EVENT } from "@/lib/studio/pull-new-arrivals-client"
import { buildFeedTrayFromWlsSelection } from "@/lib/studio/wls-studio-product-add"
import {
  buildWlsDailyStoryStudioSeed,
  buildWlsStoryFrameFromSelection,
  mergeWlsReplaceOverlay,
  WLS_DAILY_STORY_HANDOFF_QUERY_FLAG,
  WLS_DAILY_STORY_STUDIO_MAX_FRAMES,
  wlsStoryAssetIdForProduct,
} from "@/lib/templates/wls-daily-story-studio-seed"
import {
  STUDIO_SLIDES_QUERY_FLAG,
  takeStudioSlidesHandoff,
} from "@/lib/studio/studio-slides-handoff"
import { WlsEligibleProductStrip } from "@/components/studio/wls-eligible-product-strip"
import { StudioTemplatePicker } from "@/components/studio/studio-template-picker"
import { WlsDailyStoryEntryBanner } from "@/components/studio/wls-daily-story-entry-banner"
import {
  shouldSkipStudioTemplateHandoff,
  studioTemplateHandoffResumeKey,
} from "@/lib/studio/studio-template-handoff-guard"
import { fetchStudioTemplateHandoff } from "@/lib/templates/studio-handoff-client"
import type { StudioTemplateHandoffResponse } from "@/lib/templates/studio-handoff-types"
import {
  defaultTextFillsFromTemplate,
  hasUsableFrameTemplate,
  type FrameTemplate,
} from "@/lib/templates/frame-template"
import { bakeFrameTemplate } from "@/lib/media/bake-frame-template"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  buildCampaignPackFromFormula,
  defaultSlotsFromSpark,
  resolveConversionActions,
  resolveFormulaBank,
  type FormulaRenderSlots,
} from "@/lib/studio/formula-bank"
import { useStudioChromeOptional } from "@/components/studio/studio-chrome-context"
import { cn } from "@/lib/utils"
import type { AccessibleEntity } from "@/lib/types"

const RAW_SPARK_MAX = 500

const LOCAL_RESUME_WINDOW_MS = 6 * 60 * 60 * 1000

type StudioWorkspaceProps = {
  entities: AccessibleEntity[]
  activeEntity: StudioEntityDna
  initialStep?: string | null
  startFresh?: boolean
}

export function StudioWorkspace({
  entities,
  activeEntity,
  initialStep = null,
  startFresh = false,
}: StudioWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFudi = useMemo(
    () =>
      isFudiStudioEntity({
        name: activeEntity.name,
        industry: activeEntity.industry,
      }),
    [activeEntity.name, activeEntity.industry]
  )
  const [fudiTrack, setFudiTrack] = useState<FudiAudienceTrack>("diners")
  const [audienceTone, setAudienceTone] =
    useState<AudienceTone>("curated_millennial")
  const studioPresets = useMemo(() => {
    const base = resolveStudioPresets({
      name: activeEntity.name,
      industry: activeEntity.industry,
    })
    return isFudi ? applyFudiTrackToStudioPresets(base, fudiTrack) : base
  }, [activeEntity.name, activeEntity.industry, isFudi, fudiTrack])
  const fudiTrackPresets = useMemo(
    () => (isFudi ? resolveFudiTrackPresets(fudiTrack) : null),
    [isFudi, fudiTrack]
  )
  const personas = useMemo(() => {
    const fromDna = personasFromAudienceSegments(
      activeEntity.audience_segments
    )
    if (fromDna.length > 0) return fromDna
    return personasFromAudienceSegments(studioPresets.fallbackAudience)
  }, [activeEntity.audience_segments, studioPresets.fallbackAudience])

  const [intent, setIntent] = useState<MultiplexerIntent>(
    () => studioPresets.intentChips[0]?.intent ?? "Drive Sales"
  )
  const [intentChipId, setIntentChipId] = useState(
    () => studioPresets.intentChips[0]?.id ?? "drive_sales"
  )
  const objectives = studioPresets.objectives
  const consumerIntentChips = useMemo(
    () =>
      studioPresets.intentChips.filter(
        (chip) =>
          !/commission|table talk|b2b|partner pitch|nfc table|linkedin update/i.test(
            chip.label
          )
      ),
    [studioPresets.intentChips]
  )
  const [objective, setObjective] = useState(() =>
    objectiveForIntentChip(
      resolveIndustryProfile({
        name: activeEntity.name,
        industry: activeEntity.industry,
      }).id,
      studioPresets.intentChips[0]?.id ?? "drive_sales",
      studioPresets.intentChips[0]?.label ?? "Drive Sales"
    )
  )
  const brandProfileId = resolveIndustryProfile({
    name: activeEntity.name,
    industry: activeEntity.industry,
  }).id
  const toneGoalSuffix = audienceToneCue(audienceTone, brandProfileId)
  const brandVisualPresets = resolveVisualPresets({
    brandName: activeEntity.name,
    industry: activeEntity.industry,
    brandIdentity: activeEntity.brand_identity,
  })
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "")
  const [rawSpark, setRawSpark] = useState("")
  const [templateInstanceId, setTemplateInstanceId] = useState<string | null>(
    null
  )
  const [templateVersionId, setTemplateVersionId] = useState<string | null>(
    null
  )
  const [templateDisplayName, setTemplateDisplayName] = useState<string | null>(
    null
  )
  /** Explicit Story vs Feed creative surface — preview channel switches do not clear Story edits. */
  const [creativeSurface, setCreativeSurface] =
    useState<CreativeSurface>("story")
  const [templateHandoffBusy, setTemplateHandoffBusy] = useState(false)
  /** True after WLS Daily Story template handoff seeds multi-frame Story tray. */
  const [wlsDailyStorySession, setWlsDailyStorySession] = useState(false)
  /** Canva frame template session (Feed OOTD etc.). */
  const [frameTemplate, setFrameTemplate] = useState<FrameTemplate | null>(null)
  const [frameImageFills, setFrameImageFills] = useState<
    Record<string, string>
  >({})
  const [frameTextFills, setFrameTextFills] = useState<Record<string, string>>(
    {}
  )
  const [frameComposedUrl, setFrameComposedUrl] = useState<string | null>(null)
  const [frameBaking, setFrameBaking] = useState(false)
  const [wlsCanvasLayoutId, setWlsCanvasLayoutId] = useState<string | null>(
    "story_9_16"
  )
  const [wlsProductCatalog, setWlsProductCatalog] = useState<
    WlsProductSelection[]
  >([])
  const [wlsEligibleLoading, setWlsEligibleLoading] = useState(false)
  const [wlsExcludedCount, setWlsExcludedCount] = useState(0)
  const [wlsSyncedCount, setWlsSyncedCount] = useState<number | null>(null)
  const [wlsExclusionSummary, setWlsExclusionSummary] = useState<
    Partial<Record<WlsHardBlockReason, number>>
  >({})
  const [wlsSelectableCount, setWlsSelectableCount] = useState(0)
  const [wlsStripBusy, setWlsStripBusy] = useState(false)
  const [formulaHookId, setFormulaHookId] = useState<string | null>(null)
  const [formulaVisualId, setFormulaVisualId] = useState<string | null>(null)
  const [formulaCtaId, setFormulaCtaId] = useState<string | null>(null)
  const [formulaSlots, setFormulaSlots] = useState<FormulaRenderSlots>(() =>
    defaultSlotsFromSpark("")
  )
  const [activeHookId, setActiveHookId] = useState<string | null>(null)
  const [redirectSlugSeed, setRedirectSlugSeed] = useState<string | null>(null)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false)
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false)
  const [packEditorOpen, setPackEditorOpen] = useState(false)
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null)
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null)
  const [visualInspection, setVisualInspection] =
    useState<MediaVisualInspection | null>(null)
  const [pack, setPack] = useState<CampaignPack | null>(null)
  /** The caption a quick (no-AI) pack was built from; null for AI or restored packs. */
  const quickPackCaption = useRef<string | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [editorSession, setEditorSession] = useState(0)
  const [multiplexing, setMultiplexing] = useState(false)
  const [rehydrating, setRehydrating] = useState(true)
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  const [systemError, setSystemError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [workbenchStep, setWorkbenchStep] = useState<WorkbenchStepId>(() =>
    parseWorkbenchStepParam(initialStep)
  )
  // On-image text is per photo, keyed by tray asset id, so each carousel
  // slide carries its own words. New slides inherit the last-edited style.
  // New posts start in this brand's headline font (Brand Brain presets).
  const [slideOverlays, setSlideOverlays] = useState<
    Record<string, CanvasTextOverlayState>
  >({})
  // Saved Canvas layouts for this brand; the default one starts every post.
  const [canvasLayouts, setCanvasLayouts] = useState<SavedCanvasLayout[]>(
    () => activeEntity.brand_identity.canvas_layouts ?? []
  )
  const [layoutsBusy, setLayoutsBusy] = useState(false)
  const [lastOverlayStyle, setLastOverlayStyle] =
    useState<CanvasTextOverlayState>(() => {
      const fromDefault = defaultLayoutOverlay(
        activeEntity.brand_identity.canvas_layouts ?? []
      )
      if (fromDefault) return fromDefault
      const brandFontId = resolveVisualPresets({
        brandName: activeEntity.name,
        industry: activeEntity.industry,
        brandIdentity: activeEntity.brand_identity,
      }).heading_font_id
      return CANVAS_TEXT_FONTS.some((font) => font.id === brandFontId)
        ? {
            ...DEFAULT_CANVAS_TEXT_OVERLAY,
            fontId: brandFontId as CanvasTextOverlayState["fontId"],
            subFontId: brandFontId as CanvasTextOverlayState["fontId"],
          }
        : DEFAULT_CANVAS_TEXT_OVERLAY
    })
  // Which item each slide shows (from a suggestion or the library) — fills
  // that slide's Brand / Size / Price / Vibe tags on the Canvas step.
  const [slideFacts, setSlideFacts] = useState<Record<string, CanvasItemFacts>>({})
  // Prefer the active tray photo so Canvas Words/Tags and Apply layout always
  // read/write the same slide the phone preview is showing.
  const overlayKey =
    activeMediaId ?? mediaAssets[0]?.id ?? "_no_media"
  // A new slide takes the last style, not the last photo's words, tag values
  // or cutout — those belong to that slide's own item.
  const freshOverlayFor = (key: string): CanvasTextOverlayState => {
    const item = slideFacts[key]
    const fromListing = item
      ? overlayPatchFromItemFacts({ facts: item, enableTags: true })
      : {
          tagBrand: "",
          tagSize: "",
          tagPrice: "",
          tagVibe: "",
          tagNewLabel: "",
        }
    // withoutCopy clears Words — keep listing tags on and enabled for preview.
    const cleared = canvasOverlayWithoutCopy({
      ...lastOverlayStyle,
      ...fromListing,
      backdropEnabled: false,
      cutoutUrl: "",
      cutoutSourceUrl: "",
    })
    const tagsOn = Boolean(
      fromListing.tagShowBrand ||
        fromListing.tagShowSize ||
        fromListing.tagShowPrice ||
        fromListing.tagShowVibe
    )
    return normalizeCanvasTextOverlay({
      ...cleared,
      tagShowBrand: Boolean(fromListing.tagShowBrand),
      tagShowSize: Boolean(fromListing.tagShowSize),
      tagShowPrice: Boolean(fromListing.tagShowPrice),
      tagShowVibe: Boolean(fromListing.tagShowVibe),
      enabled: Boolean(fromListing.enabled) || tagsOn,
    })
  }

  // Library attach loads facts async — persist listing tags into slide overlays
  // so they survive Media → Intent (ephemeral freshOverlayFor was lost on step change).
  useEffect(() => {
    const entries = Object.entries(slideFacts)
    if (entries.length === 0) return
    setSlideOverlays((all) => {
      let changed = false
      const next = { ...all }
      for (const [assetId, facts] of entries) {
        const slide = next[assetId] ?? freshOverlayFor(assetId)
        const brand = facts.brand?.trim() ?? ""
        const size = facts.size?.trim() ?? ""
        const price = facts.price?.trim() ?? ""
        const vibe = facts.vibe?.trim() ?? ""
        const patch: Partial<CanvasTextOverlayState> = {}
        if (!slide.tagBrand.trim() && brand) {
          patch.tagBrand = brand
          if (!slide.tagShowBrand) patch.tagShowBrand = true
        }
        if (!slide.tagSize.trim() && size) {
          patch.tagSize = size
          if (!slide.tagShowSize) patch.tagShowSize = true
        }
        if (!slide.tagPrice.trim() && price) {
          patch.tagPrice = price
          if (!slide.tagShowPrice) patch.tagShowPrice = true
        }
        if (!slide.tagVibe.trim() && vibe) {
          patch.tagVibe = vibe
          if (!slide.tagShowVibe) patch.tagShowVibe = true
        }
        // Always seed a missing slide so Continue keeps tags/words on Preview.
        if (!next[assetId]) {
          next[assetId] = normalizeCanvasTextOverlay({
            ...slide,
            ...patch,
            enabled:
              slide.enabled ||
              Boolean(
                patch.tagShowBrand ||
                  patch.tagShowSize ||
                  patch.tagShowPrice ||
                  patch.tagShowVibe ||
                  slide.tagShowBrand ||
                  slide.tagShowSize ||
                  slide.tagShowPrice ||
                  slide.tagShowVibe
              ),
          })
          changed = true
          continue
        }
        if (Object.keys(patch).length === 0) continue
        const hasTags =
          (patch.tagShowBrand ?? slide.tagShowBrand) ||
          (patch.tagShowSize ?? slide.tagShowSize) ||
          (patch.tagShowPrice ?? slide.tagShowPrice) ||
          (patch.tagShowVibe ?? slide.tagShowVibe)
        next[assetId] = normalizeCanvasTextOverlay({
          ...slide,
          ...patch,
          ...(hasTags ? { enabled: true } : null),
        })
        changed = true
      }
      return changed ? next : all
    })
    // freshOverlayFor reads slideFacts + lastOverlayStyle; only re-run on facts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideFacts])
  const textOverlay: CanvasTextOverlayState =
    slideOverlays[overlayKey] ?? freshOverlayFor(overlayKey)
  const isMultiPhoto =
    mediaAssets.filter((row) => row.type !== "video").length >= 2
  const slideOverlaysRef = useRef(slideOverlays)
  slideOverlaysRef.current = slideOverlays
  const setTextOverlay = useCallback(
    (next: CanvasTextOverlayState) => {
      setSlideOverlays((current) => ({ ...current, [overlayKey]: next }))
      setLastOverlayStyle(next)
    },
    [overlayKey]
  )
  const imageAssets = mediaAssets.filter((asset) => asset.type === "image")
  /** Overlay for one tray photo — falls back to listing/default style so bake matches preview. */
  const overlayForAsset = (assetId: string): CanvasTextOverlayState =>
    slideOverlays[assetId] ?? freshOverlayFor(assetId)
  const [simPlatform, setSimPlatform] = useState<
    import("@/components/marketing/multi-platform-simulator").SimulatorPlatform
  >("ig_story")
  const [storyPreview, setStoryPreview] = useState(DEFAULT_STORY_PREVIEW)
  const [cutoutRequestId, setCutoutRequestId] = useState(0)
  const [workbenchHeadline, setWorkbenchHeadline] = useState("")
  const [optimizationTags, setOptimizationTags] = useState<string[]>([])
  const [contentPillar, setContentPillar] = useState("")
  const [postIntent, setPostIntent] = useState<PostIntentState>({
    dropKind: null,
    channelHint: "",
    listingVibe: "",
  })
  // Client-only so Brain slots use the viewer's timezone (packs hydrate after mount).
  const [dispatchPlan, setDispatchPlan] = useState<ChannelSlot[] | null>(() =>
    typeof window === "undefined" ? null : hydrateDispatchPlan({})
  )
  const [arming, setArming] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const skipIntentObjectiveSync = useRef(false)
  const hydrateToken = useRef(0)

  const preview = useMemo(
    () => (pack ? packToStudioPreview(pack, campaignId) : null),
    [pack, campaignId]
  )

  const selectedPersona =
    personas.find((persona) => persona.id === personaId) ?? personas[0] ?? null
  const resolvedPersona =
    selectedPersona ?? personaForAudienceTone(audienceTone, personas)
  const resolvedFocusChip = useMemo(
    () =>
      consumerIntentChips.find((chip) => chip.id === intentChipId) ??
      studioPresets.intentChips[0] ??
      null,
    [consumerIntentChips, intentChipId, studioPresets.intentChips]
  )
  const packTargetGoal = useMemo(() => {
    if (isFudi) return `${objective} — ${toneGoalSuffix}`
    if (!resolvedFocusChip) return `${objective} — ${toneGoalSuffix}`
    return studioTargetGoal({
      chip: resolvedFocusChip,
      contentPillar,
      audienceToneCue: toneGoalSuffix,
      profileId: brandProfileId,
    })
  }, [
    isFudi,
    objective,
    toneGoalSuffix,
    resolvedFocusChip,
    contentPillar,
    brandProfileId,
  ])

  const activeForecastingTag = useMemo(
    () =>
      resolveForecastingTagForPersona(
        activeEntity.audience_segments,
        selectedPersona?.name ?? null
      ),
    [activeEntity.audience_segments, selectedPersona?.name]
  )

  const applySparkDispatchChannels = useCallback(
    (input: { hookId?: string | null; intentChipId?: string | null }) => {
      const feature = detectSparkDispatchFeature({
        spark: rawSpark,
        hookId: input.hookId,
        intentChipId: input.intentChipId ?? intentChipId,
      })
      if (!feature) return
      setDispatchPlan((prev) =>
        applySparkChannelPreset(prev ?? hydrateDispatchPlan({}), feature)
      )
    },
    [rawSpark, intentChipId]
  )

  function applyFudiTrack(nextTrack: FudiAudienceTrack) {
    setFudiTrack(nextTrack)
    const trackPresets = resolveFudiTrackPresets(nextTrack)
    const nextChips = trackPresets.intentChips
    const nextIntent = nextChips[0]
    skipIntentObjectiveSync.current = true
    setIntentChipId(nextIntent?.id ?? "dish_drop")
    setIntent(nextIntent?.intent ?? "Drive Sales")
    setObjective(trackPresets.objectives[0] ?? "")
    const preferredName = trackPresets.defaultPersonaName.toLowerCase()
    const matched =
      personas.find((persona) =>
        persona.name.toLowerCase().includes(
          nextTrack === "partners" ? "eatery" : "foodie"
        )
      ) ??
      personas.find((persona) =>
        persona.name.toLowerCase().includes(preferredName.slice(0, 12))
      ) ??
      personas[0]
    setPersonaId(matched?.id ?? "")
    setActiveHookId(null)
  }

  function onIntentChipSelect(chip: StudioIntentChip) {
    setIntentChipId(chip.id)
    setIntent(chip.intent)
    setObjective(
      objectiveForIntentChip(brandProfileId, chip.id, chip.label)
    )
    applySparkDispatchChannels({ intentChipId: chip.id, hookId: chip.id })
  }

  useEffect(() => {
    const profile = resolveIndustryProfile({
      name: activeEntity.name,
      industry: activeEntity.industry,
    })
    setContentPillar((current) => {
      if (current.trim()) return current
      const fromEntity = activeEntity.content_pillars?.[0]?.trim()
      if (fromEntity) return fromEntity
      return profile.contentPillars[0] ?? ""
    })
  }, [activeEntity.id, activeEntity.content_pillars, activeEntity.industry, activeEntity.name])

  useEffect(() => {
    const trimmed = rawSpark.trim()
    if (!trimmed) return
    setFormulaSlots((prev) => ({
      ...prev,
      campaignLine: prev.campaignLine.trim() ? prev.campaignLine : trimmed,
      item: prev.item.trim() ? prev.item : trimmed.slice(0, 80),
      brand: prev.brand.trim() ? prev.brand : activeEntity.name,
    }))
  }, [rawSpark, activeEntity.name])

  const sparkLength = rawSpark.length
  const showStudio = Boolean(preview && pack)
  const activeMedia = useMemo(
    () => resolveActiveMedia(mediaAssets, activeMediaId),
    [mediaAssets, activeMediaId]
  )
  const hookChips = useMemo(() => {
    if (isFudi) {
      return buildFudiTrackHookChips({
        track: fudiTrack,
        sparkHint: rawSpark,
        visualDescription: visualInspection?.visualDescription,
        concreteFeatures: visualInspection?.concreteFeatures,
      })
    }
    return buildStudioHookChips({
      brandName: activeEntity.name,
      industry: activeEntity.industry,
      sparkHint: rawSpark,
      visualDescription: visualInspection?.visualDescription,
      concreteFeatures: visualInspection?.concreteFeatures,
    })
  }, [
    isFudi,
    fudiTrack,
    rawSpark,
    activeEntity.name,
    activeEntity.industry,
    visualInspection,
  ])
  const carouselPackContext = useMemo(
    () =>
      buildCarouselPackContext({
        assets: mediaAssets,
        slideFacts,
      }),
    [mediaAssets, slideFacts]
  )
  const carouselMergedVision = useMemo(
    () =>
      mergedCarouselVision({
        assets: mediaAssets,
        activeDescription: visualInspection?.visualDescription ?? null,
      }),
    [mediaAssets, visualInspection?.visualDescription]
  )
  const trayIntakeTagSuggestions = useMemo(
    () =>
      mergeTagSuggestions(
        ...mediaAssets.map((row) => row.intakeTags ?? []),
        ...carouselPackContext.brands.map(
          (brand) => sanitizeBrandName(brand) || brand
        ),
        ...carouselPackContext.vibes
      ),
    [mediaAssets, carouselPackContext.brands, carouselPackContext.vibes]
  )
  const suggestedOptimizationTags = useMemo(
    () =>
      mergeTagSuggestions(
        buildStudioOptimizationTags({
          brandName: activeEntity.name,
          industry: activeEntity.industry,
          listingVibe: postIntent.listingVibe || null,
          titleHint: workbenchHeadline || rawSpark.slice(0, 80),
          aestheticSlugs: visualInspection?.aestheticTags ?? [],
        }),
        trayIntakeTagSuggestions
      ).slice(0, OPTIMIZATION_TAG_MAX + 4),
    [
      activeEntity.name,
      activeEntity.industry,
      postIntent.listingVibe,
      workbenchHeadline,
      rawSpark,
      visualInspection?.aestheticTags,
      trayIntakeTagSuggestions,
    ]
  )

  const applyIntakeFromTray = useCallback(
    (assets: MediaAsset[], options?: { forceCaption?: boolean }) => {
      const mergedCaption = mergeTrayIntakeCaptions(
        assets.map((row) => row.intakeCaption)
      )
      if (
        mergedCaption &&
        (options?.forceCaption || rawSpark.trim().length < 8)
      ) {
        // Never dump Brand·Size·Condition into Copy — those are Canvas tags.
        const caption = isCatalogMetadataDump(mergedCaption)
          ? readableListingCaption({ description: mergedCaption })
          : mergedCaption
        if (caption) setRawSpark(caption.slice(0, RAW_SPARK_MAX))
      }
      const trayTags = mergeTagSuggestions(
        ...assets.map((row) => row.intakeTags ?? [])
      ).filter((tag) => !/^\d+$/.test(tag))
      if (trayTags.length === 0) return
      setOptimizationTags((current) => {
        if (current.length > 0 && !options?.forceCaption) return current
        return trayTags.slice(0, OPTIMIZATION_TAG_MAX)
      })
    },
    [rawSpark]
  )

  const liveRedirectSlugSeed = useMemo(() => {
    if (!isFudi) return null
    return (
      redirectSlugSeed ??
      buildFudiRedirectSlugSeed(fudiTrack, rawSpark || objective || "special")
    )
  }, [isFudi, redirectSlugSeed, fudiTrack, rawSpark, objective])

  // Jump to Schedule when a pack first appears, but let Back / the stepper leave it.
  const [packVisible, setPackVisible] = useState(showStudio)
  if (showStudio !== packVisible) {
    setPackVisible(showStudio)
    if (showStudio && workbenchStep < WORKBENCH_STEP_CHANNELS) {
      setWorkbenchStep(WORKBENCH_STEP_CHANNELS)
    }
  }
  const apiImageUrl =
    activeMedia &&
    activeMedia.type === "image" &&
    /^https?:\/\//i.test(activeMedia.url)
      ? activeMedia.url
      : attachedImageUrl && /^https?:\/\//i.test(attachedImageUrl)
        ? attachedImageUrl
        : null
  const studioMediaUrl = activeMedia?.url ?? attachedImageUrl
  const inspectableStudioMediaUrl = useMemo(() => {
    const trayAsset =
      mediaAssets.find((row) => row.id === activeMediaId) ?? mediaAssets[0]
    for (const candidate of [
      trayAsset?.publicUrl,
      trayAsset?.url,
      activeMedia?.url,
      attachedImageUrl,
      apiImageUrl,
    ]) {
      const trimmed = candidate?.trim()
      if (trimmed && /^https?:\/\//i.test(trimmed)) return trimmed
    }
    return null
  }, [mediaAssets, activeMediaId, activeMedia, attachedImageUrl, apiImageUrl])

  function syncMediaFromUrl(url: string | null) {
    setAttachedImageUrl(url)
    setVisualInspection(null)
    if (!url) {
      setMediaAssets([])
      setActiveMediaId(null)
      return
    }
    const seeded = mediaAssetsFromImageUrls([url])
    setMediaAssets(seeded)
    setActiveMediaId(seeded[0]?.id ?? null)
  }

  function onMediaAssetsChange(next: MediaAsset[]) {
    setMediaAssets(next)
    const preferred =
      next.find((row) => row.id === activeMediaId) ?? next[0] ?? null
    const settled =
      preferred?.publicUrl && /^https?:\/\//i.test(preferred.publicUrl)
        ? preferred.publicUrl
        : preferred?.url ?? null
    setAttachedImageUrl(
      settled && /^https?:\/\//i.test(settled) ? settled : settled
    )
    const inspection =
      preferred?.visualInspection ??
      next.find((row) => row.visualInspection)?.visualInspection ??
      null
    setVisualInspection(inspection ?? null)
  }

  function onSelectStudioMedia(asset: MediaAsset) {
    setActiveMediaId(asset.id)
    const settled = asset.publicUrl || asset.url
    setAttachedImageUrl(settled)
    setVisualInspection(asset.visualInspection ?? null)
  }

  useEffect(() => {
    if (isFudi && postIntent.dropKind == null) {
      setPostIntent((current) => ({ ...current, dropKind: "dish_drop" }))
    }
  }, [isFudi, postIntent.dropKind])

  function onStudioFinishedRender(publicUrl: string, kind: MediaKind) {
    const asset: MediaAsset = {
      id: `render-${Date.now()}`,
      url: publicUrl,
      publicUrl,
      type: kind,
    }
    if (kind === "video") {
      onMediaAssetsChange([asset])
    } else {
      onMediaAssetsChange([...mediaAssets, asset])
    }
    setActiveMediaId(asset.id)
  }

  function onCutoutToggle() {
    if (storyPreview.cutoutMode === "transparent") {
      setStoryPreview((current) => ({
        ...current,
        cutoutMode: "original",
        cutoutImageUrl: null,
      }))
      return
    }
    // The cutout is used on the Instagram Story card, so show that preview
    // (a carousel switches the preview to Feed, which used to grey this out).
    setSimPlatform("ig_story")
    setCutoutRequestId((value) => value + 1)
  }

  const isFashionBrand = brandProfileId === "worn_label"
  const mediaAssetsRef = useRef(mediaAssets)
  mediaAssetsRef.current = mediaAssets

  const wlsSequenceMarketingEntityIds = useMemo(
    () =>
      mediaAssets
        .filter((row) => row.type !== "video" && row.marketingEntityId)
        .map((row) => row.marketingEntityId as string),
    [mediaAssets]
  )

  const activeMarketingEntityId =
    mediaAssets.find((row) => row.id === activeMediaId)?.marketingEntityId ??
    null

  const loadWlsEligibleProducts = useCallback(async () => {
    if (!isFashionBrand) return
    setWlsEligibleLoading(true)
    try {
      const res = await fetch(
        `/api/templates/wls-daily-story/eligible?entityId=${encodeURIComponent(activeEntity.id)}`,
        { credentials: "same-origin" }
      )
      const data = (await res.json().catch(() => ({}))) as {
        catalog?: WlsProductSelection[]
        eligible?: WlsProductSelection[]
        excluded?: unknown[]
        syncedCount?: number
        selectableCount?: number
        exclusionSummary?: Partial<Record<WlsHardBlockReason, number>>
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Could not load products.")
      const catalog =
        data.catalog ??
        data.eligible ??
        []
      setWlsProductCatalog(catalog)
      setWlsSelectableCount(
        typeof data.selectableCount === "number"
          ? data.selectableCount
          : catalog.filter((row) => row.feedSelectable).length
      )
      setWlsExcludedCount(
        Array.isArray(data.excluded) ? data.excluded.length : 0
      )
      setWlsSyncedCount(
        typeof data.syncedCount === "number"
          ? data.syncedCount
          : catalog.length
      )
      setWlsExclusionSummary(data.exclusionSummary ?? {})
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load WLS products."
      )
    } finally {
      setWlsEligibleLoading(false)
    }
  }, [activeEntity.id, isFashionBrand])

  const ensureWlsTemplateForStrip = useCallback(async (): Promise<string> => {
    if (templateInstanceId) return templateInstanceId
    const res = await fetch("/api/templates/wls-daily-story/ensure", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: activeEntity.id }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      instance?: { id: string; canvas_layout_id?: string | null }
      error?: string
    }
    if (!res.ok || !data.instance?.id) {
      throw new Error(data.error || "Could not set up Daily Story template.")
    }
    setTemplateInstanceId(data.instance.id)
    setWlsCanvasLayoutId(data.instance.canvas_layout_id ?? "story_9_16")
    return data.instance.id
  }, [activeEntity.id, templateInstanceId])

  const validateWlsSelections = useCallback(
    async (
      marketingEntityIds: string[],
      surface: "story" | "feed" = "story"
    ): Promise<WlsProductSelection[]> => {
      const templateId =
        surface === "story" ? await ensureWlsTemplateForStrip() : undefined
      const res = await fetch("/api/templates/wls-daily-story/studio-seed", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeEntity.id,
          templateInstanceId: templateId,
          marketingEntityIds,
          surface,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        selections?: WlsProductSelection[]
        error?: string
      }
      if (!res.ok || !data.selections?.length) {
        throw new Error(data.error || "Product is not eligible.")
      }
      return data.selections
    },
    [activeEntity.id, ensureWlsTemplateForStrip]
  )

  const wlsFrameBuildInput = useCallback(
    () => ({
      entityId: activeEntity.id,
      brandName: activeEntity.name,
      brandLogoUrl: brandVisualPresets.logo_url,
      canvasLayouts: activeEntity.brand_identity.canvas_layouts ?? [],
      canvasLayoutId: wlsCanvasLayoutId,
      resolveImageUrl: (url: string) => proxiedImageUrl(url, activeEntity.id),
    }),
    [
      activeEntity.brand_identity.canvas_layouts,
      activeEntity.id,
      activeEntity.name,
      brandVisualPresets.logo_url,
      wlsCanvasLayoutId,
    ]
  )

  const applyWlsDailyStorySeed = useCallback(
    (
      selections: WlsProductSelection[],
      template: StudioTemplateHandoffResponse["template"]
    ) => {
      const layouts = activeEntity.brand_identity.canvas_layouts ?? []
      const seed = buildWlsDailyStoryStudioSeed({
        selections,
        entityId: activeEntity.id,
        brandName: activeEntity.name,
        brandLogoUrl: brandVisualPresets.logo_url,
        canvasLayouts: layouts,
        canvasLayoutId: template.canvasLayoutId,
        resolveImageUrl: (url) => proxiedImageUrl(url, activeEntity.id),
      })

      onMediaAssetsChange(seed.mediaAssets)
      setSlideOverlays(seed.slideOverlays)
      setSlideFacts(seed.slideFacts)
      setStoryPreview(seed.storyPreview)
      const styleFromFirst = seed.mediaAssets[0]?.id
        ? seed.slideOverlays[seed.mediaAssets[0].id]
        : null
      if (styleFromFirst) {
        setLastOverlayStyle(canvasOverlayWithoutCopy(styleFromFirst))
      }
      setActiveMediaId(seed.mediaAssets[0]?.id ?? null)
      setSimPlatform("ig_story")
      setWlsDailyStorySession(true)
      setTemplateInstanceId(template.templateInstanceId)
      setTemplateVersionId(String(template.templateVersion))
      setTemplateDisplayName(template.templateName)
      setCreativeSurface("story")
      setWlsCanvasLayoutId(template.canvasLayoutId ?? "story_9_16")
      if (template.formulaHookId) {
        setFormulaHookId(template.formulaHookId)
      }
      // Public caption = listing intake / optional default_studio_caption only.
      // Never seed creative_instructions (operator brief) into Copy / Feed.
      applyIntakeFromTray(seed.mediaAssets, { forceCaption: true })
      const templateCaption =
        template.defaultStudioCaption?.trim() ||
        template.creativeSpark.trim()
      if (templateCaption) {
        setRawSpark(templateCaption.slice(0, RAW_SPARK_MAX))
      }
    },
    [
      activeEntity.brand_identity.canvas_layouts,
      activeEntity.id,
      activeEntity.name,
      applyIntakeFromTray,
      brandVisualPresets.logo_url,
      onMediaAssetsChange,
    ]
  )

  const applyStudioTemplateHandoff = useCallback(
    (handoff: StudioTemplateHandoffResponse) => {
      const { template } = handoff
      setTemplateInstanceId(template.templateInstanceId)
      setTemplateVersionId(String(template.templateVersion))
      setTemplateDisplayName(template.templateName)
      if (template.formulaHookId) {
        setFormulaHookId(template.formulaHookId)
      }
      if (template.canvasLayoutId) {
        setWlsCanvasLayoutId(template.canvasLayoutId)
      }
      const publicCaption =
        template.defaultStudioCaption?.trim() ||
        template.creativeSpark.trim()
      if (publicCaption) {
        setRawSpark(publicCaption.slice(0, RAW_SPARK_MAX))
      }

      if (handoff.kind === "wls_daily_story") {
        setWlsDailyStorySession(true)
        setFrameTemplate(null)
        setFrameImageFills({})
        setFrameTextFills({})
        setFrameComposedUrl(null)
        if (handoff.selections?.length) {
          applyWlsDailyStorySeed(handoff.selections, template)
          toast.success(
            `Loaded ${handoff.selections.length} Story frame${handoff.selections.length === 1 ? "" : "s"} — ${template.templateName}.`
          )
        } else {
          toast.message(`Using ${template.templateName} — pick products in Synced products.`)
        }
        setWorkbenchStep(WORKBENCH_STEP_MEDIA)
        return
      }

      if (handoff.kind === "frame_template") {
        setWlsDailyStorySession(false)
        setFrameTemplate(handoff.frameTemplate)
        setFrameImageFills({})
        setFrameTextFills(defaultTextFillsFromTemplate(handoff.frameTemplate))
        setFrameComposedUrl(null)
        setCreativeSurface("feed")
        setSimPlatform("ig_feed")
        const bg = handoff.frameTemplate.backgroundUrl.trim()
        if (bg) {
          const asset: MediaAsset = {
            id: `frame-template-bg-${handoff.template.templateInstanceId}`,
            url: bg,
            publicUrl: bg,
            type: "image",
          }
          onMediaAssetsChange([asset])
        }
        toast.success(
          `${template.templateName} loaded — drop photos into the frames, then edit the labels.`
        )
        setWorkbenchStep(WORKBENCH_STEP_MEDIA)
        return
      }

      setWlsDailyStorySession(false)
      setFrameTemplate(null)
      setFrameImageFills({})
      setFrameTextFills({})
      setFrameComposedUrl(null)
      toast.message(`Using template: ${template.templateName}`)
      setWorkbenchStep(WORKBENCH_STEP_MEDIA)
    },
    [applyWlsDailyStorySeed, onMediaAssetsChange]
  )

  const selectStudioTemplate = useCallback(
    async (instanceId: string, marketingEntityIds?: string[]) => {
      if (
        templateInstanceId &&
        templateInstanceId !== instanceId &&
        mediaAssetsRef.current.length > 0 &&
        !window.confirm(
          "Apply a different template? Your current media tray stays until you change it."
        )
      ) {
        return
      }
      setTemplateHandoffBusy(true)
      try {
        const handoff = await fetchStudioTemplateHandoff({
          entityId: activeEntity.id,
          templateInstanceId: instanceId,
          marketingEntityIds,
        })
        applyStudioTemplateHandoff(handoff)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not apply template."
        )
      } finally {
        setTemplateHandoffBusy(false)
      }
    },
    [activeEntity.id, applyStudioTemplateHandoff, templateInstanceId]
  )

  const clearStudioTemplate = useCallback(() => {
    setTemplateInstanceId(null)
    setTemplateDisplayName(null)
    setWlsDailyStorySession(false)
    setFrameTemplate(null)
    setFrameImageFills({})
    setFrameTextFills({})
    setFrameComposedUrl(null)
  }, [])

  const navigateWlsProductFrame = useCallback(
    (marketingEntityId: string) => {
      const asset = mediaAssetsRef.current.find(
        (row) => row.marketingEntityId === marketingEntityId
      )
      if (asset) onSelectStudioMedia(asset)
    },
    []
  )

  const addWlsProductToMedia = useCallback(
    async (selection: WlsProductSelection) => {
      if (!selection.feedSelectable) return
      const existing = mediaAssetsRef.current.find(
        (row) => row.marketingEntityId === selection.marketingEntityId
      )
      if (existing) {
        onSelectStudioMedia(existing)
        return
      }
      setWlsStripBusy(true)
      try {
        const [validated] = await validateWlsSelections(
          [selection.marketingEntityId],
          "feed"
        )
        const bundle = buildFeedTrayFromWlsSelection(validated)
        if (!bundle || bundle.assets.length === 0) {
          throw new Error("This listing needs a usable product photo.")
        }
        const existingTray = mediaAssetsRef.current
        const append =
          existingTray.length > 0 &&
          bundle.assets[0].type !== "video" &&
          existingTray.every((row) => row.type !== "video")
        const fresh = bundle.assets.filter(
          (row) => !existingTray.some((have) => have.url === row.url)
        )
        const next = append
          ? [...existingTray, ...fresh].slice(0, 10)
          : bundle.assets.slice(0, 10)
        onMediaAssetsChange(next)
        applyIntakeFromTray(next, { forceCaption: true })
        setSlideFacts((all) => ({
          ...(append ? all : {}),
          ...bundle.factsByAssetId,
        }))
        const added = append ? fresh : bundle.assets
        onSelectStudioMedia(added[0] ?? next[0])
        if (!wlsDailyStorySession) {
          setSimPlatform(
            next.length >= 2 && bundle.format === "carousel"
              ? "ig_feed"
              : bundle.format === "story"
                ? "ig_story"
                : bundle.format === "reel"
                  ? "tiktok"
                  : "ig_feed"
          )
        }
        toast.success("Added to media tray.")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not add product."
        )
      } finally {
        setWlsStripBusy(false)
      }
    },
    [applyIntakeFromTray, validateWlsSelections, wlsDailyStorySession]
  )

  const addWlsProductToSequence = useCallback(
    async (selection: WlsProductSelection) => {
      const existing = mediaAssetsRef.current.find(
        (row) => row.marketingEntityId === selection.marketingEntityId
      )
      if (existing) {
        onSelectStudioMedia(existing)
        return
      }
      const photos = mediaAssetsRef.current.filter((row) => row.type !== "video")
      if (photos.length >= WLS_DAILY_STORY_STUDIO_MAX_FRAMES) {
        toast.error(
          `Story sequence is full (${WLS_DAILY_STORY_STUDIO_MAX_FRAMES}). Replace the active frame or remove one.`
        )
        return
      }
      setWlsStripBusy(true)
      try {
        const [validated] = await validateWlsSelections([
          selection.marketingEntityId,
        ])
        const frame = buildWlsStoryFrameFromSelection({
          selection: validated,
          ...wlsFrameBuildInput(),
        })
        onMediaAssetsChange([...mediaAssetsRef.current, frame.asset])
        setSlideOverlays((all) => ({ ...all, [frame.asset.id]: frame.overlay }))
        setSlideFacts((all) => ({ ...all, [frame.asset.id]: frame.facts }))
        onSelectStudioMedia(frame.asset)
        setWlsDailyStorySession(true)
        setSimPlatform("ig_story")
        toast.success("Added to Story sequence.")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not add product."
        )
      } finally {
        setWlsStripBusy(false)
      }
    },
    [validateWlsSelections, wlsFrameBuildInput]
  )

  const removeWlsProductFromSequence = useCallback(
    (marketingEntityId: string) => {
      const assetId = wlsStoryAssetIdForProduct(marketingEntityId)
      const nextAssets = mediaAssetsRef.current.filter((row) => row.id !== assetId)
      onMediaAssetsChange(nextAssets)
      setSlideOverlays((all) => {
        const next = { ...all }
        delete next[assetId]
        return next
      })
      setSlideFacts((all) => {
        const next = { ...all }
        delete next[assetId]
        return next
      })
      const stillActive = nextAssets.some((row) => row.id === activeMediaId)
      if (!stillActive) {
        setActiveMediaId(nextAssets[0]?.id ?? null)
      }
      toast.message("Removed from Story sequence.")
    },
    [activeMediaId]
  )

  const replaceActiveWlsFrame = useCallback(
    async (selection: WlsProductSelection) => {
      const activeId = activeMediaId
      if (!activeId) {
        await addWlsProductToSequence(selection)
        return
      }
      const activeAsset = mediaAssetsRef.current.find((row) => row.id === activeId)
      if (
        activeAsset?.marketingEntityId === selection.marketingEntityId
      ) {
        return
      }
      setWlsStripBusy(true)
      try {
        const [validated] = await validateWlsSelections([
          selection.marketingEntityId,
        ])
        const frame = buildWlsStoryFrameFromSelection({
          selection: validated,
          ...wlsFrameBuildInput(),
        })
        const index = mediaAssetsRef.current.findIndex((row) => row.id === activeId)
        if (index < 0) {
          await addWlsProductToSequence(selection)
          return
        }
        const previousOverlay = slideOverlaysRef.current[activeId]
        const previousUrl = activeAsset?.url ?? ""
        const merged = mergeWlsReplaceOverlay({
          existing: previousOverlay,
          seeded: frame.overlay,
          previousImageUrl: previousUrl,
          nextImageUrl: frame.asset.url,
        })
        const nextAssets = [...mediaAssetsRef.current]
        nextAssets[index] = frame.asset
        onMediaAssetsChange(nextAssets)
        setSlideOverlays((all) => {
          const next = { ...all }
          delete next[activeId]
          next[frame.asset.id] = merged
          return next
        })
        setSlideFacts((all) => ({
          ...all,
          [frame.asset.id]: frame.facts,
        }))
        if (activeId !== frame.asset.id) {
          setSlideFacts((all) => {
            const next = { ...all }
            delete next[activeId]
            return next
          })
        }
        onSelectStudioMedia(frame.asset)
        setWlsDailyStorySession(true)
        setSimPlatform("ig_story")
        toast.success("Active Story frame updated.")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not replace frame."
        )
      } finally {
        setWlsStripBusy(false)
      }
    },
    [activeMediaId, addWlsProductToSequence, validateWlsSelections, wlsFrameBuildInput]
  )

  useEffect(() => {
    if (!isFashionBrand || rehydrating) return
    void loadWlsEligibleProducts()
  }, [isFashionBrand, rehydrating, loadWlsEligibleProducts])

  useEffect(() => {
    if (!isFashionBrand) return
    function onInventorySynced(event: Event) {
      const detail = (event as CustomEvent<{ entityId?: string }>).detail
      if (detail?.entityId && detail.entityId !== activeEntity.id) return
      void loadWlsEligibleProducts()
    }
    function onFocus() {
      void loadWlsEligibleProducts()
    }
    window.addEventListener(INVENTORY_SYNCED_EVENT, onInventorySynced)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener(INVENTORY_SYNCED_EVENT, onInventorySynced)
      window.removeEventListener("focus", onFocus)
    }
  }, [activeEntity.id, isFashionBrand, loadWlsEligibleProducts])

  // Finished slides (e.g. the week of outfits) waiting in sessionStorage.
  const builtFromSlides = useRef(false)
  useEffect(() => {
    if (builtFromSlides.current || rehydrating) return
    if (searchParams.get(STUDIO_SLIDES_QUERY_FLAG) !== "1") return
    builtFromSlides.current = true
    const handoff = takeStudioSlidesHandoff(activeEntity.id)
    const params = new URLSearchParams(window.location.search)
    params.delete(STUDIO_SLIDES_QUERY_FLAG)
    window.history.replaceState(window.history.state, "", `/studio?${params.toString()}`)
    if (!handoff) {
      toast.error("Those slides have expired. Send them from the week of outfits again.")
      return
    }
    const tray: MediaAsset[] = handoff.urls.map((url, index) => ({
      id: `slides-${index}-${Date.now()}`,
      url,
      publicUrl: url,
      type: "image",
      destinationUrl: handoff.destinationUrl ?? null,
      intakeCaption: index === 0 ? handoff.caption : null,
    }))
    onMediaAssetsChange(tray)
    applyIntakeFromTray(tray, { forceCaption: true })
    setActiveMediaId(tray[0].id)
    setSimPlatform("ig_feed")
    toast.success(`${tray.length} slides are in the tray, ready to post as one carousel.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehydrating])

  // Build from Today's Brain team: ?items=a,b,c&format=carousel loads those
  // items — one photo each, or every photo when it's a single item.
  const builtFromTeam = useRef(false)
  useEffect(() => {
    if (builtFromTeam.current || rehydrating) return
    if (searchParams.get(WLS_DAILY_STORY_HANDOFF_QUERY_FLAG) === "1") return
    const raw = searchParams.get("items")?.trim()
    if (!raw) return
    builtFromTeam.current = true
    const ids = raw.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 10)
    const format = searchParams.get("format")
    void fetchItemsForStudio(ids, isFashionBrand)
      .then((rows) => {
        const assets: MediaAsset[] = []
        const facts: Record<string, CanvasItemFacts> = {}
        for (const row of rows) {
          const media = row.media.filter((m) =>
            format === "reel" ? m.kind === "video" : m.kind !== "video"
          )
          const chosen =
            rows.length === 1 && format === "carousel" ? media : media.slice(0, 1)
          chosen.forEach((m, index) => {
            const id = `team-${row.item.id}-${index}`
            assets.push({
              id,
              url: m.url,
              publicUrl: m.url,
              type: m.kind,
              marketingEntityId: row.item.id,
              destinationUrl:
                row.item.listing_url ??
                buildWlsDestinationUrl({
                  websiteUrl: "https://www.wornlabelsociety.co.nz",
                  websiteItemId: row.item.website_item_id,
                  listingUrl: row.item.listing_url,
                }),
              intakeCaption: listingCaptionForPost(row.item),
              intakeTags: listingTagsForPost({
                item: row.item,
                brandName: activeEntity.name,
                industry: activeEntity.industry,
              }),
            })
            facts[id] = row.facts
          })
        }
        if (assets.length === 0) {
          toast.error("Those items have no photos to use.")
          return
        }
        const tray = assets.slice(0, 10)
        onMediaAssetsChange(tray)
        applyIntakeFromTray(tray, { forceCaption: true })
        setActiveMediaId(tray[0].id)
        setSlideFacts(facts)
        setSimPlatform(format === "story" ? "ig_story" : "ig_feed")
        // Tidy the address without a router navigation (that would remount
        // Studio and empty the tray we just filled).
        const params = new URLSearchParams(window.location.search)
        params.delete("items")
        params.delete("format")
        window.history.replaceState(
          window.history.state,
          "",
          `/studio?${params.toString()}`
        )
      })
      .catch(() => toast.error("Couldn't load those items."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehydrating])

  const builtFromWlsStory = useRef(false)
  const appliedGenericTemplateHandoff = useRef(false)
  const lastSuccessfulTemplateHandoffKey = useRef<string | null>(null)
  useEffect(() => {
    if (builtFromWlsStory.current || rehydrating) return
    if (searchParams.get(WLS_DAILY_STORY_HANDOFF_QUERY_FLAG) !== "1") return
    const raw = searchParams.get("items")?.trim()
    const templateId = searchParams.get("templateInstanceId")?.trim() ?? ""
    if (!raw || !/^[0-9a-f-]{36}$/i.test(templateId)) return
    if (searchParams.get("format") !== "story") return

    builtFromWlsStory.current = true
    appliedGenericTemplateHandoff.current = true
    const marketingEntityIds = raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 5)

    void fetchStudioTemplateHandoff({
      entityId: activeEntity.id,
      templateInstanceId: templateId,
      marketingEntityIds,
    })
      .then((handoff) => {
        if (handoff.kind !== "wls_daily_story" || !handoff.selections?.length) {
          throw new Error("Could not load Daily Story products.")
        }
        applyStudioTemplateHandoff(handoff)

        const params = new URLSearchParams(window.location.search)
        params.delete("items")
        params.delete("format")
        params.delete(WLS_DAILY_STORY_HANDOFF_QUERY_FLAG)
        window.history.replaceState(
          window.history.state,
          "",
          `/studio?${params.toString()}`
        )
      })
      .catch((error) => {
        builtFromWlsStory.current = false
        appliedGenericTemplateHandoff.current = false
        toast.error(
          error instanceof Error ? error.message : "Daily Story handoff failed."
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehydrating, activeEntity.id])

  useEffect(() => {
    appliedGenericTemplateHandoff.current = false
    lastSuccessfulTemplateHandoffKey.current = null
  }, [activeEntity.id])

  useEffect(() => {
    if (appliedGenericTemplateHandoff.current || rehydrating) return
    if (searchParams.get(WLS_DAILY_STORY_HANDOFF_QUERY_FLAG) === "1") return
    if (searchParams.get("items")?.trim()) return
    if (searchParams.get("pack_id")?.trim()) return
    const templateId = searchParams.get("templateInstanceId")?.trim() ?? ""
    if (!/^[0-9a-f-]{36}$/i.test(templateId)) return

    const resumeKey = studioTemplateHandoffResumeKey({
      entityId: activeEntity.id,
      templateInstanceId: templateId,
      templateVersion: searchParams.get("templateVersion"),
    })
    if (
      shouldSkipStudioTemplateHandoff({
        mediaAssetCount: mediaAssetsRef.current.length,
        resumeKey,
        lastSuccessfulHandoffKey: lastSuccessfulTemplateHandoffKey.current,
      })
    ) {
      appliedGenericTemplateHandoff.current = true
      return
    }

    appliedGenericTemplateHandoff.current = true
    void fetchStudioTemplateHandoff({
      entityId: activeEntity.id,
      templateInstanceId: templateId,
    })
      .then((handoff) => {
        applyStudioTemplateHandoff(handoff)
        lastSuccessfulTemplateHandoffKey.current = resumeKey
      })
      .catch((error) => {
        appliedGenericTemplateHandoff.current = false
        toast.error(
          error instanceof Error ? error.message : "Template handoff failed."
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehydrating, activeEntity.id])

  function applyNewArrival(suggestion: NewArrivalSuggestion) {
    const destinationUrl =
      suggestion.item.listing_url ??
      buildWlsDestinationUrl({
        websiteUrl: "https://www.wornlabelsociety.co.nz",
        websiteItemId: suggestion.item.website_item_id,
        listingUrl: suggestion.item.listing_url,
      })
    const intake = {
      marketingEntityId: suggestion.item.id,
      destinationUrl,
      intakeCaption: suggestion.intakeCaption,
      intakeTags: suggestion.intakeTags,
    }
    const all: MediaAsset[] = suggestion.media.map((row, index) => ({
      id: `arrival-${suggestion.item.id}-${index}`,
      url: row.url,
      publicUrl: row.url,
      type: row.kind,
      ...intake,
    }))
    const firstVideo = all.find((row) => row.type === "video")
    const firstPhoto = all.find((row) => row.type !== "video") ?? all[0]
    const chosen =
      suggestion.format === "carousel"
        ? all.filter((row) => row.type !== "video")
        : suggestion.format === "reel" && firstVideo
          ? [firstVideo]
          : firstPhoto
            ? [firstPhoto]
            : []
    if (chosen.length === 0) return null
    // Photos add on to what's already in the tray, building a carousel
    // (a video still starts a fresh Reel).
    const existing = mediaAssetsRef.current
    const append =
      existing.length > 0 &&
      chosen[0].type !== "video" &&
      existing.every((row) => row.type !== "video")
    const fresh = chosen.filter(
      (row) => !existing.some((have) => have.url === row.url)
    )
    const next = append ? [...existing, ...fresh].slice(0, 10) : chosen
    const added = next.filter((row) => !append || fresh.includes(row))
    onMediaAssetsChange(next)
    applyIntakeFromTray(next, { forceCaption: true })
    setActiveMediaId(added[0]?.id ?? next[0].id)
    setSimPlatform(
      next.length >= 2 && !wlsDailyStorySession
        ? "ig_feed"
        : suggestion.format === "story" || wlsDailyStorySession
          ? "ig_story"
          : "ig_feed"
    )
    setSlideFacts((current) => ({
      ...(append ? current : {}),
      ...Object.fromEntries(added.map((row) => [row.id, suggestion.facts])),
    }))
    const addedIds = new Set(added.map((row) => row.id))
    return {
      title:
        next.length >= 2
          ? `Added to carousel — ${next.length} photos`
          : `${SUGGESTED_FORMAT_LABELS[suggestion.format]} set up for ${suggestion.item.title}`,
      undo: () => {
        const remaining = mediaAssetsRef.current.filter((row) => !addedIds.has(row.id))
        onMediaAssetsChange(remaining)
        setActiveMediaId(remaining[0]?.id ?? null)
      },
    }
  }

  // Cutouts live on each slide, so cutting out one photo never touches another.
  const [cutoutBusy, setCutoutBusy] = useState(false)
  async function cutoutSlides(
    scope: "slide" | "all",
    on: boolean,
    lookOverride?: Pick<
      CanvasTextOverlayState,
      "backdropColor" | "subjectScale" | "subjectOffsetY"
    >
  ) {
    const photos = mediaAssets.filter((row) => row.type !== "video")
    const targets =
      scope === "all"
        ? photos
        : photos.filter((row) => row.id === (activeMediaId ?? photos[0]?.id))
    if (targets.length === 0) {
      toast.error("Add a photo first.")
      return
    }
    const current = (id: string) =>
      slideOverlaysRef.current[id] ?? freshOverlayFor(id)
    const writeSlide = (id: string, patch: Partial<CanvasTextOverlayState>) =>
      setSlideOverlays((all) => ({
        ...all,
        [id]: normalizeCanvasTextOverlay({ ...(all[id] ?? freshOverlayFor(id)), ...patch }),
      }))
    if (!on) {
      targets.forEach((row) => writeSlide(row.id, { backdropEnabled: false }))
      return
    }
    // "All" uses this slide's colour and sizing everywhere.
    const look = lookOverride ?? {
      backdropColor: textOverlay.backdropColor,
      subjectScale: textOverlay.subjectScale,
      subjectOffsetY: textOverlay.subjectOffsetY,
    }
    setCutoutBusy(true)
    let failed = 0
    let lastError: string | null = null
    await Promise.all(
      targets.map(async (row) => {
        const src = row.publicUrl || row.url
        const existing = current(row.id)
        try {
          const cutoutUrl =
            existing.cutoutUrl && existing.cutoutSourceUrl === src
              ? existing.cutoutUrl
              : await requestCutout({ imageUrl: src, entityId: activeEntity.id })
          writeSlide(row.id, {
            ...(scope === "all" ? look : null),
            enabled: true,
            backdropEnabled: true,
            cutoutUrl,
            cutoutSourceUrl: src,
          })
        } catch (error) {
          failed += 1
          lastError =
            error instanceof Error ? error.message : "Cutout failed."
        }
      })
    )
    setCutoutBusy(false)
    if (failed > 0) {
      toast.error(
        lastError && failed === 1
          ? lastError
          : `Couldn't cut out ${failed} photo${failed === 1 ? "" : "s"}.`
      )
    } else if (scope === "all") {
      toast.success(`Cut out ${targets.length} photos`)
    }
  }

  async function persistLayouts(
    next: SavedCanvasLayout[],
    previous: SavedCanvasLayout[],
    success?: string
  ) {
    setCanvasLayouts(next)
    setLayoutsBusy(true)
    try {
      const result = (await saveCanvasLayouts({
        entityId: activeEntity.id,
        layouts: next,
      })) as {
        ok?: boolean
        error?: string
        data?: { layouts?: SavedCanvasLayout[] }
      }
      if (!result?.ok) throw new Error(result?.error ?? "Couldn't save layouts.")
      if (result.data?.layouts) setCanvasLayouts(result.data.layouts)
      if (success) toast.success(success)
    } catch (error) {
      setCanvasLayouts(previous)
      toast.error(error instanceof Error ? error.message : "Couldn't save layouts.")
    } finally {
      setLayoutsBusy(false)
    }
  }

  function saveLayout(
    name: string,
    makeDefault: boolean,
    updateLayoutId?: string | null
  ) {
    const existing = updateLayoutId
      ? canvasLayouts.find((row) => row.id === updateLayoutId)
      : undefined
    const layout: SavedCanvasLayout = existing
      ? {
          ...existing,
          name,
          isDefault: makeDefault,
          overlay: layoutFromOverlay(textOverlay),
        }
      : {
          id: crypto.randomUUID(),
          name,
          isDefault: makeDefault,
          overlay: layoutFromOverlay(textOverlay),
          createdAt: new Date().toISOString(),
        }
    const withoutTarget = existing
      ? canvasLayouts.filter((row) => row.id !== existing.id)
      : canvasLayouts
    const others = makeDefault
      ? withoutTarget.map((row) => ({ ...row, isDefault: false }))
      : withoutTarget
    void persistLayouts(
      [...others, layout],
      canvasLayouts,
      existing
        ? `Updated "${name}"${makeDefault ? " — default for new posts" : ""}`
        : `Saved "${name}"${makeDefault ? " — new posts will start with it" : ""}`
    )
  }

  function setDefaultLayout(layoutId: string | null) {
    void persistLayouts(
      canvasLayouts.map((row) => ({ ...row, isDefault: row.id === layoutId })),
      canvasLayouts,
      layoutId ? "New posts will start with this layout" : "No default layout"
    )
  }

  function deleteLayout(layoutId: string) {
    const removed = canvasLayouts.find((row) => row.id === layoutId)
    void persistLayouts(
      canvasLayouts.filter((row) => row.id !== layoutId),
      canvasLayouts,
      removed ? `Deleted "${removed.name}"` : undefined
    )
  }

  function applyLayout(
    layoutId: string,
    scope: "slide" | "all",
    wording: LayoutWordingMode = "keep-slide"
  ) {
    const layout = canvasLayouts.find((row) => row.id === layoutId)
    if (!layout) return
    const photos = mediaAssets.filter((row) => row.type !== "video")
    const activePhotoId =
      photos.find((row) => row.id === activeMediaId)?.id ?? photos[0]?.id ?? null
    // Never write to "_no_media" when a real tray photo is on screen — that
    // left the preview (keyed by asset id) unchanged after Apply style.
    const ids =
      scope === "all" && photos.length > 0
        ? photos.map((row) => row.id)
        : activePhotoId
          ? [activePhotoId]
          : [overlayKey]
    const brandLogo = brandVisualPresets.logo_url ?? ""
    let lastApplied: CanvasTextOverlayState | null = null
    setSlideOverlays((all) => {
      const next = { ...all }
      for (const id of ids) {
        const slide = slideOverlayBeforeLayoutApply({
          slide: all[id],
          facts: slideFacts[id],
        })
        const applied = applyLayoutToOverlay({
          layout,
          slide: { ...slide, logoUrl: brandLogo || slide.logoUrl },
          wording,
        })
        // Backdrop needs this photo's own cutout; that's made below.
        next[id] = {
          ...applied,
          backdropEnabled: applied.backdropEnabled && Boolean(slide.cutoutUrl),
        }
        lastApplied = next[id]!
      }
      return next
    })
    if (lastApplied) {
      setLastOverlayStyle(canvasOverlayWithoutCopy(lastApplied))
    }
    toast.success(
      wording === "keep-slide"
        ? `"${layout.name}" style applied to ${ids.length === 1 ? "this slide" : `${ids.length} slides`} — your words kept.`
        : `"${layout.name}" applied to ${ids.length === 1 ? "this slide" : `${ids.length} slides`}.`
    )
    if (layoutWantsBackdrop(layout)) {
      const look = normalizeCanvasTextOverlay(layout.overlay)
      // Let the new layouts land, then cut out the photos that need it.
      setTimeout(() => {
        void cutoutSlides(scope === "all" ? "all" : "slide", true, {
          backdropColor: look.backdropColor,
          subjectScale: look.subjectScale,
          subjectOffsetY: look.subjectOffsetY,
        })
      }, 0)
    }
  }

  function mountMediaLibraryCarousel(items: MediaLibraryItem[]) {
    // Each slide's tags come from the item that photo belongs to.
    setSlideFacts({})
    const itemIds = [...new Set(items.map((item) => item.marketingEntityId))]
    void Promise.all(
      itemIds.map(async (id) => [id, await fetchItemFacts(id, isFashionBrand)] as const)
    ).then((rows) => {
      const byItem = new Map(rows)
      setSlideFacts(
        Object.fromEntries(
          items.flatMap((item, index) => {
            const facts = byItem.get(item.marketingEntityId)
            return facts ? [[`lib-${item.id}-${index}`, facts]] : []
          })
        )
      )
    })
    const assets: MediaAsset[] = items.map((item, index) => ({
      id: `lib-${item.id}-${index}`,
      url: item.url,
      publicUrl: item.url,
      type: item.kind,
      marketingEntityId: item.marketingEntityId,
      intakeCaption: item.intakeCaption ?? null,
      intakeTags: item.intakeTags ?? null,
    }))
    onMediaAssetsChange(assets)
    applyIntakeFromTray(assets, { forceCaption: true })
    setActiveMediaId(assets[0]?.id ?? null)
    if (assets.length >= 2) {
      setSimPlatform("ig_feed")
    }
  }

  function onVisualInspect(
    assetId: string,
    inspection: MediaVisualInspection | null
  ) {
    if (inspection) {
      setVisualInspection(inspection)
      return
    }
    const still =
      mediaAssets.find(
        (row) => row.id !== assetId && row.visualInspection
      )?.visualInspection ?? null
    setVisualInspection(still)
  }

  const syncPackUrl = useCallback(
    (nextPackId: string | null) => {
      const params = new URLSearchParams(window.location.search)
      params.set("eid", activeEntity.id)
      if (nextPackId) {
        params.set("pack_id", nextPackId)
      } else {
        params.delete("pack_id")
      }
      const nextUrl = `/studio?${params.toString()}`
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(window.history.state, "", nextUrl)
      }
    },
    [activeEntity.id]
  )

  const writeLocalBuffer = useCallback(
    (input: {
      packId: string
      pack: CampaignPack
      mediaUrl: string | null
      eventDescription: string
      intent: MultiplexerIntent
      objective: string
      personaName: string | null
      fudiTrack?: FudiAudienceTrack | null
      savedAt?: string | null
    }) => {
      writeActiveMultiplexerBuffer({
        packId: input.packId,
        entityId: activeEntity.id,
        pack: input.pack,
        mediaUrl: input.mediaUrl,
        // Keep every carousel photo, not just the first.
        mediaUrls: mediaAssetsRef.current
          .filter((row) => row.type !== "video")
          .map((row) => row.publicUrl || row.url)
          .filter((url) => /^https?:\/\//i.test(url)),
        eventDescription: input.eventDescription,
        intent: input.intent,
        objective: input.objective,
        personaName: input.personaName,
        fudiTrack: input.fudiTrack ?? null,
        savedAt: input.savedAt || new Date().toISOString(),
      })
    },
    [activeEntity.id]
  )

  const applySnapshot = useCallback(
    (
      snapshot: StudioPackSnapshot,
      options?: { markRestored?: boolean; syncUrl?: boolean }
    ) => {
      skipIntentObjectiveSync.current = true
      setPack(snapshot.pack)
      setCampaignId(snapshot.campaignId)
      if (snapshot.context.fudi_track) {
        setFudiTrack(snapshot.context.fudi_track)
      }
      setIntent(snapshot.context.intent)
      const trackChips = snapshot.context.fudi_track
        ? resolveFudiTrackPresets(snapshot.context.fudi_track).intentChips
        : studioPresets.intentChips
      const matchedChip = trackChips.find(
        (chip) => chip.intent === snapshot.context.intent
      )
      setIntentChipId(matchedChip?.id ?? trackChips[0]?.id ?? "")
      const restoredObjective =
        snapshot.context.objective || snapshot.targetGoal || ""
      const objectiveList = snapshot.context.fudi_track
        ? resolveFudiTrackPresets(snapshot.context.fudi_track).objectives
        : studioPresets.objectives
      setObjective(
        objectiveList.includes(restoredObjective)
          ? restoredObjective
          : objectiveList[0] ?? restoredObjective
      )
      setRawSpark(snapshot.context.event_description || "")
      setActiveHookId(null)
      if (snapshot.context.fudi_track && snapshot.context.event_description) {
        setRedirectSlugSeed(
          buildFudiRedirectSlugSeed(
            snapshot.context.fudi_track,
            snapshot.context.event_description
          )
        )
      }

      const personaName =
        snapshot.context.persona_name || snapshot.targetSegment
      const matched = personas.find((persona) => persona.name === personaName)
      setPersonaId(matched?.id ?? personas[0]?.id ?? "")

      const sequence = parseCreativeSequence(
        snapshot.context.metadata?.creative_sequence
      )
      if (sequence) {
        const restored = restoreCreativeSequence(sequence)
        onMediaAssetsChange(restored.mediaAssets)
        setSlideOverlays(restored.slideOverlays)
        setStoryPreview(restored.storyPreview)
        setActiveMediaId(restored.mediaAssets[0]?.id ?? null)
        setCreativeSurface(restored.surface)
        setSimPlatform(
          restored.activeChannel === "ig_feed" ||
            restored.activeChannel === "facebook"
            ? restored.activeChannel === "facebook"
              ? "facebook"
              : "ig_feed"
            : restored.activeChannel === "tiktok"
              ? "tiktok"
              : "ig_story"
        )
        setTemplateInstanceId(restored.templateInstanceId)
        setTemplateVersionId(restored.templateVersionId)
        if (restored.rawSpark.trim()) {
          setRawSpark(restored.rawSpark.slice(0, RAW_SPARK_MAX))
        }
        if (restored.productIds.length > 0) {
          setWlsDailyStorySession(true)
        }
        if (restored.soldProductIds.length > 0) {
          toast.message(
            `${restored.soldProductIds.length} product${restored.soldProductIds.length === 1 ? "" : "s"} in this draft may no longer be available — review before scheduling.`
          )
        }
      } else {
        syncMediaFromUrl(snapshot.mediaUrl)
      }

      setEditorSession((value) => value + 1)
      setRestoredAt(
        options?.markRestored === false
          ? null
          : snapshot.updatedAt || snapshot.createdAt
      )

      writeLocalBuffer({
        packId: snapshot.campaignId,
        pack: snapshot.pack,
        mediaUrl: snapshot.mediaUrl,
        eventDescription: snapshot.context.event_description,
        intent: snapshot.context.intent,
        objective: snapshot.context.objective || snapshot.targetGoal,
        personaName: personaName ?? null,
        fudiTrack: snapshot.context.fudi_track,
        // Keep the pack's real last-edit time so reopening an old draft
        // doesn't make it look freshly worked on.
        savedAt: snapshot.updatedAt || snapshot.createdAt,
      })

      if (options?.syncUrl !== false) {
        syncPackUrl(snapshot.campaignId)
      }
    },
    [
      onMediaAssetsChange,
      personas,
      studioPresets,
      syncPackUrl,
      writeLocalBuffer,
    ]
  )

  useEffect(() => {
    if (skipIntentObjectiveSync.current) {
      skipIntentObjectiveSync.current = false
      return
    }
    // Keep objective on the active entity's list when intent chip changes.
    setObjective((current) =>
      studioPresets.objectives.includes(current)
        ? current
        : studioPresets.objectives[0] ?? ""
    )
  }, [intent, studioPresets.objectives])

  useEffect(() => {
    const token = ++hydrateToken.current
    let cancelled = false

    async function rehydrate() {
      setRehydrating(true)
      setSystemError(null)

      if (startFresh) {
        setRehydrating(false)
        return
      }

      const packIdFromUrl = searchParams.get("pack_id")?.trim() || null
      // Only resume this browser's in-progress pack if it was touched recently.
      // Older work is opened deliberately via a pack_id link (Campaigns / Planner),
      // so the Media step starts clean instead of reloading a stale draft.
      const bufferedLocal = readActiveMultiplexerBuffer(activeEntity.id)
      const local =
        bufferedLocal &&
        Date.now() - Date.parse(bufferedLocal.savedAt) < LOCAL_RESUME_WINDOW_MS
          ? bufferedLocal
          : null

      try {
        if (packIdFromUrl) {
          const result = await getStudioPack({
            entityId: activeEntity.id,
            campaignId: packIdFromUrl,
          })
          if (cancelled || hydrateToken.current !== token) return
          if (result.ok) {
            applySnapshot(result.snapshot, { markRestored: true })
            return
          }
        }

        if (local) {
          if (cancelled || hydrateToken.current !== token) return
          skipIntentObjectiveSync.current = true
          setPack(local.pack)
          setCampaignId(local.packId)
          if ((local.mediaUrls?.length ?? 0) >= 2) {
            const restored = mediaAssetsFromImageUrls(local.mediaUrls ?? [])
            setMediaAssets(restored)
            setActiveMediaId(restored[0]?.id ?? null)
            setAttachedImageUrl(local.mediaUrls?.[0] ?? local.mediaUrl)
          } else {
            syncMediaFromUrl(local.mediaUrl)
          }
          if (local.fudiTrack) setFudiTrack(local.fudiTrack)
          setIntent(local.intent)
          const localTrackChips = local.fudiTrack
            ? resolveFudiTrackPresets(local.fudiTrack).intentChips
            : studioPresets.intentChips
          const matchedLocalChip = localTrackChips.find(
            (chip) => chip.intent === local.intent
          )
          setIntentChipId(
            matchedLocalChip?.id ?? localTrackChips[0]?.id ?? ""
          )
          const localObjectives = local.fudiTrack
            ? resolveFudiTrackPresets(local.fudiTrack).objectives
            : studioPresets.objectives
          setObjective(
            localObjectives.includes(local.objective)
              ? local.objective
              : localObjectives[0] ?? local.objective
          )
          setRawSpark(local.eventDescription)
          if (local.fudiTrack) {
            setRedirectSlugSeed(
              buildFudiRedirectSlugSeed(local.fudiTrack, local.eventDescription)
            )
          }
          const matched = personas.find(
            (persona) => persona.name === local.personaName
          )
          setPersonaId(matched?.id ?? personas[0]?.id ?? "")
          setEditorSession((value) => value + 1)
          setRestoredAt(local.savedAt)
          syncPackUrl(local.packId)
          return
        }

        // Clean slate for this entity
        setPack(null)
        setCampaignId(null)
        syncMediaFromUrl(null)
        setRawSpark("")
        setRestoredAt(null)
        setPersonaId(personas[0]?.id ?? "")
        setObjective(studioPresets.objectives[0] ?? "")
        setIntent(studioPresets.intentChips[0]?.intent ?? "Drive Sales")
        setIntentChipId(studioPresets.intentChips[0]?.id ?? "drive_sales")
        setActiveHookId(null)
        syncPackUrl(null)
      } finally {
        if (!cancelled && hydrateToken.current === token) {
          setRehydrating(false)
        }
      }
    }

    void rehydrate()
    return () => {
      cancelled = true
    }
    // Rehydrate when brand changes or pack_id lands in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntity.id])

  // Template Centre handoff — keep instance id for server resolve (not just prompt text).
  useEffect(() => {
    const fromUrl = searchParams.get("templateInstanceId")?.trim() ?? ""
    if (fromUrl && /^[0-9a-f-]{36}$/i.test(fromUrl)) {
      setTemplateInstanceId(fromUrl)
    }
    const hookFromUrl = searchParams.get("formulaHookId")?.trim() ?? ""
    if (hookFromUrl) {
      setFormulaHookId(hookFromUrl)
    }
  }, [searchParams, activeEntity.id])

  // Planner day card + Brand Director handoff — seed spark from sessionStorage / URL.
  useEffect(() => {
    if (rehydrating) return

    const plannerHandoff = readStudioPlannerHandoff(activeEntity.id)
    if (plannerHandoff) {
      setRawSpark(buildPlannerStudioSpark(plannerHandoff))
      setWorkbenchHeadline(plannerHandoff.hook.slice(0, 200))
      setWorkbenchStep(WORKBENCH_STEP_COPY)
      const fromUrl = searchParams.get("prompt")?.trim() ?? ""
      if (fromUrl) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("prompt")
        router.replace(`/studio?${params.toString()}`, { scroll: false })
      }
      return
    }

    const fromUrl = searchParams.get("prompt")?.trim() ?? ""
    let fromStorage = ""
    try {
      const key = `studio-prompt:${activeEntity.id}`
      fromStorage = sessionStorage.getItem(key)?.trim() ?? ""
      if (fromStorage) sessionStorage.removeItem(key)
    } catch {
      // ignore
    }

    const prompt = fromStorage || fromUrl
    if (!prompt) return

    setRawSpark(prompt)

    if (fromUrl) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("prompt")
      // Keep templateInstanceId / formulaHookId for generate wiring.
      router.replace(`/studio?${params.toString()}`, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehydrating, activeEntity.id])

  useEffect(() => {
    if (!pack || !campaignId) return
    writeLocalBuffer({
      packId: campaignId,
      pack,
      mediaUrl: studioMediaUrl,
      eventDescription: rawSpark,
      intent,
      objective,
      personaName: selectedPersona?.name ?? null,
      fudiTrack: isFudi ? fudiTrack : null,
    })
  }, [
    pack,
    campaignId,
    studioMediaUrl,
    // Save again when carousel photos change.
    mediaAssets,
    rawSpark,
    intent,
    objective,
    selectedPersona?.name,
    writeLocalBuffer,
    isFudi,
    fudiTrack,
  ])

  function onBrandChange(nextId: string) {
    if (nextId === activeEntity.id) return
    clearActiveMultiplexerBuffer(activeEntity.id)
    setRawSpark("")
    setPack(null)
    setCampaignId(null)
    setActiveHookId(null)
    setRestoredAt(null)
    setSystemError(null)
    syncMediaFromUrl(null)
    startTransition(async () => {
      await setActiveEntity(nextId)
      router.replace(`/studio?eid=${encodeURIComponent(nextId)}`)
    })
  }

  function renderFormulaPack() {
    setSystemError(null)
    const spark = rawSpark.trim()
    if (spark.length < 8) {
      setSystemError("RAW SPARK TOO SHORT. Add a one-line event for slot fill.")
      return
    }
    const bank = resolveFormulaBank(activeEntity.brand_identity, brandProfileId)
    const ctas = resolveConversionActions(activeEntity.conversion_goals, brandProfileId)
    const hook =
      bank.hook_styles.find((h) => h.id === formulaHookId) ??
      bank.hook_styles[0]
    const visual =
      bank.visual_directions.find((v) => v.id === formulaVisualId) ??
      bank.visual_directions[0]
    const cta = ctas.find((c) => c.id === formulaCtaId) ?? ctas[0]
    if (!hook || !visual || !cta) {
      setSystemError("Select hook, visual direction, and CTA from the formula bank.")
      return
    }

    const nextPack = buildCampaignPackFromFormula({
      hook,
      visual,
      cta,
      slots: formulaSlots,
      spark,
      brandFallback: activeEntity.name,
      campaignTitle:
        [formulaSlots.brand, formulaSlots.campaignLine || formulaSlots.item]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" — ")
          .slice(0, 80) || undefined,
    })

    // The caption written on Post is exactly what publishes; the formula
    // only fills the spoken hook and on-screen line.
    setPack(
      withStudioTags({
        ...nextPack,
        seo_caption: { ...nextPack.seo_caption, caption_body: spark.slice(0, 2200) },
      })
    )
    quickPackCaption.current = spark
    setCampaignId(null)
    setRedirectSlugSeed(
      isFudi ? buildFudiRedirectSlugSeed(fudiTrack, spark) : null
    )
    setEditorSession((value) => value + 1)
    setRestoredAt(null)
    setWorkbenchStep(WORKBENCH_STEP_CHANNELS)
  }

  function withStudioTags(next: CampaignPack): CampaignPack {
    if (optimizationTags.length === 0) return next
    return {
      ...next,
      seo_caption: {
        ...next.seo_caption,
        search_optimized_tags: optimizationTags,
      },
    }
  }

  async function activateMultiplexer() {
    setSystemError(null)
    const spark = rawSpark.trim()

    if (spark.length < 8) {
      setSystemError("RAW SPARK TOO SHORT. Give the multiplexer a real event.")
      return
    }
    if (!resolvedFocusChip) {
      setSystemError("Pick a post focus on Intent (e.g. Drive Sales or Build Hype).")
      return
    }
    if (!resolvedPersona) {
      setSystemError(
        "Add audience segments in Brain, or use the default Worn Label personas."
      )
      return
    }

    setMultiplexing(true)
    try {
      const response = await fetch("/api/generate/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: activeEntity.id,
          eventDescription: spark,
          targetGoal: packTargetGoal,
          personaName: resolvedPersona.name,
          intent,
          attachedImageUrl: apiImageUrl,
          fudiTrack: isFudi ? fudiTrack : null,
          visualDescription: visualInspection?.visualDescription ?? null,
          concreteFeatures: visualInspection?.concreteFeatures ?? null,
          aestheticTags: visualInspection?.aestheticTags ?? null,
          templateInstanceId: templateInstanceId,
        }),
      })
      const payload = (await response.json()) as {
        pack?: CampaignPack
        preview?: CampaignPackOutputView
        campaignId?: string | null
        attachedImageUrl?: string | null
        redirectSlugSeed?: string | null
        fudiTrack?: FudiAudienceTrack | null
        reusedExistingCampaign?: boolean
        error?: string
      }

      if (!response.ok || !payload.pack) {
        throw new Error(payload.error ?? "SYSTEM HALTED. Multiplexer failed.")
      }

      if (payload.reusedExistingCampaign) {
        toast.message("Reused existing campaign for this template generation key.")
      }

      const nextCampaignId =
        payload.campaignId ?? payload.preview?.id ?? null
      const nextMedia = payload.attachedImageUrl ?? attachedImageUrl
      const nextSlugSeed =
        payload.redirectSlugSeed ??
        (isFudi ? buildFudiRedirectSlugSeed(fudiTrack, spark) : null)

      setPack(withStudioTags(payload.pack))
      quickPackCaption.current = null
      setCampaignId(nextCampaignId)
      setRedirectSlugSeed(nextSlugSeed)
      // The server echoes the first photo back; only adopt it for a single
      // photo, so a carousel keeps all its slides (and their Canvas text).
      const photosInTray = mediaAssetsRef.current.filter((row) => row.type !== "video")
      if (payload.attachedImageUrl && photosInTray.length < 2) {
        syncMediaFromUrl(payload.attachedImageUrl)
      }
      setEditorSession((value) => value + 1)
      setRestoredAt(null)

      if (nextCampaignId) {
        writeLocalBuffer({
          packId: nextCampaignId,
          pack: payload.pack,
          mediaUrl: nextMedia,
          eventDescription: spark,
          intent,
          objective: packTargetGoal,
          personaName: resolvedPersona.name,
          fudiTrack: isFudi ? fudiTrack : null,
        })
        syncPackUrl(nextCampaignId)
      }

      toast.success("MAD Multiplexer online — 5 assets ready.")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "SYSTEM HALTED. Unknown multiplexer failure."
      setSystemError(message)
      toast.error(message)
    } finally {
      setMultiplexing(false)
    }
  }

  function runSave(status: "draft" | "published") {
    const imageCount = mediaAssets.filter((row) => row.type !== "video").length
    const allowVisualOnly =
      status === "draft" &&
      imageCount >= 1 &&
      (wlsDailyStorySession ||
        wlsSequenceMarketingEntityIds.length > 0 ||
        creativeSurface === "story")

    if (!pack && !allowVisualOnly) {
      toast.error(
        "Generate or select your pack copy before arming — or add Story frames to save a visual draft."
      )
      return
    }
    if (!pack && allowVisualOnly && imageCount === 0) {
      toast.error("Add at least one photo before saving a visual draft.")
      return
    }

    const packToSave =
      pack ??
      buildVisualOnlyCampaignPack({
        title:
          templateDisplayName?.trim() ||
          `${activeEntity.name} · ${imageCount}-frame Story`,
        captionHint: rawSpark.trim(),
        frameCount: imageCount,
      })

    const sequence = buildCreativeSequence({
      mediaAssets,
      slideOverlays: slideOverlaysRef.current,
      storyPreview,
      surface: creativeSurface,
      activeChannel: simPlatform,
      templateInstanceId,
      templateVersionId,
      visualOnly: !pack,
      rawSpark: rawSpark.trim(),
    })

    if (allowVisualOnly && !sequence) {
      toast.error("Could not build a saveable Story sequence from the tray.")
      return
    }

    const mediaUrlForSave =
      apiImageUrl ||
      sequence?.frames[0]?.mediaUrl ||
      null

    startTransition(async () => {
      const result = await saveCampaign({
        entityId: activeEntity.id,
        eventDescription: rawSpark.trim() || packToSave.seo_caption.caption_body,
        targetGoal: packTargetGoal || "Drive Sales",
        targetSegment: resolvedPersona?.name ?? null,
        pack: packToSave,
        status,
        mediaUrl: mediaUrlForSave,
        campaignId,
        intent,
        fudiTrack: isFudi ? fudiTrack : null,
        forecastingTag: activeForecastingTag,
        creativeSequence: sequence ?? undefined,
      })
      if (!result.ok) {
        setSystemError(result.error)
        toast.error(result.error)
        return
      }
      setCampaignId(result.campaignId)
      if (!pack) setPack(packToSave)
      if (status === "draft") {
        await disarmCampaignQueue({
          entityId: activeEntity.id,
          campaignId: result.campaignId,
        })
      }
      writeLocalBuffer({
        packId: result.campaignId,
        pack: packToSave,
        mediaUrl: studioMediaUrl || mediaUrlForSave,
        eventDescription: rawSpark.trim(),
        intent,
        objective: packTargetGoal || "Drive Sales",
        personaName: resolvedPersona?.name ?? null,
        fudiTrack: isFudi ? fudiTrack : null,
      })
      syncPackUrl(result.campaignId)
      toast.success(
        status === "draft" ? "Draft saved to Campaigns." : "Campaign published."
      )
      window.location.href = `/campaigns?eid=${encodeURIComponent(activeEntity.id)}&toast=${status === "draft" ? "draft" : "published"}`
    })
  }

  function runDispatch() {
    if (!pack) { toast.error("Generate or select your pack copy in Step 2 before arming."); return; }
    startTransition(async () => {
      const result = await dispatchCampaignPack({
        entityId: activeEntity.id,
        eventDescription: rawSpark.trim(),
        targetGoal: packTargetGoal,
        targetSegment: resolvedPersona?.name ?? null,
        pack,
        status: "published",
        mediaUrl: apiImageUrl,
        campaignId,
        intent,
        fudiTrack: isFudi ? fudiTrack : null,
        forecastingTag: activeForecastingTag,
      })
      if (!result.ok) {
        setSystemError(result.error)
        toast.error(result.error)
        return
      }
      setCampaignId(result.campaignId)
      syncPackUrl(result.campaignId)
      toast.success("Dispatched — opening Campaigns.")
      window.location.href = `/campaigns?eid=${encodeURIComponent(activeEntity.id)}&toast=published`
    })
  }

  /** Ensure a pack exists for review/arm — visual Story drafts may use a stub pack. */
  function ensurePackForReview(): CampaignPack | null {
    if (pack) return pack
    const imageCount = mediaAssets.filter((row) => row.type !== "video").length
    if (imageCount < 1) return null
    if (
      !(
        wlsDailyStorySession ||
        wlsSequenceMarketingEntityIds.length > 0 ||
        creativeSurface === "story"
      )
    ) {
      return null
    }
    const stub = buildVisualOnlyCampaignPack({
      title:
        templateDisplayName?.trim() ||
        `${activeEntity.name} · ${imageCount}-frame Story`,
      captionHint: rawSpark.trim(),
      frameCount: imageCount,
    })
    setPack(stub)
    return stub
  }

  /** Checks that need no artwork; shared by the review screen and arming. */
  function armBlocker(): string | null {
    const reviewPack = pack ?? ensurePackForReview()
    if (!reviewPack) {
      return "Generate or select your pack copy in Step 2 before arming."
    }
    if (!(dispatchPlan ?? []).some((slot) => slot.enabled)) {
      return "Tick at least one channel to arm."
    }
    if (!apiImageUrl) {
      const firstHttps = mediaAssets
        .map((row) => row.publicUrl || row.url)
        .find((url) => /^https?:\/\//i.test(url))
      if (!firstHttps) {
        return "Arming needs a public https image — add or finish uploading media in step 1."
      }
    }
    return null
  }

  async function openReview() {
    const blocker = armBlocker()
    if (blocker) {
      toast.error(blocker)
      return
    }
    if (hasUsableFrameTemplate(frameTemplate)) {
      setFrameBaking(true)
      try {
        const composed = await bakeFrameTemplate({
          entityId: activeEntity.id,
          template: frameTemplate,
          imageFills: frameImageFills,
          textFills: frameTextFills,
        })
        setFrameComposedUrl(composed)
        setReviewOpen(true)
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not compose the frame template."
        )
      } finally {
        setFrameBaking(false)
      }
      return
    }
    setReviewOpen(true)
  }

  function dropChannel(channel: SchedulerChannel) {
    setDispatchPlan((plan) =>
      plan
        ? plan.map((slot) =>
            slot.channel === channel ? { ...slot, enabled: false } : slot
          )
        : plan
    )
  }

  function onArmPack(
    mediaByChannel?: MediaByChannel,
    carouselUrls?: string[] | null,
    storyUrls?: string[] | null
  ) {
    const blocker = armBlocker()
    if (blocker || !pack || !apiImageUrl) {
      toast.error(blocker ?? "Nothing to arm yet.")
      return
    }
    const slots = (dispatchPlan ?? []).filter((slot) => slot.enabled)
    // Persist the tray sequence with the draft so Confirm/arm cannot wipe
    // creative_sequence that Save draft already wrote.
    const sequenceForArm = buildCreativeSequence({
      mediaAssets,
      slideOverlays: slideOverlaysRef.current,
      storyPreview,
      surface: creativeSurface,
      activeChannel: simPlatform,
      templateInstanceId,
      templateVersionId,
      visualOnly: false,
      rawSpark: rawSpark.trim(),
    })

    setArming(true)
    startTransition(async () => {
      const saved = await saveCampaign({
        entityId: activeEntity.id,
        eventDescription: rawSpark.trim(),
        targetGoal: packTargetGoal,
        targetSegment: resolvedPersona?.name ?? null,
        pack,
        status: "draft",
        mediaUrl: apiImageUrl,
        campaignId,
        intent,
        fudiTrack: isFudi ? fudiTrack : null,
        forecastingTag: activeForecastingTag,
        creativeSequence: sequenceForArm ?? undefined,
      })
      if (!saved.ok) {
        setArming(false)
        toast.error(saved.error)
        return
      }
      setCampaignId(saved.campaignId)
      syncPackUrl(saved.campaignId)

      const result = await armCampaignMultiChannelDispatch({
        entityId: activeEntity.id,
        campaignId: saved.campaignId,
        pack,
        slots,
        mediaUrl: apiImageUrl,
        mediaByChannel: mediaByChannel ?? null,
        carouselUrls: carouselUrls ?? null,
        storyUrls: storyUrls ?? null,
        slugSeed: liveRedirectSlugSeed,
      })
      setArming(false)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const { immediate, scheduled, firstScheduledAt } = result.data
      const parts: string[] = []
      if (immediate.successes > 0) {
        parts.push(`${immediate.successes} dispatched now`)
      }
      if (scheduled > 0 && firstScheduledAt) {
        parts.push(
          `${scheduled} armed · first ${formatScheduleToast(firstScheduledAt)}`
        )
      }
      toast.success(`Multi-channel post armed — ${parts.join(" · ") || "queued"}`)
      for (const failure of immediate.errors) {
        const channel =
          CHANNEL_META[failure.platform as keyof typeof CHANNEL_META]?.label ??
          failure.platform
        toast.error(`${channel}: ${failure.error} (will retry)`)
      }
      if (immediate.skippedReason) toast.message(immediate.skippedReason)

      router.push(
        `/campaigns?eid=${encodeURIComponent(activeEntity.id)}&toast=armed`
      )
    })
  }

  function startNewPack() {
    clearActiveMultiplexerBuffer(activeEntity.id)
    setSlideOverlays({})
    setPack(null)
    setCampaignId(null)
    syncMediaFromUrl(null)
    setRawSpark("")
    setRestoredAt(null)
    setSystemError(null)
    setRedirectSlugSeed(null)
    setEditorSession((value) => value + 1)
    if (isFudi) {
      applyFudiTrack("diners")
    } else {
      setIntent(studioPresets.intentChips[0]?.intent ?? "Drive Sales")
      setIntentChipId(studioPresets.intentChips[0]?.id ?? "drive_sales")
      setObjective(studioPresets.objectives[0] ?? "")
      setPersonaId(personas[0]?.id ?? "")
    }
    setActiveHookId(null)
    quickPackCaption.current = null
    setWorkbenchStep(WORKBENCH_STEP_MEDIA)
    syncPackUrl(null)
  }

  function onStudioBack() {
    setWorkbenchStep((current) => prevWorkbenchStep(current))
  }

  function onStudioNext() {
    if (workbenchStep === WORKBENCH_STEP_COPY) {
      if (rawSpark.trim().length < 8) {
        toast.message("Write a short caption first (at least 8 characters).")
        return
      }
      // Build the post from this caption (no AI) unless there's already one
      // for it; an AI-written or restored post is kept as it is.
      const stale =
        quickPackCaption.current != null &&
        quickPackCaption.current !== rawSpark.trim()
      if (!pack || stale) {
        renderFormulaPack()
        return
      }
      setWorkbenchStep(WORKBENCH_STEP_CHANNELS)
      return
    }
    if (workbenchStep === WORKBENCH_STEP_CHANNELS) {
      void activateMultiplexer()
      return
    }
    setWorkbenchStep((current) => nextWorkbenchStep(current))
  }

  function onPackChange(next: CampaignPack) {
    setPack(next)
    setRestoredAt(null)
  }

  function onCampaignIdChange(nextId: string) {
    setCampaignId(nextId)
    syncPackUrl(nextId)
  }

  useEffect(() => {
    if (startFresh) startNewPack()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fresh=1 is a one-shot URL flag
  }, [startFresh])

  useEffect(() => {
    if (workbenchStep !== WORKBENCH_STEP_CHANNELS) setPackEditorOpen(false)
  }, [workbenchStep])

  // One-shot: strip catalog Brand·Size dumps already sitting in Copy.
  useEffect(() => {
    if (workbenchStep !== WORKBENCH_STEP_COPY) return
    if (!isCatalogMetadataDump(rawSpark)) return
    const cleaned = readableListingCaption({ description: rawSpark })
    if (cleaned) setRawSpark(cleaned.slice(0, RAW_SPARK_MAX))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering Copy
  }, [workbenchStep])

  const studioChrome = useStudioChromeOptional()
  // Depend on the stable callbacks, not the whole context value: the value
  // changes every time chrome state changes, which re-ran these effects
  // (clear -> set -> clear ...) in an endless render loop.
  const setStudioChrome = studioChrome?.setChrome
  const clearStudioChrome = studioChrome?.clearChrome
  const startNewPackRef = useRef(startNewPack)
  startNewPackRef.current = startNewPack
  const onStartFreshChrome = useCallback(() => startNewPackRef.current(), [])
  const draftActiveChrome = Boolean(restoredAt && pack)

  useEffect(() => {
    if (!setStudioChrome) return
    setStudioChrome({
      draftActive: draftActiveChrome,
      rehydrating,
      onStartFresh: onStartFreshChrome,
    })
  }, [setStudioChrome, draftActiveChrome, rehydrating, onStartFreshChrome])

  useEffect(() => {
    if (!clearStudioChrome) return
    return () => clearStudioChrome()
  }, [clearStudioChrome])

  const simulatorContent = useMemo(() => {
    const usePackInPreview =
      Boolean(pack && showStudio && workbenchStep === WORKBENCH_STEP_CHANNELS)
    const captionBody = rawSpark.trim()
    const headlineLine =
      workbenchHeadline.trim() ||
      captionBody.split(/\n/)[0]?.trim().slice(0, 120) ||
      activeEntity.name
    const emailFields = pack
      ? {
          emailSubject: pack.email_drop.subject_line,
          emailPreview:
            pack.email_drop.preview_text ||
            stripMarkdown(pack.email_drop.body_markdown).slice(0, 120),
          emailBody: stripMarkdown(pack.email_drop.body_markdown),
        }
      : {
          // Pre-pack Email preview uses Copy fields (not a blank placeholder).
          emailSubject: headlineLine,
          emailPreview: (captionBody || headlineLine).slice(0, 120),
          emailBody: captionBody || headlineLine,
        }
    if (usePackInPreview && pack) {
      return {
        brandName: activeEntity.name,
        headline:
          pack.algorithmic_signals.on_screen_text ||
          pack.carousel.slides[0]?.headline ||
          pack.campaign_title,
        caption:
          simPlatform === "ig_story"
            ? pack.algorithmic_signals.spoken_hook
            : scrubInlineHashtags(pack.seo_caption.caption_body),
        imageUrl:
          studioMediaUrl && /^https?:\/\//i.test(studioMediaUrl)
            ? studioMediaUrl
            : null,
        ...emailFields,
      }
    }
    return {
      brandName: activeEntity.name,
      headline: headlineLine,
      caption:
        scrubInlineHashtags(
          mergeCaptionWithTags(captionBody || headlineLine, optimizationTags) ||
            headlineLine
        ),
      imageUrl:
        studioMediaUrl && /^https?:\/\//i.test(studioMediaUrl)
          ? studioMediaUrl
          : null,
      ...emailFields,
    }
  }, [
    activeEntity.name,
    pack,
    rawSpark,
    workbenchHeadline,
    optimizationTags,
    showStudio,
    simPlatform,
    studioMediaUrl,
    workbenchStep,
  ])

  const mediaPreviewUrl =
    mediaAssets.find((row) => row.id === activeMediaId)?.publicUrl ||
    mediaAssets.find((row) => row.type === "image")?.url ||
    null
  const mediaStepSummary =
    mediaAssets.length > 0
      ? `Media attached · ${mediaAssets.length} asset${mediaAssets.length === 1 ? "" : "s"}`
      : "No media yet"
  const intentStepSummary = (() => {
    const tone = AUDIENCE_TONE_META[audienceTone].short
    const focus = resolvedFocusChip?.label ?? "Post focus"
    const topic = contentPillar.trim()
    if (!topic && !resolvedFocusChip) return "Intent & DNA"
    return topic
      ? `${tone} · ${focus} · ${topic.slice(0, 40)}${topic.length > 40 ? "…" : ""}`
      : `${tone} · ${focus}`
  })()
  const canvasStepSummary = (() => {
    const parts: string[] = []
    if (textOverlay.enabled && textOverlay.headline.trim()) {
      parts.push(textOverlay.headline.trim().slice(0, 32))
    }
    if (textOverlay.animation !== "none") parts.push("Motion")
    if (textOverlay.shadow !== "none") parts.push("Shadow")
    if (textOverlay.highlight !== "none") parts.push("Highlight")
    return parts.length > 0 ? parts.join(" · ") : "No words on the picture"
  })()
  const copyStepSummary =
    workbenchHeadline.trim() || rawSpark.trim()
      ? `${workbenchHeadline.trim() || "Hook"} · ${rawSpark.trim().slice(0, 48)}${rawSpark.length > 48 ? "…" : ""}`
      : "Add hook & caption"

  function renderCustomizePhase(phase: CustomizeWizardPhase) {
    const activePhoto =
      mediaAssets.find((row) => row.id === activeMediaId) ?? mediaAssets[0] ?? null
    const hasStillPhoto = Boolean(
      activePhoto && activePhoto.type !== "video"
    )
    return (
      <StepCustomize
        phase={phase}
        itemFacts={
          (activeMediaId ? slideFacts[activeMediaId] : undefined) ??
          (mediaAssets[0] ? slideFacts[mediaAssets[0].id] : undefined) ??
          null
        }
        onCutout={cutoutSlides}
        cutoutBusy={cutoutBusy}
        photoCount={mediaAssets.filter((row) => row.type !== "video").length}
        storyTools={
          phase === "canvas"
            ? {
                bridge: {
                  spokenHook:
                    workbenchHeadline.trim() || rawSpark.trim().slice(0, 120),
                  onScreenHeadline:
                    workbenchHeadline.trim().slice(0, 80) || activeEntity.name,
                  caption: rawSpark.trim(),
                  destinationUrl:
                    activePhoto?.destinationUrl ??
                    mediaAssets[0]?.destinationUrl ??
                    null,
                  assetUrl: activePhoto?.url ?? null,
                },
                cutoutActive: isMultiPhoto
                  ? canvasBackdropOn(textOverlay)
                  : storyPreview.cutoutMode === "transparent",
                onCutoutToggle: isMultiPhoto
                  ? () =>
                      void cutoutSlides(
                        "slide",
                        !canvasBackdropOn(textOverlay)
                      )
                  : onCutoutToggle,
                onCutoutAll: isMultiPhoto
                  ? () => void cutoutSlides("all", true)
                  : undefined,
                isVideo: activePhoto?.type === "video",
                hasPhoto: hasStillPhoto,
                storyCard: isMultiPhoto
                  ? null
                  : {
                      // The brand kit's Story backgrounds, same as Today.
                      swatches: resolveStoryKit({
                        presets: brandVisualPresets,
                        isWornLabel: isFashionBrand,
                      }).map((bg) => ({ hex: bg.color, label: bg.name })),
                      background:
                        storyPreview.canvasColor ||
                        brandVisualPresets.canvas_color,
                      onBackgroundChange: (hex) =>
                        setStoryPreview((current) => ({
                          ...current,
                          canvasColor: hex,
                          bgPresetId: "custom",
                        })),
                      scale: storyPreview.subjectScale ?? 1,
                      onScaleChange: (subjectScale) =>
                        setStoryPreview((current) => ({
                          ...current,
                          subjectScale,
                        })),
                      offsetY: storyPreview.subjectOffsetY ?? 0,
                      onOffsetYChange: (subjectOffsetY) =>
                        setStoryPreview((current) => ({
                          ...current,
                          subjectOffsetY,
                        })),
                    },
                disabled: multiplexing || pending || rehydrating,
              }
            : null
        }
        canvasSourceUrl={(() => {
          const active =
            mediaAssets.find((row) => row.id === activeMediaId) ?? mediaAssets[0]
          return active?.type === "video"
            ? null
            : active?.publicUrl || active?.url || attachedImageUrl || null
        })()}
        entity={activeEntity}
        entityId={activeEntity.id}
        isFudi={isFudi}
        vibeOptions={
          resolveIndustryProfile({
            name: activeEntity.name,
            industry: activeEntity.industry,
          }).vibeTags
        }
        postIntent={postIntent}
        onPostIntentChange={setPostIntent}
        headline={workbenchHeadline}
        caption={rawSpark}
        onHeadlineChange={setWorkbenchHeadline}
        onCaptionChange={setRawSpark}
        hookChips={hookChips}
        activeHookId={activeHookId}
        onHookSelect={(hookId) => {
          const hook = hookChips.find((row) => row.id === hookId)
          if (!hook) return
          setActiveHookId(hookId)
          setWorkbenchHeadline(hook.hook.slice(0, 200))
          setRawSpark((current) =>
            stripDuplicateHookFromCaption(
              hook.hook,
              current || hook.hook
            ).slice(0, RAW_SPARK_MAX)
          )
          applySparkDispatchChannels({ hookId })
        }}
        contentPillar={contentPillar}
        onContentPillarChange={setContentPillar}
        personaId={personaId}
        onPersonaIdChange={setPersonaId}
        hookBlueprintId={formulaHookId}
        onHookBlueprintIdChange={setFormulaHookId}
        ctaId={formulaCtaId}
        onCtaIdChange={setFormulaCtaId}
        textOverlay={textOverlay}
        onTextOverlayChange={setTextOverlay}
        tagsSlot={
          phase === "copy" || phase === "post" ? (
            <OptimizationTagsEditor
              entityId={activeEntity.id}
              tags={optimizationTags}
              suggestedTags={suggestedOptimizationTags}
              headline={workbenchHeadline}
              caption={rawSpark}
              listingVibe={postIntent.listingVibe || null}
              visualDescription={
                carouselPackContext.isCarousel
                  ? carouselMergedVision.visualDescription ||
                    visualInspection?.visualDescription ||
                    null
                  : visualInspection?.visualDescription ?? null
              }
              carouselPackContext={carouselPackContext}
              onTagsChange={setOptimizationTags}
            />
          ) : null
        }
        isVideoPreview={activeMedia?.type === "video"}
        visualDescription={visualInspection?.visualDescription ?? null}
        visualInspection={visualInspection}
        inspectableMediaUrl={inspectableStudioMediaUrl}
        inspectableMediaType={activeMedia?.type ?? "image"}
        onVisualInspectionResolved={(inspection) => {
          setVisualInspection(inspection)
          if (!activeMediaId) return
          setMediaAssets((current) =>
            current.map((row) =>
              row.id === activeMediaId
                ? { ...row, visualInspection: inspection }
                : row
            )
          )
        }}
        topSlot={
          !isFudi ? (
            <IntentMatrix
              brandProfileId={brandProfileId}
              audienceTone={audienceTone}
              onAudienceToneChange={setAudienceTone}
              intentChips={consumerIntentChips}
              intentChipId={intentChipId}
              onIntentChipSelect={onIntentChipSelect}
              outputFormats={fudiTrackPresets?.outputFormats ?? []}
            />
          ) : null
        }
        intentFieldSet={isFudi ? "full" : "focus"}
        intentSummary={intentStepSummary}
        audienceToneCue={toneGoalSuffix}
        postFocusLabel={resolvedFocusChip?.label ?? null}
        stillPhotoCount={
          mediaAssets.filter((row) => row.type !== "video").length
        }
        brandProfileId={brandProfileId}
        carouselPackContext={carouselPackContext}
        carouselMergedVision={
          carouselMergedVision.visualDescription || null
        }
        footerSlot={
          phase === "post" ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-mad-black/15 pt-3">
              <p className="text-xs text-neutral-600">
                Or let AI write the whole post: a caption for each channel and
                a video script.
              </p>
              <button
                type="button"
                onClick={() => void activateMultiplexer()}
                disabled={multiplexing || pending || rehydrating}
                className="inline-flex items-center gap-1.5 border border-mad-black/40 px-3 py-1.5 text-xs font-medium text-mad-black hover:border-mad-black disabled:opacity-50"
              >
                {multiplexing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                {multiplexing ? "Writing…" : "Write it with AI"}
              </button>
            </div>
          ) : null
        }
        canvasSlot={
          phase === "canvas" ? (
            <div className="space-y-3">
              {hasUsableFrameTemplate(frameTemplate) ? (
                <div className="space-y-3 border-2 border-mad-black bg-neutral-50 p-3">
                  <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-neutral-500 uppercase">
                    Frame labels
                  </p>
                  <p className="text-xs text-neutral-600">
                    Drag tray photos onto the cream frames in the preview. Edit
                    the headers here or tap them on the phone.
                  </p>
                  {frameTemplate.textSlots.map((slot) => (
                    <div key={slot.id} className="space-y-1">
                      <Label htmlFor={`frame-text-${slot.id}`}>
                        {slot.label}
                      </Label>
                      <Input
                        id={`frame-text-${slot.id}`}
                        value={frameTextFills[slot.id] ?? slot.defaultText ?? ""}
                        onChange={(e) =>
                          setFrameTextFills((prev) => ({
                            ...prev,
                            [slot.id]: e.target.value,
                          }))
                        }
                        className="rounded-none"
                      />
                    </div>
                  ))}
                  <ul className="space-y-1 text-xs text-neutral-600">
                    {frameTemplate.imageSlots.map((slot) => (
                      <li key={slot.id}>
                        {slot.label}:{" "}
                        {frameImageFills[slot.id] ? "filled" : "empty — drop a photo"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <CanvasLayoutsBar
                    layouts={canvasLayouts}
                    photoCount={imageAssets.length}
                    busy={layoutsBusy || cutoutBusy}
                    saveSlot={(selected) => (
                      <CanvasLayoutSaveButton
                        variant="labeled"
                        busy={layoutsBusy}
                        suggestedName={`Layout ${canvasLayouts.length + 1}`}
                        selectedLayout={selected}
                        onSave={saveLayout}
                      />
                    )}
                    onApply={applyLayout}
                    onSetDefault={setDefaultLayout}
                    onDelete={deleteLayout}
                  />
                  {imageAssets.length >= 2 ? (
                    <CanvasSlidePicker
                      slides={imageAssets.map((asset) => {
                        const overlay =
                          asset.id === activeMediaId
                            ? textOverlay
                            : overlayForAsset(asset.id)
                        return {
                          id: asset.id,
                          url: asset.publicUrl || asset.url,
                          hasText: overlay
                            ? canvasOverlayHasDecor(overlay)
                            : false,
                        }
                      })}
                      activeId={activeMediaId}
                      onSelect={(id) => {
                        const asset = imageAssets.find((row) => row.id === id)
                        if (asset) onSelectStudioMedia(asset)
                      }}
                    />
                  ) : null}
                </>
              )}
            </div>
          ) : null
        }
      />
    )
  }

  const studioHeader = (
    <>
      <StudioCreateChrome
        brandName={activeEntity.name}
        step={workbenchStep}
        onStepChange={setWorkbenchStep}
      />
      <WlsDailyStoryEntryBanner show={isFashionBrand && wlsDailyStorySession} />
      {systemError ? (
        <div
          className="mt-2 border-2 border-mad-black bg-mad-vermillion px-3 py-2 text-sm font-bold text-mad-white shadow-keycap"
          role="alert"
        >
          {systemError}
        </div>
      ) : null}
    </>
  )

  /** WLS Daily Story sequence active — bottom strip is the product picker. */
  const wlsTemplateProductMode =
    wlsDailyStorySession || wlsSequenceMarketingEntityIds.length > 0

  return (
    <div className="flex h-full min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden">
      <StudioSplitShell
        className="min-h-0 flex-1"
        showInlinePreview
        previewActions={
          workbenchStep === WORKBENCH_STEP_CANVAS ? (
            <CanvasLayoutSaveButton
              busy={layoutsBusy}
              suggestedName={`Layout ${canvasLayouts.length + 1}`}
              onSave={saveLayout}
            />
          ) : null
        }
        previewDrawer={{
          open: previewDrawerOpen,
          onOpenChange: setPreviewDrawerOpen,
        }}
        header={studioHeader}
        channelRail={
          <CompactChannelRail
            placement="below"
            platform={simPlatform}
            onPlatformChange={(platform) => {
              setSimPlatform(platform)
              // Preserve Story overlays when previewing Feed/TikTok — only
              // record intended surface; do not clear slideOverlays/storyPreview.
              if (platform === "ig_story") setCreativeSurface("story")
              else if (platform === "ig_feed" || platform === "facebook") {
                setCreativeSurface("feed")
              }
            }}
          />
        }
        previewGridClassName={
          workbenchStep === WORKBENCH_STEP_CANVAS
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(220px,min(20rem,26vw))] xl:grid-cols-[minmax(0,1fr)_minmax(240px,min(22rem,28vw))]"
            : undefined
        }
        navigationDock={
          <StepDock
            step={workbenchStep}
            onBack={onStudioBack}
            onNext={onStudioNext}
            nextBusy={multiplexing || (pending && !arming)}
            nextLabel={
              workbenchStep === WORKBENCH_STEP_MEDIA
                ? "Next: Make"
                : workbenchStep === WORKBENCH_STEP_CANVAS
                  ? "Next: Post"
                  : workbenchStep === WORKBENCH_STEP_INTENT
                    ? "Next: Post"
                    : workbenchStep === WORKBENCH_STEP_COPY
                      ? "Channels & time"
                      : workbenchStep === WORKBENCH_STEP_CHANNELS && !showStudio
                        ? "Write it with AI"
                        : undefined
            }
            nextDisabled={
              (workbenchStep === WORKBENCH_STEP_MEDIA &&
                mediaAssets.length === 0 &&
                !hasUsableFrameTemplate(frameTemplate)) ||
              (workbenchStep === WORKBENCH_STEP_COPY &&
                rawSpark.trim().length < 8 &&
                !wlsTemplateProductMode)
            }
            showScheduleActions={
              workbenchStep === WORKBENCH_STEP_CHANNELS && showStudio
            }
            onSaveDraft={
              mediaAssets.some((row) => row.type === "image")
                ? () => runSave("draft")
                : undefined
            }
            saveDraftBusy={pending && !arming}
            onConfirmArm={() => void openReview()}
            confirmArmBusy={arming || frameBaking}
            confirmArmDisabled={pending && !arming}
            previewDrawerOpen={previewDrawerOpen}
            hidePreviewToggleOnWide
            onTogglePreviewDrawer={() =>
              setPreviewDrawerOpen((open) => !open)
            }
          />
        }
        footer={
          isFashionBrand &&
          (workbenchStep === WORKBENCH_STEP_MEDIA ||
            workbenchStep === WORKBENCH_STEP_CANVAS) ? (
            <WlsEligibleProductStrip
              entityId={activeEntity.id}
              catalog={wlsProductCatalog}
              loading={wlsEligibleLoading}
              excludedCount={wlsExcludedCount}
              selectableCount={wlsSelectableCount}
              syncedCount={wlsSyncedCount}
              exclusionSummary={wlsExclusionSummary}
              storySequenceMode={wlsTemplateProductMode}
              sequenceMarketingEntityIds={wlsSequenceMarketingEntityIds}
              activeMarketingEntityId={activeMarketingEntityId}
              onRefresh={() => void loadWlsEligibleProducts()}
              onNavigateToFrame={navigateWlsProductFrame}
              onAddToSequence={(row) => void addWlsProductToSequence(row)}
              onAddToMedia={(row) => void addWlsProductToMedia(row)}
              onRemoveFromSequence={removeWlsProductFromSequence}
              onReplaceActiveFrame={(row) => void replaceActiveWlsFrame(row)}
              disabled={wlsStripBusy || rehydrating}
            />
          ) : null
        }
        preview={
          <MultiPlatformSimulator
            lockedViewport
            compact
            fluidViewport
            content={simulatorContent}
            activeMedia={activeMedia}
            carouselMedia={mediaAssets}
            onSlideIndexChange={(index) => {
              const asset = mediaAssets[index]
              if (asset) onSelectStudioMedia(asset)
            }}
            platform={simPlatform}
            onPlatformChange={(platform) => {
              setSimPlatform(platform)
              if (platform === "ig_story") setCreativeSurface("story")
              else if (platform === "ig_feed" || platform === "facebook") {
                setCreativeSurface("feed")
              }
            }}
            industry={activeEntity.industry}
            visualPresets={activeEntity.brand_identity.visual_presets ?? null}
            textOverlay={textOverlay}
            onTextOverlayChange={setTextOverlay}
            textOverlayInteractive={
              workbenchStep === WORKBENCH_STEP_CANVAS &&
              !hasUsableFrameTemplate(frameTemplate)
            }
            storyPreview={storyPreview}
            onStoryPreviewChange={setStoryPreview}
            // Story tools live on Canvas — the under-phone dock on Intent/Copy
            // shrank the preview and made Words/Tags vanish (0-height overlay).
            hideStylingDock
            externalCutoutRequestId={cutoutRequestId}
            onCutoutBusyChange={setCutoutBusy}
            showTextStyler={false}
            showCreativeControls={false}
            showActionDock={workbenchStep === WORKBENCH_STEP_CHANNELS}
            hidePlatformSwitcher
            frameTemplate={frameTemplate}
            frameEntityId={activeEntity.id}
            frameImageFills={frameImageFills}
            frameTextFills={frameTextFills}
            frameInteractive={
              workbenchStep === WORKBENCH_STEP_MEDIA ||
              workbenchStep === WORKBENCH_STEP_CANVAS
            }
            onFrameImageFill={(slotId, url) =>
              setFrameImageFills((prev) => ({ ...prev, [slotId]: url }))
            }
            onFrameTextFill={(slotId, text) =>
              setFrameTextFills((prev) => ({ ...prev, [slotId]: text }))
            }
            actionContext={{
              entityId: activeEntity.id,
              marketingEntityId:
                mediaAssets.find((row) => row.id === activeMediaId)
                  ?.marketingEntityId ??
                mediaAssets[0]?.marketingEntityId ??
                null,
              destinationUrl:
                mediaAssets.find((row) => row.id === activeMediaId)
                  ?.destinationUrl ??
                mediaAssets[0]?.destinationUrl ??
                null,
            }}
          />
        }
        controls={
          <div className="flex min-h-0 w-full flex-col gap-2">
            {workbenchStep === WORKBENCH_STEP_COPY ? (
              <StudioStepSummary
                title="Make"
                summary={canvasStepSummary}
                onEdit={() => setWorkbenchStep(WORKBENCH_STEP_CANVAS)}
              />
            ) : null}
            <div className="flex min-h-0 w-full flex-col pb-1">
        {workbenchStep === WORKBENCH_STEP_MEDIA ? (
          <StepMedia
            entityId={activeEntity.id}
            templatePickerSlot={
              <StudioTemplatePicker
                entityId={activeEntity.id}
                selectedTemplateId={templateInstanceId}
                selectedTemplateName={templateDisplayName}
                busy={templateHandoffBusy}
                disabled={multiplexing || pending || rehydrating}
                onSelectTemplate={(id) => selectStudioTemplate(id)}
                onClearTemplate={clearStudioTemplate}
              />
            }
            suggestionsSlot={
              isFashionBrand ? null : (
                <NewArrivalSuggestions
                  entityId={activeEntity.id}
                  brandName={activeEntity.name}
                  industry={activeEntity.industry}
                  isFashion={isFashionBrand}
                  onUse={applyNewArrival}
                  disabled={multiplexing || pending || rehydrating}
                />
              )
            }
            assets={mediaAssets}
            activeId={activeMediaId}
            onAssetsChange={onMediaAssetsChange}
            onSelectMedia={onSelectStudioMedia}
            brandName={activeEntity.name}
            industry={activeEntity.industry}
            onIntakeAssetsAdded={(added) => applyIntakeFromTray(added)}
            onVisualInspect={onVisualInspect}
            onFinishedRender={onStudioFinishedRender}
            onOpenMediaLibrary={() => setMediaLibraryOpen(true)}
            disabled={multiplexing || pending || rehydrating}
            visualDescription={visualInspection?.visualDescription ?? null}
          />
        ) : null}

        {workbenchStep === WORKBENCH_STEP_INTENT
          ? renderCustomizePhase("intent")
          : null}
        {workbenchStep === WORKBENCH_STEP_CANVAS
          ? renderCustomizePhase("canvas")
          : null}
        {workbenchStep === WORKBENCH_STEP_COPY
          ? renderCustomizePhase("post")
          : null}

        {workbenchStep === WORKBENCH_STEP_CHANNELS ? (
          // With Fine-tune open, the channel list and editor stack and scroll
          // together instead of being squeezed into one fixed-height column.
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col gap-3",
              packEditorOpen && "overflow-y-auto"
            )}
          >
            {!showStudio ? (
              <section className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto rounded-lg border border-neutral-200/80 bg-white p-3 shadow-sm md:p-4">
                <FormulaBankPanel
                  entity={activeEntity}
                  spark={rawSpark}
                  hookId={formulaHookId}
                  visualId={formulaVisualId}
                  ctaId={formulaCtaId}
                  onHookIdChange={setFormulaHookId}
                  onVisualIdChange={setFormulaVisualId}
                  onCtaIdChange={setFormulaCtaId}
                  slots={formulaSlots}
                  onSlotsChange={setFormulaSlots}
                />
                <div className="grid gap-3 border-t border-neutral-100 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <p className="text-[12px] font-medium tracking-[0.16em] text-mad-vermillion uppercase">
                      Generate pack
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      Formula render ($0) or full AI when you need a custom pass.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={renderFormulaPack}
                      disabled={
                        pending || rehydrating || rawSpark.trim().length < 8
                      }
                      className="border-2 border-mad-black bg-mad-lime px-4 py-3 font-typewriter text-sm font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm transition-all hover:bg-mad-black hover:text-mad-white disabled:opacity-60"
                    >
                      Render formula pack ($0)
                    </button>
                    {rawSpark.trim().length < 8 ? (
                      <p className="text-xs text-neutral-600">
                        Needs a caption first.{" "}
                        <button
                          type="button"
                          onClick={() => setWorkbenchStep(WORKBENCH_STEP_COPY)}
                          className="font-semibold text-mad-black underline underline-offset-2 hover:text-mad-vermillion"
                        >
                          Go to Copy
                        </button>
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={activateMultiplexer}
                      disabled={multiplexing || pending || rehydrating}
                      className="border-2 border-mad-black bg-mad-black px-4 py-3 font-typewriter text-sm font-bold tracking-widest text-mad-white uppercase shadow-keycap-sm transition-all hover:bg-mad-vermillion disabled:opacity-60"
                    >
                      {multiplexing ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          Generating…
                        </span>
                      ) : (
                        "Generate with AI"
                      )}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {showStudio && pack && dispatchPlan ? (
              <MultiChannelScheduler
                className={
                  packEditorOpen
                    ? "flex-none"
                    : "flex h-full min-h-0 flex-1 flex-col"
                }
                plan={dispatchPlan}
                onPlanChange={setDispatchPlan}
                onSaveDraft={() => runSave("draft")}
                onArm={() => void openReview()}
                saving={pending && !arming}
                arming={arming}
                hideFooterActions
                wizardLayout
                topBanner={
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-mad-black/15 pb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-typewriter text-xs font-bold tracking-widest text-mad-vermillion uppercase">
                        Pack ready
                        {campaignId ? (
                          <span className="ml-2 font-mono font-normal text-neutral-500">
                            · {campaignId.slice(0, 8)}
                          </span>
                        ) : null}
                      </p>
                      <h2 className="line-clamp-2 font-typewriter text-base font-bold leading-snug tracking-typewriter-tight text-mad-black uppercase md:text-lg">
                        {pack.campaign_title}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPackEditorOpen((open) => !open)}
                        className={cn(
                          "inline-flex items-center gap-1 border-2 border-mad-black px-2.5 py-2 font-typewriter text-xs font-bold tracking-widest uppercase",
                          packEditorOpen
                            ? "bg-mad-lime text-mad-black"
                            : "bg-mad-white text-mad-black hover:bg-mad-lime/50"
                        )}
                      >
                        Edit words
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform",
                            packEditorOpen && "rotate-180"
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={startNewPack}
                        className="border-2 border-mad-black bg-mad-white px-2.5 py-2 font-typewriter text-xs font-bold tracking-widest text-mad-black uppercase hover:bg-mad-lime"
                      >
                        Start New Pack
                      </button>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-auto rounded-none px-1 py-2 font-typewriter text-xs uppercase"
                      >
                        <Link
                          href={`/campaigns?eid=${encodeURIComponent(activeEntity.id)}`}
                        >
                          Ledger →
                        </Link>
                      </Button>
                    </div>
                  </div>
                }
              />
            ) : null}

            {showStudio && pack && packEditorOpen ? (
              <PackResultsEditor
                key={editorSession}
                hidePreview
                pack={pack}
                campaignId={campaignId}
                brandName={activeEntity.name}
                entityId={activeEntity.id}
                eventDescription={rawSpark.trim()}
                targetGoal={packTargetGoal}
                targetSegment={resolvedPersona?.name ?? null}
                mediaUrl={studioMediaUrl}
                mediaAssets={mediaAssets}
                activeMedia={activeMedia}
                intent={intent}
                industry={activeEntity.industry}
                visualPresets={
                  activeEntity.brand_identity.visual_presets ?? null
                }
                redirectSlugSeed={liveRedirectSlugSeed}
                onPackChange={onPackChange}
                onCampaignIdChange={onCampaignIdChange}
                onMediaAssetsChange={onMediaAssetsChange}
                onActiveMediaIdChange={setActiveMediaId}
              />
            ) : null}
          </div>
        ) : null}
            </div>
          </div>
        }
      />

      {pack &&
      (apiImageUrl ||
        mediaAssets.some((row) =>
          /^https?:\/\//i.test(row.publicUrl || row.url)
        )) &&
      dispatchPlan ? (
        <ReviewBeforeSchedule
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          entityId={activeEntity.id}
          brandName={activeEntity.name}
          pack={pack}
          slots={dispatchPlan.filter((slot) => slot.enabled)}
          photoUrl={
            frameComposedUrl ||
            apiImageUrl ||
            mediaAssets
              .map((row) => row.publicUrl || row.url)
              .find((url) => /^https?:\/\//i.test(url)) ||
            ""
          }
          textOverlay={
            frameComposedUrl
              ? DEFAULT_CANVAS_TEXT_OVERLAY
              : textOverlay
          }
          storyPreview={storyPreview}
          useStoryCard={
            !frameComposedUrl &&
            !isFudi &&
            storyPreview.cutoutMode !== "original"
          }
          storyHeadline={simulatorContent.headline}
          visualPresets={resolveVisualPresets({
            brandName: activeEntity.name,
            industry: activeEntity.industry,
            brandIdentity: activeEntity.brand_identity,
          })}
          slugSeed={liveRedirectSlugSeed}
          carouselSlides={
            frameComposedUrl
              ? []
              : imageAssets
                  .map((asset) => ({
                    // Match how the selected photo's URL is chosen (apiImageUrl).
                    url: /^https?:\/\//i.test(asset.url)
                      ? asset.url
                      : (asset.publicUrl ?? ""),
                    overlay:
                      asset.id === activeMediaId
                        ? textOverlay
                        : overlayForAsset(asset.id),
                  }))
                  .filter((slide) => /^https?:\/\//i.test(slide.url))
          }
          onDropChannel={dropChannel}
          onConfirm={(mediaByChannel, carouselUrls, storyUrls) =>
            onArmPack(mediaByChannel, carouselUrls, storyUrls)
          }
          confirming={arming || frameBaking}
        />
      ) : null}

      <MediaLibraryDrawer
        entityId={activeEntity.id}
        brandName={activeEntity.name}
        industry={activeEntity.industry}
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        onBuildCarousel={mountMediaLibraryCarousel}
      />
    </div>
  )
}

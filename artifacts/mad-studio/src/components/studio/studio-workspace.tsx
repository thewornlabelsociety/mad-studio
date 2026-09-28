"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Link } from "wouter"
import { useRouter, useSearchParams } from "@/lib/next-compat"
import { Loader2, Radio, Save } from "lucide-react"
import { toast } from "sonner"

import {
  dispatchCampaignPack,
  getLatestStudioDraft,
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
import { IntentMatrix } from "@/components/studio/intent-matrix"
import { PackResultsEditor } from "@/components/studio/pack-results-editor"
import {
  StepDock,
  StepStepper,
  type WorkbenchStepId,
} from "@/components/studio/step-stepper"
import {
  MediaTray,
  mediaAssetsFromImageUrls,
  resolveActiveMedia,
  type MediaAsset,
} from "@/components/marketing/media-tray"
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
  buildStudioHookChips,
  resolveStudioPresets,
  type StudioIntentChip,
} from "@/lib/studio/entity-presets"
import {
  applyFudiTrackToStudioPresets,
  buildFudiRedirectSlugSeed,
  buildFudiTrackHookChips,
  isFudiStudioEntity,
  resolveFudiTrackPresets,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"
import { cn } from "@/lib/utils"
import type { AccessibleEntity } from "@/lib/types"

const RAW_SPARK_MAX = 500

type StudioWorkspaceProps = {
  entities: AccessibleEntity[]
  activeEntity: StudioEntityDna
}

export function StudioWorkspace({
  entities,
  activeEntity,
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
  const [objective, setObjective] = useState(objectives[0] ?? "")
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "")
  const [rawSpark, setRawSpark] = useState("")
  const [activeHookId, setActiveHookId] = useState<string | null>(null)
  const [redirectSlugSeed, setRedirectSlugSeed] = useState<string | null>(null)
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([])
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null)
  const [attachedImageUrl, setAttachedImageUrl] = useState<string | null>(null)
  const [visualInspection, setVisualInspection] =
    useState<MediaVisualInspection | null>(null)
  const [pack, setPack] = useState<CampaignPack | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [editorSession, setEditorSession] = useState(0)
  const [multiplexing, setMultiplexing] = useState(false)
  const [rehydrating, setRehydrating] = useState(true)
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  const [systemError, setSystemError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [workbenchStep, setWorkbenchStep] = useState<WorkbenchStepId>(1)
  // Client-only so Brain slots use the viewer's timezone (packs hydrate after mount).
  const [dispatchPlan, setDispatchPlan] = useState<ChannelSlot[] | null>(() =>
    typeof window === "undefined" ? null : hydrateDispatchPlan({})
  )
  const [arming, setArming] = useState(false)
  const skipIntentObjectiveSync = useRef(false)
  const hydrateToken = useRef(0)

  const preview = useMemo(
    () => (pack ? packToStudioPreview(pack, campaignId) : null),
    [pack, campaignId]
  )

  const selectedPersona =
    personas.find((persona) => persona.id === personaId) ?? personas[0] ?? null

  function applyFudiTrack(nextTrack: FudiAudienceTrack) {
    setFudiTrack(nextTrack)
    const trackPresets = resolveFudiTrackPresets(nextTrack)
    const nextChips = trackPresets.intentChips
    const nextIntent = nextChips[0]
    skipIntentObjectiveSync.current = true
    setIntentChipId(nextIntent?.id ?? "friday_rush")
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
  }

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
    if (showStudio && workbenchStep < 3) setWorkbenchStep(3)
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
    }) => {
      writeActiveMultiplexerBuffer({
        packId: input.packId,
        entityId: activeEntity.id,
        pack: input.pack,
        mediaUrl: input.mediaUrl,
        eventDescription: input.eventDescription,
        intent: input.intent,
        objective: input.objective,
        personaName: input.personaName,
        fudiTrack: input.fudiTrack ?? null,
        savedAt: new Date().toISOString(),
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
      syncMediaFromUrl(snapshot.mediaUrl)
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
      })

      if (options?.syncUrl !== false) {
        syncPackUrl(snapshot.campaignId)
      }
    },
    [personas, studioPresets, syncPackUrl, writeLocalBuffer]
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

      const packIdFromUrl = searchParams.get("pack_id")?.trim() || null
      const local = readActiveMultiplexerBuffer(activeEntity.id)

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

        const latest = await getLatestStudioDraft({
          entityId: activeEntity.id,
        })
        if (cancelled || hydrateToken.current !== token) return

        if (latest.ok && latest.snapshot) {
          const preferLocal =
            local &&
            local.packId === latest.snapshot.campaignId &&
            local.savedAt > latest.snapshot.updatedAt

          if (preferLocal) {
            skipIntentObjectiveSync.current = true
            setPack(local.pack)
            setCampaignId(local.packId)
            syncMediaFromUrl(local.mediaUrl)
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
                buildFudiRedirectSlugSeed(
                  local.fudiTrack,
                  local.eventDescription
                )
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

          applySnapshot(latest.snapshot, { markRestored: true })
          return
        }

        if (local) {
          if (cancelled || hydrateToken.current !== token) return
          skipIntentObjectiveSync.current = true
          setPack(local.pack)
          setCampaignId(local.packId)
          syncMediaFromUrl(local.mediaUrl)
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

  // Brand Director "Send to Studio" handoff — seed the spark from URL/sessionStorage.
  useEffect(() => {
    if (rehydrating) return

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

  async function activateMultiplexer() {
    setSystemError(null)
    const spark = rawSpark.trim()

    if (spark.length < 8) {
      setSystemError("RAW SPARK TOO SHORT. Give the multiplexer a real event.")
      return
    }
    if (!objective) {
      setSystemError("OBJECTIVE REQUIRED. Select a target from the Intent Matrix.")
      return
    }
    if (!selectedPersona) {
      setSystemError("PERSONA REQUIRED. Add audience DNA in Brain Lab first.")
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
          targetGoal: objective,
          personaName: selectedPersona.name,
          intent,
          attachedImageUrl: apiImageUrl,
          fudiTrack: isFudi ? fudiTrack : null,
          visualDescription: visualInspection?.visualDescription ?? null,
          concreteFeatures: visualInspection?.concreteFeatures ?? null,
          aestheticTags: visualInspection?.aestheticTags ?? null,
        }),
      })
      const payload = (await response.json()) as {
        pack?: CampaignPack
        preview?: CampaignPackOutputView
        campaignId?: string | null
        attachedImageUrl?: string | null
        redirectSlugSeed?: string | null
        fudiTrack?: FudiAudienceTrack | null
        error?: string
      }

      if (!response.ok || !payload.pack) {
        throw new Error(payload.error ?? "SYSTEM HALTED. Multiplexer failed.")
      }

      const nextCampaignId =
        payload.campaignId ?? payload.preview?.id ?? null
      const nextMedia = payload.attachedImageUrl ?? attachedImageUrl
      const nextSlugSeed =
        payload.redirectSlugSeed ??
        (isFudi ? buildFudiRedirectSlugSeed(fudiTrack, spark) : null)

      setPack(payload.pack)
      setCampaignId(nextCampaignId)
      setRedirectSlugSeed(nextSlugSeed)
      if (payload.attachedImageUrl) {
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
          objective,
          personaName: selectedPersona.name,
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
    if (!pack) { toast.error("Generate or select your pack copy in Step 2 before arming."); return; }
    startTransition(async () => {
      const result = await saveCampaign({
        entityId: activeEntity.id,
        eventDescription: rawSpark.trim(),
        targetGoal: objective,
        targetSegment: selectedPersona?.name ?? null,
        pack,
        status,
        mediaUrl: apiImageUrl,
        campaignId,
        intent,
        fudiTrack: isFudi ? fudiTrack : null,
      })
      if (!result.ok) {
        setSystemError(result.error)
        toast.error(result.error)
        return
      }
      setCampaignId(result.campaignId)
      if (status === "draft") {
        await disarmCampaignQueue({
          entityId: activeEntity.id,
          campaignId: result.campaignId,
        })
      }
      writeLocalBuffer({
        packId: result.campaignId,
        pack,
        mediaUrl: studioMediaUrl,
        eventDescription: rawSpark.trim(),
        intent,
        objective,
        personaName: selectedPersona?.name ?? null,
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
        targetGoal: objective,
        targetSegment: selectedPersona?.name ?? null,
        pack,
        status: "published",
        mediaUrl: apiImageUrl,
        campaignId,
        intent,
        fudiTrack: isFudi ? fudiTrack : null,
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

  function onArmPack() {
    if (!pack) { toast.error("Generate or select your pack copy in Step 2 before arming."); return; }
    const slots = (dispatchPlan ?? []).filter((slot) => slot.enabled)
    if (slots.length === 0) {
      toast.message("Tick at least one channel to arm.")
      return
    }
    if (!apiImageUrl) {
      toast.error(
        "Arming needs a public https image — add or finish uploading media in step 1."
      )
      return
    }

    setArming(true)
    startTransition(async () => {
      const saved = await saveCampaign({
        entityId: activeEntity.id,
        eventDescription: rawSpark.trim(),
        targetGoal: objective,
        targetSegment: selectedPersona?.name ?? null,
        pack,
        status: "draft",
        mediaUrl: apiImageUrl,
        campaignId,
        intent,
        fudiTrack: isFudi ? fudiTrack : null,
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
    setWorkbenchStep(1)
    syncPackUrl(null)
  }

  function onStudioBack() {
    setWorkbenchStep((current) =>
      current > 1 ? ((current - 1) as WorkbenchStepId) : current
    )
  }

  function onStudioNext() {
    if (workbenchStep === 1) {
      setWorkbenchStep(2)
      return
    }
    if (workbenchStep === 2) {
      if (rawSpark.trim().length < 8) {
        toast.message("Add a short spark (at least 8 characters) before dispatch.")
        return
      }
      setWorkbenchStep(3)
      return
    }
    if (showStudio) {
      onArmPack()
      return
    }
    void activateMultiplexer()
  }

  function onPackChange(next: CampaignPack) {
    setPack(next)
    setRestoredAt(null)
  }

  function onCampaignIdChange(nextId: string) {
    setCampaignId(nextId)
    syncPackUrl(nextId)
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm">
        <div className="min-w-0">
          <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Active brand
          </p>
          <p className="brand-typewriter truncate text-[0.75rem] text-mad-black">
            {activeEntity.name}
          </p>
        </div>
        <Select value={activeEntity.id} onValueChange={onBrandChange}>
          <SelectTrigger className="w-[14rem] rounded-none border-2 border-mad-black font-typewriter text-xs uppercase shadow-keycap-sm">
            <SelectValue placeholder="Switch brand" />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2 border-mad-black">
            {entities.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>
                {entity.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <StepStepper step={workbenchStep} onStepChange={setWorkbenchStep} />

      {restoredAt && pack ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-mad-black bg-mad-lime/50 px-4 py-2.5 shadow-keycap-sm">
          <p className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase">
            Draft restored from {formatDraftRestoredAt(restoredAt)}
          </p>
          <button
            type="button"
            onClick={startNewPack}
            className="border-2 border-mad-black bg-mad-white px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm hover:bg-mad-black hover:text-mad-white"
          >
            Start New Pack
          </button>
        </div>
      ) : null}

      {rehydrating ? (
        <div className="inline-flex items-center gap-2 font-typewriter text-[0.65rem] font-bold tracking-widest text-neutral-500 uppercase">
          <Loader2 className="size-3.5 animate-spin" />
          Restoring draft…
        </div>
      ) : null}

      {systemError ? (
        <div
          className="border-2 border-mad-black bg-mad-vermillion px-4 py-3 text-sm font-bold text-mad-white shadow-keycap"
          role="alert"
        >
          {systemError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {workbenchStep === 1 ? (
          <section className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap lg:col-span-3">
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Step 1 · Media & Cutout
            </p>
            <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              Photos, Reels & cutout
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Attach the visual drop first — cutout isolation lands on the phone
              after you generate.
            </p>
            <div className="mt-4">
              <MediaTray
                entityId={activeEntity.id}
                assets={mediaAssets}
                activeId={activeMediaId}
                onAssetsChange={onMediaAssetsChange}
                onSelectMedia={onSelectStudioMedia}
                onVisualInspect={onVisualInspect}
                disabled={multiplexing || pending || rehydrating}
              />
              {visualInspection?.visualDescription ? (
                <p className="mt-3 border-2 border-mad-black bg-mad-lime/40 px-3 py-2 text-xs leading-relaxed text-mad-black">
                  <span className="font-typewriter text-[0.55rem] font-bold tracking-widest uppercase">
                    Vision ·{" "}
                  </span>
                  {visualInspection.visualDescription}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {workbenchStep === 2 ? (
          <>
            <section className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap">
              <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
                Step 2 · Intent
              </p>
              <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
                Brand category & goal
              </h2>

              <div className="mt-4">
                <IntentMatrix
                  showFudiTracks={isFudi}
                  fudiTrack={fudiTrack}
                  onFudiTrackChange={applyFudiTrack}
                  intentChips={studioPresets.intentChips}
                  intentChipId={intentChipId}
                  onIntentChipSelect={onIntentChipSelect}
                  outputFormats={fudiTrackPresets?.outputFormats}
                />
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-1.5">
                  <label className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
                    Objective
                  </label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger className="w-full rounded-none border-2 border-mad-black text-sm shadow-keycap-sm">
                      <SelectValue placeholder="Select objective" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-2 border-mad-black">
                      {objectives.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <label className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
                    Audience Persona
                  </label>
                  <Select
                    value={personaId || "__none__"}
                    onValueChange={(value) =>
                      setPersonaId(value === "__none__" ? "" : value)
                    }
                  >
                    <SelectTrigger className="w-full rounded-none border-2 border-mad-black text-sm shadow-keycap-sm">
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-2 border-mad-black">
                      {personas.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No personas in Brain DNA
                        </SelectItem>
                      ) : (
                        personas.map((persona) => (
                          <SelectItem key={persona.id} value={persona.id}>
                            {persona.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedPersona ? (
                    <p className="text-xs leading-relaxed text-neutral-600">
                      {selectedPersona.desires}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap lg:col-span-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
                    Step 2 · Vibe & Copy
                  </p>
                  <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
                    Trigger spark
                  </h2>
                </div>
                <span
                  className={cn(
                    "font-typewriter text-[0.6rem] font-bold tracking-wider",
                    sparkLength > RAW_SPARK_MAX
                      ? "text-mad-vermillion"
                      : "text-neutral-500"
                  )}
                >
                  {sparkLength}/{RAW_SPARK_MAX}
                </span>
              </div>

              <textarea
                value={rawSpark}
                maxLength={RAW_SPARK_MAX}
                onChange={(event) => setRawSpark(event.target.value)}
                rows={10}
                placeholder={studioPresets.sparkPlaceholder}
                className="mt-4 min-h-[12rem] w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed text-mad-black outline-none placeholder:text-neutral-400"
              />
              {visualInspection ? (
                <p className="mt-2 inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-lime px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm">
                  👁 Visual details extracted from media
                </p>
              ) : null}

              <div className="mt-4 space-y-2 border-t-2 border-mad-black pt-4">
                <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
                  Context-aware hooks
                </p>
                <div className="grid gap-2">
                  {hookChips.map((hook) => {
                    const active = activeHookId === hook.id
                    return (
                      <button
                        key={hook.id}
                        type="button"
                        onClick={() => {
                          setActiveHookId(hook.id)
                          setRawSpark(hook.hook.slice(0, RAW_SPARK_MAX))
                        }}
                        className={cn(
                          "border-2 border-mad-black px-3 py-2.5 text-left transition",
                          active
                            ? "bg-mad-black text-mad-white shadow-keycap-sm"
                            : "bg-mad-white hover:bg-mad-lime"
                        )}
                      >
                        <span
                          className={cn(
                            "block font-typewriter text-[0.55rem] font-bold tracking-widest uppercase",
                            active ? "text-mad-vermillion" : "text-mad-vermillion"
                          )}
                        >
                          {hook.label}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug">
                          {hook.hook}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {workbenchStep === 3 ? (
          <section className="border-2 border-mad-black bg-mad-white shadow-keycap lg:col-span-3">
            {!showStudio ? (
              <div className="flex min-h-[16rem] flex-col justify-between p-5 sm:flex-row sm:items-end sm:gap-8">
                <div className="max-w-xl">
                  <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
                    Step 3 · Dispatch
                  </p>
                  <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-base">
                    Generate campaign pack
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                    Synthesize brand DNA, intent, persona, and spark into five
                    ready-to-edit assets — then publish or schedule.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={activateMultiplexer}
                  disabled={multiplexing || pending || rehydrating}
                  className="mt-6 w-full shrink-0 border-2 border-mad-black bg-mad-black px-6 py-5 font-typewriter text-sm font-bold tracking-widest text-mad-white uppercase shadow-keycap-lg transition-all hover:bg-mad-vermillion disabled:opacity-60 sm:mt-0 sm:w-auto"
                >
                  {multiplexing ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Generating…
                    </span>
                  ) : (
                    "Generate pack"
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
                    Pack ready
                  </p>
                  <h2 className="mt-1 line-clamp-2 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
                    {pack?.campaign_title}
                  </h2>
                  {campaignId ? (
                    <p className="mt-1 font-mono text-[0.65rem] text-neutral-500">
                      ID {campaignId.slice(0, 8)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none border-2 border-mad-black shadow-keycap-sm"
                    disabled={pending}
                    onClick={() => runSave("draft")}
                  >
                    <Save data-icon="inline-start" />
                    Save Pack
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-none border-2 border-mad-black bg-mad-black text-mad-white shadow-keycap-sm hover:bg-mad-vermillion"
                    disabled={pending}
                    onClick={runDispatch}
                  >
                    {pending ? (
                      <Loader2 className="animate-spin" data-icon="inline-start" />
                    ) : (
                      <Radio data-icon="inline-start" />
                    )}
                    Dispatch
                  </Button>
                  <button
                    type="button"
                    onClick={startNewPack}
                    className="border-2 border-mad-black bg-mad-white px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm hover:bg-mad-lime"
                  >
                    Start New Pack
                  </button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="rounded-none font-typewriter text-[0.65rem] uppercase"
                  >
                    <Link
                      href={`/campaigns?eid=${encodeURIComponent(activeEntity.id)}`}
                    >
                      Ledger →
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {showStudio && pack && workbenchStep === 3 && dispatchPlan ? (
        <MultiChannelScheduler
          plan={dispatchPlan}
          onPlanChange={setDispatchPlan}
          onSaveDraft={() => runSave("draft")}
          onArm={onArmPack}
          saving={pending && !arming}
          arming={arming}
        />
      ) : null}

      {showStudio && pack && workbenchStep === 3 ? (
        <PackResultsEditor
          key={editorSession}
          pack={pack}
          campaignId={campaignId}
          brandName={activeEntity.name}
          entityId={activeEntity.id}
          eventDescription={rawSpark.trim()}
          targetGoal={objective}
          targetSegment={selectedPersona?.name ?? null}
          mediaUrl={studioMediaUrl}
          activeMedia={activeMedia}
          intent={intent}
          industry={activeEntity.industry}
          visualPresets={activeEntity.brand_identity.visual_presets ?? null}
          fudiTrack={isFudi ? fudiTrack : null}
          redirectSlugSeed={liveRedirectSlugSeed}
          onPackChange={onPackChange}
          onCampaignIdChange={onCampaignIdChange}
        />
      ) : null}

      <StepDock
        step={workbenchStep}
        onBack={onStudioBack}
        onNext={onStudioNext}
        nextBusy={multiplexing || pending}
        nextLabel={
          workbenchStep === 3
            ? showStudio
              ? "Confirm & Arm"
              : "Generate pack"
            : undefined
        }
        nextDisabled={workbenchStep === 2 && rawSpark.trim().length < 8}
        className="fixed inset-x-0 bottom-0 z-40"
      />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "wouter"
import { toPng } from "html-to-image"
import {
  Copy,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import {
  StoryCanvas,
  storyExportFilter,
} from "@/components/marketing/story-canvas"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import { requestCutout } from "@/lib/media/request-cutout"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import {
  buildWlsDailyStoryCanvasModel,
  isWornLabelFashionEntity,
  WLS_DAILY_STORY_EXPORT,
  WLS_DAILY_STORY_PALETTE,
  WLS_DAILY_STORY_TEMPLATE_NAME,
  assertWlsDailyStoryRenderable,
} from "@/lib/templates/wls-daily-story"
import type { EntityTemplateInstance } from "@/lib/templates/template-schema"
import { buildWlsDailyStoryStudioHandoffHref } from "@/lib/templates/template-handoff"
import {
  WLS_DAILY_STORY_STUDIO_MAX_FRAMES,
} from "@/lib/templates/wls-daily-story-studio-seed"
import { formatWlsNzdPrice } from "@/lib/templates/format-wls-nzd-price"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

type TemplateState = {
  instance: EntityTemplateInstance
  versionId: string | null
  created: boolean
}

export function WlsDailyStoryWorkspace({
  entityId,
  entityName,
  industry = null,
  brandIdentity = null,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [template, setTemplate] = useState<TemplateState | null>(null)
  const [eligible, setEligible] = useState<WlsProductSelection[]>([])
  const [excludedCount, setExcludedCount] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [studioPickIds, setStudioPickIds] = useState<string[]>([])
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null)
  const [useCutout, setUseCutout] = useState(false)
  const [subjectScale, setSubjectScale] = useState(1)
  const [subjectOffsetY, setSubjectOffsetY] = useState(0)
  const [showLogo, setShowLogo] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastRenderedUrl, setLastRenderedUrl] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const isWls = isWornLabelFashionEntity({ name: entityName, industry })

  const visualPresets = useMemo(() => {
    const resolved = resolveVisualPresets({
      brandName: entityName,
      industry,
      brandIdentity: brandIdentity as never,
    })
    return {
      ...resolved,
      canvas_color: resolved.canvas_color || WLS_DAILY_STORY_PALETTE.canvas,
      text_color: resolved.text_color || WLS_DAILY_STORY_PALETTE.ink,
      accent_color: resolved.accent_color || WLS_DAILY_STORY_PALETTE.accent,
      palette:
        resolved.palette?.length > 0
          ? resolved.palette
          : [
              WLS_DAILY_STORY_PALETTE.accent,
              WLS_DAILY_STORY_PALETTE.canvas,
              WLS_DAILY_STORY_PALETTE.ink,
              "#FFFFFF",
            ],
    }
  }, [entityName, industry, brandIdentity])

  const selected = eligible.find((row) => row.marketingEntityId === selectedId) ?? null

  function toggleStudioPick(marketingEntityId: string) {
    setStudioPickIds((current) => {
      if (current.includes(marketingEntityId)) {
        return current.filter((id) => id !== marketingEntityId)
      }
      if (current.length >= WLS_DAILY_STORY_STUDIO_MAX_FRAMES) {
        toast.error(
          `Select up to ${WLS_DAILY_STORY_STUDIO_MAX_FRAMES} products for one Story sequence.`
        )
        return current
      }
      return [...current, marketingEntityId]
    })
  }

  const studioHandoffHref =
    template && studioPickIds.length > 0
      ? buildWlsDailyStoryStudioHandoffHref({
          entityId,
          templateInstanceId: template.instance.id,
          marketingEntityIds: studioPickIds,
          templateVersion: template.instance.version,
          formulaHookId: template.instance.formula_hook_id ?? null,
        })
      : null

  const sourceImage = selected?.sourceImageUrls.find((url) =>
    /^https?:\/\//i.test(url)
  ) ?? null

  const displayImage =
    useCutout && cutoutUrl ? cutoutUrl : sourceImage

  const model = useMemo(() => {
    if (!selected || !displayImage) return null
    return buildWlsDailyStoryCanvasModel({
      selection: selected,
      brandName: entityName,
      imageUrl: proxiedImageUrl(displayImage, entityId),
    })
  }, [selected, displayImage, entityName, entityId])

  const presetsForCanvas = useMemo(
    () => ({
      ...visualPresets,
      logo_url: visualPresets.logo_url
        ? proxiedImageUrl(visualPresets.logo_url, entityId)
        : undefined,
      canvas_color: WLS_DAILY_STORY_PALETTE.canvas,
      text_color: WLS_DAILY_STORY_PALETTE.ink,
    }),
    [visualPresets, entityId]
  )

  const loadEligible = useCallback(async () => {
    setBusy("eligible")
    setFailure(null)
    try {
      const res = await fetch(
        `/api/templates/wls-daily-story/eligible?entityId=${encodeURIComponent(entityId)}`,
        { credentials: "same-origin" }
      )
      const data = (await res.json().catch(() => ({}))) as {
        eligible?: WlsProductSelection[]
        excluded?: unknown[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Could not load products.")
      const list = data.eligible ?? []
      setEligible(list)
      setExcludedCount(Array.isArray(data.excluded) ? data.excluded.length : 0)
      setSelectedId((current) =>
        current && list.some((row) => row.marketingEntityId === current)
          ? current
          : list[0]?.marketingEntityId ?? null
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Load failed.")
    } finally {
      setBusy(null)
    }
  }, [entityId])

  const ensureTemplate = useCallback(async () => {
    setBusy("ensure")
    setFailure(null)
    try {
      const res = await fetch("/api/templates/wls-daily-story/ensure", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        instance?: EntityTemplateInstance
        latestVersion?: { id?: string } | null
        created?: boolean
        error?: string
        message?: string
      }
      if (!res.ok || !data.instance) {
        throw new Error(data.error || "Could not set up template.")
      }
      setTemplate({
        instance: data.instance,
        versionId: data.latestVersion?.id ?? null,
        created: Boolean(data.created),
      })
      toast.success(data.message || "Template ready.")
      await loadEligible()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed.")
    } finally {
      setBusy(null)
    }
  }, [entityId, loadEligible])

  useEffect(() => {
    if (!isWls) return
    void loadEligible()
  }, [isWls, loadEligible])

  useEffect(() => {
    setCutoutUrl(null)
    setUseCutout(false)
    setLastRenderedUrl(null)
    setFailure(null)
    setSubjectScale(1)
    setSubjectOffsetY(0)
  }, [selectedId])

  async function onCutout() {
    if (!sourceImage || !selected) return
    setBusy("cutout")
    try {
      const url = await requestCutout({
        imageUrl: sourceImage,
        entityId,
      })
      setCutoutUrl(url)
      setUseCutout(true)
      toast.success("Cutout ready — product colours preserved.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Cutout failed — use the original photo or fix manually."
      )
    } finally {
      setBusy(null)
    }
  }

  async function bakePng(): Promise<{ dataUrl: string; blob: Blob }> {
    const node = canvasRef.current
    if (!node) throw new Error("Story canvas is not ready.")
    const dataUrl = await toPng(node, {
      cacheBust: true,
      filter: storyExportFilter,
      pixelRatio: 1080 / Math.max(node.offsetWidth, 1),
      width: node.offsetWidth,
      height: node.offsetHeight,
    })
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    return { dataUrl, blob }
  }

  async function onDownload() {
    if (!selected || !model) return
    const gate = assertWlsDailyStoryRenderable({
      selection: selected,
      entityId,
      brandName: entityName,
      industry,
    })
    if (!gate.ok) {
      setFailure(gate.detail)
      toast.error(gate.detail)
      return
    }
    setBusy("download")
    try {
      const { dataUrl } = await bakePng()
      const anchor = document.createElement("a")
      anchor.href = dataUrl
      anchor.download = `wls-daily-story-${selected.websiteItemId}.png`
      anchor.click()
      toast.success("Downloaded 1080×1920 Story PNG.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.")
    } finally {
      setBusy(null)
    }
  }

  async function onCopyLink() {
    if (!selected?.destinationUrl) {
      toast.error("No product URL for link sticker.")
      return
    }
    try {
      await navigator.clipboard.writeText(selected.destinationUrl)
      toast.success(
        "Product URL copied — paste as Instagram link sticker on your phone. Meta Story API cannot add clickable stickers."
      )
    } catch {
      toast.error("Could not copy URL.")
    }
  }

  async function onSaveDraft() {
    if (!selected || !model || !template || !sourceImage) return
    const gate = assertWlsDailyStoryRenderable({
      selection: selected,
      entityId,
      brandName: entityName,
      industry,
    })
    if (!gate.ok) {
      setFailure(gate.detail)
      toast.error(gate.detail)
      return
    }
    setBusy("save")
    setFailure(null)
    try {
      const { blob } = await bakePng()
      const renderedUrl = await uploadRenderedPng(blob, entityId)
      setLastRenderedUrl(renderedUrl)

      const res = await fetch("/api/templates/wls-daily-story/save-draft", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          marketingEntityId: selected.marketingEntityId,
          templateInstanceId: template.instance.id,
          templateVersionId: template.versionId,
          sourceImageUrl: sourceImage,
          renderedUrl,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        reusedExisting?: boolean
      }
      if (!res.ok) throw new Error(data.error || "Save failed.")
      toast.success(data.message || "Draft saved — approval required.")
      await loadEligible()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed."
      setFailure(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  if (!isWls) {
    return (
      <div className="border-2 border-mad-black bg-white p-6 font-typewriter text-sm">
        Daily New Arrival Story is available only when the active brand resolves
        as Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Checkpoint B · Instagram Story · 1080×1920
          </p>
          <h1 className="brand-typewriter text-xl">{WLS_DAILY_STORY_TEMPLATE_NAME}</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Eligible synced products only. Drafts stay unpublished until you
            approve. Link stickers are phone handoff — not Meta API.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-2 border-mad-black"
            disabled={busy != null}
            onClick={() => void ensureTemplate()}
          >
            {busy === "ensure" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {template ? "Refresh template" : "Set up template"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-2 border-mad-black"
            disabled={busy != null}
            onClick={() => void loadEligible()}
          >
            {busy === "eligible" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Reload products
          </Button>
          <Button asChild variant="outline" className="border-2 border-mad-black">
            <Link href={`/templates?eid=${encodeURIComponent(entityId)}`}>
              Template Centre
            </Link>
          </Button>
        </div>
      </header>

      {template ? (
        <p className="font-typewriter text-[10px] uppercase tracking-wide text-mad-black/55">
          Template {template.created ? "created" : "ready"} ·{" "}
          {template.instance.id.slice(0, 8)}…
          {template.versionId
            ? ` · version ${template.versionId.slice(0, 8)}…`
            : ""}
        </p>
      ) : (
        <p className="border border-dashed border-mad-black/40 bg-[#F4EFE6] px-3 py-2 text-sm">
          Click <strong>Set up template</strong> to register the WLS-owned
          template (idempotent — safe to repeat). Required before saving drafts.
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col items-center gap-3">
          <div
            className="relative w-full max-w-[280px] overflow-hidden border-2 border-mad-black shadow-sm"
            style={{ aspectRatio: "9 / 16" }}
          >
            {model ? (
              <StoryCanvas
                ref={canvasRef}
                model={model}
                stylePreset={WLS_DAILY_STORY_EXPORT.stylePreset}
                format={WLS_DAILY_STORY_EXPORT.format}
                canvasColor={WLS_DAILY_STORY_PALETTE.canvas}
                cutoutMode={useCutout ? "transparent" : "original"}
                visualPresets={presetsForCanvas}
                showLogo={showLogo && Boolean(presetsForCanvas.logo_url)}
                showStickerGuide
                subjectScale={subjectScale}
                subjectOffsetY={subjectOffsetY}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#E8DCC4] p-6 text-center font-typewriter text-xs uppercase">
                Select an eligible product
              </div>
            )}
          </div>

          {failure ? (
            <p className="max-w-md border-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
              {failure}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-2 border-mad-black"
              disabled={!sourceImage || busy != null}
              onClick={() => void onCutout()}
            >
              {busy === "cutout" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Scissors className="mr-2 h-4 w-4" />
              )}
              Cutout
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-2 border-mad-black"
              disabled={!cutoutUrl}
              onClick={() => setUseCutout((v) => !v)}
            >
              {useCutout ? "Use photo" : "Use cutout"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-2 border-mad-black"
              disabled={!model || busy != null}
              onClick={() => void onDownload()}
            >
              <Download className="mr-2 h-4 w-4" />
              Download PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-2 border-mad-black"
              disabled={!selected?.destinationUrl}
              onClick={() => void onCopyLink()}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy product URL
            </Button>
            <Button
              type="button"
              className="border-2 border-mad-black bg-mad-black text-mad-white"
              disabled={!template || !model || busy != null}
              onClick={() => void onSaveDraft()}
            >
              {busy === "save" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save draft
            </Button>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-2 font-typewriter text-[10px] uppercase">
            <label className="flex items-center justify-between gap-3">
              Subject scale
              <input
                type="range"
                min={0.7}
                max={1.25}
                step={0.01}
                value={subjectScale}
                onChange={(event) =>
                  setSubjectScale(Number(event.target.value))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              Vertical nudge
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={subjectOffsetY}
                onChange={(event) =>
                  setSubjectOffsetY(Number(event.target.value))
                }
              />
            </label>
            <label className="flex items-center gap-2 normal-case">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(event) => setShowLogo(event.target.checked)}
              />
              Show Brand Brain logo
            </label>
          </div>

          {lastRenderedUrl ? (
            <p className="max-w-md break-all text-center text-xs text-mad-black/60">
              Last baked creative (separate from source): {lastRenderedUrl}
            </p>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col gap-2 border-2 border-mad-black bg-white p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-typewriter text-xs uppercase tracking-widest">
              Eligible products
            </h2>
            <span className="text-[10px] text-mad-black/50">
              {eligible.length} ready · {excludedCount} excluded
            </span>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {eligible.length === 0 ? (
              <li className="text-sm text-mad-black/60">
                No eligible listings. Pull new arrivals from Library / Today,
                then reload.
              </li>
            ) : (
              eligible.map((row) => {
                const active = row.marketingEntityId === selectedId
                const picked = studioPickIds.includes(row.marketingEntityId)
                const thumb = row.sourceImageUrls[0]
                return (
                  <li key={row.marketingEntityId}>
                    <div
                      className={cn(
                        "flex w-full gap-2 border-2 p-2 transition",
                        active
                          ? "border-mad-black bg-[#F4EFE6]"
                          : "border-mad-black/20"
                      )}
                    >
                      <label className="flex shrink-0 cursor-pointer items-center pt-1">
                        <input
                          type="checkbox"
                          checked={picked}
                          onChange={() => toggleStudioPick(row.marketingEntityId)}
                          className="size-4 border-2 border-mad-black"
                          aria-label={`Include ${row.brand || row.title} in Create Studio sequence`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.marketingEntityId)}
                        className="flex min-w-0 flex-1 gap-2 text-left hover:opacity-90"
                      >
                      <div className="h-14 w-11 shrink-0 overflow-hidden bg-[#E8DCC4]">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={proxiedImageUrl(thumb, entityId)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {row.brand || entityName}
                        </p>
                        <p className="truncate text-xs text-mad-black/70">
                          {row.title}
                        </p>
                        <p className="font-typewriter text-[10px] uppercase text-mad-black/55">
                          {row.size ? `Sz ${row.size} · ` : ""}
                          {formatWlsNzdPrice(row)}
                        </p>
                      </div>
                      </button>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
          {studioHandoffHref ? (
            <Button
              asChild
              className="w-full border-2 border-mad-black bg-mad-black text-mad-white"
            >
              <Link href={studioHandoffHref}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Edit {studioPickIds.length} in Create Studio
              </Link>
            </Button>
          ) : (
            <p className="text-[10px] text-mad-black/50">
              Check up to {WLS_DAILY_STORY_STUDIO_MAX_FRAMES} products, then open
              Create → Make a Post to edit each Story frame.
            </p>
          )}
          {selected ? (
            <div className="border-t border-mad-black/20 pt-2 text-xs text-mad-black/70">
              <p className="font-typewriter text-[10px] uppercase">Handoff</p>
              <p className="mt-1 break-all">{selected.destinationUrl}</p>
              <p className="mt-1 text-[10px] text-mad-black/50">
                ME {selected.marketingEntityId.slice(0, 8)}… · item{" "}
                {selected.websiteItemId}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

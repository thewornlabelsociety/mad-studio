"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "wouter"
import { toPng } from "html-to-image"
import {
  Check,
  Copy,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Scissors,
  Share2,
  Sparkles,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { storyExportFilter } from "@/components/marketing/story-canvas"
import { KitStoryCanvas } from "@/components/templates/kit-story-canvas"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import {
  detectItemTraits,
  pickStoryBackground,
  resolveStoryKit,
  storyTraitLabel,
  type Rgb,
  type StoryBackground,
} from "@/lib/brands/story-kit"
import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import { requestCutout } from "@/lib/media/request-cutout"
import { sampleItemColour } from "@/lib/media/sample-item-colour"
import { formatCanvasSizeTagLabel } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import {
  buildWlsDailyStoryCanvasModel,
  isWornLabelFashionEntity,
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

type ItemEdits = {
  vibe?: string
  backgroundId?: string
  subjectScale?: number
  subjectOffsetY?: number
  useCutout?: boolean
}

function itemText(row: WlsProductSelection): string {
  return [row.title, row.brand, row.description].filter(Boolean).join(" ")
}

/** The shop's vibe label, else a short form of the title. */
function defaultVibe(row: WlsProductSelection): string {
  const vibe = row.vibe?.trim()
  if (vibe) return vibe
  const brand = row.brand?.trim()
  const withoutBrand = (
    brand
      ? row.title.replace(
          new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
          " "
        )
      : row.title
  )
    .replace(/\b(in|by|from|with|size|sz)\b.*$/i, " ")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  return withoutBrand.split(" ").slice(0, 3).join(" ") || "New in"
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
  const [cutouts, setCutouts] = useState<Record<string, string>>({})
  const [cutoutFailed, setCutoutFailed] = useState<Record<string, true>>({})
  const [colours, setColours] = useState<Record<string, Rgb | null>>({})
  const [edits, setEdits] = useState<Record<string, ItemEdits>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const isWls = isWornLabelFashionEntity({ name: entityName, industry })

  const kit = useMemo(() => {
    const presets = resolveVisualPresets({
      brandName: entityName,
      industry,
      brandIdentity: brandIdentity as never,
    })
    return resolveStoryKit({ presets, isWornLabel: isWls })
  }, [entityName, industry, brandIdentity, isWls])

  const selected = eligible.find((row) => row.marketingEntityId === selectedId) ?? null
  const selectedEdits = (selectedId && edits[selectedId]) || {}

  function patchEdits(patch: ItemEdits) {
    if (!selectedId) return
    setEdits((current) => ({
      ...current,
      [selectedId]: { ...current[selectedId], ...patch },
    }))
  }

  /**
   * Background per item, in list order, so neighbours don't repeat. Uses the
   * cutout's colour once it has been read, otherwise the listing words alone.
   */
  const autoBackgrounds = useMemo(() => {
    const out: Record<string, { background: StoryBackground; matched: string[] }> = {}
    let previousId: string | null = null
    for (const row of eligible) {
      const traits = detectItemTraits({
        text: itemText(row),
        colour: colours[row.marketingEntityId] ?? null,
      })
      const pick = pickStoryBackground({ kit, traits, previousId })
      const chosen =
        kit.find((bg) => bg.id === edits[row.marketingEntityId]?.backgroundId) ??
        pick.background
      out[row.marketingEntityId] = { background: pick.background, matched: pick.matched }
      previousId = chosen.id
    }
    return out
  }, [eligible, colours, kit, edits])

  const auto = selectedId ? autoBackgrounds[selectedId] : undefined
  const background =
    kit.find((bg) => bg.id === selectedEdits.backgroundId) ??
    auto?.background ??
    kit[0]

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
  const cutoutUrl = selectedId ? cutouts[selectedId] ?? null : null
  const useCutout = selectedEdits.useCutout ?? true
  const displayImage = useCutout && cutoutUrl ? cutoutUrl : sourceImage

  const model = useMemo(() => {
    if (!selected || !displayImage) return null
    return buildWlsDailyStoryCanvasModel({
      selection: selected,
      brandName: entityName,
      imageUrl: proxiedImageUrl(displayImage, entityId),
    })
  }, [selected, displayImage, entityName, entityId])

  const vibe = selectedEdits.vibe ?? (selected ? defaultVibe(selected) : "")

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
    setFailure(null)
  }, [selectedId])

  const makeCutout = useCallback(
    async (row: WlsProductSelection, image: string) => {
      setBusy("cutout")
      try {
        const url = await requestCutout({ imageUrl: image, entityId })
        setCutouts((current) => ({ ...current, [row.marketingEntityId]: url }))
      } catch (error) {
        setCutoutFailed((current) => ({ ...current, [row.marketingEntityId]: true }))
        toast.error(
          error instanceof Error
            ? `${error.message} Showing the original photo.`
            : "Cutout failed. Showing the original photo."
        )
      } finally {
        setBusy(null)
      }
    },
    [entityId]
  )

  // Cut each product out the first time it's opened.
  useEffect(() => {
    if (!selected || !sourceImage) return
    const id = selected.marketingEntityId
    if (cutouts[id] || cutoutFailed[id] || busy === "cutout") return
    void makeCutout(selected, sourceImage)
  }, [selected, sourceImage, cutouts, cutoutFailed, busy, makeCutout])

  // Read the item's colour (cutout first) to match its background.
  useEffect(() => {
    if (!selectedId || !displayImage || selectedId in colours) return
    if (!cutoutUrl && !cutoutFailed[selectedId]) return
    let cancelled = false
    void sampleItemColour(proxiedImageUrl(displayImage, entityId)).then((rgb) => {
      if (!cancelled) setColours((current) => ({ ...current, [selectedId]: rgb }))
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, displayImage, cutoutUrl, cutoutFailed, colours, entityId])

  async function bakePng(): Promise<{ dataUrl: string; blob: Blob }> {
    const node = canvasRef.current
    if (!node) throw new Error("Story isn't ready yet.")
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

  function gateOk(): boolean {
    if (!selected) return false
    const gate = assertWlsDailyStoryRenderable({
      selection: selected,
      entityId,
      brandName: entityName,
      industry,
    })
    if (!gate.ok) {
      setFailure(gate.detail)
      toast.error(gate.detail)
      return false
    }
    return true
  }

  async function onSaveImage() {
    if (!selected || !model || !gateOk()) return
    setBusy("download")
    try {
      const { dataUrl, blob } = await bakePng()
      const filename = `wls-story-${selected.websiteItemId}.png`
      const file = new File([blob], filename, { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        // Phones: straight to the share sheet (Instagram, Photos).
        await navigator.share({ files: [file] })
      } else {
        const anchor = document.createElement("a")
        anchor.href = dataUrl
        anchor.download = filename
        anchor.click()
        toast.success("Story saved as a 1080×1920 image.")
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setBusy(null)
    }
  }

  async function onCopyLink() {
    if (!selected?.destinationUrl) {
      toast.error("This product has no shop link.")
      return
    }
    try {
      await navigator.clipboard.writeText(selected.destinationUrl)
      toast.success("Shop link copied. Paste it into a link sticker on the Story.")
    } catch {
      toast.error("Couldn't copy the link.")
    }
  }

  async function onSaveDraft() {
    if (!selected || !model || !template || !sourceImage || !gateOk()) return
    setBusy("save")
    setFailure(null)
    try {
      const { blob } = await bakePng()
      const renderedUrl = await uploadRenderedPng(blob, entityId)

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
      }
      if (!res.ok) throw new Error(data.error || "Save failed.")
      toast.success(data.message || "Draft saved for approval.")
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
        New arrival Stories are only for Worn Label Society. Switch brand in the
        top bar.
      </div>
    )
  }

  const matchedNote =
    selectedEdits.backgroundId && selectedEdits.backgroundId !== auto?.background.id
      ? "Your pick"
      : auto?.matched.length
        ? `Matched: ${auto.matched.map(storyTraitLabel).join(", ")}`
        : "No colour match, so it rotated"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Instagram &amp; Facebook Story · 1080×1920
          </p>
          <h1 className="brand-typewriter text-xl">{WLS_DAILY_STORY_TEMPLATE_NAME}</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Each new arrival is cut out and placed on the background that suits
            it. Check the words, save the image, then add the shop link as a
            sticker on your phone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-2 border-mad-black"
            disabled={busy != null}
            onClick={() => void ensureTemplate()}
            title="Register this Story template for drafts"
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
            title="Load the newest arrivals from the shop"
          >
            {busy === "eligible" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Reload products
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)_300px]">
        <section className="flex flex-col items-center gap-3">
          <div className="relative w-full max-w-[300px] overflow-hidden rounded-lg shadow-lg">
            {model ? (
              <KitStoryCanvas
                ref={canvasRef}
                background={background}
                brandName={entityName}
                tag="New in"
                imageUrl={model.imageUrl}
                vibe={vibe}
                designer={model.designer}
                sizeLabel={model.sizeLabel ? formatCanvasSizeTagLabel(model.sizeLabel) : null}
                subjectScale={selectedEdits.subjectScale ?? 1}
                subjectOffsetY={selectedEdits.subjectOffsetY ?? 0}
              />
            ) : (
              <div
                className="flex aspect-[9/16] items-center justify-center p-6 text-center font-typewriter text-xs uppercase"
                style={{ background: kit[0].color, color: kit[0].text_color }}
              >
                Pick a new arrival
              </div>
            )}
            {busy === "cutout" ? (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 py-2 text-xs text-white">
                <Scissors className="size-3.5" aria-hidden /> Cutting out…
              </div>
            ) : null}
          </div>
          {failure ? (
            <p className="max-w-sm border-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
              {failure}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-5" aria-label="Edit this Story">
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-typewriter text-xs uppercase tracking-widest">Background</h2>
              <span className="text-[11px] text-mad-black/55">{selected ? matchedNote : ""}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {kit.map((bg) => {
                const active = bg.id === background.id
                return (
                  <button
                    key={bg.id}
                    type="button"
                    disabled={!selected}
                    onClick={() => patchEdits({ backgroundId: bg.id })}
                    title={bg.name}
                    aria-label={`Use ${bg.name}`}
                    aria-pressed={active}
                    className={cn(
                      "relative size-11 rounded-full border border-black/15 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mad-black disabled:opacity-40",
                      active && "ring-2 ring-mad-black ring-offset-2"
                    )}
                    style={{ background: bg.color }}
                  >
                    {active ? (
                      <Check className="absolute inset-0 m-auto size-4" style={{ color: bg.text_color }} aria-hidden />
                    ) : null}
                  </button>
                )
              })}
              {selectedEdits.backgroundId ? (
                <button
                  type="button"
                  onClick={() => patchEdits({ backgroundId: undefined })}
                  title="Go back to the matched background"
                  aria-label="Use the matched background"
                  className="flex size-11 items-center justify-center rounded-full border border-dashed border-mad-black/50 text-mad-black/70 hover:text-mad-black"
                >
                  <Wand2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <p className="text-xs text-mad-black/60">{background.name}</p>
          </div>

          <label className="grid gap-1.5">
            <span className="font-typewriter text-xs uppercase tracking-widest">Vibe</span>
            <input
              id="story-vibe"
              type="text"
              value={vibe}
              maxLength={28}
              disabled={!selected}
              onChange={(event) => patchEdits({ vibe: event.target.value })}
              className="h-10 border-2 border-mad-black bg-white px-3 text-sm uppercase tracking-wider"
            />
            <span className="text-[11px] text-mad-black/55">
              {selected?.vibe ? "From the shop listing. Change it if you like." : "The listing has no vibe, so this is from the title."}
            </span>
          </label>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-mad-black/55">Brand</dt>
            <dd>{model?.designer ?? "—"}</dd>
            <dt className="text-mad-black/55">Size</dt>
            <dd>{model?.sizeLabel ?? "Not on the listing, so left off"}</dd>
            <dt className="text-mad-black/55">Price</dt>
            <dd>{selected ? formatWlsNzdPrice(selected) : "—"}</dd>
          </dl>

          <div className="grid gap-3 text-xs">
            <label className="grid gap-1">
              <span className="font-typewriter uppercase tracking-widest">Item size</span>
              <input
                id="story-scale"
                type="range"
                min={0.7}
                max={1.3}
                step={0.01}
                disabled={!selected}
                value={selectedEdits.subjectScale ?? 1}
                onChange={(event) => patchEdits({ subjectScale: Number(event.target.value) })}
              />
            </label>
            <label className="grid gap-1">
              <span className="font-typewriter uppercase tracking-widest">Move up or down</span>
              <input
                id="story-offset"
                type="range"
                min={-10}
                max={10}
                step={1}
                disabled={!selected}
                value={selectedEdits.subjectOffsetY ?? 0}
                onChange={(event) => patchEdits({ subjectOffsetY: Number(event.target.value) })}
              />
            </label>
            {cutoutUrl ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="story-use-cutout"
                  type="checkbox"
                  checked={useCutout}
                  onChange={(event) => patchEdits({ useCutout: event.target.checked })}
                />
                Use the cutout
              </label>
            ) : selected && cutoutFailed[selected.marketingEntityId] && sourceImage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start border-2 border-mad-black"
                disabled={busy != null}
                onClick={() => {
                  setCutoutFailed((current) => {
                    const next = { ...current }
                    delete next[selected.marketingEntityId]
                    return next
                  })
                }}
              >
                <Scissors className="mr-2 size-3.5" aria-hidden /> Try the cutout again
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Button
              type="button"
              className="border-2 border-mad-black bg-mad-black text-mad-white"
              disabled={!model || busy != null}
              onClick={() => void onSaveImage()}
            >
              {busy === "download" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : typeof navigator !== "undefined" && "share" in navigator ? (
                <Share2 className="mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Save image
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-2 border-mad-black"
              disabled={!selected?.destinationUrl}
              onClick={() => void onCopyLink()}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy shop link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-2 border-mad-black"
              disabled={!template || !model || busy != null}
              onClick={() => void onSaveDraft()}
              title={template ? "Save for approval" : "Set up the template first"}
            >
              {busy === "save" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save draft
            </Button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-2 border-2 border-mad-black bg-white p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-typewriter text-xs uppercase tracking-widest">
              New arrivals
            </h2>
            <span className="text-[10px] text-mad-black/50">
              {eligible.length} ready · {excludedCount} can't be used
            </span>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {eligible.length === 0 ? (
              <li className="text-sm text-mad-black/60">
                No new arrivals ready. Pull new stock from Today or Library,
                then reload.
              </li>
            ) : (
              eligible.map((row) => {
                const active = row.marketingEntityId === selectedId
                const picked = studioPickIds.includes(row.marketingEntityId)
                const thumb = row.sourceImageUrls[0]
                const rowBackground =
                  kit.find((bg) => bg.id === edits[row.marketingEntityId]?.backgroundId) ??
                  autoBackgrounds[row.marketingEntityId]?.background
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
                          aria-label={`Include ${row.brand || row.title} in a Create Studio sequence`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.marketingEntityId)}
                        className="flex min-w-0 flex-1 gap-2 text-left hover:opacity-90"
                      >
                        <div
                          className="h-14 w-11 shrink-0 overflow-hidden"
                          style={{ background: rowBackground?.color ?? "#E8DCC4" }}
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={proxiedImageUrl(cutouts[row.marketingEntityId] ?? thumb, entityId)}
                              alt=""
                              className={cn(
                                "h-full w-full",
                                cutouts[row.marketingEntityId] ? "object-contain" : "object-cover"
                              )}
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
              Tick up to {WLS_DAILY_STORY_STUDIO_MAX_FRAMES} to edit them as one
              Story sequence in Create Studio.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

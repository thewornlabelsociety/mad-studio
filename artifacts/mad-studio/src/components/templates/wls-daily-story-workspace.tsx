"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "wouter"
import {
  Check,
  Copy,
  Download,
  Loader2,
  Move,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Share2,
  Sparkles,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { isAdjusted } from "@/components/templates/adjustable-layer"
import { KitStoryCanvas } from "@/components/templates/kit-story-canvas"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { storyTraitLabel } from "@/lib/brands/story-kit"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import {
  isWornLabelFashionEntity,
  WLS_DAILY_STORY_TEMPLATE_NAME,
  assertWlsDailyStoryRenderable,
} from "@/lib/templates/wls-daily-story"
import type { EntityTemplateInstance } from "@/lib/templates/template-schema"
import { buildWlsDailyStoryStudioHandoffHref } from "@/lib/templates/template-handoff"
import {
  bakeStoryPng,
  copyStoryLink,
  shareOrDownloadStory,
  useKitStories,
} from "@/lib/templates/use-kit-stories"
import {
  WLS_DAILY_STORY_STUDIO_MAX_FRAMES,
} from "@/lib/templates/wls-daily-story-studio-seed"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
  /** Open on this product (from the Today Story feed). */
  initialItemId?: string | null
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
  initialItemId = null,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [template, setTemplate] = useState<TemplateState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId)
  const [studioPickIds, setStudioPickIds] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [subjectSelected, setSubjectSelected] = useState(false)

  const isWls = isWornLabelFashionEntity({ name: entityName, industry })

  const {
    kit,
    eligible,
    excludedCount,
    loading,
    reload,
    stories,
    patch,
    cuttingId,
    cutoutFailed,
    retryCutout,
  } = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: isWls,
    cutoutIds: selectedId ? [selectedId] : [],
  })

  // Keep a valid selection as the list loads or changes.
  useEffect(() => {
    if (eligible.length === 0) return
    if (selectedId && eligible.some((row) => row.marketingEntityId === selectedId)) return
    setSelectedId(eligible[0].marketingEntityId)
  }, [eligible, selectedId])

  useEffect(() => {
    setFailure(null)
    setSubjectSelected(false)
  }, [selectedId])

  const story = selectedId ? stories.get(selectedId) ?? null : null
  const selected = story?.row ?? null

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
      await reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed.")
    } finally {
      setBusy(null)
    }
  }, [entityId, reload])

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
    const node = canvasRef.current
    if (!selected || !node || !gateOk()) return
    setBusy("download")
    try {
      const baked = await bakeStoryPng(node)
      const result = await shareOrDownloadStory({
        ...baked,
        filename: `wls-story-${selected.websiteItemId}.png`,
      })
      if (result === "downloaded") toast.success("Story saved as a 1080×1920 image.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setBusy(null)
    }
  }

  async function onSaveDraft() {
    const node = canvasRef.current
    if (!selected || !node || !template || !story?.sourceImage || !gateOk()) return
    setBusy("save")
    setFailure(null)
    try {
      const { blob } = await bakeStoryPng(node)
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
          sourceImageUrl: story.sourceImage,
          renderedUrl,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }
      if (!res.ok) throw new Error(data.error || "Save failed.")
      toast.success(data.message || "Draft saved for approval.")
      await reload()
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

  const matchedNote = !story
    ? ""
    : story.edits.backgroundId && story.edits.backgroundId !== story.autoBackground.id
      ? "Your pick"
      : story.matched.length
        ? `Matched: ${story.matched.map(storyTraitLabel).join(", ")}`
        : "No colour match, so it rotated"
  const cutting = Boolean(selectedId && cuttingId === selectedId)

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
            disabled={loading}
            onClick={() => void reload()}
            title="Load the newest arrivals from the shop"
          >
            {loading ? (
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
            {story && story.imageUrl ? (
              <KitStoryCanvas
                ref={canvasRef}
                background={story.background}
                brandName={entityName}
                tag="New in"
                imageUrl={story.imageUrl}
                vibe={story.vibe}
                designer={story.designer}
                sizeLabel={story.sizeLabel}
                subject={story.subject}
                onSubjectChange={(next) => selectedId && patch(selectedId, { subject: next })}
                subjectSelected={subjectSelected}
                onSubjectSelect={setSubjectSelected}
              />
            ) : (
              <div
                className="flex aspect-[9/16] items-center justify-center p-6 text-center font-typewriter text-xs uppercase"
                style={{ background: kit[0].color, color: kit[0].text_color }}
              >
                {loading ? "Loading new arrivals…" : "Pick a new arrival"}
              </div>
            )}
            {cutting ? (
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
              <span className="text-[11px] text-mad-black/55">{matchedNote}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {kit.map((bg) => {
                const active = bg.id === story?.background.id
                return (
                  <button
                    key={bg.id}
                    type="button"
                    disabled={!story}
                    onClick={() => selectedId && patch(selectedId, { backgroundId: bg.id })}
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
              {story?.edits.backgroundId ? (
                <button
                  type="button"
                  onClick={() => selectedId && patch(selectedId, { backgroundId: undefined })}
                  title="Go back to the matched background"
                  aria-label="Use the matched background"
                  className="flex size-11 items-center justify-center rounded-full border border-dashed border-mad-black/50 text-mad-black/70 hover:text-mad-black"
                >
                  <Wand2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <p className="text-xs text-mad-black/60">{story?.background.name ?? ""}</p>
          </div>

          <label className="grid gap-1.5">
            <span className="font-typewriter text-xs uppercase tracking-widest">Vibe</span>
            <input
              id="story-vibe"
              type="text"
              value={story?.vibe ?? ""}
              maxLength={28}
              disabled={!story}
              onChange={(event) => selectedId && patch(selectedId, { vibe: event.target.value })}
              className="h-10 border-2 border-mad-black bg-white px-3 text-sm uppercase tracking-wider"
            />
            <span className="text-[11px] text-mad-black/55">
              {!story
                ? ""
                : story.vibeFromShop
                  ? "From the shop listing. Change it if you like."
                  : "The listing has no vibe, so this is from the title."}
            </span>
          </label>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-mad-black/55">Brand</dt>
            <dd>{story?.designer ?? "—"}</dd>
            <dt className="text-mad-black/55">Size</dt>
            <dd>{story ? story.sizeLabel ?? "Not on the listing, so left off" : "—"}</dd>
            <dt className="text-mad-black/55">Price</dt>
            <dd>{story?.priceLabel ?? "—"}</dd>
          </dl>

          <div className="grid gap-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-start gap-1.5 text-mad-black/65">
                <Move className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Drag the item on the Story to move it. Pull its corner to
                resize, or the dot above it to tilt.
              </p>
              <button
                type="button"
                disabled={!story || !isAdjusted(story.subject)}
                onClick={() => selectedId && patch(selectedId, { subject: undefined })}
                title="Put the item back in the middle"
                aria-label="Reset the item position"
                className="flex size-8 shrink-0 items-center justify-center border-2 border-mad-black/30 hover:border-mad-black disabled:opacity-30"
              >
                <RotateCcw className="size-3.5" aria-hidden />
              </button>
            </div>
            {story?.cutoutUrl ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="story-use-cutout"
                  type="checkbox"
                  checked={story.useCutout}
                  onChange={(event) =>
                    selectedId && patch(selectedId, { useCutout: event.target.checked })
                  }
                />
                Use the cutout
              </label>
            ) : selectedId && cutoutFailed[selectedId] && story?.sourceImage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start border-2 border-mad-black"
                onClick={() => retryCutout(selectedId)}
              >
                <Scissors className="mr-2 size-3.5" aria-hidden /> Try the cutout again
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Button
              type="button"
              className="border-2 border-mad-black bg-mad-black text-mad-white"
              disabled={!story?.imageUrl || busy != null}
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
              onClick={() => void copyStoryLink(selected?.destinationUrl ?? null)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy shop link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-2 border-mad-black"
              disabled={!template || !story?.imageUrl || busy != null}
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
                {loading
                  ? "Loading…"
                  : "No new arrivals ready. Pull new stock from Today or Library, then reload."}
              </li>
            ) : (
              eligible.map((row) => {
                const id = row.marketingEntityId
                const rowStory = stories.get(id)
                const active = id === selectedId
                const picked = studioPickIds.includes(id)
                const thumb = rowStory?.cutoutUrl ?? row.sourceImageUrls[0]
                return (
                  <li key={id}>
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
                          onChange={() => toggleStudioPick(id)}
                          className="size-4 border-2 border-mad-black"
                          aria-label={`Include ${row.brand || row.title} in a Create Studio sequence`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSelectedId(id)}
                        className="flex min-w-0 flex-1 gap-2 text-left hover:opacity-90"
                      >
                        <div
                          className="h-14 w-11 shrink-0 overflow-hidden"
                          style={{ background: rowStory?.background.color ?? "#E8DCC4" }}
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={proxiedImageUrl(thumb, entityId)}
                              alt=""
                              className={cn(
                                "h-full w-full",
                                rowStory?.cutoutUrl ? "object-contain" : "object-cover"
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
                            {rowStory?.priceLabel}
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

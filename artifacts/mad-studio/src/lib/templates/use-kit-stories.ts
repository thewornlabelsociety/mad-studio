"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { toast } from "sonner"

import { storyExportFilter } from "@/components/marketing/story-canvas"
import { NO_ADJUST, type LayerAdjust } from "@/components/templates/adjustable-layer"
import {
  detectItemTraits,
  pickStoryBackground,
  resolveStoryKit,
  type Rgb,
  type StoryBackground,
  type StoryItemTrait,
} from "@/lib/brands/story-kit"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import { requestCutout } from "@/lib/media/request-cutout"
import { sampleItemColour } from "@/lib/media/sample-item-colour"
import { formatCanvasSizeTagLabel } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl } from "@/lib/studio/final-artwork"
import { formatWlsNzdPrice } from "@/lib/templates/format-wls-nzd-price"
import { buildWlsDailyStoryCanvasModel } from "@/lib/templates/wls-daily-story"

export type StoryEdits = {
  vibe?: string
  backgroundId?: string
  /** Hand placement of the cutout. */
  subject?: LayerAdjust
  useCutout?: boolean
}

/** Everything one new arrival Story needs to render and be edited. */
export type KitStory = {
  row: WlsProductSelection
  background: StoryBackground
  autoBackground: StoryBackground
  /** Traits that picked the automatic background; empty when it rotated. */
  matched: StoryItemTrait[]
  vibe: string
  vibeFromShop: boolean
  designer: string
  sizeLabel: string | null
  priceLabel: string
  sourceImage: string | null
  cutoutUrl: string | null
  useCutout: boolean
  /** Proxied, same-origin image for the canvas. */
  imageUrl: string | null
  subject: LayerAdjust
  edits: StoryEdits
}

function itemText(row: WlsProductSelection): string {
  return [row.title, row.brand, row.description].filter(Boolean).join(" ")
}

/** The shop's vibe label, else the product type from the title. */
export function defaultStoryVibe(row: WlsProductSelection): string {
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

function firstImage(row: WlsProductSelection): string | null {
  return row.sourceImageUrls.find((url) => /^https?:\/\//i.test(url)) ?? null
}

async function saveStoryState(body: {
  entityId: string
  marketingEntityId: string
  shared?: boolean
  cutoutUrl?: string
}): Promise<{ sharedAt: string | null }> {
  const res = await fetch("/api/templates/wls-daily-story/story-state", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    sharedAt?: string | null
    error?: string
  }
  if (!res.ok) throw new Error(data.error || "Couldn't save the Story.")
  return { sharedAt: data.sharedAt ?? null }
}

/**
 * New arrival Stories for one brand: loads the products, cuts each one out
 * once (and saves it), reads its colour, and picks its kit background.
 * `cutoutIds` are cut out in order, one at a time.
 */
export function useKitStories(input: {
  entityId: string
  entityName: string
  industry: string | null
  brandIdentity: { visual_presets?: VisualPresets | null } | null
  isWornLabel: boolean
  cutoutIds: string[]
}) {
  const { entityId, entityName, industry, brandIdentity, isWornLabel, cutoutIds } = input
  const [eligible, setEligible] = useState<WlsProductSelection[]>([])
  const [excludedCount, setExcludedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [cutouts, setCutouts] = useState<Record<string, string>>({})
  const [cutoutFailed, setCutoutFailed] = useState<Record<string, true>>({})
  const [cuttingId, setCuttingId] = useState<string | null>(null)
  const [colours, setColours] = useState<Record<string, Rgb | null>>({})
  const [edits, setEdits] = useState<Record<string, StoryEdits>>({})
  const [sharedAt, setSharedAt] = useState<Record<string, string | null>>({})
  const sampling = useRef(new Set<string>())

  const kit = useMemo(() => {
    const presets = resolveVisualPresets({
      brandName: entityName,
      industry,
      brandIdentity: brandIdentity as never,
    })
    return resolveStoryKit({ presets, isWornLabel })
  }, [entityName, industry, brandIdentity, isWornLabel])

  const reload = useCallback(async () => {
    setLoading(true)
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
      if (!res.ok) throw new Error(data.error || "Couldn't load new arrivals.")
      const list = data.eligible ?? []
      setEligible(list)
      setExcludedCount(Array.isArray(data.excluded) ? data.excluded.length : 0)
      setCutouts((current) => {
        const next = { ...current }
        for (const row of list) {
          if (!next[row.marketingEntityId] && row.cutoutUrl) {
            next[row.marketingEntityId] = row.cutoutUrl
          }
        }
        return next
      })
      setSharedAt((current) => {
        const next = { ...current }
        for (const row of list) {
          next[row.marketingEntityId] = row.usage.storySharedAt ?? null
        }
        return next
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load new arrivals.")
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [entityId])

  useEffect(() => {
    if (!isWornLabel) return
    void reload()
  }, [isWornLabel, reload])

  // Cut out the requested products one at a time; keep each cutout on the item.
  const cutoutKey = cutoutIds.join(",")
  useEffect(() => {
    if (cuttingId) return
    const next = eligible.find(
      (row) =>
        cutoutIds.includes(row.marketingEntityId) &&
        !cutouts[row.marketingEntityId] &&
        !cutoutFailed[row.marketingEntityId] &&
        firstImage(row)
    )
    if (!next) return
    const id = next.marketingEntityId
    setCuttingId(id)
    void (async () => {
      try {
        const url = await requestCutout({ imageUrl: firstImage(next)!, entityId })
        setCutouts((current) => ({ ...current, [id]: url }))
        void saveStoryState({ entityId, marketingEntityId: id, cutoutUrl: url }).catch(() => {
          /* the cutout still shows; it just isn't remembered */
        })
      } catch {
        setCutoutFailed((current) => ({ ...current, [id]: true }))
      } finally {
        setCuttingId(null)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoutKey, eligible, cutouts, cutoutFailed, cuttingId, entityId])

  // Read each cut-out item's colour for background matching.
  useEffect(() => {
    for (const row of eligible) {
      const id = row.marketingEntityId
      const image = cutouts[id] ?? (cutoutFailed[id] ? firstImage(row) : null)
      if (!image || id in colours || sampling.current.has(id)) continue
      sampling.current.add(id)
      void sampleItemColour(proxiedImageUrl(image, entityId)).then((rgb) => {
        setColours((current) => ({ ...current, [id]: rgb }))
      })
    }
  }, [eligible, cutouts, cutoutFailed, colours, entityId])

  const stories = useMemo(() => {
    const out = new Map<string, KitStory>()
    let previousId: string | null = null
    for (const row of eligible) {
      const id = row.marketingEntityId
      const rowEdits = edits[id] ?? {}
      const pick = pickStoryBackground({
        kit,
        traits: detectItemTraits({ text: itemText(row), colour: colours[id] ?? null }),
        previousId,
      })
      const background = kit.find((bg) => bg.id === rowEdits.backgroundId) ?? pick.background
      previousId = background.id

      const sourceImage = firstImage(row)
      const cutoutUrl = cutouts[id] ?? null
      const useCutout = rowEdits.useCutout ?? true
      const shown = useCutout && cutoutUrl ? cutoutUrl : sourceImage
      const model = buildWlsDailyStoryCanvasModel({
        selection: row,
        brandName: entityName,
        imageUrl: shown ?? "",
      })
      out.set(id, {
        row,
        background,
        autoBackground: pick.background,
        matched: pick.matched,
        vibe: rowEdits.vibe ?? defaultStoryVibe(row),
        vibeFromShop: Boolean(row.vibe?.trim()),
        designer: model.designer,
        sizeLabel: model.sizeLabel ? formatCanvasSizeTagLabel(model.sizeLabel) : null,
        priceLabel: formatWlsNzdPrice(row),
        sourceImage,
        cutoutUrl,
        useCutout,
        imageUrl: shown ? proxiedImageUrl(shown, entityId) : null,
        subject: rowEdits.subject ?? NO_ADJUST,
        edits: rowEdits,
      })
    }
    return out
  }, [eligible, edits, kit, colours, cutouts, entityName, entityId])

  const patch = useCallback((id: string, next: StoryEdits) => {
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...next } }))
  }, [])

  const retryCutout = useCallback((id: string) => {
    setCutoutFailed((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])

  const markShared = useCallback(
    async (id: string, shared: boolean) => {
      const previous = sharedAt[id] ?? null
      setSharedAt((current) => ({ ...current, [id]: shared ? new Date().toISOString() : null }))
      try {
        const result = await saveStoryState({ entityId, marketingEntityId: id, shared })
        setSharedAt((current) => ({ ...current, [id]: result.sharedAt }))
      } catch (error) {
        setSharedAt((current) => ({ ...current, [id]: previous }))
        toast.error(error instanceof Error ? error.message : "Couldn't save that.")
      }
    },
    [entityId, sharedAt]
  )

  return {
    kit,
    eligible,
    excludedCount,
    loading,
    loaded,
    reload,
    stories,
    patch,
    cuttingId,
    cutoutFailed,
    retryCutout,
    sharedAt,
    markShared,
  }
}

/** Bake a rendered Story node to a 1080-wide PNG (link-sticker guide left out). */
export async function bakeStoryPng(node: HTMLElement): Promise<{ dataUrl: string; blob: Blob }> {
  const dataUrl = await toPng(node, {
    // Proxied images differ only by query string; without this they all share one cache entry.
    includeQueryParams: true,
    cacheBust: true,
    filter: storyExportFilter,
    pixelRatio: 1080 / Math.max(node.offsetWidth, 1),
    width: node.offsetWidth,
    height: node.offsetHeight,
  })
  const blob = await (await fetch(dataUrl)).blob()
  return { dataUrl, blob }
}

/** Phone: open the share sheet (Instagram, Photos). Desktop: download. */
export async function shareOrDownloadStory(input: {
  dataUrl: string
  blob: Blob
  filename: string
}): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([input.blob], input.filename, { type: "image/png" })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return "shared"
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled"
      throw error
    }
  }
  const anchor = document.createElement("a")
  anchor.href = input.dataUrl
  anchor.download = input.filename
  anchor.click()
  return "downloaded"
}

export async function copyStoryLink(url: string | null): Promise<void> {
  if (!url) {
    toast.error("This product has no shop link.")
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Shop link copied. Paste it into a link sticker on the Story.")
  } catch {
    toast.error("Couldn't copy the link.")
  }
}

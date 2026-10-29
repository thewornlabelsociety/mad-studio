"use client"

import { useMemo, useRef, useState } from "react"
import { Link } from "wouter"
import { toPng } from "html-to-image"
import { Copy, Download, Loader2, Scissors } from "lucide-react"
import { toast } from "sonner"

import {
  StoryCanvas,
  storyExportFilter,
} from "@/components/marketing/story-canvas"
import { ensureInventoryTrackableLink, patchDropWorkbenchDraft } from "@/lib/actions"
import { readApiJson } from "@/lib/api-json"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import type { MarketingEntity } from "@/lib/inventory/types"
import {
  buildStoryCanvasModel,
  resolveItemDestinationUrl,
  type StoryStylePreset,
} from "@/lib/marketing/story-presets"
import { cn } from "@/lib/utils"

type Template = "cutout" | "full_page"

const TEMPLATES: Array<{ id: Template; label: string; hint: string }> = [
  { id: "cutout", label: "Cutout", hint: "Item on your brand colour" },
  { id: "full_page", label: "Full page", hint: "Photo fills the screen" },
]

const STYLE_FOR: Record<Template, StoryStylePreset> = {
  cutout: "moody_noir",
  full_page: "full_page",
}

/** Same-origin copy of a remote image so the PNG export can read its pixels. */
function proxied(url: string | null | undefined, entityId: string) {
  if (!url) return null
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url
  }
  return `/api/media/image-proxy?url=${encodeURIComponent(url)}&entityId=${encodeURIComponent(entityId)}`
}

type Props = {
  item: MarketingEntity
  entityId: string
  brandName: string
  industry?: string | null
  websiteUrl?: string | null
  visualPresets: VisualPresets
  onItemChange: (item: MarketingEntity) => void
}

/**
 * Builds an Instagram Story for one item in the brand's own look — Cutout or
 * Full page — then downloads it as a 1080×1920 PNG and copies the shop link
 * for the phone's link sticker.
 */
export function StoryMaker({
  item,
  entityId,
  brandName,
  industry = null,
  websiteUrl = null,
  visualPresets,
  onItemChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const meta = item.copy_draft?.metadata
  const [template, setTemplate] = useState<Template>(
    meta?.story_template ?? "cutout"
  )
  const [showLogo, setShowLogo] = useState(false)
  const [busy, setBusy] = useState<"cutout" | "download" | "link" | null>(null)

  const photo = item.images.find((url) => /^https?:\/\//i.test(url)) ?? null
  const cutoutUrl = meta?.cutout_url ?? null
  const hasLogo = Boolean(visualPresets.logo_url)

  const imageUrl =
    template === "cutout" && cutoutUrl ? cutoutUrl : photo
  const model = useMemo(
    () =>
      buildStoryCanvasModel({
        item,
        brandName,
        industry,
        imageUrl: proxied(imageUrl, entityId),
      }),
    [item, brandName, industry, imageUrl, entityId]
  )
  const presetsForCanvas = useMemo(
    () => ({
      ...visualPresets,
      logo_url: proxied(visualPresets.logo_url, entityId) ?? undefined,
    }),
    [visualPresets, entityId]
  )

  /** Remember the template that was actually used, once a story is saved. */
  function rememberTemplate() {
    if (meta?.story_template === template) return
    void patchDropWorkbenchDraft({
      entityId,
      itemId: item.id,
      copyDraft: { metadata: { story_template: template } },
    })
  }

  async function removeBackground() {
    if (!photo) return
    setBusy("cutout")
    try {
      const response = await fetch("/api/media/remove-bg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: photo, entityId, itemId: item.id }),
      })
      const payload = await readApiJson<{
        transparentUrl?: string
        error?: string
      }>(response)
      if (!response.ok || !payload.transparentUrl) {
        throw new Error(payload.error || "Background removal failed.")
      }
      const saved = await patchDropWorkbenchDraft({
        entityId,
        itemId: item.id,
        copyDraft: { metadata: { cutout_url: payload.transparentUrl } },
      })
      if (!saved.ok) throw new Error(saved.error)
      onItemChange({
        ...item,
        copy_draft: {
          ...item.copy_draft,
          metadata: {
            ...item.copy_draft?.metadata,
            cutout_url: payload.transparentUrl,
          },
        },
      })
      toast.success("Background removed.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cutout failed.")
    } finally {
      setBusy(null)
    }
  }

  async function download() {
    const node = canvasRef.current
    if (!node) return
    setBusy("download")
    try {
      const dataUrl = await toPng(node, {
        // Proxied images differ only by query string; without this they all share one cache entry.
        includeQueryParams: true,
        cacheBust: true,
        filter: storyExportFilter,
        // Render at Instagram's 1080 × 1920 story size.
        pixelRatio: 1080 / node.offsetWidth,
      })
      const anchor = document.createElement("a")
      const stem = `${brandName}-${item.title}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 60)
      anchor.download = `${stem}-story.png`
      anchor.href = dataUrl
      anchor.click()
      rememberTemplate()
      toast.success("Story saved — 1080 × 1920, ready for Instagram.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.")
    } finally {
      setBusy(null)
    }
  }

  async function copyLink() {
    setBusy("link")
    try {
      const result = await ensureInventoryTrackableLink({
        entityId,
        marketingEntityId: item.id,
        destinationUrl: resolveItemDestinationUrl({
          entityId,
          websiteUrl,
          websiteItemId: item.website_item_id,
          copyDraft: item.copy_draft,
        }),
      })
      if (!result.ok) throw new Error(result.error)
      await navigator.clipboard.writeText(result.data.shortUrl)
      toast.success("Shop link copied — paste it into the link sticker.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't copy link.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-semibold text-mad-black">Story</h4>
        <p className="text-xs text-neutral-500">
          In {brandName}&apos;s colours and type from Brand Brain.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Story template">
        {TEMPLATES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={template === option.id}
            onClick={() => setTemplate(option.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              template === option.id
                ? "border-mad-black bg-mad-black text-mad-white"
                : "border-neutral-200 hover:border-neutral-400"
            )}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span
              className={cn(
                "block text-[0.75rem]",
                template === option.id ? "text-neutral-300" : "text-neutral-500"
              )}
            >
              {option.hint}
            </span>
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-[16rem] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
        <StoryCanvas
          ref={canvasRef}
          model={model}
          stylePreset={STYLE_FOR[template]}
          format="story_9_16"
          cutoutMode={
            template === "cutout" && cutoutUrl ? "transparent" : "original"
          }
          visualPresets={presetsForCanvas}
          showLogo={showLogo}
        />
      </div>

      {template === "cutout" && !cutoutUrl ? (
        <button
          type="button"
          onClick={removeBackground}
          disabled={!photo || busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy === "cutout" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Scissors className="size-4" />
          )}
          Remove background
        </button>
      ) : null}

      <label
        className={cn(
          "flex items-center justify-between gap-3 text-sm",
          !hasLogo && "text-neutral-400"
        )}
      >
        <span>
          Add logo
          {!hasLogo ? (
            <span className="block text-xs">
              Upload one in{" "}
              <Link
                href={`/brain?eid=${encodeURIComponent(entityId)}`}
                className="underline"
              >
                Brand Brain
              </Link>{" "}
              first.
            </span>
          ) : null}
        </span>
        <input
          type="checkbox"
          checked={showLogo}
          disabled={!hasLogo}
          onChange={(event) => setShowLogo(event.target.checked)}
          className="size-4 accent-mad-black"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={download}
          disabled={!photo || busy !== null}
          className="flex items-center justify-center gap-2 rounded-md bg-mad-black px-3 py-2 text-sm font-medium text-mad-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy === "download" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Save story
        </button>
        <button
          type="button"
          onClick={copyLink}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy === "link" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Copy className="size-4" />
          )}
          Copy shop link
        </button>
      </div>
      <p className="text-xs leading-relaxed text-neutral-500">
        On your phone: post the saved image as a Story, add a Link sticker,
        paste the shop link, and drop it on the dashed spot.
      </p>
    </section>
  )
}

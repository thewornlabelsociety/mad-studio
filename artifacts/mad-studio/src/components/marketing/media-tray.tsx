"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
} from "react"
import { Eye, GripVertical, Loader2, Play, Plus, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { MediaLibraryDrawer } from "@/components/studio/media-library-drawer"
import {
  appendInventoryImage,
  removeInventoryImage,
  reorderInventoryImages,
} from "@/lib/actions"
import type { MediaLibraryItem } from "@/lib/studio/media-library"
import {
  extractVideoKeyframeDataUrl,
  extractVideoKeyframeFromUrl,
  requestMediaInspection,
} from "@/lib/media/client-inspect"
import type { MediaVisualInspection } from "@/lib/media/inspect-schema"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  detectMediaKindFromUrl,
  type MediaKind,
} from "@/lib/media/kind"

export type { MediaKind }
export { detectMediaKindFromUrl }

export type MediaAsset = {
  id: string
  url: string
  /** Settled public URL after Supabase upload (preferred for publish). */
  publicUrl: string | null
  type: MediaKind
  uploading?: boolean
  inspecting?: boolean
  visualInspection?: MediaVisualInspection | null
  /** marketing_entities row when pulled from website / intake library. */
  marketingEntityId?: string | null
  /** Exact product / listing URL for phone link-sticker handoff. */
  destinationUrl?: string | null
  /** Listing / website description for this slide's source item. */
  intakeCaption?: string | null
  /** Suggested discovery tags from that listing (no #). */
  intakeTags?: string[] | null
}

export type ActiveMedia = {
  url: string
  type: MediaKind
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
const VIDEO_TYPES = ["video/mp4", "video/quicktime"]
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 80 * 1024 * 1024

type Props = {
  entityId: string
  brandName?: string
  industry?: string | null
  assets: MediaAsset[]
  activeId: string | null
  onAssetsChange: (assets: MediaAsset[]) => void
  onSelectMedia: (asset: MediaAsset) => void
  /** Fired when library items with website copy are added to the tray. */
  onIntakeAssetsAdded?: (assets: MediaAsset[]) => void
  /** Fired when vision inspect completes for an asset. */
  onVisualInspect?: (
    assetId: string,
    inspection: MediaVisualInspection | null
  ) => void
  /** When set, image uploads also persist on the marketing entity row. */
  inventoryItemId?: string | null
  disabled?: boolean
  className?: string
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80)
}

function detectKind(file: File): MediaKind | null {
  if (IMAGE_TYPES.includes(file.type)) return "image"
  if (VIDEO_TYPES.includes(file.type)) return "video"
  const lower = file.name.toLowerCase()
  if (/\.(png|jpe?g|webp)$/.test(lower)) return "image"
  if (/\.(mp4|mov)$/.test(lower)) return "video"
  return null
}

export async function uploadToEntityAssets(
  entityId: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const safeName = sanitizeFileName(file.name || "media.bin")
  const path = `media/${entityId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from("entity-assets")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  if (error) throw new Error(error.message)

  const {
    data: { publicUrl },
  } = supabase.storage.from("entity-assets").getPublicUrl(path)

  return publicUrl
}

export function resolveActiveMedia(
  assets: MediaAsset[],
  activeId: string | null
): ActiveMedia | null {
  const asset = assets.find((row) => row.id === activeId) ?? assets[0] ?? null
  if (!asset) return null
  const url = asset.publicUrl || asset.url
  return {
    url,
    type:
      asset.type === "video" || detectMediaKindFromUrl(url) === "video"
        ? "video"
        : "image",
  }
}

export function mediaAssetsFromImageUrls(urls: string[]): MediaAsset[] {
  return urls
    .filter((url) => typeof url === "string" && url.trim().length > 0)
    .map((url, index) => {
      const kind = detectMediaKindFromUrl(url)
      return {
        id: `seed-${kind}-${index}-${url.slice(-32)}`,
        url,
        publicUrl: /^https?:\/\//i.test(url) ? url : null,
        type: kind,
      }
    })
}

/** Alias — seeds image or video assets from settled URLs. */
export const mediaAssetsFromUrls = mediaAssetsFromImageUrls

export function MediaTray({
  entityId,
  brandName,
  industry = null,
  assets,
  activeId,
  onAssetsChange,
  onSelectMedia,
  onIntakeAssetsAdded,
  onVisualInspect,
  inventoryItemId = null,
  disabled = false,
  className,
}: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<Set<string>>(new Set())
  const assetsRef = useRef(assets)
  const [fileDragging, setFileDragging] = useState(false)
  const [dragAssetId, setDragAssetId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const reorderDirtyRef = useRef(false)

  useEffect(() => {
    assetsRef.current = assets
  }, [assets])

  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const updateById = useCallback(
    (id: string, patch: Partial<MediaAsset>) => {
      const next = assetsRef.current.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      )
      assetsRef.current = next
      onAssetsChange(next)
    },
    [onAssetsChange]
  )

  const runInspect = useCallback(
    async (input: {
      assetId: string
      mediaUrl: string
      mediaType: MediaKind
      file?: File
    }) => {
      updateById(input.assetId, { inspecting: true })
      try {
        let frameDataUrl: string | null = null
        if (input.mediaType === "video") {
          if (input.file) {
            frameDataUrl = await extractVideoKeyframeDataUrl(input.file)
          }
          if (!frameDataUrl && /^https?:\/\//i.test(input.mediaUrl)) {
            frameDataUrl = await extractVideoKeyframeFromUrl(input.mediaUrl)
          }
        }
        const inspection = await requestMediaInspection({
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          entityId,
          frameDataUrl,
        })
        updateById(input.assetId, {
          inspecting: false,
          visualInspection: inspection,
        })
        onVisualInspect?.(input.assetId, inspection)
      } catch (error) {
        updateById(input.assetId, {
          inspecting: false,
          visualInspection: null,
        })
        onVisualInspect?.(input.assetId, null)
        toast.message(
          error instanceof Error
            ? `Vision skip: ${error.message}`
            : "Vision inspection skipped."
        )
      }
    },
    [entityId, onVisualInspect, updateById]
  )

  const handleFiles = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      if (!fileList || disabled) return
      const files = Array.from(fileList)
      if (files.length === 0) return

      for (const file of files) {
        const kind = detectKind(file)
        if (!kind) {
          toast.error("Use PNG, JPG, WEBP, MP4, or MOV.")
          continue
        }
        if (kind === "image" && file.size > MAX_IMAGE_BYTES) {
          toast.error("Images must be under 8MB.")
          continue
        }
        if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
          toast.error("Videos must be under 80MB.")
          continue
        }

        const localUrl = URL.createObjectURL(file)
        objectUrlsRef.current.add(localUrl)
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const pending: MediaAsset = {
          id,
          url: localUrl,
          publicUrl: null,
          type: kind,
          uploading: true,
        }

        const next = [...assetsRef.current, pending]
        assetsRef.current = next
        onAssetsChange(next)
        onSelectMedia(pending)

        try {
          const publicUrl = await uploadToEntityAssets(entityId, file)
          if (kind === "image" && inventoryItemId) {
            const result = await appendInventoryImage({
              entityId,
              itemId: inventoryItemId,
              imageUrl: publicUrl,
            })
            if (!result.ok) throw new Error(result.error)
          }
          if (localUrl.startsWith("blob:")) {
            URL.revokeObjectURL(localUrl)
            objectUrlsRef.current.delete(localUrl)
          }
          updateById(id, {
            url: publicUrl,
            publicUrl,
            uploading: false,
          })
          toast.success(kind === "video" ? "Reel attached." : "Image attached.")
          void runInspect({
            assetId: id,
            mediaUrl: publicUrl,
            mediaType: kind,
            file: kind === "video" ? file : undefined,
          })
        } catch (error) {
          updateById(id, { uploading: false })
          toast.warning(
            error instanceof Error
              ? `${error.message} — using local preview.`
              : "Upload delayed — using local preview."
          )
        }
      }

      if (inputRef.current) inputRef.current.value = ""
    },
    [
      disabled,
      entityId,
      inventoryItemId,
      onAssetsChange,
      onSelectMedia,
      runInspect,
      updateById,
    ]
  )

  const attachFromLibrary = useCallback(
    async (items: MediaLibraryItem[]) => {
      if (disabled || items.length === 0) return

      const existing = new Set(
        assetsRef.current.map((row) => (row.publicUrl || row.url).trim())
      )
      const additions: MediaAsset[] = []

      for (const item of items) {
        const url = item.url.trim()
        if (!url || existing.has(url)) continue
        existing.add(url)
        additions.push({
          id: `lib-${item.id}-${Date.now()}-${additions.length}`,
          url,
          publicUrl: url,
          type: item.kind,
          marketingEntityId: item.marketingEntityId,
          intakeCaption: item.intakeCaption ?? null,
          intakeTags: item.intakeTags ?? null,
        })
      }

      if (additions.length === 0) {
        toast.message("Selected media is already in the tray.")
        return
      }

      const next = [...assetsRef.current, ...additions]
      assetsRef.current = next
      onAssetsChange(next)
      onSelectMedia(additions[0]!)
      if (additions.some((row) => row.intakeCaption?.trim())) {
        onIntakeAssetsAdded?.(additions)
      }

      for (const asset of additions) {
        if (
          asset.type === "image" &&
          inventoryItemId &&
          asset.publicUrl &&
          /^https?:\/\//i.test(asset.publicUrl)
        ) {
          const result = await appendInventoryImage({
            entityId,
            itemId: inventoryItemId,
            imageUrl: asset.publicUrl,
          })
          if (!result.ok) {
            toast.warning(result.error)
          }
        }
        void runInspect({
          assetId: asset.id,
          mediaUrl: asset.publicUrl || asset.url,
          mediaType: asset.type,
        })
      }
    },
    [
      disabled,
      entityId,
      inventoryItemId,
      onAssetsChange,
      onSelectMedia,
      runInspect,
    ]
  )

  async function onRemove(asset: MediaAsset) {
    if (disabled || asset.uploading || asset.inspecting) return

    if (
      asset.type === "image" &&
      inventoryItemId &&
      asset.publicUrl &&
      /^https?:\/\//i.test(asset.publicUrl)
    ) {
      const result = await removeInventoryImage({
        entityId,
        itemId: inventoryItemId,
        imageUrl: asset.publicUrl,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
    }

    if (asset.url.startsWith("blob:")) {
      URL.revokeObjectURL(asset.url)
      objectUrlsRef.current.delete(asset.url)
    }

    const remaining = assetsRef.current.filter((row) => row.id !== asset.id)
    assetsRef.current = remaining
    onAssetsChange(remaining)
    if (activeId === asset.id && remaining[0]) {
      onSelectMedia(remaining[0])
    }
    onVisualInspect?.(asset.id, null)
    toast.success("Media removed.")
  }

  function isFileDrag(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files")
  }

  function onFileDrag(event: DragEvent, active: boolean) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (!disabled) setFileDragging(active)
  }

  const persistImageOrder = useCallback(
    async (list: MediaAsset[]) => {
      if (!inventoryItemId) return
      const images = list
        .filter((row) => row.type === "image")
        .map((row) => (row.publicUrl || row.url).trim())
        .filter((url) => /^https?:\/\//i.test(url))
      if (images.length < 2) return

      const result = await reorderInventoryImages({
        entityId,
        itemId: inventoryItemId,
        images,
      })
      if (!result.ok) {
        toast.warning(result.error)
      }
    },
    [entityId, inventoryItemId]
  )

  function moveAssetBefore(fromId: string, toId: string) {
    if (fromId === toId) return
    const list = [...assetsRef.current]
    const from = list.findIndex((row) => row.id === fromId)
    const to = list.findIndex((row) => row.id === toId)
    if (from < 0 || to < 0 || from === to) return
    const [item] = list.splice(from, 1)
    if (!item) return
    list.splice(to, 0, item)
    assetsRef.current = list
    onAssetsChange(list)
    reorderDirtyRef.current = true
  }

  function onAssetDragStart(event: DragEvent, asset: MediaAsset) {
    if (disabled || asset.uploading || asset.inspecting) {
      event.preventDefault()
      return
    }
    event.stopPropagation()
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/mad-media-asset", asset.id)
    event.dataTransfer.setData("text/plain", asset.id)
    setDragAssetId(asset.id)
    setDropTargetId(null)
    reorderDirtyRef.current = false
  }

  function onAssetDragOver(event: DragEvent, targetId: string) {
    if (isFileDrag(event)) return
    if (!dragAssetId || dragAssetId === targetId) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = "move"
    if (dropTargetId !== targetId) setDropTargetId(targetId)
  }

  function onAssetDrop(event: DragEvent, targetId: string) {
    if (isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    const fromId =
      event.dataTransfer.getData("text/mad-media-asset") ||
      event.dataTransfer.getData("text/plain") ||
      dragAssetId
    if (fromId) moveAssetBefore(fromId, targetId)
    setDropTargetId(null)
  }

  async function onAssetDragEnd() {
    setDragAssetId(null)
    setDropTargetId(null)
    if (!reorderDirtyRef.current) return
    reorderDirtyRef.current = false
    await persistImageOrder(assetsRef.current)
  }

  const activeAsset =
    assets.find((row) => row.id === activeId) ?? assets[0] ?? null
  const visionReady = Boolean(activeAsset?.visualInspection?.visualDescription)
  const visionBusy = Boolean(
    activeAsset?.inspecting || assets.some((row) => row.inspecting)
  )

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-black uppercase">
          Media tray
        </p>
        <p className="font-typewriter text-[0.7rem] font-bold tracking-wider text-neutral-500 uppercase">
          {assets.length >= 2
            ? "Drag to reorder · multi-upload OK"
            : "Drop or upload multiple · PNG · JPG · WEBP · MP4 · MOV"}
        </p>
      </div>

      {visionReady || visionBusy ? (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 border-2 border-mad-black px-2.5 py-1 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase shadow-keycap-sm",
            visionBusy
              ? "bg-mad-white text-neutral-600"
              : "bg-mad-lime text-mad-black"
          )}
        >
          {visionBusy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Eye className="size-3" />
          )}
          {visionBusy
            ? "Reading visual details…"
            : "Visual details extracted from media"}
        </div>
      ) : null}

      <div
        className={cn(
          "flex gap-2 overflow-x-auto border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm",
          fileDragging && "bg-mad-lime/40"
        )}
        onDragEnter={(event) => onFileDrag(event, true)}
        onDragOver={(event) => onFileDrag(event, true)}
        onDragLeave={(event) => onFileDrag(event, false)}
        onDrop={(event) => {
          if (!isFileDrag(event)) return
          onFileDrag(event, false)
          void handleFiles(event.dataTransfer.files)
        }}
      >
        {assets.map((asset, index) => {
          const active = asset.id === activeId
          const canDrag =
            !disabled && !asset.uploading && !asset.inspecting && assets.length >= 2
          const isDragging = dragAssetId === asset.id
          const isDropTarget = dropTargetId === asset.id && dragAssetId !== asset.id
          return (
            <div
              key={asset.id}
              className={cn(
                "group relative shrink-0",
                isDragging && "opacity-40",
                isDropTarget && "ring-2 ring-mad-lime ring-offset-1"
              )}
              onDragOver={(event) => onAssetDragOver(event, asset.id)}
              onDrop={(event) => onAssetDrop(event, asset.id)}
            >
              <button
                type="button"
                draggable={canDrag}
                onDragStart={(event) => onAssetDragStart(event, asset)}
                onDragEnd={() => void onAssetDragEnd()}
                onClick={() => onSelectMedia(asset)}
                disabled={disabled}
                title={canDrag ? "Drag to change carousel order" : undefined}
                aria-label={
                  canDrag
                    ? `Media ${index + 1} of ${assets.length}. Drag to reorder.`
                    : `Media ${index + 1}`
                }
                className={cn(
                  "relative size-16 overflow-hidden border-2 border-mad-black bg-neutral-200 transition",
                  active
                    ? "ring-2 ring-mad-vermillion ring-offset-1"
                    : "opacity-80 hover:opacity-100",
                  canDrag && "cursor-grab active:cursor-grabbing"
                )}
              >
                {asset.type === "video" ? (
                  <>
                    <video
                      src={asset.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover pointer-events-none"
                    />
                    <span className="absolute right-1 bottom-1 flex size-5 items-center justify-center border border-mad-black bg-mad-black text-mad-lime">
                      <Play className="size-3 fill-current" aria-label="Video" />
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.url}
                    alt=""
                    draggable={false}
                    className="size-full object-cover pointer-events-none"
                  />
                )}
                {assets.length >= 2 ? (
                  <span className="absolute bottom-1 left-1 border border-mad-black bg-mad-white px-1 font-typewriter text-[0.65rem] font-bold text-mad-black">
                    {index + 1}
                  </span>
                ) : null}
                {canDrag ? (
                  <span
                    className="absolute top-1 right-1 flex size-4 items-center justify-center border border-mad-black bg-mad-white/90 text-mad-black opacity-0 transition group-hover:opacity-100"
                    aria-hidden
                  >
                    <GripVertical className="size-2.5" />
                  </span>
                ) : null}
                {asset.uploading || asset.inspecting ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-mad-white/80">
                    <Loader2 className="size-4 animate-spin text-mad-black" />
                  </span>
                ) : null}
                {asset.visualInspection && !asset.inspecting ? (
                  <span className="absolute top-1 left-1 flex size-4 items-center justify-center border border-mad-black bg-mad-lime text-mad-black">
                    <Eye className="size-2.5" />
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => void onRemove(asset)}
                disabled={disabled || asset.uploading || asset.inspecting}
                className="absolute -top-2 -right-2 flex size-5 items-center justify-center border-2 border-mad-black bg-mad-black text-mad-white opacity-0 shadow-keycap-sm transition group-hover:opacity-100 hover:bg-mad-vermillion focus-visible:opacity-100"
                aria-label="Remove media"
              >
                <X className="size-3" />
              </button>
            </div>
          )
        })}

        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          title="Upload one or more files from your device"
          className={cn(
            "flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 border-2 border-dashed border-mad-black bg-mad-white font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase transition hover:bg-mad-lime",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <Upload className="size-4" />
          <span className="text-[0.7rem] font-medium tracking-wide uppercase">
            Upload
          </span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setLibraryOpen(true)}
          title="Pick from entity media library"
          className={cn(
            "flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 border-2 border-dashed border-mad-black bg-mad-lime font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase transition hover:bg-mad-black hover:text-mad-white",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <Plus className="size-4" />
          <span className="text-[0.7rem] font-medium tracking-wide uppercase">
            Library
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          void handleFiles(event.target.files)
        }}
      />

      <MediaLibraryDrawer
        entityId={entityId}
        brandName={brandName}
        industry={industry}
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        mode="attach"
        onAttachToTray={(items) => void attachFromLibrary(items)}
        onUploadFiles={(files) => handleFiles(files)}
      />
    </div>
  )
}

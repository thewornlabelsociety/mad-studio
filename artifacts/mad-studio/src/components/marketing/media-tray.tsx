"use client"

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
} from "react"
import { Eye, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { MediaLibraryDrawer } from "@/components/studio/media-library-drawer"
import {
  appendInventoryImage,
  removeInventoryImage,
} from "@/lib/actions"
import type { MediaLibraryItem } from "@/lib/studio/media-library"
import {
  extractVideoKeyframeDataUrl,
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
  assets: MediaAsset[]
  activeId: string | null
  onAssetsChange: (assets: MediaAsset[]) => void
  onSelectMedia: (asset: MediaAsset) => void
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
  assets,
  activeId,
  onAssetsChange,
  onSelectMedia,
  onVisualInspect,
  inventoryItemId = null,
  disabled = false,
  className,
}: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<Set<string>>(new Set())
  const assetsRef = useRef(assets)
  const [dragging, setDragging] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)

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
        if (input.mediaType === "video" && input.file) {
          frameDataUrl = await extractVideoKeyframeDataUrl(input.file)
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

  function onDrag(event: DragEvent, active: boolean) {
    event.preventDefault()
    event.stopPropagation()
    if (!disabled) setDragging(active)
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
        <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
          Media tray
        </p>
        <p className="font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase">
          PNG · JPG · WEBP · MP4 · MOV
        </p>
      </div>

      {visionReady || visionBusy ? (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 border-2 border-mad-black px-2.5 py-1 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm",
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
            : "👁 Visual details extracted from media"}
        </div>
      ) : null}

      <div
        className={cn(
          "flex gap-2 overflow-x-auto border-2 border-mad-black bg-mad-white p-2 shadow-keycap-sm",
          dragging && "bg-mad-lime/40"
        )}
        onDragEnter={(event) => onDrag(event, true)}
        onDragOver={(event) => onDrag(event, true)}
        onDragLeave={(event) => onDrag(event, false)}
        onDrop={(event) => {
          onDrag(event, false)
          void handleFiles(event.dataTransfer.files)
        }}
      >
        {assets.map((asset) => {
          const active = asset.id === activeId
          return (
            <div key={asset.id} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => onSelectMedia(asset)}
                disabled={disabled}
                className={cn(
                  "relative size-16 overflow-hidden border-2 border-mad-black bg-neutral-200 transition",
                  active
                    ? "ring-2 ring-mad-vermillion ring-offset-1"
                    : "opacity-80 hover:opacity-100"
                )}
              >
                {asset.type === "video" ? (
                  <>
                    <video
                      src={asset.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                    <span className="absolute right-1 bottom-1 flex size-5 items-center justify-center border border-mad-black bg-mad-black text-[0.55rem] text-mad-lime">
                      ▶
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.url}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
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
          onClick={() => setLibraryOpen(true)}
          className={cn(
            "flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 border-2 border-dashed border-mad-black bg-mad-lime font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase transition hover:bg-mad-black hover:text-mad-white",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <Plus className="size-4" />
          <span className="text-[0.55rem] font-medium tracking-wide uppercase">
            Add
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
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        mode="attach"
        onAttachToTray={(items) => void attachFromLibrary(items)}
        onUploadFiles={(files) => handleFiles(files)}
      />
    </div>
  )
}

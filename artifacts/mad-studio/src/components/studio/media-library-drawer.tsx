"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Images, Loader2, Plus, Upload, X } from "lucide-react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  fetchEntityMediaLibrary,
  type MediaLibraryItem,
} from "@/lib/studio/media-library"
import { cn } from "@/lib/utils"

type BaseProps = {
  entityId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After local upload from this drawer, refresh the grid. */
  onUploadFiles?: (files: FileList) => void | Promise<void>
}

type CarouselModeProps = BaseProps & {
  mode?: "carousel"
  onBuildCarousel: (items: MediaLibraryItem[]) => void
  onAttachToTray?: never
}

type AttachModeProps = BaseProps & {
  mode: "attach"
  onAttachToTray: (items: MediaLibraryItem[]) => void
  onBuildCarousel?: never
}

type Props = CarouselModeProps | AttachModeProps

export function MediaLibraryDrawer(props: Props) {
  const {
    entityId,
    open,
    onOpenChange,
    onUploadFiles,
    mode = "carousel",
  } = props

  const uploadInputId = useId()
  const uploadRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<MediaLibraryItem[]>([])
  const [selected, setSelected] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchEntityMediaLibrary(entityId)
      setItems(rows)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load media library."
      )
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    if (!open) return
    setSelected([])
    void load()
  }, [open, load])

  const maxSelect = mode === "attach" ? 20 : 10

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((row) => row !== id)
      }
      if (current.length >= maxSelect) {
        toast.message(
          mode === "attach"
            ? `Select up to ${maxSelect} items.`
            : "Carousel supports up to 10 items."
        )
        return current
      }
      return [...current, id]
    })
  }

  function onPrimaryAction() {
    const picked = selected
      .map((id) => items.find((row) => row.id === id))
      .filter((row): row is MediaLibraryItem => Boolean(row))

    if (mode === "attach") {
      if (picked.length < 1) {
        toast.message("Select at least one item to add to the tray.")
        return
      }
      if (props.mode === "attach") {
        props.onAttachToTray(picked)
      }
      onOpenChange(false)
      toast.success(
        picked.length === 1
          ? "Added to media tray."
          : `Added ${picked.length} items to media tray.`
      )
      return
    }

    if (picked.length < 2) {
      toast.message("Select at least two items for a feed carousel.")
      return
    }
    if (props.mode !== "attach") {
      props.onBuildCarousel(picked)
    }
    onOpenChange(false)
    toast.success(`Carousel mounted with ${picked.length} slides.`)
  }

  async function onUploadChange(files: FileList | null) {
    if (!files?.length || !onUploadFiles) return
    try {
      await onUploadFiles(files)
      await load()
    } finally {
      if (uploadRef.current) uploadRef.current.value = ""
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col gap-0 overflow-hidden rounded-none border-l-2 border-mad-black p-0 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b-2 border-mad-black px-4 py-3 text-left">
          <SheetTitle className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
            Media library
          </SheetTitle>
          <p className="font-typewriter text-[0.5rem] leading-relaxed tracking-wider text-neutral-500 normal-case">
            {mode === "attach"
              ? "Pick intake or uploaded entity media, or upload a new file — then add to your tray."
              : "Recent entity media — multi-select up to 10 stills or clips, then build a feed carousel in the simulator."}
          </p>
          {onUploadFiles ? (
            <label
              htmlFor={uploadInputId}
              className="mt-2 inline-flex cursor-pointer items-center gap-1.5 border-2 border-mad-black bg-mad-lime px-2.5 py-1.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-black hover:text-mad-white"
            >
              <Upload className="size-3.5" />
              Upload new file
            </label>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-neutral-400" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-600">
              No media yet — sync intake or upload a new file above.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {items.map((item) => {
                const active = selected.includes(item.id)
                const order = selected.indexOf(item.id)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "relative aspect-square w-full overflow-hidden border-2 border-mad-black text-left",
                        active && "ring-2 ring-mad-vermillion ring-offset-1"
                      )}
                    >
                      {item.kind === "video" ? (
                        <video
                          src={item.url}
                          className="size-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                      <span className="absolute left-0 top-0 max-w-full truncate bg-mad-black/80 px-1 py-0.5 font-typewriter text-[0.4rem] font-bold text-mad-white uppercase">
                        {item.origin === "fudi_intake"
                          ? "[ FÜDI App ]"
                          : "[ Upload ]"}
                      </span>
                      {active ? (
                        <span className="absolute right-0 bottom-0 bg-mad-vermillion px-1.5 py-0.5 font-typewriter text-[0.55rem] font-bold text-white">
                          {order + 1}
                        </span>
                      ) : null}
                    </button>
                    <p className="mt-0.5 line-clamp-2 font-typewriter text-[0.45rem] leading-tight text-neutral-600 normal-case">
                      {item.sourceTitle}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t-2 border-mad-black p-3">
          <button
            type="button"
            disabled={
              mode === "attach" ? selected.length < 1 : selected.length < 2
            }
            onClick={onPrimaryAction}
            className="inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase disabled:opacity-50"
          >
            {mode === "attach" ? (
              <>
                <Plus className="size-4" />
                Add to tray ({selected.length})
              </>
            ) : (
              <>
                <Images className="size-4" />
                Build carousel ({selected.length}/10)
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1 border-2 border-mad-black bg-mad-white font-typewriter text-[0.55rem] font-bold uppercase"
          >
            <X className="size-3.5" />
            Close
          </button>
        </div>

        {onUploadFiles ? (
          <input
            ref={uploadRef}
            id={uploadInputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
            multiple
            className="sr-only"
            onChange={(event) => void onUploadChange(event.target.files)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

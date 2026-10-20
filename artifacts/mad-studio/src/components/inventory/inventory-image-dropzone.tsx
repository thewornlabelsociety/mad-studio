"use client"

import { useCallback, useId, useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import {
  appendInventoryImage,
  removeInventoryImage,
} from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
const MAX_BYTES = 8 * 1024 * 1024

type Props = {
  entityId: string
  itemId: string
  images: string[]
  onChange: (images: string[]) => void
  disabled?: boolean
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80)
}

async function uploadInventoryImage(
  entityId: string,
  itemId: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const safeName = sanitizeFileName(file.name || "drop.jpg")
  const path = `inventory/${entityId}/${itemId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage.from("entity-assets").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("entity-assets").getPublicUrl(path)

  return publicUrl
}

export function InventoryImageDropzone({
  entityId,
  itemId,
  images,
  onChange,
  disabled = false,
}: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFiles = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      if (!fileList || disabled) return
      const files = Array.from(fileList)
      if (files.length === 0) return

      setUploading(true)
      let added = 0
      let latestImages: string[] | null = null
      try {
        for (const file of files) {
          if (!ACCEPTED.includes(file.type)) {
            toast.error(`${file.name || "File"}: use PNG, JPG, or WEBP only.`)
            continue
          }
          if (file.size > MAX_BYTES) {
            toast.error(`${file.name || "File"}: must be under 8MB.`)
            continue
          }

          const publicUrl = await uploadInventoryImage(entityId, itemId, file)
          const result = await appendInventoryImage({
            entityId,
            itemId,
            imageUrl: publicUrl,
          })
          if (!result.ok) {
            throw new Error(result.error)
          }
          latestImages = result.data.images
          added += 1
        }

        if (latestImages) {
          onChange(latestImages)
        }
        if (added === 0) {
          toast.message("No images were uploaded.")
        } else if (added === 1) {
          toast.success("Supplementary image attached.")
        } else {
          toast.success(`Attached ${added} images.`)
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Image upload failed."
        toast.error(message)
        if (latestImages) onChange(latestImages)
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ""
      }
    },
    [disabled, entityId, itemId, onChange]
  )

  async function onRemove(url: string) {
    if (disabled || uploading) return
    const result = await removeInventoryImage({
      entityId,
      itemId,
      imageUrl: url,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    onChange(result.data.images)
    toast.success("Image removed.")
  }

  return (
    <div className="space-y-3">
      <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-black uppercase">
        Supplementary Media Uploads
      </p>

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="aspect-square w-full border-2 border-mad-black object-cover shadow-keycap-sm"
              />
              <button
                type="button"
                onClick={() => void onRemove(url)}
                disabled={disabled || uploading}
                className="absolute -top-2 -right-2 inline-flex size-6 items-center justify-center border-2 border-mad-black bg-mad-black text-mad-white hover:bg-mad-vermillion disabled:opacity-50"
                aria-label="Remove image"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!disabled) setDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragging(false)
          void handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          "flex min-h-[6rem] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-mad-black bg-mad-white px-3 py-4 text-center transition-colors",
          dragging && "bg-mad-lime",
          (disabled || uploading) && "cursor-not-allowed opacity-60"
        )}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin text-mad-black" />
        ) : (
          <ImagePlus className="size-4 text-mad-black" />
        )}
        <span className="font-typewriter text-[0.75rem] font-bold tracking-wider text-mad-black uppercase">
          {uploading
            ? "Uploading…"
            : "+ Click or drag photos here (PNG, JPG, WEBP · multiple OK)"}
        </span>
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(event) => {
          void handleFiles(event.target.files)
        }}
      />
    </div>
  )
}

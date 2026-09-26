"use client"

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
const MAX_BYTES = 8 * 1024 * 1024

type SparkImageUploaderProps = {
  entityId: string
  imageUrl: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80)
}

export async function uploadSparkImage(
  entityId: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const safeName = sanitizeFileName(file.name || "drop.jpg")
  const path = `campaigns/${entityId}/${Date.now()}_${safeName}`

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

export function SparkImageUploader({
  entityId,
  imageUrl,
  onChange,
  disabled = false,
}: SparkImageUploaderProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl)

  useEffect(() => {
    setPreviewUrl(imageUrl)
  }, [imageUrl])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || disabled) return

      if (!ACCEPTED.includes(file.type)) {
        toast.error("Use PNG, JPG, or WEBP only.")
        return
      }
      if (file.size > MAX_BYTES) {
        toast.error("Image must be under 8MB.")
        return
      }

      clearObjectUrl()
      const localUrl = URL.createObjectURL(file)
      objectUrlRef.current = localUrl
      setPreviewUrl(localUrl)
      onChange(localUrl)
      setUploading(true)

      try {
        const publicUrl = await uploadSparkImage(entityId, file)
        clearObjectUrl()
        setPreviewUrl(publicUrl)
        onChange(publicUrl)
        toast.success("Visual drop asset attached.")
      } catch (error) {
        // Keep local object URL as offline fallback
        const message =
          error instanceof Error ? error.message : "Upload failed — using local preview."
        toast.warning(message)
        onChange(localUrl)
      } finally {
        setUploading(false)
      }
    },
    [clearObjectUrl, disabled, entityId, onChange]
  )

  function onRemove(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    clearObjectUrl()
    setPreviewUrl(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
        Attach Visual Drop Asset (Optional)
      </p>

      {previewUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Attached campaign visual"
            className="size-24 border-2 border-mad-black object-cover shadow-keycap-sm"
          />
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled || uploading}
            className="absolute -top-2 -right-2 inline-flex size-6 items-center justify-center border-2 border-mad-black bg-mad-black text-mad-white hover:bg-mad-vermillion disabled:opacity-50"
            aria-label="Remove attached image"
          >
            <X className="size-3.5" />
          </button>
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-mad-white/70">
              <Loader2 className="size-5 animate-spin text-mad-black" />
            </div>
          ) : null}
        </div>
      ) : (
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
            const file = event.dataTransfer.files?.[0]
            void handleFile(file)
          }}
          className={cn(
            "flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-mad-black bg-mad-white px-3 py-4 text-center transition-colors",
            dragging && "bg-mad-lime",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <ImagePlus className="size-4 text-mad-black" />
          <span className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase">
            + Click or drag item photo here (PNG, JPG, WEBP)
          </span>
        </label>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          void handleFile(file)
        }}
      />
    </div>
  )
}

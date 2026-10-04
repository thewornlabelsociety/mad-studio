"use client"

import { useRef, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { appendInventoryImage } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import type { MediaKind } from "@/lib/media/kind"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  marketingEntityId?: string | null
  onReady: (publicUrl: string, kind: MediaKind) => void
  className?: string
}

async function uploadEntityAsset(entityId: string, file: File): Promise<string> {
  const supabase = createClient()
  const safeName = file.name.replace(/[^\w.\-]+/g, "_") || "render.bin"
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

function detectKind(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("image/")) return "image"
  const lower = file.name.toLowerCase()
  if (/\.(mp4|mov)$/.test(lower)) return "video"
  if (/\.(png|jpe?g)$/.test(lower)) return "image"
  return null
}

export function FinishedRenderDropZone({
  entityId,
  marketingEntityId = null,
  onReady,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function ingestFile(file: File) {
    const kind = detectKind(file)
    if (!kind) {
      toast.error("Drop MP4, MOV, PNG, or JPG.")
      return
    }
    setBusy(true)
    try {
      const publicUrl = await uploadEntityAsset(entityId, file)
      if (marketingEntityId) {
        const result = await appendInventoryImage({
          entityId,
          itemId: marketingEntityId,
          imageUrl: publicUrl,
        })
        if (!result.ok) toast.message(result.error)
      }
      onReady(publicUrl, kind)
      toast.success("Finished render attached to draft.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setBusy(false)
      setDragOver(false)
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,image/png,image/jpeg,.mp4,.mov,.png,.jpg,.jpeg"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void ingestFile(file)
          event.target.value = ""
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file) void ingestFile(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex min-h-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-mad-black px-3 py-4 text-center transition",
          dragOver ? "bg-mad-lime/40" : "bg-mad-white hover:bg-mad-lime/20"
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Download className="size-5" />
        )}
        <span className="font-typewriter text-[0.55rem] font-bold tracking-wider uppercase">
          Drop finished render here
        </span>
        <span className="font-typewriter text-[0.45rem] tracking-wide text-neutral-500 normal-case">
          MP4 / MOV / PNG / JPG replaces active draft media
        </span>
      </div>
    </div>
  )
}

"use client"

import { useRef, useState } from "react"
import { Clapperboard, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { appendInventoryImage } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export type CapCutBridgePayload = {
  hook: string
  headline: string
  caption: string
  audioScript: string
  assetUrl: string | null
  /** Clipboard bundle fields for CapCut handoff. */
  spokenHook?: string
  onScreenHeadline?: string
  destinationUrl?: string | null
}

type Props = {
  entityId: string
  marketingEntityId?: string | null
  payload: CapCutBridgePayload
  onVideoReady: (publicUrl: string) => void
  className?: string
}

async function uploadEntityAsset(
  entityId: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const safeName = file.name.replace(/[^\w.\-]+/g, "_") || "reel.mp4"
  const path = `media/${entityId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage
    .from("entity-assets")
    .upload(path, file, {
      contentType: file.type || "video/mp4",
      upsert: false,
    })
  if (error) throw new Error(error.message)
  const {
    data: { publicUrl },
  } = supabase.storage.from("entity-assets").getPublicUrl(path)
  return publicUrl
}

export function CapCutBridge({
  entityId,
  marketingEntityId = null,
  payload,
  onVideoReady,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"copy" | "upload" | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function copyCapCutBundle() {
    setBusy("copy")
    try {
      const bundle = JSON.stringify(
        {
          spokenHook: payload.spokenHook ?? payload.hook,
          onScreenHeadline: payload.onScreenHeadline ?? payload.headline,
          caption: payload.caption,
          destinationUrl: payload.destinationUrl ?? null,
          assetUrl: payload.assetUrl,
        },
        null,
        2
      )
      await navigator.clipboard.writeText(bundle)
      toast.success("CapCut bundle copied — opening editor…")
      window.open("https://www.capcut.com/editor", "_blank", "noopener,noreferrer")
      window.setTimeout(() => {
        window.location.href = "capcut://"
      }, 400)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed.")
    } finally {
      setBusy(null)
    }
  }

  async function ingestFile(file: File) {
    if (!/\.(mp4|mov)$/i.test(file.name) && !file.type.startsWith("video/")) {
      toast.error("Drop an MP4 or MOV from CapCut.")
      return
    }
    setBusy("upload")
    try {
      const publicUrl = await uploadEntityAsset(entityId, file)
      if (marketingEntityId) {
        const result = await appendInventoryImage({
          entityId,
          itemId: marketingEntityId,
          imageUrl: publicUrl,
        })
        if (!result.ok) {
          toast.message(result.error)
        }
      }
      onVideoReady(publicUrl)
      toast.success("CapCut render attached — metadata and links kept.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setBusy(null)
      setDragOver(false)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={busy != null}
        onClick={() => void copyCapCutBundle()}
        className="inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-60"
      >
        {busy === "copy" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Clapperboard className="size-4" />
        )}
        Edit reel in CapCut
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
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
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click()
          }
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
        {busy === "upload" ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Download className="size-5" />
        )}
        <span className="font-typewriter text-[0.55rem] font-bold tracking-wider uppercase">
          Drop finished CapCut MP4
        </span>
        <span className="font-typewriter text-[0.45rem] tracking-wide text-neutral-500 normal-case">
          Replaces draft video; hook, caption & publish queue stay intact
        </span>
      </div>
    </div>
  )
}

"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FrameTemplateLayer } from "@/components/templates/frame-template-layer"
import { uploadToEntityAssets } from "@/components/marketing/media-tray"
import {
  createInstagramFeedOotdPreset,
  frameTemplateSchema,
  type FrameTemplate,
} from "@/lib/templates/frame-template"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  value: FrameTemplate | null
  disabled?: boolean
  onChange: (next: FrameTemplate | null) => void
}

export function FrameTemplateEditor({
  entityId,
  value,
  disabled,
  onChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const enabled = Boolean(value)

  async function onUpload(file: File | null) {
    if (!file || disabled) return
    setUploading(true)
    try {
      const url = await uploadToEntityAssets(entityId, file)
      const base = value ?? createInstagramFeedOotdPreset()
      onChange(
        frameTemplateSchema.parse({
          ...base,
          backgroundUrl: url,
        })
      )
      toast.success("Background uploaded.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function enableOotd() {
    onChange(
      createInstagramFeedOotdPreset(value?.backgroundUrl?.trim() || "")
    )
  }

  function clearFrames() {
    onChange(null)
  }

  function patchSlot(
    kind: "image" | "text",
    id: string,
    patch: Record<string, unknown>
  ) {
    if (!value) return
    if (kind === "image") {
      onChange({
        ...value,
        imageSlots: value.imageSlots.map((slot) =>
          slot.id === id ? { ...slot, ...patch } : slot
        ),
      })
      return
    }
    onChange({
      ...value,
      textSlots: value.textSlots.map((slot) =>
        slot.id === id ? { ...slot, ...patch } : slot
      ),
    })
  }

  return (
    <div className="space-y-3 border-2 border-dashed border-neutral-300 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-neutral-500 uppercase">
            Frame layout (Canva)
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Upload a Canva export with empty photo frames. Drop photos into
            frames in Create and rewrite the labels. Logo / footer art stay
            baked in the background.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!enabled ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              className="rounded-none"
              onClick={enableOotd}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Instagram Feed OOTD
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              className="rounded-none border-2 border-mad-black"
              onClick={clearFrames}
            >
              Remove frames
            </Button>
          )}
        </div>
      </div>

      {enabled && value ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={disabled || uploading}
              onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || uploading}
              className="rounded-none border-2 border-mad-black"
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-3.5" aria-hidden />
              )}
              {value.backgroundUrl ? "Replace background" : "Upload background"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              className="rounded-none border-2 border-mad-black"
              onClick={enableOotd}
            >
              Reset OOTD slots
            </Button>
          </div>

          <div className="mx-auto aspect-[4/5] w-full max-w-[220px] border-2 border-mad-black bg-black">
            <FrameTemplateLayer
              template={value}
              entityId={entityId}
              imageFills={{}}
              textFills={Object.fromEntries(
                value.textSlots.map((s) => [s.id, s.defaultText])
              )}
              interactive={false}
            />
          </div>

          <div className="space-y-2">
            <Label>Default labels (editable in Create)</Label>
            {value.textSlots.map((slot) => (
              <div
                key={slot.id}
                className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2"
              >
                <span className="truncate text-xs text-neutral-500">
                  {slot.label}
                </span>
                <Input
                  value={slot.defaultText}
                  disabled={disabled}
                  className="h-8 rounded-none text-xs"
                  onChange={(e) =>
                    patchSlot("text", slot.id, {
                      defaultText: e.target.value,
                    })
                  }
                />
              </div>
            ))}
          </div>

          <details className="text-xs text-neutral-600">
            <summary className="cursor-pointer font-medium text-mad-black">
              Advanced: nudge image frames (%)
            </summary>
            <div className="mt-2 space-y-2">
              {value.imageSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={cn(
                    "grid grid-cols-[6rem_repeat(4,minmax(0,1fr))] items-center gap-1"
                  )}
                >
                  <span className="truncate">{slot.label}</span>
                  {(["x", "y", "w", "h"] as const).map((key) => (
                    <Input
                      key={key}
                      type="number"
                      step="0.5"
                      value={slot[key]}
                      disabled={disabled}
                      aria-label={`${slot.label} ${key}`}
                      className="h-7 rounded-none px-1 text-[0.65rem]"
                      onChange={(e) =>
                        patchSlot("image", slot.id, {
                          [key]: Number(e.target.value),
                        })
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </details>
        </>
      ) : null}
    </div>
  )
}

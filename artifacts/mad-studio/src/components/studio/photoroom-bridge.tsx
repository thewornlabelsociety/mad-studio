"use client"

import { Scissors } from "lucide-react"

import { ToolIconButton } from "@/components/studio/tool-icon-button"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Square icon button with a hover label (Studio tool row). */
  iconOnly?: boolean
}

function openPhotoRoom() {
  window.open("https://www.photoroom.com/create", "_blank", "noopener,noreferrer")
}

export function PhotoRoomBridge({ className, iconOnly = false }: Props) {
  if (iconOnly) {
    return (
      <ToolIconButton
        label="Edit in PhotoRoom"
        hint="Retouch or restyle the photo, then upload the result."
        onClick={openPhotoRoom}
        className={className}
        icon={<Scissors className="size-5" />}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={openPhotoRoom}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-white font-typewriter text-[0.72rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime",
        className
      )}
    >
      <Scissors className="size-4" />
      Edit in PhotoRoom
    </button>
  )
}

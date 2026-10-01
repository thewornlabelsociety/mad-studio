"use client"

import { Scissors } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

export function PhotoRoomBridge({ className }: Props) {
  return (
    <button
      type="button"
      onClick={() =>
        window.open("https://www.photoroom.com/create", "_blank", "noopener,noreferrer")
      }
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-white font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime",
        className
      )}
    >
      <Scissors className="size-4" />
      Edit in PhotoRoom
    </button>
  )
}

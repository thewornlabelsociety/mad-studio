"use client"

import { useState, useTransition } from "react"
import { Loader2, Zap } from "lucide-react"
import { useRouter } from "@/lib/next-compat"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type BrainSuggestionBarProps = {
  entityId: string
  onTaught?: () => void
}

export function BrainSuggestionBar({
  entityId,
  onTaught,
}: BrainSuggestionBarProps) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [pending, startTransition] = useTransition()

  function submit() {
    const suggestionText = text.trim()
    if (!suggestionText || pending) return

    startTransition(async () => {
      try {
        const res = await fetch("/api/brain/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId, suggestionText }),
        })
        const payload = (await res.json()) as {
          ok?: boolean
          actionTaken?: string
          error?: string
        }
        if (!res.ok || !payload.ok) {
          toast.error(payload.error ?? "Could not update the Brain.")
          return
        }
        toast.success(`Brand Brain updated: ${payload.actionTaken ?? "Applied"}`)
        setText("")
        onTaught?.()
        router.refresh()
      } catch {
        toast.error("Could not reach the Brain suggest API.")
      }
    })
  }

  return (
    <section className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm sm:p-5">
      <label
        htmlFor="brain-suggestion"
        className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase"
      >
        💡 Creative Direction & Seasonal Focus
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <Input
          id="brain-suggestion"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              submit()
            }
          }}
          disabled={pending}
          placeholder={`e.g. "Focus on spring wedding guests for the next 2 weeks" or "Tone down formal language"`}
          className="h-11 flex-1 rounded-none border-2 border-mad-black font-typewriter text-sm shadow-none"
        />
        <Button
          type="button"
          disabled={pending || !text.trim()}
          onClick={submit}
          className="h-11 shrink-0 rounded-none border-2 border-mad-black bg-mad-black px-5 font-typewriter text-[0.7rem] tracking-widest text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion"
        >
          {pending ? (
            <>
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Updating…
            </>
          ) : (
            <>
              <Zap data-icon="inline-start" />
              Update Brand Brain
            </>
          )}
        </Button>
      </div>
    </section>
  )
}

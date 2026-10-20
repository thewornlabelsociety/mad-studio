"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = {
  busy?: boolean
  /** Suggested name, e.g. "Layout 2". */
  suggestedName: string
  onSave: (name: string, makeDefault: boolean) => void
}

/**
 * Save icon beside the live preview: names the layout on screen and asks
 * whether new posts should start with it.
 */
export function CanvasLayoutSaveButton({ busy = false, suggestedName, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [makeDefault, setMakeDefault] = useState(true)

  function openDialog() {
    setName(suggestedName)
    setMakeDefault(true)
    setOpen(true)
  }

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed, makeDefault)
    setOpen(false)
  }

  const choice =
    "flex-1 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.75rem] font-bold tracking-wider uppercase"

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={openDialog}
              disabled={busy}
              aria-label="Save this layout"
              className="inline-flex size-8 items-center justify-center border-2 border-mad-black bg-mad-white shadow-keycap-sm hover:bg-mad-lime disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Save this layout to reuse
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-none border-2 border-mad-black">
          <DialogHeader>
            <DialogTitle className="font-typewriter text-sm font-bold tracking-widest uppercase">
              Save layout
            </DialogTitle>
            <DialogDescription>
              Saves everything on Canvas now: fonts, colours, sizes, positions,
              tag toggles, logo, backdrop, and your headline/subhead as{" "}
              <strong>starter text</strong> for future posts. Photos and per-item
              tag values (brand, size, price) stay unique on each drop — use{" "}
              <strong>Apply style</strong> on a layout to merge styling onto the
              current slide without replacing words you already typed.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <label className="grid gap-1.5">
              <span className="font-typewriter text-[0.72rem] font-bold tracking-widest uppercase">
                Name
              </span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                placeholder="e.g. New In carousel"
                className="h-10 border-2 border-mad-black px-3 text-sm outline-none focus:bg-mad-lime/20"
              />
            </label>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 font-typewriter text-[0.72rem] font-bold tracking-widest uppercase">
                Save as default for new posts?
              </legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={makeDefault}
                  onClick={() => setMakeDefault(true)}
                  className={cn(choice, makeDefault ? "bg-mad-black text-mad-white" : "bg-mad-white hover:bg-mad-lime")}
                >
                  Yes
                </button>
                <button
                  type="button"
                  aria-pressed={!makeDefault}
                  onClick={() => setMakeDefault(false)}
                  className={cn(choice, !makeDefault ? "bg-mad-black text-mad-white" : "bg-mad-white hover:bg-mad-lime")}
                >
                  No
                </button>
              </div>
            </fieldset>
            <DialogFooter>
              <button
                type="submit"
                disabled={!name.trim() || busy}
                className="inline-flex h-10 w-full items-center justify-center gap-2 bg-mad-black px-4 font-typewriter text-[0.75rem] font-bold tracking-widest text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
              >
                <Save className="size-4" aria-hidden />
                Save layout
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

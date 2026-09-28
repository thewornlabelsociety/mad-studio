"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { useRouter } from "@/lib/next-compat"
import { toast } from "sonner"

import { saveEntityDna } from "@/lib/actions"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"

type Props = {
  entity: StudioEntityDna
}

function normalizeTag(word: string): string {
  const trimmed = word.trim().replace(/^#+/, "")
  return trimmed ? `#${trimmed.toUpperCase()}` : ""
}

export function ForbiddenWordsEditor({ entity }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [words, setWords] = useState<string[]>(
    entity.brand_identity.forbidden_words ?? []
  )
  const [draft, setDraft] = useState("")

  useEffect(() => {
    setWords(entity.brand_identity.forbidden_words ?? [])
  }, [entity.brand_identity.forbidden_words, entity.id])

  function removeWord(index: number) {
    setWords((prev) => prev.filter((_, i) => i !== index))
  }

  function addWord() {
    const tag = normalizeTag(draft)
    if (!tag) return
    setWords((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
    setDraft("")
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveEntityDna({
        entityId: entity.id,
        brandIdentity: {
          ...entity.brand_identity,
          forbidden_words: words,
        },
        audienceSegments: entity.audience_segments,
        industry: entity.industry,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Brand safety tags updated.")
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <div>
        <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Forbidden words · brand safety
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Tap to remove — saved tags flow into Studio and Brand Director chat.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {words.length === 0 ? (
          <span className="text-sm text-neutral-500">No tags on file.</span>
        ) : (
          words.map((word, index) => (
            <button
              key={`${word}-${index}`}
              type="button"
              onClick={() => removeWord(index)}
              className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-lime px-2.5 py-1 font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase hover:bg-mad-vermillion hover:text-mad-white"
              title="Remove tag"
            >
              {word.startsWith("#") ? word : `#${word}`}
              <X className="size-3" />
            </button>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addWord()
            }
          }}
          placeholder="Add tag e.g. SYNERGY"
          className="min-w-[12rem] flex-1 border-2 border-mad-black px-2 py-1.5 font-typewriter text-xs uppercase"
        />
        <button
          type="button"
          onClick={addWord}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
        >
          <Plus className="size-3.5" />
          Add
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Save safety tags
        </button>
      </div>
    </section>
  )
}

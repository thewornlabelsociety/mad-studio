"use client"

import { Loader2, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { customerQuotePlaceholder } from "@/lib/brain/brain-industry-ui"
import {
  QUOTE_SOURCES,
  type BrainQuote,
  type QuoteSource,
} from "@/lib/brain/types"
import { isFudiHospitalityEntity } from "@/lib/studio/fudi-platform"
import { cn } from "@/lib/utils"

export type StreetEarSeed = {
  text: string
  source: QuoteSource
}

export const FUDI_STREET_EAR_SEEDS: StreetEarSeed[] = [
  {
    text: "Stop sending blurry PDF menus",
    source: "instagram_dm",
  },
  {
    text: "Tap table and order? Stupidly easy",
    source: "in_store",
  },
  {
    text: "30% delivery commission is bleeding us dry",
    source: "in_store",
  },
  {
    text: "Having all weekend pop-ups on one map",
    source: "instagram_dm",
  },
  {
    text: "Saw 4:30 PM drop, ate by 5:15",
    source: "instagram_dm",
  },
]

type StreetEarProps = {
  entityId: string
  entityName: string
  industry: string
  quotes: BrainQuote[]
  quoteText: string
  quoteSource: QuoteSource
  pending: boolean
  sourceLabel: Record<string, string>
  onQuoteTextChange: (value: string) => void
  onQuoteSourceChange: (source: QuoteSource) => void
  onAddQuote: () => void
  onDeleteQuote: (quoteId: string) => void
  onApplySeed: (seed: StreetEarSeed) => void
}

function FieldLabel({
  plain,
  marketing,
  htmlFor,
}: {
  plain: string
  marketing: string
  htmlFor?: string
}) {
  return (
    <div className="space-y-0.5">
      <label
        htmlFor={htmlFor}
        className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase"
      >
        {plain}
      </label>
      <p className="text-xs text-neutral-500">{marketing}</p>
    </div>
  )
}

export function StreetEar({
  entityId,
  entityName,
  industry,
  quotes,
  quoteText,
  quoteSource,
  pending,
  sourceLabel,
  onQuoteTextChange,
  onQuoteSourceChange,
  onAddQuote,
  onDeleteQuote,
  onApplySeed,
}: StreetEarProps) {
  const showFudiSeeds = isFudiHospitalityEntity({
    id: entityId,
    name: entityName,
    industry,
  })

  const quotePlaceholder = customerQuotePlaceholder(industry, entityName)

  return (
    <div className="space-y-4">
      <div>
        <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Street Ear // Voice of Customer &amp; Language Bank
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
          Raw verbatims, local slang, and customer objections. The AI mirrors
          these exact phrases in hook generation to eliminate robotic corporate
          copy.
        </p>
      </div>

      <div className="grid gap-3 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
        {showFudiSeeds ? (
          <div className="flex flex-wrap gap-2 border-b-2 border-mad-black/15 pb-3">
            {FUDI_STREET_EAR_SEEDS.map((seed) => (
              <button
                key={seed.text}
                type="button"
                onClick={() => onApplySeed(seed)}
                className={cn(
                  "border-2 border-mad-black bg-[#CCFF00]/50 px-2 py-1 text-left font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase transition hover:bg-[#CCFF00] hover:scale-[1.02]"
                )}
              >
                [ + &quot;{seed.text}&quot; ]
              </button>
            ))}
          </div>
        ) : null}

        <FieldLabel
          plain="Add Customer Quote / DM / Review"
          marketing="Exact customer language"
          htmlFor="quote-text"
        />
        <Textarea
          id="quote-text"
          rows={3}
          value={quoteText}
          onChange={(event) => onQuoteTextChange(event.target.value)}
          placeholder={quotePlaceholder}
          className="rounded-none border-2 border-mad-black"
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-[12rem] flex-1 gap-2">
            <FieldLabel plain="Where did you hear it?" marketing="Source" />
            <Select
              value={quoteSource}
              onValueChange={(value) =>
                onQuoteSourceChange(value as QuoteSource)
              }
            >
              <SelectTrigger className="w-full rounded-none border-2 border-mad-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-mad-black">
                {QUOTE_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={onAddQuote}
            disabled={pending || !quoteText.trim()}
            className="rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.65rem] uppercase text-mad-white shadow-keycap-sm hover:bg-mad-vermillion"
          >
            {pending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Add quote
          </Button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <p className="font-typewriter text-xs tracking-wider text-neutral-500 uppercase">
          No customer quotes yet. Add the first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <article
              key={quote.id}
              className="flex gap-3 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm"
            >
              <div className="min-w-0 flex-1">
                <Badge
                  variant="outline"
                  className="rounded-none border-2 border-mad-black bg-mad-white font-typewriter text-[0.55rem] uppercase"
                >
                  {sourceLabel[quote.source ?? "in_store"] ?? quote.source}
                </Badge>
                <p className="mt-3 text-sm leading-relaxed text-mad-black">
                  &ldquo;{quote.quote_text}&rdquo;
                </p>
              </div>
              <button
                type="button"
                aria-label="Delete quote"
                disabled={pending}
                onClick={() => onDeleteQuote(quote.id)}
                className="size-8 shrink-0 border-2 border-mad-black bg-mad-white font-typewriter text-sm leading-none hover:bg-mad-vermillion hover:text-mad-white disabled:opacity-50"
              >
                ✕
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { ChevronDown, FileUp, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  addCustomerQuote,
  clearCampaignTakeaway,
  deleteCustomerQuote,
  deleteEntityDocument,
  updateCampaignTakeaway,
  uploadEntityDocument,
} from "@/lib/actions"
import { BrainChat } from "@/app/brain/components/brain-chat"
import { AudienceSegmentsEditor } from "@/components/brain/audience-segments-editor"
import { BrainSuggestionBar } from "@/components/brain/brain-suggestion-bar"
import { DnaIntakeWizard } from "@/components/brain/dna-intake-wizard"
import { customerQuotePlaceholder } from "@/lib/brain/brain-industry-ui"
import { VisualPresetCard } from "@/components/brain/visual-preset-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  QUOTE_SOURCES,
  type BrainDocument,
  type BrainQuote,
  type BrainTakeaway,
  type QuoteSource,
} from "@/lib/brain/types"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"

type BrainLabProps = {
  entity: StudioEntityDna
  documents: BrainDocument[]
  quotes: BrainQuote[]
  takeaways: BrainTakeaway[]
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
      <Label
        htmlFor={htmlFor}
        className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase"
      >
        {plain}
      </Label>
      <p className="text-xs text-neutral-500">{marketing}</p>
    </div>
  )
}

export function BrainLab({
  entity,
  documents: initialDocuments,
  quotes: initialQuotes,
  takeaways: initialTakeaways,
}: BrainLabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [documents, setDocuments] = useState(initialDocuments)
  const [quotes, setQuotes] = useState(initialQuotes)
  const [takeaways, setTakeaways] = useState(initialTakeaways)
  const [quoteText, setQuoteText] = useState("")
  const [quoteSource, setQuoteSource] = useState<QuoteSource>("in_store")
  const [dragActive, setDragActive] = useState(false)

  const sourceLabel = useMemo(() => {
    return Object.fromEntries(
      QUOTE_SOURCES.map((source) => [source.value, source.label])
    ) as Record<string, string>
  }, [])

  const quotePlaceholder = useMemo(
    () => customerQuotePlaceholder(entity.industry, entity.name),
    [entity.industry, entity.name]
  )

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("entityId", entity.id)
      formData.set("file", file)
      const result = await uploadEntityDocument(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDocuments((prev) => [
        {
          id: result.data.id,
          title: result.data.title,
          file_url: "",
          extracted_knowledge: result.data.extracted_knowledge,
          doc_type: "guideline",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
      toast.success("Document uploaded and knowledge extracted.")
    } finally {
      setUploading(false)
    }
  }

  function onAddQuote() {
    startTransition(async () => {
      const result = await addCustomerQuote({
        entityId: entity.id,
        quoteText,
        source: quoteSource,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setQuotes((prev) => [
        {
          id: result.data.id,
          quote_text: quoteText.trim(),
          source: quoteSource,
          customer_emotion: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
      setQuoteText("")
      toast.success("Customer quote saved to the Street Ear.")
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b-2 border-mad-black pb-5">
        <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
          {entity.name} // Brand Intelligence
        </p>
        <h1 className="brand-typewriter text-2xl text-mad-black sm:text-3xl">
          Brand Brain
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
          Tune voice, memory, and creative direction — then push seasonal focus
          straight into the workbench.
        </p>
      </div>

      <BrainSuggestionBar entityId={entity.id} />

      <Tabs defaultValue="dna" className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-none border-0 bg-transparent p-0 shadow-none sm:grid-cols-5">
          <TabsTrigger
            value="dna"
            className="rounded-none border-2 border-mad-black bg-mad-white px-3 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm data-[state=active]:bg-mad-black data-[state=active]:text-mad-white data-[state=active]:shadow-none"
          >
            Core DNA
          </TabsTrigger>
          <TabsTrigger
            value="docs"
            className="rounded-none border-2 border-mad-black bg-mad-white px-3 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm data-[state=active]:bg-mad-black data-[state=active]:text-mad-white data-[state=active]:shadow-none"
          >
            Documents
          </TabsTrigger>
          <TabsTrigger
            value="quotes"
            className="rounded-none border-2 border-mad-black bg-mad-white px-3 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm data-[state=active]:bg-mad-black data-[state=active]:text-mad-white data-[state=active]:shadow-none"
          >
            Street Ear
          </TabsTrigger>
          <TabsTrigger
            value="memory"
            className="rounded-none border-2 border-mad-black bg-mad-white px-3 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm data-[state=active]:bg-mad-black data-[state=active]:text-mad-white data-[state=active]:shadow-none"
          >
            Memory
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="col-span-2 rounded-none border-2 border-mad-black bg-mad-white px-3 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase shadow-keycap-sm data-[state=active]:bg-mad-black data-[state=active]:text-mad-white data-[state=active]:shadow-none sm:col-span-1"
          >
            Brand Director
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dna" className="mt-0 space-y-4">
          <VisualPresetCard entity={entity} />
          <DnaIntakeWizard entity={entity} />
          <AudienceSegmentsEditor entity={entity} />
        </TabsContent>

        <TabsContent value="docs" className="mt-0 space-y-4">
          <div>
            <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Documents
            </p>
            <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              Internal Documents & Guidelines
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              Upload PDFs, DOCX, or text files — we extract marketing-director rules
            </p>
          </div>

          <div
            className={`border-2 border-dashed border-mad-black p-8 text-center transition-colors ${
              dragActive ? "bg-mad-lime/40" : "bg-mad-white"
            }`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              const file = event.dataTransfer.files?.[0]
              if (file) void handleFile(file)
            }}
          >
            <FileUp className="mx-auto size-6 text-mad-black" />
            <p className="mt-3 font-typewriter text-sm font-bold tracking-wide text-mad-black uppercase">
              Drag & drop a document here
            </p>
            <p className="mt-1 font-typewriter text-[0.65rem] tracking-wider text-neutral-500 uppercase">
              PDF, DOCX, TXT, MD, CSV
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] uppercase shadow-keycap-sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Extracting…
                </>
              ) : (
                "Choose file"
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="font-typewriter text-xs tracking-wider text-neutral-500 uppercase">
                No documents uploaded yet.
              </p>
            ) : (
              documents.map((doc) => (
                <article
                  key={doc.id}
                  className="space-y-3 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-typewriter text-sm font-bold text-mad-black uppercase">
                        {doc.title}
                      </p>
                      <p
                        className="font-typewriter text-[0.65rem] tracking-wider text-neutral-500 uppercase"
                        suppressHydrationWarning
                      >
                        {doc.doc_type ?? "guideline"} ·{" "}
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-none border-2 border-mad-black hover:bg-mad-vermillion hover:text-mad-white"
                      onClick={() => {
                        startTransition(async () => {
                          const result = await deleteEntityDocument({
                            entityId: entity.id,
                            documentId: doc.id,
                          })
                          if (!result.ok) {
                            toast.error(result.error)
                            return
                          }
                          setDocuments((prev) =>
                            prev.filter((item) => item.id !== doc.id)
                          )
                          toast.success("Document removed.")
                        })
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <pre className="max-h-56 overflow-auto border-2 border-mad-black bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {doc.extracted_knowledge}
                  </pre>
                </article>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="mt-0 space-y-4">
          <div>
            <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Street Ear
            </p>
            <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              Customer Quotes
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              Exact words customers actually say
            </p>
          </div>

          <div className="grid gap-3 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
            <FieldLabel
              plain="Add Customer Quote / DM / Review"
              marketing="Exact customer language"
              htmlFor="quote-text"
            />
            <Textarea
              id="quote-text"
              rows={3}
              value={quoteText}
              onChange={(event) => setQuoteText(event.target.value)}
              placeholder={quotePlaceholder}
              className="rounded-none border-2 border-mad-black"
            />
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid min-w-[12rem] flex-1 gap-2">
                <FieldLabel plain="Where did you hear it?" marketing="Source" />
                <Select
                  value={quoteSource}
                  onValueChange={(value) =>
                    setQuoteSource(value as QuoteSource)
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

          <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
            {quotes.map((quote) => (
              <article
                key={quote.id}
                className="mb-3 break-inside-avoid border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant="outline"
                    className="rounded-none border-2 border-mad-black font-typewriter text-[0.55rem] uppercase"
                  >
                    {sourceLabel[quote.source ?? "in_store"] ?? quote.source}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-none border-2 border-mad-black hover:bg-mad-vermillion hover:text-mad-white"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await deleteCustomerQuote({
                          entityId: entity.id,
                          quoteId: quote.id,
                        })
                        if (!result.ok) {
                          toast.error(result.error)
                          return
                        }
                        setQuotes((prev) =>
                          prev.filter((item) => item.id !== quote.id)
                        )
                      })
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <p className="mt-3 text-sm leading-relaxed">
                  “{quote.quote_text}”
                </p>
              </article>
            ))}
          </div>
          {quotes.length === 0 ? (
            <p className="font-typewriter text-xs tracking-wider text-neutral-500 uppercase">
              No customer quotes yet. Add the first one above.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="memory" className="mt-0 space-y-4">
          <div>
            <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Memory
            </p>
            <h2 className="mt-1 font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              Winning Rules & Audit Log
            </h2>
            <p className="mt-1 text-xs text-neutral-600">
              Learned directives from winner and loss campaigns
            </p>
          </div>

          {takeaways.length === 0 ? (
            <p className="font-typewriter text-xs tracking-wider text-neutral-500 uppercase">
              No learned rules yet. Complete a campaign post-mortem to train the
              brain.
            </p>
          ) : (
            <div className="space-y-3">
              {takeaways.map((item) => (
                <TakeawayEditor
                  key={item.id}
                  item={item}
                  entityId={entity.id}
                  pending={pending}
                  onChange={(next) =>
                    setTakeaways((prev) =>
                      prev.map((row) => (row.id === next.id ? next : row))
                    )
                  }
                  onDelete={(id) =>
                    setTakeaways((prev) => prev.filter((row) => row.id !== id))
                  }
                  startTransition={startTransition}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-0">
          <BrainChat
            entityId={entity.id}
            entityName={entity.name}
            industry={entity.industry}
          />
        </TabsContent>
      </Tabs>

      <Collapsible className="border-2 border-mad-black bg-mad-white shadow-keycap-sm">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-typewriter text-[0.65rem] font-bold tracking-widest text-neutral-500 uppercase hover:bg-mad-lime/30 hover:text-mad-black">
          <span>▾ Advanced Diagnostics</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t-2 border-mad-black px-4 py-3">
          <dl className="grid gap-2 font-mono text-[0.7rem] text-neutral-500 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-400">Entity ID</dt>
              <dd className="break-all text-mad-black">{entity.id}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Organization</dt>
              <dd className="break-all text-mad-black">
                {entity.organization_id}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-400">Industry</dt>
              <dd className="text-mad-black">{entity.industry || "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-400">Website</dt>
              <dd className="truncate text-mad-black">
                {entity.website_url || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-400">Documents / Quotes / Memory</dt>
              <dd className="text-mad-black">
                {documents.length} / {quotes.length} / {takeaways.length}
              </dd>
            </div>
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function TakeawayEditor({
  item,
  entityId,
  pending,
  onChange,
  onDelete,
  startTransition,
}: {
  item: BrainTakeaway
  entityId: string
  pending: boolean
  onChange: (item: BrainTakeaway) => void
  onDelete: (id: string) => void
  startTransition: (cb: () => void) => void
}) {
  const [value, setValue] = useState(item.ai_takeaway)

  return (
    <article className="space-y-3 border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-typewriter text-sm font-bold text-mad-black uppercase">
            {item.title}
          </p>
          <p
            className="font-typewriter text-[0.65rem] tracking-wider text-neutral-500 uppercase"
            suppressHydrationWarning
          >
            {item.outcome_rating} ·{" "}
            {new Date(item.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="rounded-none border-2 border-mad-black font-typewriter text-[0.6rem] uppercase shadow-keycap-sm"
            onClick={() => {
              startTransition(async () => {
                const result = await updateCampaignTakeaway({
                  entityId,
                  campaignId: item.id,
                  aiTakeaway: value,
                })
                if (!result.ok) {
                  toast.error(result.error)
                  return
                }
                onChange({ ...item, ai_takeaway: value })
                toast.success("Learned rule updated.")
              })
            }}
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="rounded-none border-2 border-mad-black font-typewriter text-[0.6rem] uppercase hover:bg-mad-vermillion hover:text-mad-white"
            onClick={() => {
              startTransition(async () => {
                const result = await clearCampaignTakeaway({
                  entityId,
                  campaignId: item.id,
                })
                if (!result.ok) {
                  toast.error(result.error)
                  return
                }
                onDelete(item.id)
                toast.success("Learned rule removed.")
              })
            }}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>
      <Textarea
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="rounded-none border-2 border-mad-black"
      />
    </article>
  )
}

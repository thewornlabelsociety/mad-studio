"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "wouter"
import {
  Archive,
  Copy,
  Filter,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DEFAULT_FORMULA_BANK } from "@/lib/studio/formula-bank"
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_SURFACES,
  type EntityTemplateInstance,
  type PlatformTemplateDef,
  type TemplateInstanceStatus,
} from "@/lib/templates/template-schema"
import {
  CHANNEL_OPTIONS,
  duplicateInstanceLive,
  forkStarterLive,
  loadTemplateCentre,
  updateInstanceLive,
  type TemplateBackendStatus,
  type TemplateDataSource,
} from "@/lib/templates/template-client"
import {
  buildStudioHandoffHref,
  categoryLabel,
} from "@/lib/templates/template-handoff"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"

type TabId = "mine" | "starters"

type Props = {
  entityId: string
  entityName: string
}

type EditorDraft = {
  name: string
  creative_instructions: string
  default_studio_caption: string
  status: TemplateInstanceStatus
  formula_hook_id: string
  story_style_preset: string
  canvas_layout_id: string
  channel_plan: string[]
  placeholdersText: string
  surfaces: string[]
}

function toDraft(instance: EntityTemplateInstance): EditorDraft {
  return {
    name: instance.name,
    creative_instructions: instance.creative_instructions,
    default_studio_caption: instance.payload.default_studio_caption ?? "",
    status: instance.status,
    formula_hook_id: instance.formula_hook_id ?? "",
    story_style_preset: instance.story_style_preset ?? "",
    canvas_layout_id: instance.canvas_layout_id ?? "",
    channel_plan: [...instance.channel_plan],
    placeholdersText: (instance.payload.placeholders ?? []).join(", "),
    surfaces: [...(instance.payload.surfaces ?? ["social_post"])],
  }
}

function SourceBanner({ status }: { status: TemplateBackendStatus }) {
  if (status.source === "live") {
    return (
      <div className="border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
        <span className="font-semibold">Live brand data</span>
        {" — "}
        templates load from MAD Supabase for this entity only.
      </div>
    )
  }
  return (
    <div className="border-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-semibold uppercase tracking-wide">
        Demo data — not saved
      </p>
      <p className="mt-1">
        {status.message} Copy, save, activate, duplicate, and generate stay
        disabled until the Phase 3B migration is applied.
      </p>
      {status.detail ? (
        <p className="mt-1 font-mono text-xs text-amber-900/80">{status.detail}</p>
      ) : null}
    </div>
  )
}

function EmptyState({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10">
      <LayoutTemplate className="size-6 text-neutral-400" aria-hidden />
      <p className="font-medium text-mad-black">{title}</p>
      <p className="max-w-md text-sm text-neutral-600">{body}</p>
    </div>
  )
}

export function TemplateCentreWorkspace({ entityId, entityName }: Props) {
  const [tab, setTab] = useState<TabId>("mine")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<TemplateBackendStatus | null>(null)
  const [starters, setStarters] = useState<PlatformTemplateDef[]>([])
  const [instances, setInstances] = useState<EntityTemplateInstance[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditorDraft | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const bundle = await loadTemplateCentre(entityId)
      setStatus(bundle.status)
      setStarters(bundle.starters)
      setInstances(
        bundle.instances.filter((row) => row.entity_id === entityId)
      )
      setSelectedId((prev) => {
        if (prev && bundle.instances.some((row) => row.id === prev)) return prev
        return bundle.instances[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.")
      setStatus(null)
      setStarters([])
      setInstances([])
    } finally {
      setLoading(false)
    }
  }, [entityId])

  useEffect(() => {
    void reload()
  }, [reload])

  const selected = useMemo(
    () => instances.find((row) => row.id === selectedId) ?? null,
    [instances, selectedId]
  )

  useEffect(() => {
    if (selected) setDraft(toDraft(selected))
    else setDraft(null)
  }, [selected])

  const filteredInstances = useMemo(() => {
    const q = query.trim().toLowerCase()
    return instances.filter((row) => {
      if (row.entity_id !== entityId) return false
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.creative_instructions.toLowerCase().includes(q)
      )
    })
  }, [instances, entityId, categoryFilter, query])

  const filteredStarters = useMemo(() => {
    const q = query.trim().toLowerCase()
    return starters.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false
      if (!q) return true
      return (
        row.title.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q)
      )
    })
  }, [starters, categoryFilter, query])

  const source: TemplateDataSource | null = status?.source ?? null
  const canMutate = Boolean(status?.mutationsEnabled)
  const canGenerate = Boolean(status?.generateEnabled)

  async function onFork(starter: PlatformTemplateDef) {
    if (!canMutate) {
      toast.message("Copy starter requires the template database migration.")
      return
    }
    setBusy(true)
    try {
      const instance = await forkStarterLive({
        entityId,
        starterId: starter.id,
        name: `${starter.title} — ${entityName}`.slice(0, 200),
      })
      toast.success("Starter copied into this brand.")
      setTab("mine")
      await reload()
      setSelectedId(instance.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fork failed.")
    } finally {
      setBusy(false)
    }
  }

  async function onDuplicate() {
    if (!selected || !canMutate) {
      toast.message("Duplicate requires the template database migration.")
      return
    }
    setBusy(true)
    try {
      const instance = await duplicateInstanceLive({
        entityId,
        instanceId: selected.id,
        name: `${selected.name} (copy)`.slice(0, 200),
      })
      toast.success("Template duplicated.")
      await reload()
      setSelectedId(instance.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed.")
    } finally {
      setBusy(false)
    }
  }

  async function onSave(nextStatus?: TemplateInstanceStatus) {
    if (!selected || !draft || !canMutate) {
      toast.message("Saving requires the template database migration.")
      return
    }
    setBusy(true)
    try {
      const placeholders = draft.placeholdersText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 24)
      const updated = await updateInstanceLive({
        entityId,
        instanceId: selected.id,
        name: draft.name,
        creative_instructions: draft.creative_instructions,
        status: nextStatus ?? draft.status,
        formula_hook_id: draft.formula_hook_id || null,
        story_style_preset: draft.story_style_preset || null,
        canvas_layout_id: draft.canvas_layout_id || null,
        channel_plan: draft.channel_plan,
        payload: {
          surfaces: draft.surfaces as EntityTemplateInstance["payload"]["surfaces"],
          default_channels: draft.channel_plan,
          creative_instructions: draft.creative_instructions,
          formula_hook_id: draft.formula_hook_id || null,
          story_style_preset: draft.story_style_preset || null,
          canvas_layout_id: draft.canvas_layout_id || null,
          placeholders,
          default_studio_caption: draft.default_studio_caption.trim() || undefined,
        },
      })
      toast.success(
        nextStatus === "active"
          ? "Template activated."
          : nextStatus === "archived"
            ? "Template archived."
            : "Template saved (new version)."
      )
      await reload()
      setSelectedId(updated.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setBusy(false)
    }
  }

  function toggleChannel(id: string) {
    setDraft((prev) => {
      if (!prev) return prev
      const has = prev.channel_plan.includes(id)
      return {
        ...prev,
        channel_plan: has
          ? prev.channel_plan.filter((c) => c !== id)
          : [...prev.channel_plan, id],
      }
    })
  }

  function toggleSurface(id: string) {
    setDraft((prev) => {
      if (!prev) return prev
      const has = prev.surfaces.includes(id)
      const next = has
        ? prev.surfaces.filter((s) => s !== id)
        : [...prev.surfaces, id]
      return { ...prev, surfaces: next.length ? next : ["social_post"] }
    })
  }

  const studioHref =
    selected && canGenerate
      ? buildStudioHandoffHref({ entityId, template: selected })
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-neutral-500 uppercase">
            Template Centre
          </p>
          <h1 className="brand-typewriter text-2xl text-mad-black sm:text-3xl">
            {entityName}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-600">
            Brand-owned templates and platform starters. Generate still uses
            Studio → Review → Schedule — not a separate publishing engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isWornLabelFashionEntity({ name: entityName }) ? (
            <Button
              asChild
              size="sm"
              className="rounded-none border-2 border-mad-black bg-mad-black text-mad-white"
            >
              <Link
                href={`/templates/wls-daily-story?eid=${encodeURIComponent(entityId)}`}
              >
                <Sparkles className="size-3.5" aria-hidden />
                Daily Arrival Story
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={loading || busy}
            className="rounded-none border-2 border-mad-black"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-none border-2 border-mad-black"
          >
            <Link href={`/studio?eid=${encodeURIComponent(entityId)}&step=2`}>
              Advanced Edit
            </Link>
          </Button>
        </div>
      </header>

      {status ? <SourceBanner status={status} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-neutral-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading templates…
        </div>
      ) : error ? (
        <div className="border-2 border-mad-vermillion/40 bg-red-50 px-4 py-6 text-sm text-red-950">
          <p className="font-semibold">Could not load Template Centre</p>
          <p className="mt-1">{error}</p>
          <Button
            type="button"
            size="sm"
            className="mt-3 rounded-none"
            onClick={() => void reload()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-2">
            {(
              [
                ["mine", "My Templates"],
                ["starters", "Starter Library"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "px-3 py-1.5 font-typewriter text-xs font-bold tracking-wider uppercase",
                  tab === id
                    ? "bg-mad-black text-mad-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Filter className="size-3.5 text-neutral-400" aria-hidden />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-[10rem] rounded-none border-neutral-300 text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabel(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                className="h-8 w-40 rounded-none border-neutral-300 text-xs"
              />
              {source === "mock" ? (
                <span className="rounded-none bg-amber-200 px-2 py-1 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase">
                  Demo
                </span>
              ) : (
                <span className="rounded-none bg-emerald-200 px-2 py-1 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase">
                  Live
                </span>
              )}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <section className="min-h-0 space-y-2 overflow-y-auto">
              {tab === "mine" ? (
                filteredInstances.length === 0 ? (
                  <EmptyState
                    title="No brand templates yet"
                    body={
                      canMutate
                        ? "Open Starter Library and copy a starter into this brand."
                        : "Demo list is empty for this filter — clear filters, or apply the migration to create real templates."
                    }
                  />
                ) : (
                  filteredInstances.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        "w-full border-2 px-3 py-3 text-left transition-colors",
                        selectedId === row.id
                          ? "border-mad-black bg-mad-white"
                          : "border-transparent bg-neutral-50 hover:border-neutral-300"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-mad-black">{row.name}</p>
                        <span className="shrink-0 font-typewriter text-[0.6rem] tracking-wider text-neutral-500 uppercase">
                          {row.status} · v{row.version}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                        {row.creative_instructions || "No instructions yet."}
                      </p>
                      <p className="mt-2 font-typewriter text-[0.6rem] tracking-wider text-neutral-400 uppercase">
                        {categoryLabel(row.category)}
                        {source === "mock" ? " · demo" : ""}
                      </p>
                    </button>
                  ))
                )
              ) : filteredStarters.length === 0 ? (
                <EmptyState
                  title="No starters match"
                  body="Clear filters to see the platform starter library."
                />
              ) : (
                filteredStarters.map((starter) => (
                  <div
                    key={starter.id}
                    className="border border-neutral-200 bg-neutral-50 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-mad-black">
                          {starter.title}
                        </p>
                        <p className="mt-1 text-xs text-neutral-600">
                          {starter.description}
                        </p>
                        <p className="mt-2 font-typewriter text-[0.6rem] tracking-wider text-neutral-400 uppercase">
                          {categoryLabel(starter.category)} · read-only starter
                          {source === "mock" ? " · demo" : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canMutate || busy}
                        title={
                          canMutate
                            ? "Copy into this brand"
                            : "Requires database migration"
                        }
                        className="shrink-0 rounded-none"
                        onClick={() => void onFork(starter)}
                      >
                        <Plus className="size-3.5" aria-hidden />
                        Copy to brand
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="min-h-0 overflow-y-auto border-2 border-mad-black bg-mad-white p-4">
              {tab === "starters" ? (
                <div className="space-y-3 text-sm text-neutral-700">
                  <p className="font-semibold text-mad-black">Starter library</p>
                  <p>
                    Platform starters are immutable. Copy one into{" "}
                    <strong>{entityName}</strong> to customize creative
                    instructions, channels, and placeholders. Global edit is
                    never available here.
                  </p>
                  <ol className="list-decimal space-y-1 pl-5 text-neutral-600">
                    <li>Copy starter → My Templates</li>
                    <li>Edit &amp; activate</li>
                    <li>Generate in Studio → Review → Approve → Schedule</li>
                  </ol>
                </div>
              ) : !selected || !draft ? (
                <EmptyState
                  title="Select a template"
                  body="Pick a brand template to preview and edit."
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-typewriter text-[0.65rem] tracking-widest text-neutral-500 uppercase">
                        Editor · {source === "mock" ? "demo preview" : "live"}
                      </p>
                      <h2 className="text-lg font-semibold text-mad-black">
                        {draft.name}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canMutate || busy}
                        className="rounded-none border-2 border-mad-black"
                        onClick={() => void onDuplicate()}
                      >
                        <Copy className="size-3.5" aria-hidden />
                        Duplicate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canMutate || busy}
                        className="rounded-none border-2 border-mad-black"
                        onClick={() => void onSave("archived")}
                      >
                        <Archive className="size-3.5" aria-hidden />
                        Archive
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tmpl-name">Name</Label>
                    <Input
                      id="tmpl-name"
                      value={draft.name}
                      disabled={!canMutate || busy}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, name: e.target.value } : d))
                      }
                      className="rounded-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tmpl-instructions">
                      Creative instructions
                    </Label>
                    <Textarea
                      id="tmpl-instructions"
                      value={draft.creative_instructions}
                      disabled={!canMutate || busy}
                      rows={5}
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? { ...d, creative_instructions: e.target.value }
                            : d
                        )
                      }
                      className="rounded-none"
                    />
                    <p className="text-xs text-neutral-500">
                      Used for AI pack generation and as a fallback Studio brief
                      when no default caption is set.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tmpl-studio-caption">
                      Default Create caption
                    </Label>
                    <Textarea
                      id="tmpl-studio-caption"
                      value={draft.default_studio_caption}
                      disabled={!canMutate || busy}
                      rows={4}
                      placeholder="e.g. New arrivals just landed — tap through to shop ✨ Link in bio."
                      onChange={(e) =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                default_studio_caption: e.target.value,
                              }
                            : d
                        )
                      }
                      className="rounded-none"
                    />
                    <p className="text-xs text-neutral-500">
                      Prefills the Copy step when you apply this template in
                      Studio (Start from template, Generate in Studio, or Daily
                      New Arrival Story). Overrides merged listing text when
                      set.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Formula hook</Label>
                      <Select
                        value={draft.formula_hook_id || "none"}
                        disabled={!canMutate || busy}
                        onValueChange={(value) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  formula_hook_id:
                                    value === "none" ? "" : value,
                                }
                              : d
                          )
                        }
                      >
                        <SelectTrigger className="rounded-none">
                          <SelectValue placeholder="Hook" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {DEFAULT_FORMULA_BANK.hook_styles.map((hook) => (
                            <SelectItem key={hook.id} value={hook.id}>
                              {hook.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tmpl-status">Status</Label>
                      <Select
                        value={draft.status}
                        disabled={!canMutate || busy}
                        onValueChange={(value) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  status: value as TemplateInstanceStatus,
                                }
                              : d
                          )
                        }
                      >
                        <SelectTrigger id="tmpl-status" className="rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="tmpl-placeholders">
                      Placeholders (comma-separated)
                    </Label>
                    <Input
                      id="tmpl-placeholders"
                      value={draft.placeholdersText}
                      disabled={!canMutate || busy}
                      onChange={(e) =>
                        setDraft((d) =>
                          d ? { ...d, placeholdersText: e.target.value } : d
                        )
                      }
                      className="rounded-none"
                      placeholder="item, brand, location"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Channels</Label>
                    <div className="flex flex-wrap gap-2">
                      {CHANNEL_OPTIONS.map((ch) => {
                        const on = draft.channel_plan.includes(ch.id)
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            disabled={!canMutate || busy}
                            onClick={() => toggleChannel(ch.id)}
                            className={cn(
                              "border px-2 py-1 text-xs",
                              on
                                ? "border-mad-black bg-mad-black text-mad-white"
                                : "border-neutral-300 text-neutral-600"
                            )}
                          >
                            {ch.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Surfaces</Label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATE_SURFACES.map((surface) => {
                        const on = draft.surfaces.includes(surface)
                        return (
                          <button
                            key={surface}
                            type="button"
                            disabled={!canMutate || busy}
                            onClick={() => toggleSurface(surface)}
                            className={cn(
                              "border px-2 py-1 text-xs",
                              on
                                ? "border-mad-black bg-mad-black text-mad-white"
                                : "border-neutral-300 text-neutral-600"
                            )}
                          >
                            {categoryLabel(surface)}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="tmpl-layout">Canvas layout id</Label>
                      <Input
                        id="tmpl-layout"
                        value={draft.canvas_layout_id}
                        disabled={!canMutate || busy}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? { ...d, canvas_layout_id: e.target.value }
                              : d
                          )
                        }
                        className="rounded-none"
                        placeholder="optional"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tmpl-story">Story style preset</Label>
                      <Input
                        id="tmpl-story"
                        value={draft.story_style_preset}
                        disabled={!canMutate || busy}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? { ...d, story_style_preset: e.target.value }
                              : d
                          )
                        }
                        className="rounded-none"
                        placeholder="optional"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
                    <Button
                      type="button"
                      disabled={!canMutate || busy}
                      className="rounded-none"
                      onClick={() => void onSave()}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Save version
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canMutate || busy}
                      className="rounded-none border-2 border-mad-black"
                      onClick={() => void onSave("active")}
                    >
                      Save &amp; activate
                    </Button>
                    {studioHref ? (
                      <Button asChild className="rounded-none bg-mad-vermillion">
                        <Link href={studioHref}>
                          <Sparkles className="size-3.5" aria-hidden />
                          Generate in Studio
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled
                        title="Requires live templates + migration"
                        className="rounded-none"
                      >
                        <Sparkles className="size-3.5" aria-hidden />
                        Generate in Studio
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-neutral-500">
                    Journey: Generate (Studio pack) → Review → Approve → Schedule
                    on the existing Create / Calendar flows. Publishing channels
                    are unchanged.
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

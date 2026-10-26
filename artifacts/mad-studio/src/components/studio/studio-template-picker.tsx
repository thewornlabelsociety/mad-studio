"use client"

import { useEffect, useState } from "react"
import { LayoutTemplate, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  entityTemplateInstanceSchema,
  type EntityTemplateInstance,
} from "@/lib/templates/template-schema"

type Props = {
  entityId: string
  selectedTemplateId: string | null
  selectedTemplateName: string | null
  onSelectTemplate: (templateInstanceId: string) => void | Promise<void>
  onClearTemplate: () => void
  busy?: boolean
  disabled?: boolean
}

export function StudioTemplatePicker({
  entityId,
  selectedTemplateId,
  selectedTemplateName,
  onSelectTemplate,
  onClearTemplate,
  busy = false,
  disabled = false,
}: Props) {
  const [instances, setInstances] = useState<EntityTemplateInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void fetch(
      `/api/templates/instances?entityId=${encodeURIComponent(entityId)}`,
      { credentials: "same-origin" }
    )
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          instances?: unknown[]
          error?: string
        }
        if (!res.ok) {
          throw new Error(data.error || "Could not load templates.")
        }
        const rows = Array.isArray(data.instances) ? data.instances : []
        const parsed = rows
          .map((row) => {
            try {
              return entityTemplateInstanceSchema.parse(row)
            } catch {
              return null
            }
          })
          .filter((row): row is EntityTemplateInstance => row !== null)
          .filter((row) => row.status === "active")
          .sort((a, b) => a.name.localeCompare(b.name))
        if (!cancelled) setInstances(parsed)
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Could not load templates."
          )
          setInstances([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entityId])

  if (selectedTemplateId && selectedTemplateName) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
        <LayoutTemplate className="size-4 shrink-0 text-mad-black" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-neutral-800">
          <span className="text-neutral-500">Using template:</span>{" "}
          <span className="font-medium">{selectedTemplateName}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-neutral-600"
          disabled={disabled || busy}
          onClick={() => {
            if (busy) return
            if (
              window.confirm(
                "Switch template? Your media tray stays as-is until you add or replace products."
              )
            ) {
              onClearTemplate()
            }
          }}
        >
          <X className="size-3.5" aria-hidden />
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-3 space-y-1.5">
      <p className="text-xs font-medium text-neutral-600">Start from template</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          disabled={disabled || busy || loading || instances.length === 0}
          onValueChange={(value) => {
            void onSelectTemplate(value)
          }}
        >
          <SelectTrigger className="h-9 max-w-full min-w-[12rem] flex-1 bg-white text-sm">
            <SelectValue
              placeholder={
                loading
                  ? "Loading templates…"
                  : loadError
                    ? "Templates unavailable"
                    : instances.length === 0
                      ? "No active templates — use Template Centre"
                      : "Choose a brand template"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {instances.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(busy || loading) && (
          <Loader2
            className="size-4 shrink-0 animate-spin text-neutral-400"
            aria-label="Loading"
          />
        )}
      </div>
      {loadError ? (
        <p className="text-xs text-amber-800">{loadError}</p>
      ) : (
        <p className="text-xs text-neutral-500">
          Optional — pre-fills creative brief and hooks. WLS Daily Story uses
          Synced products below.
        </p>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AnalyticsSnapshot } from "@/lib/campaigns/ledger"

type LogNumbersModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  entityId: string
  initial?: AnalyticsSnapshot | null
  onSaved?: (analytics: AnalyticsSnapshot) => void
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
      <Label htmlFor={htmlFor}>{plain}</Label>
      <p className="text-muted-foreground text-xs">{marketing}</p>
    </div>
  )
}

export function LogNumbersModal({
  open,
  onOpenChange,
  campaignId,
  entityId,
  initial,
  onSaved,
}: LogNumbersModalProps) {
  const router = useRouter()
  const [spend, setSpend] = useState(String(initial?.spend ?? ""))
  const [revenue, setRevenue] = useState(String(initial?.revenue ?? ""))
  const [conversions, setConversions] = useState(
    String(initial?.conversions_count ?? "")
  )
  const [impressions, setImpressions] = useState(
    String(initial?.impressions ?? "")
  )
  const [clicks, setClicks] = useState(String(initial?.clicks ?? ""))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch("/api/analytics/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          entityId,
          spend: Number(spend || 0),
          revenue: Number(revenue || 0),
          conversionsCount: Number(conversions || 0),
          impressions: Number(impressions || 0),
          clicks: Number(clicks || 0),
        }),
      })
      const payload = (await response.json()) as {
        analytics?: AnalyticsSnapshot
        error?: string
      }
      if (!response.ok || !payload.analytics) {
        throw new Error(payload.error ?? "Failed to log numbers.")
      }
      toast.success("Spend and sales logged.")
      onSaved?.(payload.analytics)
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not log numbers."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Spend / Sales</DialogTitle>
          <DialogDescription>
            Enter the money numbers. Profit, ROAS, and CPA calculate
            automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <FieldLabel
              plain="Money Spent ($)"
              marketing="Ad Cost"
              htmlFor="spend"
            />
            <Input
              id="spend"
              type="number"
              min="0"
              step="0.01"
              required
              value={spend}
              onChange={(event) => setSpend(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <FieldLabel
              plain="Sales Made ($)"
              marketing="Gross Revenue"
              htmlFor="revenue"
            />
            <Input
              id="revenue"
              type="number"
              min="0"
              step="0.01"
              required
              value={revenue}
              onChange={(event) => setRevenue(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <FieldLabel
              plain="Total Customers / Orders"
              marketing="Conversions"
              htmlFor="conversions"
            />
            <Input
              id="conversions"
              type="number"
              min="0"
              step="1"
              required
              value={conversions}
              onChange={(event) => setConversions(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="text-muted-foreground text-left text-xs underline-offset-2 hover:underline"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced
              ? "Hide diagnostic inputs"
              : "Add Views & Clicks (optional)"}
          </button>

          {showAdvanced ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <FieldLabel
                  plain="Views"
                  marketing="Impressions"
                  htmlFor="impressions"
                />
                <Input
                  id="impressions"
                  type="number"
                  min="0"
                  step="1"
                  value={impressions}
                  onChange={(event) => setImpressions(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel
                  plain="Link Visits"
                  marketing="Clicks"
                  htmlFor="clicks"
                />
                <Input
                  id="clicks"
                  type="number"
                  min="0"
                  step="1"
                  value={clicks}
                  onChange={(event) => setClicks(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Saving…
                </>
              ) : (
                "Save numbers"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "@/lib/next-compat"
import { Loader2, PlugZap, Save, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import {
  deactivateSocialConnection,
  upsertSocialConnection,
} from "@/lib/actions"
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
import type { SocialConnectionPublic, SocialPlatform } from "@/lib/social/types"
import { cn } from "@/lib/utils"

type PlatformCardConfig = {
  platform: SocialPlatform
  title: string
  subtitle: string
  accountLabel: string
  tokenLabel: string
  readyNote?: string
  schemaOnly?: boolean
}

const CARDS: PlatformCardConfig[] = [
  {
    platform: "instagram",
    title: "Instagram Business / Creator",
    subtitle: "Connect via Meta OAuth or paste tokens manually",
    accountLabel: "IG Business User ID",
    tokenLabel: "Page / IG access token",
    readyNote:
      "Use Connect with Meta to save Page + Instagram tokens to social_connections.",
  },
  {
    platform: "facebook",
    title: "Facebook Page",
    subtitle: "Same Meta login links your Facebook Page token",
    accountLabel: "Facebook Page ID",
    tokenLabel: "Page Access Token",
  },
  {
    platform: "tiktok",
    title: "TikTok Business",
    subtitle: "Direct Post via TikTok login (webhook as fallback)",
    accountLabel: "TikTok Business Account ID",
    tokenLabel: "Access token (optional)",
    schemaOnly: false,
    readyNote:
      "Publishing posts straight to TikTok with this connection. Without one, the payload goes to your Outbound Webhook URL.",
  },
]

type Props = {
  entityId: string
  brandName: string
  initialConnections: SocialConnectionPublic[]
}

type DraftForm = {
  connectionId: string | null
  accountId: string
  accountName: string
  accessToken: string
}

function formatSyncTime(iso: string | null | undefined): string {
  if (!iso) return "Never"
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function SocialConnectionsPanel({
  entityId,
  brandName,
  initialConnections,
}: Props) {
  const router = useRouter()
  const [connections, setConnections] = useState(initialConnections)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get("status")
    const reason = params.get("reason")
    if (status === "meta_connected") {
      toast.success("Instagram and Facebook connected via Meta.")
      router.replace(`/settings/social?eid=${encodeURIComponent(entityId)}`)
    } else if (status === "meta_error") {
      toast.error(reason ? `Meta login failed: ${reason}` : "Meta login failed.")
      router.replace(`/settings/social?eid=${encodeURIComponent(entityId)}`)
    } else if (status === "tiktok_connected") {
      toast.success("TikTok connected — Direct Post ready (sandbox = private videos).")
      router.replace(`/settings/social?eid=${encodeURIComponent(entityId)}`)
      router.refresh()
    } else if (status === "tiktok_error") {
      toast.error(reason ? `TikTok login failed: ${reason}` : "TikTok login failed.")
      router.replace(`/settings/social?eid=${encodeURIComponent(entityId)}`)
    }
  }, [entityId, router])
  const [editing, setEditing] = useState<PlatformCardConfig | null>(null)
  const [draft, setDraft] = useState<DraftForm>({
    connectionId: null,
    accountId: "",
    accountName: "",
    accessToken: "",
  })
  const [pending, startTransition] = useTransition()
  const [testingPlatform, setTestingPlatform] = useState<SocialPlatform | null>(
    null
  )

  const byPlatform = useMemo(() => {
    const map = new Map<SocialPlatform, SocialConnectionPublic>()
    for (const row of connections) {
      if (!row.is_active) continue
      const existing = map.get(row.platform)
      if (!existing || row.updated_at > existing.updated_at) {
        map.set(row.platform, row)
      }
    }
    return map
  }, [connections])

  function openEditor(card: PlatformCardConfig) {
    const current = byPlatform.get(card.platform)
    setEditing(card)
    setDraft({
      connectionId: current?.id ?? null,
      accountId: current?.account_id ?? "",
      accountName: current?.account_name ?? "",
      accessToken: "",
    })
  }

  function saveConnection() {
    if (!editing) return
    startTransition(async () => {
      const result = await upsertSocialConnection({
        entityId,
        platform: editing.platform,
        connectionId: draft.connectionId,
        accountId: draft.accountId,
        accountName: draft.accountName,
        accessToken: draft.accessToken || undefined,
        keepExistingToken: Boolean(draft.connectionId) && !draft.accessToken,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConnections((rows) => {
        const without = rows.filter((row) => row.id !== result.data.id)
        return [...without, result.data]
      })
      setEditing(null)
      toast.success(`${editing.title} credentials saved.`)
      router.refresh()
    })
  }

  function disconnect(platform: SocialPlatform) {
    const current = byPlatform.get(platform)
    if (!current) return
    startTransition(async () => {
      const result = await deactivateSocialConnection({
        entityId,
        connectionId: current.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setConnections((rows) =>
        rows.map((row) =>
          row.id === current.id ? { ...row, is_active: false } : row
        )
      )
      toast.success("Connection deactivated.")
      router.refresh()
    })
  }

  async function testConnection(card: PlatformCardConfig) {
    const current = byPlatform.get(card.platform)
    setTestingPlatform(card.platform)
    try {
      const params = new URLSearchParams({
        entityId,
        platform: card.platform,
      })
      if (current?.id) params.set("connectionId", current.id)
      const response = await fetch(`/api/social/verify?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      })
      const payload = (await response.json()) as {
        ok?: boolean
        message?: string
        accountName?: string
        error?: string
      }
      if (!response.ok || payload.ok === false) {
        toast.error(payload.message || payload.error || "Connection test failed.")
        return
      }
      toast.success(payload.message || "Verified & Ready to Dispatch")
      if (payload.accountName && current) {
        setConnections((rows) =>
          rows.map((row) =>
            row.id === current.id
              ? {
                  ...row,
                  account_name: payload.accountName || row.account_name,
                  updated_at: new Date().toISOString(),
                }
              : row
          )
        )
      }
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connection test failed."
      )
    } finally {
      setTestingPlatform(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap">
        <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Active tenant
        </p>
        <h2 className="mt-1 font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
          {brandName}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Store Instagram, Facebook, and TikTok credentials for this brand only.
          Tokens never appear in full after save — update by pasting a new token.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {CARDS.map((card) => {
          const connection = byPlatform.get(card.platform)
          const connected = Boolean(connection?.is_active && connection.token_configured)
          const testing = testingPlatform === card.platform

          return (
            <article
              key={card.platform}
              className="flex flex-col border-2 border-mad-black bg-mad-white p-4 shadow-keycap-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-typewriter text-sm font-bold tracking-tight text-mad-black uppercase">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    {card.subtitle}
                  </p>
                </div>
                <StatusPill
                  connected={connected}
                  schemaOnly={card.schemaOnly}
                />
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
                    Account name
                  </dt>
                  <dd className="text-mad-black">
                    {connection?.account_name || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
                    Account ID
                  </dt>
                  <dd className="font-mono text-xs text-mad-black">
                    {connection?.account_id || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
                    Token
                  </dt>
                  <dd className="font-mono text-xs text-neutral-600">
                    {connection?.token_preview || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
                    Last token sync
                  </dt>
                  <dd className="text-xs text-neutral-600">
                    {formatSyncTime(connection?.updated_at)}
                  </dd>
                </div>
              </dl>

              {card.readyNote ? (
                <p className="mt-3 text-xs text-neutral-500">{card.readyNote}</p>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {card.platform === "instagram" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-none border-2 border-mad-black bg-mad-lime font-typewriter text-[0.6rem] uppercase shadow-keycap-sm hover:bg-mad-white"
                    asChild
                  >
                    <a
                      href={`/api/auth/meta?entityId=${encodeURIComponent(entityId)}`}
                    >
                      <PlugZap data-icon="inline-start" />
                      Connect with Meta
                    </a>
                  </Button>
                ) : null}
                {card.platform === "tiktok" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-none border-2 border-mad-black bg-mad-lime font-typewriter text-[0.6rem] uppercase shadow-keycap-sm hover:bg-mad-white"
                    asChild
                  >
                    <a
                      href={`/api/auth/tiktok?entityId=${encodeURIComponent(entityId)}`}
                    >
                      <PlugZap data-icon="inline-start" />
                      Connect with TikTok
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] uppercase text-mad-white shadow-keycap-sm hover:bg-mad-vermillion"
                  onClick={() => openEditor(card)}
                  disabled={pending}
                >
                  <Save data-icon="inline-start" />
                  {connected ? "Update" : "Configure"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-none border-2 border-mad-black font-typewriter text-[0.6rem] uppercase shadow-keycap-sm"
                  onClick={() => void testConnection(card)}
                  disabled={pending || testing || (!connected && !card.schemaOnly)}
                >
                  {testing ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <ShieldCheck data-icon="inline-start" />
                  )}
                  Test Connection
                </Button>
                {connected ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-none font-typewriter text-[0.6rem] uppercase"
                    onClick={() => disconnect(card.platform)}
                    disabled={pending}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="rounded-none border-2 border-mad-black sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-typewriter text-sm uppercase">
              {editing?.title}
            </DialogTitle>
            <DialogDescription>
              Upserts into <code>social_connections</code> for {brandName}. Leave
              token blank when editing to keep the existing secret.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="social-account-name">Display name / username</Label>
              <Input
                id="social-account-name"
                value={draft.accountName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    accountName: event.target.value,
                  }))
                }
                placeholder={
                  editing?.platform === "instagram"
                    ? "@wornlabelsociety"
                    : "Page name"
                }
                className="rounded-none border-2 border-mad-black"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="social-account-id">
                {editing?.accountLabel ?? "Account ID"}
              </Label>
              <Input
                id="social-account-id"
                value={draft.accountId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    accountId: event.target.value,
                  }))
                }
                placeholder="Numeric Meta ID"
                className="rounded-none border-2 border-mad-black font-mono text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="social-access-token">
                {editing?.tokenLabel ?? "Access token"}
              </Label>
              <Input
                id="social-access-token"
                type="password"
                value={draft.accessToken}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    accessToken: event.target.value,
                  }))
                }
                placeholder={
                  draft.connectionId
                    ? "Paste new token to rotate (or leave blank)"
                    : "Paste long-lived access token"
                }
                className="rounded-none border-2 border-mad-black font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-none border-2 border-mad-black"
              onClick={() => setEditing(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-none border-2 border-mad-black bg-mad-black text-mad-white hover:bg-mad-vermillion"
              onClick={saveConnection}
              disabled={pending || !draft.accountId.trim()}
            >
              {pending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <PlugZap data-icon="inline-start" />
              )}
              Save Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusPill({
  connected,
  schemaOnly,
}: {
  connected: boolean
  schemaOnly?: boolean
}) {
  if (schemaOnly && !connected) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[0.65rem] font-medium text-amber-800">
        Schema Ready
      </span>
    )
  }

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[0.65rem] font-medium",
        connected
          ? "bg-emerald-50 text-emerald-700"
          : "bg-neutral-100 text-neutral-500"
      )}
    >
      {connected ? "Connected" : "Not Configured"}
    </span>
  )
}

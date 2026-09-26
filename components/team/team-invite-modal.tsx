"use client"

import { useMemo, useState, useTransition } from "react"
import { Copy, Link2, Users } from "lucide-react"

import { createInvitation } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  INVITE_ROLES,
  roleRequiresEntity,
  type AccessibleEntity,
  type InviteRole,
} from "@/lib/types"

type TeamInviteModalProps = {
  organizationId: string
  entities: AccessibleEntity[]
}

const ROLE_LABELS: Record<InviteRole, string> = {
  org_admin: "Org Admin",
  entity_manager: "Entity Manager",
  creator: "Creator",
  viewer: "Viewer",
}

export function TeamInviteModal({
  organizationId,
  entities,
}: TeamInviteModalProps) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<InviteRole>("viewer")
  const [entityId, setEntityId] = useState<string>("")
  const [email, setEmail] = useState("")
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const entityRequired = roleRequiresEntity(role)
  const orgEntities = useMemo(
    () => entities.filter((entity) => entity.organization_id === organizationId),
    [entities, organizationId]
  )

  function resetForm() {
    setRole("viewer")
    setEntityId("")
    setEmail("")
    setInviteUrl(null)
    setError(null)
    setCopied(false)
  }

  function onGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await createInvitation({
        organizationId,
        role,
        entityId: entityId || null,
        email: email || null,
      })

      if (!result.ok) {
        setError(result.error)
        setInviteUrl(null)
        return
      }

      setInviteUrl(result.inviteUrl)
    })
  }

  async function onCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          resetForm()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users data-icon="inline-start" />
          Team
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite teammate</DialogTitle>
          <DialogDescription>
            Generate a 7-day invite link. Org admins can invite across the
            organization; entity roles can be scoped to a brand.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                setRole(value as InviteRole)
                setInviteUrl(null)
              }}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {INVITE_ROLES.map((inviteRole) => (
                  <SelectItem key={inviteRole} value={inviteRole}>
                    {ROLE_LABELS[inviteRole]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-entity">
              Entity scope{entityRequired ? "" : " (optional)"}
            </Label>
            <Select
              value={entityId || "__none__"}
              onValueChange={(value) => {
                setEntityId(value === "__none__" ? "" : value)
                setInviteUrl(null)
              }}
            >
              <SelectTrigger id="invite-entity" className="w-full">
                <SelectValue placeholder="All entities / org-wide" />
              </SelectTrigger>
              <SelectContent>
                {!entityRequired ? (
                  <SelectItem value="__none__">Org-wide (no entity)</SelectItem>
                ) : null}
                {orgEntities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email lock (optional)</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setInviteUrl(null)
              }}
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          {inviteUrl ? (
            <div className="bg-muted/60 grid gap-2 rounded-lg border p-3">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Link2 className="size-3.5" />
                Invite link
              </div>
              <p className="font-mono text-xs break-all">{inviteUrl}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onCopy}
                className="w-fit"
              >
                <Copy data-icon="inline-start" />
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={onGenerate}
            disabled={pending || (entityRequired && !entityId)}
          >
            {pending ? "Generating…" : "Generate 7-day link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

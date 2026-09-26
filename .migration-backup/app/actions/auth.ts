"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ENTITY_COOKIE,
  isInviteRole,
  roleRequiresEntity,
  type AcceptInvitationResult,
  type AccessibleEntity,
  type InviteRole,
} from "@/lib/types"

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}

function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

function loginRedirect(opts: {
  redirectTo: string
  error?: string
  message?: string
  mode?: "signin" | "signup"
  confirmed?: boolean
}) {
  const params = new URLSearchParams()
  const next = isSafeRedirect(opts.redirectTo) ? opts.redirectTo : "/studio"
  params.set("redirect", next)
  if (opts.error) params.set("error", opts.error)
  if (opts.message) params.set("message", opts.message)
  if (opts.mode) params.set("mode", opts.mode)
  if (opts.confirmed) params.set("confirmed", "1")
  redirect(`/login?${params.toString()}`)
}

export async function signInWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const redirectTo = String(formData.get("redirect") ?? "/studio")

  if (!email || !password) {
    loginRedirect({
      redirectTo,
      mode: "signin",
      error: "Email and password are required.",
    })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    loginRedirect({
      redirectTo,
      mode: "signin",
      error: error.message,
    })
  }

  redirect(isSafeRedirect(redirectTo) ? redirectTo : "/studio")
}

export async function signUpWithPassword(formData: FormData): Promise<void> {
  const fullName = String(formData.get("full_name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const redirectTo = String(formData.get("redirect") ?? "/studio")
  const next = isSafeRedirect(redirectTo) ? redirectTo : "/studio"

  if (!fullName || !email || !password) {
    loginRedirect({
      redirectTo: next,
      mode: "signup",
      error: "Full name, email, and password are required.",
    })
  }

  if (password.length < 8) {
    loginRedirect({
      redirectTo: next,
      mode: "signup",
      error: "Password must be at least 8 characters.",
    })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    loginRedirect({
      redirectTo: next,
      mode: "signup",
      error: error.message,
    })
  }

  // Auto-confirmed (session present) → go straight to redirect target
  if (data.session) {
    redirect(next)
  }

  // Email confirmation required
  loginRedirect({
    redirectTo: next,
    mode: "signup",
    confirmed: true,
    message: "Check your inbox for a confirmation link.",
  })
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function setActiveEntity(
  entityId: string,
  options?: { redirectTo?: string | null }
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ENTITY_COOKIE, entityId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidatePath("/today")
  revalidatePath("/studio")
  revalidatePath("/inventory")
  revalidatePath("/brain")
  revalidatePath("/campaigns")
  revalidatePath("/analytics")

  const raw = options?.redirectTo?.trim() || ""
  let pathname = "/studio"
  if (raw) {
    try {
      const url = raw.startsWith("http")
        ? new URL(raw)
        : new URL(raw, "http://local.invalid")
      const candidate = url.pathname
      if (
        candidate.startsWith("/") &&
        !candidate.startsWith("//") &&
        !candidate.includes("\\")
      ) {
        pathname = candidate
      }
    } catch {
      pathname = "/studio"
    }
  }

  redirect(`${pathname}?eid=${encodeURIComponent(entityId)}`)
}

export type CreateInviteInput = {
  organizationId: string
  role: InviteRole
  entityId?: string | null
  email?: string | null
}

export type CreateInviteResult =
  | { ok: true; inviteUrl: string; expiresAt: string; token: string }
  | { ok: false; error: string }

export async function createInvitation(
  input: CreateInviteInput
): Promise<CreateInviteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "You must be signed in." }
  }

  if (!isInviteRole(input.role)) {
    return { ok: false, error: "Invalid role." }
  }

  if (roleRequiresEntity(input.role) && !input.entityId) {
    return {
      ok: false,
      error: "Select an entity for entity_manager and creator invites.",
    }
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_org_admin",
    { org_id: input.organizationId }
  )

  if (adminError) {
    return { ok: false, error: adminError.message }
  }

  if (!isAdmin) {
    return { ok: false, error: "Only organization admins can create invites." }
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: input.organizationId,
      entity_id: input.entityId || null,
      email: input.email?.trim() || null,
      role: input.role,
      expires_at: expiresAt,
    })
    .select("token, expires_at")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create invitation." }
  }

  return {
    ok: true,
    token: data.token,
    expiresAt: data.expires_at,
    inviteUrl: `${siteUrl()}/invite/${data.token}`,
  }
}

export async function acceptInvitation(token: string): Promise<{
  entityId: string | null
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { entityId: null, error: "unauthenticated" }
  }

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  })

  if (error) {
    return { entityId: null, error: error.message }
  }

  const result = data as AcceptInvitationResult | null
  const entityId = result?.entity_id ?? null

  if (entityId) {
    const cookieStore = await cookies()
    cookieStore.set(ENTITY_COOKIE, entityId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return { entityId }
}

export async function getAccessibleEntities(
  userId: string
): Promise<AccessibleEntity[]> {
  const supabase = await createClient()
  const byId = new Map<string, AccessibleEntity>()

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)

  const adminOrgIds =
    memberships
      ?.filter((member) => member.role === "org_admin")
      .map((member) => member.organization_id) ?? []

  if (adminOrgIds.length > 0) {
    const { data: orgEntities } = await supabase
      .from("entities")
      .select("id, name, organization_id, industry")
      .in("organization_id", adminOrgIds)

    for (const entity of orgEntities ?? []) {
      byId.set(entity.id, entity)
    }
  }

  const { data: accessRows } = await supabase
    .from("entity_access")
    .select("entity_id")
    .eq("user_id", userId)

  const accessEntityIds = (accessRows ?? []).map((row) => row.entity_id)
  if (accessEntityIds.length > 0) {
    const { data: accessEntities } = await supabase
      .from("entities")
      .select("id, name, organization_id, industry")
      .in("id", accessEntityIds)

    for (const entity of accessEntities ?? []) {
      byId.set(entity.id, entity)
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getActiveOrganizationId(
  userId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "org_admin")
    .limit(1)
    .maybeSingle()

  return data?.organization_id ?? null
}

export async function isCurrentUserOrgAdmin(
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("is_org_admin", {
    org_id: organizationId,
  })
  if (error) {
    return false
  }
  return Boolean(data)
}

export async function claimFirstOrgAdmin(): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("claim_first_org_admin", {
    p_org_id: null,
  })

  if (error) {
    redirect(
      `/studio?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath("/studio")
  redirect("/studio")
}

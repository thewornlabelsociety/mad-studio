import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
  title: "Welcome · MAD STUDIO",
  description: "Sign in or create your MAD STUDIO account.",
}

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string
    error?: string
    message?: string
    mode?: string
    token?: string
  }>
}

function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  const redirectTo =
    params.redirect && isSafeRedirect(params.redirect)
      ? params.redirect
      : params.token && /^[a-zA-Z0-9_-]+$/.test(params.token)
        ? `/invite/${params.token}`
        : "/studio"

  const initialMode = params.mode === "signup" ? "signup" : "signin"

  return (
    <div className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden bg-mad-white px-4 py-16">
      <AuthForm
        redirectTo={redirectTo}
        inviteToken={params.token ?? null}
        initialMode={initialMode}
        initialError={params.error}
        initialMessage={params.message}
      />
    </div>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { MadStudioLogo } from "@/components/brand/mad-logo"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type AuthMode = "signin" | "signup"
type AuthMethod = "password" | "magic"

type Message = { type: "error" | "success"; text: string }

type AuthFormProps = {
  redirectTo: string
  inviteToken?: string | null
  initialMode?: AuthMode
  initialError?: string
  initialMessage?: string
}

function humanizeAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
    return "Invalid email or password."
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "That email is already registered. Sign in instead."
  }
  if (lower.includes("password") && lower.includes("weak")) {
    return "Password is too weak. Use at least 8 characters."
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 8 characters."
  }
  if (message === "auth-failed") {
    return "Authentication failed. Please try again."
  }
  return message
}

function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

export function AuthForm({
  redirectTo,
  inviteToken,
  initialMode = "signin",
  initialError,
  initialMessage,
}: AuthFormProps) {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [method, setMethod] = useState<AuthMethod>("password")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(() => {
    if (initialError) {
      return { type: "error", text: humanizeAuthError(initialError) }
    }
    if (initialMessage) {
      return { type: "success", text: initialMessage }
    }
    return null
  })

  const destination = (() => {
    if (inviteToken && /^[a-zA-Z0-9_-]+$/.test(inviteToken)) {
      return `/invite/${inviteToken}`
    }
    return isSafeRedirect(redirectTo) ? redirectTo : "/studio"
  })()

  const heading =
    mode === "signup" ? "Create Studio Account" : "Enter Studio Workspace"

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const supabase = createClient()
    const trimmedEmail = email.trim()
    const trimmedName = fullName.trim()

    try {
      if (method === "magic") {
        if (!trimmedEmail) {
          setMessage({ type: "error", text: "Work email is required." })
          return
        }
        if (mode === "signup" && !trimmedName) {
          setMessage({ type: "error", text: "Operator name is required." })
          return
        }

        const callback = new URL("/auth/callback", window.location.origin)
        callback.searchParams.set("next", destination)

        const { error } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            shouldCreateUser: mode === "signup",
            data:
              mode === "signup" ? { full_name: trimmedName } : undefined,
            emailRedirectTo: callback.toString(),
          },
        })

        if (error) {
          setMessage({ type: "error", text: humanizeAuthError(error.message) })
          return
        }

        setMessage({
          type: "success",
          text: "Magic login link dispatched. Check your inbox.",
        })
        return
      }

      if (mode === "signin") {
        if (!trimmedEmail || !password) {
          setMessage({
            type: "error",
            text: "Email and password are required.",
          })
          return
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })

        if (error) {
          setMessage({ type: "error", text: humanizeAuthError(error.message) })
          return
        }

        router.push(destination)
        router.refresh()
        return
      }

      if (!trimmedName || !trimmedEmail || !password) {
        setMessage({
          type: "error",
          text: "Operator name, email, and password are required.",
        })
        return
      }

      if (password.length < 8) {
        setMessage({
          type: "error",
          text: "Password must be at least 8 characters.",
        })
        return
      }

      const callback = new URL("/auth/callback", window.location.origin)
      callback.searchParams.set("next", destination)

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
          emailRedirectTo: callback.toString(),
        },
      })

      if (error) {
        setMessage({ type: "error", text: humanizeAuthError(error.message) })
        return
      }

      if (data.session) {
        router.push(destination)
        router.refresh()
        return
      }

      setMessage({
        type: "success",
        text: "Check your email for the confirmation link to activate your studio.",
      })
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? humanizeAuthError(error.message)
            : "Something went wrong. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md border-2 border-mad-black bg-mad-white p-8 shadow-[4px_4px_0px_0px_#000000]">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center gap-3">
          <MadStudioLogo size="md" href={null} />
          <span className="inline-flex border border-mad-black bg-mad-lime px-2 py-0.5 font-typewriter text-[10px] font-bold tracking-wider text-mad-black uppercase">
            .NZ
          </span>
        </span>

        <div className="space-y-2">
          <h1 className="font-typewriter text-xl font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-2xl">
            {heading}
          </h1>
          <p className="text-sm text-neutral-600">
            Autonomous multi-brand marketing engine.
          </p>
        </div>
      </div>

      {message ? (
        <p
          className={cn(
            "mb-4 border-2 border-mad-black px-3 py-2 text-sm",
            message.type === "error"
              ? "bg-mad-vermillion text-mad-white"
              : "bg-mad-lime text-mad-black"
          )}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-2 border-2 border-mad-black">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={cn(
            "px-3 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest uppercase transition-colors",
            mode === "signin"
              ? "bg-mad-black text-mad-white"
              : "bg-mad-white text-mad-black hover:bg-neutral-100"
          )}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={cn(
            "px-3 py-2.5 font-typewriter text-[0.65rem] font-bold tracking-widest uppercase transition-colors",
            mode === "signup"
              ? "bg-mad-black text-mad-white"
              : "bg-mad-white text-mad-black hover:bg-neutral-100"
          )}
        >
          Create Account
        </button>
      </div>

      <div className="mb-5 flex gap-4 border-b-2 border-mad-black">
        <button
          type="button"
          onClick={() => setMethod("password")}
          className={cn(
            "pb-2 font-typewriter text-[0.65rem] font-bold tracking-widest uppercase transition-colors",
            method === "password"
              ? "border-b-2 border-mad-vermillion text-mad-black"
              : "text-neutral-500 hover:text-mad-black"
          )}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMethod("magic")}
          className={cn(
            "pb-2 font-typewriter text-[0.65rem] font-bold tracking-widest uppercase transition-colors",
            method === "magic"
              ? "border-b-2 border-mad-vermillion text-mad-black"
              : "text-neutral-500 hover:text-mad-black"
          )}
        >
          Magic Link
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        {mode === "signup" ? (
          <div className="grid gap-2">
            <label
              htmlFor="operator-name"
              className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase"
            >
              Operator Name
            </label>
            <input
              id="operator-name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Alex Rivera"
              className="border-2 border-mad-black bg-mad-white px-3 py-2.5 font-mono text-sm text-mad-black outline-none focus:ring-0"
            />
          </div>
        ) : null}

        <div className="grid gap-2">
          <label
            htmlFor="work-email"
            className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase"
          >
            Work Email
          </label>
          <input
            id="work-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="border-2 border-mad-black bg-mad-white px-3 py-2.5 font-mono text-sm text-mad-black outline-none focus:ring-0"
          />
        </div>

        {method === "password" ? (
          <div className="grid gap-2">
            <label
              htmlFor="password"
              className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-black uppercase"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === "signup" ? "At least 8 characters" : "••••••••"
              }
              className="border-2 border-mad-black bg-mad-white px-3 py-2.5 font-mono text-sm text-mad-black outline-none focus:ring-0"
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="border-2 border-mad-black bg-mad-black px-4 py-3.5 font-typewriter text-xs font-bold tracking-widest text-mad-white uppercase transition-all hover:bg-neutral-800 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
        >
          {loading
            ? "Working…"
            : method === "magic"
              ? "Send Magic Link"
              : mode === "signup"
                ? "Create Account"
                : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link
          href="/"
          className="font-typewriter text-[0.65rem] font-bold tracking-widest text-neutral-600 uppercase underline underline-offset-2 hover:text-mad-black"
        >
          ← Back to Homepage
        </Link>
      </p>
    </div>
  )
}

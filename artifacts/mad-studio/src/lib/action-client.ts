import { createClient } from "@/lib/supabase/client"

async function encodeArg(value: any): Promise<any> {
  if (!(value instanceof FormData)) return value
  const fields: Record<string, unknown> = {}
  for (const [key, part] of value.entries()) {
    if (part instanceof File) {
      const bytes = new Uint8Array(await part.arrayBuffer())
      let binary = ""
      for (const byte of bytes) binary += String.fromCharCode(byte)
      fields[key] = { name: part.name, type: part.type, base64: btoa(binary) }
    } else {
      fields[key] = part
    }
  }
  return fields
}

export async function action<T = any>(name: string, ...args: any[]): Promise<T> {
  const { data: { session } } = await createClient().auth.getSession()
  const response = await fetch(`/api/actions/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ args: await Promise.all(args.map(encodeArg)) }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error ?? `Action ${name} failed (${response.status}).`)
  if (typeof payload?.redirect === "string") {
    if (!payload.redirect.startsWith("/") || payload.redirect.startsWith("//")) {
      throw new Error("Action returned an unsafe redirect.")
    }
    window.location.assign(payload.redirect)
    return undefined as T
  }
  if (!payload || !Object.hasOwn(payload, "result")) {
    throw new Error(`Action ${name} returned an invalid response.`)
  }
  return payload.result as T
}
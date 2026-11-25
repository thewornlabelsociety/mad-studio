import { z } from "zod"

/**
 * "Wanted" call-outs from the Worn Label Society shop: emails already sent to
 * consignors asking for stock, offered to Mad Studio for a post and a Story.
 * Read from the shop's public feed (no recipient data in it).
 */

const linkSchema = z.object({
  book: z.string().url(),
  online: z.string().url(),
  join: z.string().url(),
  shop: z.string().url(),
})

export const shopCalloutSchema = z.object({
  id: z.number().int().positive(),
  template: z.string(),
  sentAt: z.string(),
  title: z.string(),
  kicker: z.string().default(""),
  headline: z.string().default(""),
  headlineAccent: z.string().default(""),
  message: z.string().default(""),
  items: z
    .array(z.object({ label: z.string(), audience: z.string(), typeKey: z.string() }))
    .max(20),
  images: z.array(z.string().regex(/^https?:\/\//i)).max(10),
  links: linkSchema,
  nextDropOff: z.string().nullable(),
  leadOnline: z.boolean(),
  caption: z.string().default(""),
})

export type ShopCallout = z.infer<typeof shopCalloutSchema>

const FEED_PATH = "/api/public/callouts/feed"
const DEFAULT_SITE = "https://www.wornlabelsociety.co.nz"

export function shopCalloutFeedUrl(env: Record<string, string | undefined> = process.env): string {
  const override = env.WLS_CALLOUT_FEED_URL?.trim()
  if (override) return override
  const site = (env.WLS_WEBSITE_URL?.trim() || DEFAULT_SITE).replace(/\/+$/, "")
  return `${site}${FEED_PATH}`
}

/** Keeps every call-out that matches the shape; skips any that don't, so one bad row can't hide the rest. */
export function parseShopCalloutFeed(payload: unknown): ShopCallout[] {
  const list =
    payload && typeof payload === "object" && Array.isArray((payload as { callouts?: unknown }).callouts)
      ? (payload as { callouts: unknown[] }).callouts
      : []
  const out: ShopCallout[] = []
  for (const row of list) {
    const parsed = shopCalloutSchema.safeParse(row)
    if (parsed.success) out.push(parsed.data)
  }
  return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

export async function fetchShopCallouts(input: {
  fetchImpl?: typeof fetch
  env?: Record<string, string | undefined>
  timeoutMs?: number
} = {}): Promise<{ ok: true; callouts: ShopCallout[] } | { ok: false; error: string }> {
  const url = shopCalloutFeedUrl(input.env)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000)
  try {
    const res = await (input.fetchImpl ?? fetch)(url, {
      headers: { Accept: "application/json", "User-Agent": "MAD-STUDIO-Callouts/1.0" },
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false, error: `The shop's call-out feed answered ${res.status}.` }
    const type = res.headers.get("content-type") ?? ""
    if (!type.includes("json")) return { ok: false, error: "The shop's call-out feed isn't live yet." }
    return { ok: true, callouts: parseShopCalloutFeed(await res.json()) }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"
    return { ok: false, error: aborted ? "The shop took too long to answer." : "Couldn't reach the shop." }
  } finally {
    clearTimeout(timer)
  }
}

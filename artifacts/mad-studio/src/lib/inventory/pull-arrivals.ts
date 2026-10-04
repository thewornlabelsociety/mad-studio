import type { Json } from "@/lib/database.types"
import {
  resolveInventoryIntakeMode,
  type InventoryIntakeMode,
} from "@/lib/inventory/entity-intake"
import {
  parseAestheticSlugs,
  resolveListingVibe,
  withListingVibeMetrics,
} from "@/lib/inventory/listing-vibe"
import { parsePrice } from "@/lib/inventory/types"
import { metaGraphBase } from "@/lib/social/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type PulledArrival = {
  website_item_id: string
  title: string
  brand: string | null
  price: number | null
  description: string | null
  images: string[]
  vibe: string | null
  aesthetic_slugs: string[]
}

export type PullNewArrivalsResult = {
  imported: number
  skipped: number
  feedUrl: string
  items: Array<{ id: string; website_item_id: string; title: string }>
  /** Feed responded OK but had zero live listings. */
  emptyFeed?: boolean
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  return withProtocol.replace(/\/$/, "")
}

/** Apex + www origins to try (WLS apex is a Replit placeholder; live site is www). */
function storefrontOrigins(websiteUrl: string | null): string[] {
  const base = normalizeBaseUrl(websiteUrl ?? "")
  if (!base) return []

  const origins = [base]
  try {
    const url = new URL(base)
    if (url.hostname.startsWith("www.")) {
      const bare = new URL(base)
      bare.hostname = url.hostname.slice(4)
      origins.push(bare.origin)
    } else {
      const www = new URL(base)
      www.hostname = `www.${url.hostname}`
      origins.unshift(www.origin)
    }
  } catch {
    /* keep base only */
  }

  return Array.from(new Set(origins))
}

function entityEnvSlug(entityName: string | null | undefined): string {
  return (entityName ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

/** Candidate catalog / feed URLs for a brand — scoped by intake mode. */
export function resolveArrivalFeedCandidates(input: {
  websiteUrl: string | null
  feedOverride?: string | null
  entityName?: string | null
  intakeMode?: InventoryIntakeMode
}): string[] {
  const candidates: string[] = []
  const mode = input.intakeMode ?? "website"
  const push = (value: string | null | undefined) => {
    const normalized = value?.trim()
    if (!normalized) return
    if (!candidates.includes(normalized)) candidates.push(normalized)
  }

  push(input.feedOverride)

  const slugKey = entityEnvSlug(input.entityName)
  if (slugKey) {
    push(process.env[`INVENTORY_FEED_URL_${slugKey}`])
  }

  if (mode === "food_feed") {
    // Never fall back to the global fashion marketplace URL for food brands.
    push(process.env.INVENTORY_FEED_URL_FUDI)
    push(process.env.FUDI_FEED_URL)
    push(process.env.INVENTORY_FOOD_FEED_URL)
  } else {
    push(process.env.INVENTORY_FEED_URL)
  }

  const customPath = process.env.INVENTORY_NEW_ARRIVALS_PATH?.trim()
  const defaultPaths =
    mode === "food_feed"
      ? [
          "/api/public/menu",
          "/api/public/specials",
          "/api/public/feed",
          "/api/feed",
          "/feed.json",
        ]
      : ["/api/public/marketplace/listings", "/api/public/items"]

  for (const origin of storefrontOrigins(input.websiteUrl)) {
    if (customPath && mode !== "food_feed") {
      const normalizedPath = customPath.startsWith("/")
        ? customPath
        : `/${customPath}`
      push(`${origin}${normalizedPath}`)
    }
    for (const path of defaultPaths) {
      push(`${origin}${path}`)
    }
  }

  return candidates
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function numberField(
  record: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = parsePrice(value)
      if (parsed != null) return parsed
    }
  }
  return null
}

function collectImages(record: Record<string, unknown>): string[] {
  const urls: string[] = []
  const pushUrl = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
      urls.push(value.trim())
    }
  }

  pushUrl(record.photoUrl)
  pushUrl(record.imageUrl)
  pushUrl(record.image)
  pushUrl(record.coverImageUrl)
  pushUrl(record.media_url)
  pushUrl(record.thumbnail_url)

  for (const key of ["images", "photos", "photoUrls", "media"]) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    for (const entry of value) {
      if (typeof entry === "string") {
        pushUrl(entry)
        continue
      }
      const nested = asRecord(entry)
      if (!nested) continue
      pushUrl(nested.src)
      pushUrl(nested.url)
      pushUrl(nested.photoUrl)
      pushUrl(nested.imageUrl)
      pushUrl(nested.media_url)
    }
  }

  return Array.from(new Set(urls)).slice(0, 12)
}

function buildDescription(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts
    .map((part) => (part ? stripHtml(part) : ""))
    .map((part) => part.trim())
    .filter(Boolean)
  if (cleaned.length === 0) return null
  return cleaned.join(" · ").slice(0, 8000)
}

function extractListingAesthetics(record: Record<string, unknown>): {
  vibe: string | null
  aesthetic_slugs: string[]
} {
  const aesthetic_slugs = parseAestheticSlugs(
    record.aestheticSlugs ??
      record.aesthetic_slugs ??
      record.vibes ??
      record.vibeSlugs ??
      record.vibe_slugs
  )
  const labeled =
    stringField(record, "vibe", "aesthetic", "aestheticLabel", "vibeLabel") ??
    null
  return {
    aesthetic_slugs,
    vibe: labeled?.trim() || resolveListingVibe(aesthetic_slugs),
  }
}

/** Worn Label Society `/api/public/marketplace/listings` (array). */
function parseWornLabelListings(payload: unknown): PulledArrival[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload)?.listings)
      ? (asRecord(payload)!.listings as unknown[])
      : []

  return rows
    .map((row) => {
      const record = asRecord(row)
      if (!record) return null

      const status = stringField(record, "status")?.toLowerCase()
      if (status && !["active", "available", "published"].includes(status)) {
        return null
      }

      const itemId =
        stringField(record, "itemId", "sourceItemId", "id") ?? null
      const title =
        stringField(record, "listingTitle", "title", "itemName", "name") ??
        null
      if (!itemId || !title) return null

      const price =
        numberField(
          record,
          "salePrice",
          "listingPrice",
          "discountedPrice",
          "price"
        ) ?? null

      const aesthetics = extractListingAesthetics(record)
      const description = buildDescription([
        stringField(record, "listingDescription", "description"),
        stringField(record, "brand")
          ? `Brand: ${stringField(record, "brand")}`
          : null,
        stringField(record, "size")
          ? `Size: ${stringField(record, "size")}`
          : null,
        stringField(record, "condition")
          ? `Condition: ${stringField(record, "condition")}`
          : null,
        stringField(record, "material")
          ? `Material: ${stringField(record, "material")}`
          : null,
        stringField(record, "category", "subCategory"),
        stringField(record, "colour", "colourPattern", "color"),
        aesthetics.vibe ? `Vibe: ${aesthetics.vibe}` : null,
      ])

      return {
        website_item_id: itemId,
        title: title.slice(0, 500),
        brand: stringField(record, "brand"),
        price,
        description,
        images: collectImages(record),
        vibe: aesthetics.vibe,
        aesthetic_slugs: aesthetics.aesthetic_slugs,
      } satisfies PulledArrival
    })
    .filter((item): item is PulledArrival => item != null)
}

/** Worn Label Society `/api/public/items` (`{ items: [...] }`). */
function parseWornLabelItems(payload: unknown): PulledArrival[] {
  const root = asRecord(payload)
  const rows = Array.isArray(root?.items)
    ? (root!.items as unknown[])
    : Array.isArray(payload)
      ? payload
      : []

  return rows
    .map((row) => {
      const record = asRecord(row)
      if (!record) return null

      const status = stringField(record, "status")?.toLowerCase()
      if (
        status &&
        !["active", "available", "published"].includes(status)
      ) {
        return null
      }

      const id = stringField(record, "id", "itemId")
      const title = stringField(record, "itemName", "title", "name")
      if (!id || !title) return null

      const price =
        numberField(record, "discountedPrice", "price") ?? null

      const aesthetics = extractListingAesthetics(record)
      const description = buildDescription([
        stringField(record, "description"),
        stringField(record, "brand")
          ? `Brand: ${stringField(record, "brand")}`
          : null,
        stringField(record, "size")
          ? `Size: ${stringField(record, "size")}`
          : null,
        stringField(record, "category"),
        stringField(record, "colour", "color"),
        aesthetics.vibe ? `Vibe: ${aesthetics.vibe}` : null,
      ])

      return {
        website_item_id: id,
        title: title.slice(0, 500),
        brand: stringField(record, "brand"),
        price,
        description,
        images: collectImages(record),
        vibe: aesthetics.vibe,
        aesthetic_slugs: aesthetics.aesthetic_slugs,
      } satisfies PulledArrival
    })
    .filter((item): item is PulledArrival => item != null)
}

/** Optional generic / Shopify-style `{ products: [...] }` JSON feeds. */
function parseGenericProductsJson(payload: unknown): PulledArrival[] {
  if (!payload || typeof payload !== "object") return []
  const record = payload as Record<string, unknown>
  const products = Array.isArray(record.products)
    ? (record.products as Array<Record<string, unknown>>)
    : Array.isArray(payload)
      ? (payload as Array<Record<string, unknown>>)
      : []

  return products
    .map((product) => {
      const handle = stringField(product, "handle")
      const id = stringField(product, "id") ?? handle
      const title = stringField(product, "title", "name")
      if (!id || !title) return null

      const variants = Array.isArray(product.variants)
        ? (product.variants as Array<Record<string, unknown>>)
        : []
      const priceRaw = variants[0]
        ? numberField(variants[0], "price")
        : numberField(product, "price")

      const images = collectImages(product)
      const nestedImage = asRecord(product.image)
      if (nestedImage) {
        const src = stringField(nestedImage, "src", "url")
        if (src && !images.includes(src)) images.unshift(src)
      }

      const body = stringField(product, "body_html", "description")
      const aesthetics = extractListingAesthetics(product)

      return {
        website_item_id: handle ?? id,
        title: title.slice(0, 500),
        brand:
          stringField(product, "vendor", "brand", "product_type") ?? null,
        price: priceRaw,
        description: body ? stripHtml(body).slice(0, 8000) : null,
        images: images.slice(0, 12),
        vibe: aesthetics.vibe,
        aesthetic_slugs: aesthetics.aesthetic_slugs,
      } satisfies PulledArrival
    })
    .filter((item): item is PulledArrival => item != null)
}

/** Eatery / app feeds: posts, specials, menu items. */
function parseFoodFeedPayload(payload: unknown): PulledArrival[] {
  const root = asRecord(payload)
  const rows = Array.isArray(root?.posts)
    ? (root!.posts as unknown[])
    : Array.isArray(root?.specials)
      ? (root!.specials as unknown[])
      : Array.isArray(root?.menuItems)
        ? (root!.menuItems as unknown[])
        : Array.isArray(root?.feed)
          ? (root!.feed as unknown[])
          : Array.isArray(root?.items)
            ? (root!.items as unknown[])
            : Array.isArray(payload)
              ? payload
              : []

  return rows.flatMap((row) => {
    const record = asRecord(row)
    if (!record) return []

    const id =
      stringField(record, "id", "postId", "slug", "handle", "sku") ?? null
    const caption = stringField(record, "caption", "body", "text")
    const title =
      stringField(record, "title", "name", "dish", "special") ??
      (caption ? caption.split("\n")[0]?.slice(0, 120) ?? null : null)
    if (!id || !title) return []

    const images = collectImages(record)
    if (images.length === 0) return []

    const arrival: PulledArrival = {
      website_item_id: id.startsWith("fudi-") ? id : `fudi-${id}`,
      title: title.slice(0, 500),
      brand: stringField(record, "brand", "venue", "restaurant") ?? "FÜDI",
      price: numberField(record, "price") ?? null,
      description: buildDescription([
        caption,
        stringField(record, "description"),
        stringField(record, "permalink", "url")
          ? `Link: ${stringField(record, "permalink", "url")}`
          : null,
      ]),
      images: images.slice(0, 12),
      vibe: null,
      aesthetic_slugs: [],
    }
    return [arrival]
  })
}

function parseArrivalPayload(
  payload: unknown,
  mode: InventoryIntakeMode
): PulledArrival[] {
  if (mode === "food_feed") {
    const food = parseFoodFeedPayload(payload)
    if (food.length > 0) return food
    const generic = parseGenericProductsJson(payload)
    if (generic.length > 0) return generic
    return []
  }

  const listings = parseWornLabelListings(payload)
  if (listings.length > 0) return listings

  const items = parseWornLabelItems(payload)
  if (items.length > 0) return items

  return parseGenericProductsJson(payload)
}

function wornLabelDemoArrivals(): PulledArrival[] {
  return [
    {
      website_item_id: "demo-zimmermann-linen-midi",
      title: "Zimmermann Linen Midi — Sample Size 1",
      brand: "Zimmermann",
      price: 890,
      description:
        "Archival linen midi in soft bone. Sample size 1, original tags retained. Ideal for ball season styling with clean lines and breathable fabric.",
      images: [
        "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=80",
      ],
      vibe: "Quiet Luxury",
      aesthetic_slugs: ["quiet-luxury"],
    },
  ]
}

function fudiDemoArrivals(): PulledArrival[] {
  return [
    {
      website_item_id: "demo-fudi-harvest-flatbread",
      title: "Friday Wood-Fired Harvest Flatbread",
      brand: "FÜDI Tap",
      price: null,
      description:
        "Seasonal roast veg, soft herbs, and blistered dough — tonight's neighborhood special. Tap to view the menu and share with the block.",
      images: [
        "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
      ],
      vibe: null,
      aesthetic_slugs: [],
    },
    {
      website_item_id: "demo-fudi-late-bite-bowl",
      title: "Late Bite Chili Crisp Bowl",
      brand: "FÜDI Tap",
      price: null,
      description:
        "Warm grains, chili crisp, soft egg — the after-hours craving drop. Chef's table energy for the feed.",
      images: [
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80",
      ],
      vibe: null,
      aesthetic_slugs: [],
    },
  ]
}

function foodFeedSkipsInstagramFallback(input: {
  feedOverride?: string | null
}): boolean {
  if (
    process.env.INVENTORY_FOOD_FEED_SKIP_INSTAGRAM === "1" ||
    process.env.INVENTORY_FOOD_FEED_SKIP_INSTAGRAM === "true"
  ) {
    return true
  }
  if (input.feedOverride?.trim()) return true
  return Boolean(
    process.env.FUDI_FEED_URL?.trim() ||
      process.env.INVENTORY_FEED_URL_FUDI?.trim() ||
      process.env.INVENTORY_FOOD_FEED_URL?.trim()
  )
}

async function fetchJsonFeed(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; MAD-STUDIO-InventorySync/1.0)",
      },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok) {
      throw new Error(`Feed responded ${response.status}`)
    }
    const contentType = response.headers.get("content-type") ?? ""
    const text = await response.text()
    if (
      contentType.includes("text/html") ||
      text.trimStart().startsWith("<!DOCTYPE") ||
      text.trimStart().startsWith("<html")
    ) {
      throw new Error("Feed returned HTML instead of JSON")
    }
    return JSON.parse(text) as unknown
  } finally {
    clearTimeout(timeout)
  }
}

async function pullInstagramFeedArrivals(entityId: string): Promise<{
  arrivals: PulledArrival[]
  feedUrl: string
} | null> {
  const admin = createAdminClient()
  const { data: connection } = await admin
    .from("social_connections")
    .select("account_id, account_name, access_token, platform")
    .eq("entity_id", entityId)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .maybeSingle()

  if (!connection?.access_token || !connection.account_id) {
    return null
  }

  const feedUrl = `${metaGraphBase()}/${connection.account_id}/media`
  const query = new URL(feedUrl)
  query.searchParams.set(
    "fields",
    "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp"
  )
  query.searchParams.set("limit", "25")
  query.searchParams.set("access_token", connection.access_token)

  const response = await fetch(query.toString(), {
    method: "GET",
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Instagram feed responded ${response.status}`)
  }

  const payload = (await response.json()) as {
    data?: Array<Record<string, unknown>>
    error?: { message?: string }
  }
  if (payload.error?.message) {
    throw new Error(payload.error.message)
  }

  const brand = connection.account_name?.trim() || "FÜDI"
  const arrivals = (payload.data ?? []).flatMap((row) => {
    const id = stringField(row, "id")
    if (!id) return []
    const caption = stringField(row, "caption")
    const mediaType = stringField(row, "media_type")?.toUpperCase()
    const mediaUrl = stringField(row, "media_url")
    const thumb = stringField(row, "thumbnail_url")
    const image =
      mediaType === "VIDEO" || mediaType === "REELS"
        ? thumb ?? mediaUrl
        : mediaUrl ?? thumb
    if (!image) return []

    const title =
      caption?.split("\n").map((line) => line.trim()).find(Boolean)?.slice(
        0,
        120
      ) ?? `${brand} feed drop`

    const arrival: PulledArrival = {
      website_item_id: `ig-${id}`,
      title,
      brand,
      price: null,
      description: buildDescription([
        caption,
        stringField(row, "permalink")
          ? `Link: ${stringField(row, "permalink")}`
          : null,
      ]),
      images: [image],
      vibe: null,
      aesthetic_slugs: [],
    }
    return [arrival]
  })

  if (arrivals.length === 0) return null

  return {
    arrivals,
    feedUrl: `instagram://media/${connection.account_id}`,
  }
}

export async function pullNewArrivalsForEntity(input: {
  entityId: string
  feedUrl?: string | null
}): Promise<PullNewArrivalsResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  const { data: canEdit, error: accessError } = await supabase.rpc(
    "has_entity_access",
    {
      ent_id: input.entityId,
      allowed_roles: ["entity_manager", "creator"],
    }
  )
  if (accessError) throw new Error(accessError.message)
  if (!canEdit) {
    throw new Error("You need creator or manager access to pull inventory.")
  }

  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .select("id, name, website_url, industry")
    .eq("id", input.entityId)
    .maybeSingle()

  if (entityError || !entity) {
    throw new Error(entityError?.message ?? "Brand entity not found.")
  }

  const intakeMode = resolveInventoryIntakeMode({
    name: entity.name,
    industry: entity.industry,
  })

  let arrivals: PulledArrival[] = []
  let usedFeed = ""
  let emptyFeedUrl: string | null = null
  const errors: string[] = []

  const candidates = resolveArrivalFeedCandidates({
    websiteUrl: entity.website_url,
    feedOverride: input.feedUrl,
    entityName: entity.name,
    intakeMode,
  })
  usedFeed = candidates[0] ?? usedFeed

  for (const feedUrl of candidates) {
    try {
      const json = await fetchJsonFeed(feedUrl)
      const parsed = parseArrivalPayload(json, intakeMode)
      if (parsed.length === 0) {
        emptyFeedUrl ??= feedUrl
        errors.push(`${feedUrl}: empty product list`)
        continue
      }
      arrivals = parsed
      usedFeed = feedUrl
      break
    } catch (error) {
      errors.push(
        `${feedUrl}: ${error instanceof Error ? error.message : "fetch failed"}`
      )
    }
  }

  if (
    intakeMode === "food_feed" &&
    arrivals.length === 0 &&
    !foodFeedSkipsInstagramFallback({ feedOverride: input.feedUrl })
  ) {
    try {
      const ig = await pullInstagramFeedArrivals(input.entityId)
      if (ig && ig.arrivals.length > 0) {
        arrivals = ig.arrivals
        usedFeed = ig.feedUrl
      }
    } catch (error) {
      errors.push(
        `instagram: ${error instanceof Error ? error.message : "fetch failed"}`
      )
    }
  }

  const allowDemo =
    process.env.INVENTORY_USE_DEMO_FEED === "1" ||
    process.env.INVENTORY_USE_DEMO_FEED === "true"

  if (arrivals.length === 0 && allowDemo) {
    if (intakeMode === "food_feed") {
      arrivals = fudiDemoArrivals()
      usedFeed = "demo://fudi-eatery-feed"
    } else {
      arrivals = wornLabelDemoArrivals()
      usedFeed = "demo://worn-label-new-arrivals"
    }
  }

  if (arrivals.length === 0 && emptyFeedUrl) {
    await supabase.from("activity_logs").insert({
      entity_id: input.entityId,
      user_id: user.id,
      action: "pulled_new_arrivals",
      details: {
        imported: 0,
        skipped: 0,
        feed_url: emptyFeedUrl,
        intake_mode: intakeMode,
        empty_feed: true,
        item_ids: [],
      },
    })
    return {
      imported: 0,
      skipped: 0,
      feedUrl: emptyFeedUrl,
      items: [],
      emptyFeed: true,
    }
  }

  if (arrivals.length === 0) {
    throw new Error(
      intakeMode === "food_feed"
        ? [
            "Could not load eatery / app feed for this brand.",
            "Set INVENTORY_FEED_URL_FUDI / FUDI_FEED_URL to your app JSON feed, or connect Instagram as a fallback.",
            entity.website_url
              ? `Also tried menu/specials endpoints under ${entity.website_url}.`
              : null,
            errors.slice(0, 3).join(" · "),
          ]
            .filter(Boolean)
            .join(" ")
        : [
            "Could not load new arrivals from the brand website.",
            entity.website_url
              ? `Tried public catalog endpoints under ${entity.website_url} (including www).`
              : "No website_url is set on this brand.",
            "Optional: set INVENTORY_FEED_URL to a JSON catalog URL.",
            errors.slice(0, 3).join(" · "),
          ]
            .filter(Boolean)
            .join(" ")
    )
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  let imported = 0
  let skipped = 0
  const inserted: Array<{ id: string; website_item_id: string; title: string }> =
    []

  for (const item of arrivals) {
    const { data: existing } = await admin
      .from("marketing_entities")
      .select("id, metrics")
      .eq("entity_id", input.entityId)
      .eq("website_item_id", item.website_item_id)
      .maybeSingle()

    if (existing) {
      // Backfill listing vibe on already-imported items without forcing a re-intake.
      if (item.vibe || item.aesthetic_slugs.length > 0) {
        const currentMetrics =
          existing.metrics &&
          typeof existing.metrics === "object" &&
          !Array.isArray(existing.metrics)
            ? (existing.metrics as Record<string, unknown>)
            : { views: 0, clicks: 0, sales: 0 }
        await admin
          .from("marketing_entities")
          .update({
            metrics: withListingVibeMetrics(currentMetrics, {
              vibe: item.vibe,
              aesthetic_slugs: item.aesthetic_slugs,
            }) as Json,
            updated_at: now,
          })
          .eq("id", existing.id)
      }
      skipped += 1
      continue
    }

    const { data, error } = await admin
      .from("marketing_entities")
      .insert({
        entity_id: input.entityId,
        website_item_id: item.website_item_id,
        title: item.title,
        brand: item.brand,
        price: item.price,
        description: item.description,
        images: item.images,
        status: "unfeatured",
        metrics: withListingVibeMetrics(
          { views: 0, clicks: 0, sales: 0 },
          { vibe: item.vibe, aesthetic_slugs: item.aesthetic_slugs }
        ) as Json,
        updated_at: now,
      })
      .select("id, website_item_id, title")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    imported += 1
    if (data) inserted.push(data)
  }

  await supabase.from("activity_logs").insert({
    entity_id: input.entityId,
    user_id: user.id,
    action: "pulled_new_arrivals",
    details: {
      imported,
      skipped,
      feed_url: usedFeed,
      intake_mode: intakeMode,
      item_ids: inserted.map((row) => row.id),
    },
  })

  return {
    imported,
    skipped,
    feedUrl: usedFeed,
    items: inserted,
  }
}

/** Where a piece sits in an outfit. */
export type GarmentSlot =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "shoes"
  | "accessory"
  | "other"

export type GarmentGender = "men" | "women" | "unisex"

/** Marketplace category and gender, as synced from the shop listing. */
export type ListingGarment = {
  category: string | null
  gender: GarmentGender | null
}

export function normalizeGarmentGender(raw: unknown): GarmentGender | null {
  if (typeof raw !== "string") return null
  const value = raw.trim().toLowerCase()
  if (!value) return null
  if (/^(men|mens|men's|male|man|menswear)$/.test(value)) return "men"
  if (/^(women|womens|women's|female|woman|ladies|womenswear)$/.test(value)) return "women"
  if (/^(unisex|all|any|everyone)$/.test(value)) return "unisex"
  return null
}

export function readListingGarmentFromMetrics(metrics: unknown): ListingGarment {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return { category: null, gender: null }
  }
  const record = metrics as Record<string, unknown>
  const category =
    typeof record.listing_category === "string" && record.listing_category.trim()
      ? record.listing_category.trim()
      : null
  return { category, gender: normalizeGarmentGender(record.listing_gender) }
}

export function withListingGarmentMetrics(
  metrics: Record<string, unknown>,
  input: { category?: string | null; gender?: string | null }
): Record<string, unknown> {
  const next = { ...metrics }
  const category = input.category?.trim()
  if (category) next.listing_category = category
  else delete next.listing_category
  const gender = normalizeGarmentGender(input.gender)
  if (gender) next.listing_gender = gender
  else delete next.listing_gender
  return next
}

// Title words beat the category: "Board Shorts" can sit under "Menswear".
const TITLE_SLOTS: Array<[RegExp, GarmentSlot]> = [
  [/\b(dress|jumpsuit|playsuit|romper|overalls?)\b/i, "dress"],
  [/\b(jacket|coat|blazer|parka|puffer|anorak|trench|gilet|bomber|windbreaker|cardigan|hoodie|hoody)\b/i, "outerwear"],
  [/\b(shorts|jeans|pants|trousers|chinos|skirt|leggings|joggers|trackpants|cargos?|culottes|board ?shorts)\b/i, "bottom"],
  [/\b(sneakers?|trainers?|shoes|boots?|sandals?|heels|loafers|slides|jandals|flats|mules)\b/i, "shoes"],
  [/\b(bag|tote|clutch|handbag|backpack|purse|wallet|belt|hat|cap|beanie|scarf|sunglasses|necklace|earrings?|bracelet|jewell?ery|watch)\b/i, "accessory"],
  [/\b(shirt|t-?shirt|tee|polo|blouse|top|tank|singlet|cami|vest|jumper|sweater|knit|crew ?neck|sweatshirt|bodysuit|crop)\b/i, "top"],
]

const CATEGORY_SLOTS: Array<[RegExp, GarmentSlot]> = [
  [/dress|jumpsuit/i, "dress"],
  [/outerwear|jacket|coat/i, "outerwear"],
  [/bottom|pant|jean|short|skirt|trouser/i, "bottom"],
  [/shoe|footwear|sneaker|boot/i, "shoes"],
  [/accessor|bag|hat|jewel|belt/i, "accessory"],
  [/top|shirt|tee|knit/i, "top"],
]

export function garmentSlot(input: {
  title: string
  brand?: string | null
  category?: string | null
}): GarmentSlot {
  // "Vest Just Jeans": the brand must not decide the garment.
  const brand = input.brand?.trim()
  const title = brand
    ? input.title.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    : input.title
  for (const [pattern, slot] of TITLE_SLOTS) {
    if (pattern.test(title)) return slot
  }
  const category = input.category ?? ""
  for (const [pattern, slot] of CATEGORY_SLOTS) {
    if (pattern.test(category)) return slot
  }
  return "other"
}

/** Gender from the listing, else from words like "Mens" in the title or category. */
export function garmentGender(input: {
  gender?: GarmentGender | string | null
  title: string
  category?: string | null
  description?: string | null
}): GarmentGender | null {
  const listed = normalizeGarmentGender(input.gender)
  if (listed) return listed
  const text = `${input.title} ${input.category ?? ""}`
  if (/\b(womens?|women's|ladies|womenswear)\b/i.test(text)) return "women"
  if (/\b(mens?|men's|menswear)\b/i.test(text)) return "men"
  return null
}

/** Category line the shop sync writes into older descriptions ("Tops", "Bottoms"). */
export function categoryFromDescription(description: string | null | undefined): string | null {
  if (!description) return null
  for (const line of description.split(/\r?\n/)) {
    const value = line.trim()
    if (/^(tops|bottoms|menswear|womenswear|dresses|outerwear|shoes|footwear|accessories|bags|knitwear|jackets|activewear)$/i.test(value)) {
      return value
    }
  }
  return null
}

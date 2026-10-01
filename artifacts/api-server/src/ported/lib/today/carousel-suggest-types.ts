export type CarouselSuggestItem = {
  title: string
  venue?: string
  price?: string
  description?: string
  imageUrl: string
}

export type CarouselPromoAngle = {
  id: string
  angle_title: string
  reasoning: string
  hero_item_index: number
  recommended_order: number[]
  hook: string
  slide_subheads: string[]
  caption: string
  tags: string[]
}

export const FUDI_CAROUSEL_ANGLE_ARCHETYPES = [
  "The Local Weekend Hitlist",
  "Craving Contrast (Sweet x Savoury)",
  "Hidden Kitchen Pass Drops",
] as const

export const FUDI_CAROUSEL_BANNED_TERMS = [
  "sartorial",
  "saas",
  "cheap eats",
  "aggregator",
  "voucher codes",
  "voucher code",
  "synergy",
  "funnel",
  "mad studio",
] as const

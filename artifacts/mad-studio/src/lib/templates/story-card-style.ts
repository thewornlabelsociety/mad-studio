"use client"

import type { CardAlign, PillFill, PillShape } from "@/components/templates/edit-slides"
import { useRememberedState } from "@/lib/use-remembered-state"

/** What a piece card can show, switched on and off for every card at once. */
export type CardField = "number" | "brand" | "category" | "vibe" | "size" | "price"

export const CARD_FIELDS: Array<{ id: CardField; label: string }> = [
  { id: "number", label: "Eyebrow" },
  { id: "brand", label: "Brand" },
  { id: "category", label: "Sub category" },
  { id: "vibe", label: "Vibe" },
  { id: "size", label: "Size" },
  { id: "price", label: "Price" },
]

export const DEFAULT_CARD_FIELDS: Record<CardField, boolean> = {
  number: true,
  brand: true,
  category: false,
  vibe: false,
  size: true,
  price: true,
}

export const PILL_FILLS: Array<{ id: PillFill; label: string }> = [
  { id: "outline", label: "Outline" },
  { id: "accent", label: "Accent colour" },
  { id: "ink", label: "Text colour" },
  { id: "cream", label: "Cream" },
]

export const PILL_SHAPES: Array<{ id: PillShape; label: string }> = [
  { id: "round", label: "Round" },
  { id: "soft", label: "Soft corner" },
  { id: "square", label: "Square" },
]

/** How every new-arrival Story card looks: the Themed edit card, in Story size. */
export type StoryCardStyle = {
  fields: Record<CardField, boolean>
  align: CardAlign
  pillAlign: CardAlign
  pillFill: PillFill
  pillShape: PillShape
}

export const DEFAULT_STORY_CARD_STYLE: StoryCardStyle = {
  // Stories lead with the vibe and skip the "No. 01" numbering.
  fields: { ...DEFAULT_CARD_FIELDS, number: false, vibe: true, category: true },
  align: "center",
  pillAlign: "right",
  pillFill: "outline",
  pillShape: "round",
}

/**
 * One card style for Today's Stories, the Story screen and the Sale rack,
 * kept per brand on this device.
 */
export function useStoryCardStyle(entityId: string) {
  const [style, setStyle] = useRememberedState<StoryCardStyle>(
    `mad.storyCardStyle.v2.${entityId}`,
    DEFAULT_STORY_CARD_STYLE
  )
  // Older saves may miss a field added later.
  const merged: StoryCardStyle = {
    ...DEFAULT_STORY_CARD_STYLE,
    ...style,
    fields: { ...DEFAULT_STORY_CARD_STYLE.fields, ...style.fields },
  }
  return [merged, setStyle] as const
}

/** The kind of piece from its shop title: "Formal Dress Karen Millen in Brown" gives "Formal Dress". */
export function pieceType(title: string, brand: string | null): string | null {
  let text = title
  if (brand?.trim()) text = text.replace(new RegExp(brand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
  text = text.replace(/\s+\bin\b\s.*$/i, "").replace(/\s+/g, " ").trim()
  return text || null
}

/** "$120.00" reads as "$120"; a dash means no price. */
export function shortPrice(label: string | null | undefined): string | null {
  if (!label || label === "—") return null
  return label.replace(/\.00$/, "")
}

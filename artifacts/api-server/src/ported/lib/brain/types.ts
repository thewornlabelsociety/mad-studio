export const QUOTE_SOURCES = [
  { value: "in_store", label: "In-Store" },
  { value: "instagram_dm", label: "Instagram DM" },
  { value: "google_review", label: "Google Review" },
  { value: "facebook_comment", label: "Facebook" },
] as const

export type QuoteSource = (typeof QUOTE_SOURCES)[number]["value"]

export type BrainDocument = {
  id: string
  title: string
  file_url: string
  extracted_knowledge: string
  doc_type: string | null
  created_at: string
}

export type BrainQuote = {
  id: string
  quote_text: string
  source: string | null
  customer_emotion: string | null
  created_at: string
}

export type BrainTakeaway = {
  id: string
  title: string
  outcome_rating: string | null
  ai_takeaway: string
  updated_at: string
}

export function guessDocType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.includes("menu")) return "menu"
  if (lower.includes("lookbook") || lower.includes("look-book")) return "lookbook"
  if (lower.includes("price") || lower.includes("wholesale")) return "pricing"
  if (lower.includes("policy") || lower.includes("agreement")) return "policy"
  return "guideline"
}

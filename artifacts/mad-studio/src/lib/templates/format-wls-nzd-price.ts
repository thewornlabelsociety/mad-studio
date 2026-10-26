import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"

export function formatWlsNzdPrice(selection: WlsProductSelection): string {
  if (selection.price == null || !Number.isFinite(selection.price)) return "—"
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: selection.currency || "NZD",
  }).format(selection.price)
}

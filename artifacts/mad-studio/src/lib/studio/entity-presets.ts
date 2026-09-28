import {
  resolveIndustryProfile,
  type IndustryTemplateId,
} from "@/lib/brands/industry-templates"
import type { MultiplexerIntent } from "@/lib/campaigns/multiplexer"
import type { AudienceSegment } from "@/lib/entities/dna-schema"
import { scrubAgencyLeak } from "@/lib/inventory/context-hooks"

export type StudioIntentChip = {
  id: string
  label: string
  intent: MultiplexerIntent
}

export type StudioHookChip = {
  id: string
  label: string
  hook: string
}

export type StudioEntityPresets = {
  profileId: IndustryTemplateId
  sparkPlaceholder: string
  intentChips: StudioIntentChip[]
  objectives: string[]
  hookChips: Array<{ id: string; label: string; template: string }>
  fallbackAudience: AudienceSegment[]
}

const WORN_LABEL_PRESETS: StudioEntityPresets = {
  profileId: "worn_label",
  sparkPlaceholder:
    'e.g. "Just unpacked 8 authenticated silk slip dresses and neutral tailoring for formal event season..."',
  intentChips: [
    { id: "drive_sales", label: "Drive Sales", intent: "Drive Sales" },
    { id: "build_hype", label: "Build Hype", intent: "Build Hype" },
    {
      id: "source_consignment",
      label: "Source Consignment",
      intent: "Get Inventory",
    },
    {
      id: "shop_by_vibe",
      label: "Shop by Vibe Drop",
      intent: "Build Hype",
    },
  ],
  objectives: [
    "Sell Through Drop",
    "Attract Consignors",
    "Increase Showroom Traffic",
  ],
  hookChips: [
    {
      id: "vibe",
      label: "Vibe / Styling Hook",
      template:
        "The quiet-luxury edit: bias-cut silk and neutral tailoring for effortless evening layering.",
    },
    {
      id: "investment",
      label: "Investment Value Hook",
      template:
        "Authenticated designer consignment at a fraction of retail — conditioned pieces ready for the season.",
    },
    {
      id: "local",
      label: "Whangārei Showroom Hook",
      template:
        "Just arrived on our Whangārei showroom rack — try it on in store or shop online.",
    },
  ],
  fallbackAudience: [
    {
      name: "The Conscious Designer Shopper",
      role: "Discerning buyer",
      pain: "Tired of endless scrolling for pieces that actually fit their wardrobe.",
      desire: "Curated, authenticated designer finds without the search headache.",
      trigger: "A Shop by Vibe drop that matches their aesthetic.",
      winning_rebuttal: "Less searching. Better finding — verified and ready to wear.",
    },
    {
      name: "The Wardrobe Consignor",
      role: "Closet seller",
      pain: "Worried about lowball offers and pieces sitting forever online.",
      desire: "A trusted boutique that presents their pieces with care and fair returns.",
      trigger: "A clear consignment invite with provenance-first storytelling.",
      winning_rebuttal: "We elevate your pieces — quiet luxury presentation, not marketplace noise.",
    },
  ],
}

const FUDI_PRESETS: StudioEntityPresets = {
  profileId: "fudi",
  sparkPlaceholder:
    'e.g. Jovial Judge Tavern just dropped a Pavlova Cocktail for $14, or Mean\'s Vietnamese has 15 pork belly bao specials tonight only...',
  intentChips: [
    {
      id: "dish_drop",
      label: "Fresh Dish / Pass Drop",
      intent: "Build Hype",
    },
    {
      id: "live_deal",
      label: "Live Deal / Mid-Week Drop",
      intent: "Drive Sales",
    },
    {
      id: "weekend_event",
      label: "Weekend Event / Tour",
      intent: "Build Hype",
    },
    {
      id: "pantry_maker",
      label: "Local Pantry / Maker",
      intent: "Drive Sales",
    },
  ],
  objectives: [
    "Promote a Live Dish Drop",
    "Push a Mid-Week Deal",
    "Fill a Weekend Event",
    "Spotlight a Pantry Maker",
  ],
  hookChips: [
    {
      id: "dish_drop",
      label: "🍕 Kitchen Pass Drop",
      template:
        "Plated tonight at [Eatery Name]: [Dish Title]. Sizzling hot, live on the FÜDI map.",
    },
    {
      id: "live_deal",
      label: "🏷️ Live Deal / Perk",
      template:
        "Just dropped on FÜDI: [Eatery Name] has [Deal Title]. Limited portions, claim via table tap.",
    },
    {
      id: "weekend_event",
      label: "🎟️ Weekend Event / Tour",
      template:
        "Weekend plans? [Event Title] hosted by [Eatery Name]. Check the lineup and RSVP on FÜDI.",
    },
    {
      id: "pantry_maker",
      label: "🍯 Local Hands Market",
      template:
        "Fresh from local hands: [Product Name] by [Maker]. Order direct on FÜDI Marketplace.",
    },
  ],
  fallbackAudience: [
    {
      name: "Unified Local Food Enthusiasts",
      role: "Local diners & weekend planners",
      pain:
        "Fragmented platform overload: bouncing between Google (outdated PDF menus), Instagram (non-shoppable photos), Facebook (buried flyers), and UberEats (marked-up fees). Disjointed apps cluttered with non-food noise.",
      desire:
        "One single place for everything local food: visual dish feeds, live mid-week deals, weekend event tickets, pantry marketplace, and instant tap-and-pay at the table.",
      trigger:
        "A concrete dish drop, limited deal, or weekend event from a venue they trust — surfaced on one map.",
      winning_rebuttal:
        "Stop app-hopping. FÜDI puts every dish, drop, event, and table menu in your town onto one live map.",
    },
  ],
}

const GENERIC_PRESETS: StudioEntityPresets = {
  profileId: "generic",
  sparkPlaceholder:
    'e.g. "Share the event, offer, or story you want this campaign pack to open with..."',
  intentChips: [
    { id: "drive_sales", label: "Drive Sales", intent: "Drive Sales" },
    { id: "build_hype", label: "Build Hype", intent: "Build Hype" },
    { id: "get_inventory", label: "Get Inventory", intent: "Get Inventory" },
    { id: "teach_ai", label: "Teach AI", intent: "Teach AI" },
  ],
  objectives: [
    "Increase Awareness",
    "Drive Conversions",
    "Grow Community",
  ],
  hookChips: [
    {
      id: "angle_a",
      label: "Primary Angle",
      template: "Lead with the clearest customer desire in one sentence.",
    },
    {
      id: "angle_b",
      label: "Proof Angle",
      template: "Anchor the offer in proof, provenance, or social trust.",
    },
    {
      id: "angle_c",
      label: "Local / CTA Angle",
      template: "Invite the audience to act locally or digitally with one clear CTA.",
    },
  ],
  fallbackAudience: [],
}

const BY_PROFILE: Record<IndustryTemplateId, StudioEntityPresets> = {
  worn_label: WORN_LABEL_PRESETS,
  fudi: FUDI_PRESETS,
  generic: GENERIC_PRESETS,
}

export function resolveStudioPresets(input: {
  name?: string | null
  industry?: string | null
}): StudioEntityPresets {
  const profile = resolveIndustryProfile(input)
  return BY_PROFILE[profile.id] ?? GENERIC_PRESETS
}

/** Click-to-apply spark hooks scoped to the active brand industry. */
export function buildStudioHookChips(input: {
  brandName: string
  industry?: string | null
  sparkHint?: string | null
  visualDescription?: string | null
  concreteFeatures?: string[] | null
}): StudioHookChip[] {
  const presets = resolveStudioPresets(input)
  const textCue = softCue(input.sparkHint, 110)
  const features = (input.concreteFeatures ?? [])
    .map((row) => softenFeature(row))
    .filter(Boolean)
    .slice(0, 4)
  const visualFallback = softCue(input.visualDescription, 110)

  return presets.hookChips.map((chip, index) => {
    const visualCue =
      features[index] || features[0] || visualFallback || null
    const hook = weaveStudioHook({
      chipId: chip.id,
      template: chip.template,
      visualCue,
      textCue,
      profileId: presets.profileId,
    })
    return {
      id: chip.id,
      label: chip.label,
      hook: scrubAgencyLeak(hook),
    }
  })
}

function softCue(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.length < 8) return null
  const bite = trimmed.split(/[.!?]/)[0]?.trim() || trimmed
  return bite.slice(0, max).trim() || null
}

function softenFeature(feature: string): string {
  return feature
    .replace(
      /^(fabric|color|colour|cut|silhouette|neckline|ingredient|plating|texture|hardware)\s*:\s*/i,
      ""
    )
    .replace(/^(camera sees|visual details|inspected)\s*:?\s*/i, "")
    .trim()
}

function ensurePeriod(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/[—–-]\s*$/, "").trim()
  if (!cleaned) return cleaned
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

function weaveStudioHook(input: {
  chipId: string
  template: string
  visualCue: string | null
  textCue: string | null
  profileId: IndustryTemplateId
}): string {
  const { chipId, template, visualCue, textCue, profileId } = input
  const isFood = profileId === "fudi"

  if (!visualCue && !textCue) return template

  if (
    chipId === "dish_drop" ||
    chipId === "live_deal" ||
    chipId === "weekend_event" ||
    chipId === "pantry_maker"
  ) {
    if (textCue && textCue.length > 20) {
      return ensurePeriod(textCue)
    }
    return template
  }

  if (chipId === "vibe") {
    if (visualCue && textCue) {
      return ensurePeriod(
        isFood
          ? `${visualCue} — ${textCue}`
          : `The quiet-luxury edit: ${visualCue} — ${textCue}`
      )
    }
    if (visualCue) {
      return ensurePeriod(
        isFood
          ? `${visualCue}, plated for the neighbourhood table`
          : `The quiet-luxury edit: ${visualCue} for effortless evening layering`
      )
    }
    return ensurePeriod(`${template.replace(/\.$/, "")} — ${textCue}`)
  }

  if (chipId === "investment") {
    if (visualCue && textCue) {
      return ensurePeriod(
        isFood
          ? `${textCue}: ${visualCue}, worth the shortlist`
          : `${visualCue} — authenticated designer consignment; ${textCue}`
      )
    }
    if (visualCue) {
      return ensurePeriod(
        isFood
          ? `${visualCue} — craft you can taste on the weekend shortlist`
          : `${visualCue} — authenticated designer consignment at a fraction of retail`
      )
    }
    return ensurePeriod(`${template.replace(/\.$/, "")} — ${textCue}`)
  }

  // local / showroom
  if (visualCue && textCue) {
    return ensurePeriod(
      isFood
        ? `${visualCue} — ${textCue}. Meet us on the neighbourhood table`
        : `Just arrived on our Whangārei showroom rack — ${visualCue}. ${textCue}`
    )
  }
  if (visualCue) {
    return ensurePeriod(
      isFood
        ? `Independent kitchen spotlight: ${visualCue}. Meet the neighbourhood table`
        : `Just arrived on our Whangārei showroom rack — ${visualCue}. Try it on in store or shop online`
    )
  }
  return ensurePeriod(`${template.replace(/\.$/, "")} — ${textCue}`)
}

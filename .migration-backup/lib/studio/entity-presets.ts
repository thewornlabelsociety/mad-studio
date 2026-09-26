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
    'e.g. "Friday 4:30 PM decision fatigue? 3 local Whangārei spots offering exclusive FÜDI Tap specials this weekend..." or "Announcing zero-commission founder partner onboarding for local cafes..."',
  intentChips: [
    {
      id: "fill_tables",
      label: "Fill Tables / Specials",
      intent: "Drive Sales",
    },
    {
      id: "diner_app",
      label: "Diner App / Tap Discovery",
      intent: "Build Hype",
    },
    {
      id: "b2b_partner",
      label: "B2B Eatery Partner",
      intent: "Get Inventory",
    },
    {
      id: "community",
      label: "Community Event",
      intent: "Teach AI",
    },
  ],
  objectives: [
    "Promote Friday Specials",
    "Onboard Eatery Partners",
    "Drive FÜDI Tap Scans",
  ],
  hookChips: [
    {
      id: "craving",
      label: "Craving / Dish Hook",
      template:
        "Hot plate, cold drink, zero decision fatigue — tonight's neighbourhood special is waiting on FÜDI Tap.",
    },
    {
      id: "weekend",
      label: "Weekend Dining Guide",
      template:
        "Your Whangārei weekend table shortlist: three local spots with exclusive FÜDI Tap specials.",
    },
    {
      id: "spotlight",
      label: "Local Eatery Spotlight",
      template:
        "Independent kitchens, zero commission onboarding — meet the founder partners joining FÜDI this week.",
    },
  ],
  fallbackAudience: [
    {
      name: "The Local Foodie & Social Diner",
      role: "Weekend diner",
      pain: "Decision fatigue when picking where to eat with friends.",
      desire: "Trusted local specials and easy discovery via FÜDI Tap.",
      trigger: "A Friday special or weekend dining guide from a spot they trust.",
      winning_rebuttal: "Skip the scroll — tap the special and claim the table.",
    },
    {
      name: "The Independent Eatery Owner / Chef",
      role: "Hospitality partner",
      pain: "Paying fees to fill seats and struggling to reach local diners.",
      desire: "Zero-commission discovery that drives real covers.",
      trigger: "Founder partner onboarding with neighbourhood reach.",
      winning_rebuttal: "Fill tables with locals who already crave what you cook.",
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

import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import { industryBiasCopy, resolveIndustryProfile } from "@/lib/brands/industry-templates"
import type { MultiplexerIntent } from "@/lib/campaigns/multiplexer"
import { intentBiasCopy } from "@/lib/campaigns/multiplexer"
import {
  fudiMasterOperatingLawBlock,
  fudiTrackPromptBlock,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"
import { isFudiHospitalityEntity } from "@/lib/studio/fudi-platform"

/** Platform terms that must never appear in customer-facing copy. */
export const PLATFORM_LEAK_BANS = [
  "MAD",
  "MAD Studio",
  "Agency",
  "Lowballers",
  "Lowballer",
  "Cheap",
  "Thrifty",
  "Op-shop",
  "Disruptive",
  "Synergy",
  "Funnel",
  "Conversion funnel",
  "ROAS",
  "CTR",
  "Multiplexer",
  "Brain Lab",
  "Intent Matrix",
  "Operator",
  "Asset pack",
  "Campaign pack",
  "DNA Matrix",
  "Sartorial",
  "Marketplace headache",
] as const

export function mergeForbiddenWords(
  brandWords: string[] | undefined | null,
  extras: string[] = []
): string[] {
  const merged = new Set<string>()
  for (const word of [...PLATFORM_LEAK_BANS, ...(brandWords ?? []), ...extras]) {
    const trimmed = word.trim()
    if (trimmed) merged.add(trimmed)
  }
  return Array.from(merged)
}

/**
 * Silent director — structure, formats, indexing cues.
 * Never appears as the public brand voice.
 */
export function buildOperationalLayer(input: {
  intent: MultiplexerIntent
  intentBias: string
  objective: string
}): string {
  return [
    `### OPERATIONAL LAYER (SILENT DIRECTOR — INTERNAL ONLY)`,
    `You are an invisible production director for a private marketing ops platform.`,
    `Your job is structure, format, and distribution readiness — NOT public brand voice.`,
    ``,
    `Operator intent: ${input.intent}`,
    `Intent bias (internal routing only — do not echo this language in public copy): ${input.intentBias}`,
    `Objective (internal): ${input.objective}`,
    ``,
    `Format & layout rules:`,
    `- Carousel slides must read as publishable 4:5 Instagram assets.`,
    `- Slide 1 = product / hero visual language; slides 2+ may be editorial manifesto cards.`,
    `- Long explanatory copy belongs in seo_caption.caption_body, not as stickers over garments.`,
    `- Short video spoken_lines must be teleprompter-ready.`,
    `- Email body_markdown must be valid markdown.`,
    `- B2B DM should feel human, short, and sendable.`,
    ``,
    `2026 Algorithmic Targeting Triad (structure only — voice still = client):`,
    `1. Spoken Audio Hook (0–3s): Speak the exact product/event identifier and acute desire aloud for speech-to-text indexing.`,
    `2. On-Screen Text (OCR): Bold 3–5 word visual overlay for OCR scrapers.`,
    `3. Semantic Search Keywords: 3–5 natural phrases people type into TikTok/Instagram search.`,
    ``,
    `HARD BAN — never write these into ANY customer-facing field:`,
    `- Do not mention MAD Studio, MAD, agencies, marketing ops, or this platform.`,
    `- Do not use meta-marketing jargon: funnels, conversion, ROAS, CTR, synergy, disruptive, multiplexers, DNA, Brain Lab, Intent Matrix, operators, asset packs.`,
    `- Do not write like an agency pitch deck. Public copy must sound like the CLIENT brand speaking to its own customers.`,
    `- BAN clichés: Must-have, Elevate your style, Upgrade your wardrobe, Game-changer, Amazing food, Timeless piece, Wardrobe staple.`,
    `- BAN meta-vision labels in public copy: Camera sees, Visual details, Inspected, Concrete features, In the frame.`,
  ].join("\n")
}

/**
 * Public voice — always the client's stored Brain DNA + website vocabulary.
 */
export function buildClientPersonaLayer(input: {
  entity: StudioEntityDna
  contentPillars?: string[]
  localContext?: string[]
  personaBlock: string
  documentBlock: string
  quotesBlock: string
  learningBlock: string
  eventDescription: string
  visualDropUrl?: string | null
  visualDescription?: string | null
  concreteFeatures?: string[] | null
  aestheticTags?: string[] | null
}): string {
  const profile = resolveIndustryProfile({
    name: input.entity.name,
    industry: input.entity.industry,
  })
  const identity = input.entity.brand_identity
  const vibes =
    (Array.isArray((identity as { vibes?: string[] }).vibes) &&
      (identity as { vibes?: string[] }).vibes) ||
    profile.vibeTags
  const fudiExtras = isFudiHospitalityEntity({
    id: input.entity.id,
    name: input.entity.name,
    industry: input.entity.industry,
  })
    ? [
        "SYNERGY",
        "DISRUPT",
        "SAAS",
        "SOFTWARE",
        "CHEAP EATS",
        "VOUCHER CODE",
        "AGGREGATOR",
        "THIRD-PARTY DELIVERY",
      ]
    : []
  const forbidden = mergeForbiddenWords(identity.forbidden_words, fudiExtras).join(
    ", "
  )
  const valueProps = Object.entries(input.entity.value_propositions)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n")
  const pillars =
    input.contentPillars && input.contentPillars.length > 0
      ? input.contentPillars.map((p) => `- ${p}`).join("\n")
      : profile.contentPillars.map((p) => `- ${p}`).join("\n") || "- (none)"
  const local =
    input.localContext && input.localContext.length > 0
      ? input.localContext.map((p) => `- ${p}`).join("\n")
      : "- (none)"
  const audienceBlock =
    input.entity.audience_segments.length > 0
      ? input.entity.audience_segments
          .map(
            (segment) =>
              `- ${segment.name} (${segment.role}): pain=${segment.pain}; desire=${segment.desire}; trigger=${segment.trigger}; rebuttal=${segment.winning_rebuttal}`
          )
          .join("\n")
      : "- No audience segments stored."

  return [
    `### CLIENT PERSONA LAYER (THE ONLY PUBLIC VOICE)`,
    `All customer-facing strings MUST sound like "${input.entity.name}" — never like a marketing agency.`,
    `Source of truth = this brand's Brain DNA (scraped from their website and stored in Supabase).`,
    ``,
    `Brand: ${input.entity.name}`,
    `Industry: ${input.entity.industry}`,
    `Tone & voice: ${identity.tone || profile.tone}`,
    `Visual vibe: ${identity.visual_vibe || profile.visualVibe}`,
    `Core mission / tagline: ${identity.core_mission || profile.coreMission}`,
    `Signature vibes / collections (use when natural): ${vibes.join(", ") || "n/a"}`,
    `Forbidden words (strict — never use): ${forbidden}`,
    ``,
    `Website-grounded voice guidance:`,
    industryBiasCopy({
      name: input.entity.name,
      industry: input.entity.industry,
    }),
    ``,
    `Value propositions:`,
    valueProps || "- (none stored)",
    `Content pillars:`,
    pillars,
    `Local context:`,
    local,
    `Audiences:`,
    audienceBlock,
    ``,
    `### INTERNAL DOCUMENT SUMMARIES (facts only — rewrite in client voice)`,
    input.documentBlock,
    ``,
    `### REAL CUSTOMER LANGUAGE & PHRASING`,
    input.quotesBlock,
    ``,
    `### ACTIVE PERSONA`,
    input.personaBlock,
    ``,
    `### RAW SPARK / CORE EVENT`,
    input.eventDescription,
    input.visualDescription
      ? [
          ``,
          `### GROUNDED VISUAL INSPECTION (MANDATORY SOURCE OF TRUTH)`,
          `Media inspection notes (internal — weave into copy; never quote as meta):`,
          input.visualDescription,
          input.concreteFeatures && input.concreteFeatures.length > 0
            ? `Visible attributes to name naturally: ${input.concreteFeatures.join("; ")}`
            : "",
          input.aestheticTags && input.aestheticTags.length > 0
            ? `Aesthetic mood: ${input.aestheticTags.join(", ")}`
            : "",
          `When visual attributes (fabric, color, cut, neckline, plating, ingredients) are provided from media inspection, weave them directly into the flow of the sentence. NEVER output phrases like "Camera sees", "Visual details:", "Inspected:", "Concrete features:", or "In the frame:". The final text must read like an editorial director or food insider wrote it.`,
          `MANDATORY RULE: Every spoken_hook, on_screen_text, creative_hooks entry, seo_caption, carousel headline, and short_video line MUST reference specific features from this inspection (fabric/cut/hardware OR ingredients/plating/texture). Do not invent unseen details.`,
          `BAN GENERIC CLICHÉS — never write: Must-have, Elevate your style, Upgrade your wardrobe, Game-changer, Amazing food, Timeless piece, Wardrobe staple, Foodie paradise.`,
          `At least two creative_hooks (or spoken + OCR if hooks omitted) must name concrete visible attributes from the list above — embedded mid-sentence, never as a suffix label.`,
        ]
          .filter(Boolean)
          .join("\n")
      : input.visualDropUrl
        ? [
            ``,
            `### ATTACHED VISUAL DROP ASSET`,
            `Campaign product/visual reference URL: ${input.visualDropUrl}`,
            `Ground hooks, OCR text, carousel, and email in this exact drop visual (texture, silhouette, season, scarcity) using CLIENT vocabulary only.`,
            `Weave fabric/cut/plating details into natural editorial sentences — never label them as inspection output.`,
            `BAN GENERIC CLICHÉS — never write: Must-have, Elevate your style, Upgrade your wardrobe, Game-changer, Amazing food.`,
          ].join("\n")
        : "",
    ``,
    `### PROVEN WINNERS & BANNED ANGLES (internal memory — do not cite as MAD)`,
    input.learningBlock,
    ``,
    `Client voice rules:`,
    `- Write as the boutique / brand catalog or editorial — not as an agency briefing.`,
    `- Prefer vocabulary evidenced in Brain DNA, documents, and customer quotes.`,
    `- Never invent platform or agency self-references.`,
    `- HARD BAN in every field: MAD, agency, sartorial, marketplace headache, lowballers, synergy, funnel, ROAS, CTR, multiplexer, operator, asset pack, Must-have, Elevate your style, Upgrade your wardrobe, Game-changer, Amazing food, Camera sees, Visual details, Inspected.`,
    `- Keep every module aligned to the same event and objective while staying in-brand.`,
    ``,
    `### CREATIVE HOOKS (required when schema includes creative_hooks)`,
    `Produce exactly 3 distinct click-to-apply hooks tailored to THIS garment / visual drop:`,
    `1. vibe_styling — styling / wear angle grounded in visible silhouette, fabric, or plating.`,
    `2. investment_condition — quality, condition, designer provenance, value vs retail (or dish craft / portion proof for food).`,
    `3. local_instore — Whangārei showroom / neighbourhood table invite.`,
    `Each hook must be one publishable sentence in the client brand voice — no agency jargon.`,
    input.visualDescription
      ? `When visual inspection is present, hooks 1 and 2 MUST each name at least one concreteFeatures item woven into natural prose (never "Camera sees: …").`
      : "",
    ``,
    buildCaptionQualityRules({
      brandName: input.entity.name,
      showroomCta: profile.id === "worn_label",
    }),
  ]
    .filter(Boolean)
    .join("\n")
}

/** Caption hygiene rules — mirrors lib/copy/caption-hygiene post-processing. */
export function buildCaptionQualityRules(input: {
  brandName: string
  showroomCta: boolean
}): string {
  const ctas = input.showroomCta
    ? `"Tap link in bio to shop" or "Try on in our Whangārei showroom today"`
    : `"Tap link in bio to shop"`
  return [
    `### CAPTION & HASHTAG QUALITY (seo_caption, carousel, short_video, email)`,
    `- Never output duplicate introductory sentences or repeated draft fragments.`,
    `- Write concise, editorial, 2-to-3 sentence captions in ${input.brandName}'s natural tone.`,
    `- Do not insert bare web URLs in Instagram Feed captions. Use natural CTAs: ${ctas}. Tracking links are added automatically to Facebook / Email and the Story link sticker.`,
    `- Generate 6-8 clean, relevant hashtags in seo_caption.search_optimized_tags. Strictly ban hashtagging internal test titles or raw item IDs (e.g., no #zaratestitem, no SKU or numeric codes).`,
    `- Product names: strip internal catalog markers ("Test item", "SKU", "sample", item codes, draft notes, truncated abbreviations) and write a clean fashion title with natural casing, e.g. "Zara Cotton Maxi Skirt in Green".`,
  ].join("\n")
}

export function buildCampaignPackPrompt(input: {
  intent: MultiplexerIntent
  objective: string
  entity: StudioEntityDna
  contentPillars?: string[]
  localContext?: string[]
  personaBlock: string
  documentBlock: string
  quotesBlock: string
  learningBlock: string
  eventDescription: string
  visualDropUrl?: string | null
  visualDescription?: string | null
  concreteFeatures?: string[] | null
  aestheticTags?: string[] | null
  fudiTrack?: FudiAudienceTrack | null
  fudiRedirectSlugSeed?: string | null
}): string {
  const isFudi = isFudiHospitalityEntity({
    id: input.entity.id,
    name: input.entity.name,
    industry: input.entity.industry,
  })
  const trackBlock = isFudi
    ? input.fudiTrack
      ? fudiTrackPromptBlock(input.fudiTrack)
      : fudiMasterOperatingLawBlock()
    : ""
  const slugLine = input.fudiRedirectSlugSeed
    ? `Preferred trackable CTA slug for this pack: /r/${input.fudiRedirectSlugSeed} (append uniqueness if needed; keep the fudi- or partner- prefix).`
    : ""

  return [
    buildOperationalLayer({
      intent: input.intent,
      intentBias: intentBiasCopy(input.intent),
      objective: input.objective,
    }),
    trackBlock ? `\n${trackBlock}` : "",
    slugLine ? `\n${slugLine}` : "",
    ``,
    buildClientPersonaLayer(input),
  ]
    .filter(Boolean)
    .join("\n")
}

/** Prompt for website DNA extraction — capture CLIENT voice, never platform persona. */
export function buildWebsiteDnaExtractionPrompt(input: {
  brandName: string
  sourceUrl: string
  pageText: string
}): string {
  return [
    `Extract a structured marketing DNA matrix for the CLIENT brand "${input.brandName}".`,
    `You are extracting their public website voice for later use as customer-facing copy DNA.`,
    `Website URL: ${input.sourceUrl}`,
    ``,
    `CRITICAL:`,
    `- Capture the brand's own narrative, taglines, collection names, and vocabulary EXACTLY as customers would hear them.`,
    `- Do NOT inject agency / MAD Studio / marketing-ops language into any field.`,
    `- brand_identity must describe how THIS brand speaks to shoppers — not how a studio operates.`,
    `- Prefer verbatim taglines and vibe labels found on the page (e.g. "Less searching. Better finding", "Quiet Luxury").`,
    ``,
    `Field guidance:`,
    `- brand_identity.tone: comma-separated voice descriptors from the site.`,
    `- brand_identity.visual_vibe: aesthetic read from site copy and collections.`,
    `- brand_identity.core_mission: purpose + signature tagline from the site.`,
    `- brand_identity.forbidden_words: words THIS brand would never use (cheap/thrift tropes for luxury, etc.) PLUS never include MAD/agency terms as brand positives.`,
    `- brand_identity.vibes: curated collection / vibe labels found on the site (Shop by Vibe style).`,
    `- brand_identity.visual_presets: exact visual tokens inferred from the brand site aesthetic:`,
    `  - canvas_color (hex background)`,
    `  - accent_color (hex accent / CTA)`,
    `  - text_color (hex primary text on canvas)`,
    `  - font_family: "serif" | "sans" | "mono" (dominant typography vibe)`,
    `- content_pillars: recurring editorial themes from the site.`,
    `- value_propositions: keyed promises in the brand's own phrasing.`,
    `- audience_segments: grounded in who the site clearly serves.`,
    ``,
    `--- WEBSITE CONTENT ---`,
    input.pageText,
  ].join("\n")
}

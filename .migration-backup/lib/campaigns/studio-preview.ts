import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import type { CampaignPackOutputView } from "@/lib/campaigns/multiplexer"
import { stripMarkdown } from "@/lib/campaigns/pack-schema"

/** Maps the structured Gemini pack into the five Asset Studio preview strings. */
export function packToStudioPreview(
  pack: CampaignPack,
  campaignId: string | null = null
): CampaignPackOutputView {
  const teleprompter_script = [
    "[SPOKEN HOOK] [0s]",
    pack.algorithmic_signals.spoken_hook,
    "",
    "[ON-SCREEN TEXT / OCR]",
    pack.algorithmic_signals.on_screen_text,
    "",
    "[HOOK VISUAL]",
    pack.short_video_script.hook_visual,
    "",
    ...pack.short_video_script.spoken_lines.flatMap((line, index) => [
      `[${(index + 1) * 5}s]`,
      line,
      "",
    ]),
    "[CTA]",
    pack.short_video_script.cta_spoken,
    "",
    "[B-ROLL CUES]",
    ...pack.short_video_script.b_roll_cues.map((cue) => `• ${cue}`),
  ].join("\n")

  const carousel_copy = [
    pack.carousel.title,
    "",
    ...pack.carousel.slides.map(
      (slide) =>
        `Slide ${slide.slide_number}: ${slide.headline}\n${slide.body_text}`
    ),
  ].join("\n\n")

  const seo_captions = [
    pack.seo_caption.caption_body,
    "",
    "Keywords:",
    pack.algorithmic_signals.search_keywords.join(", "),
    "",
    "Tags:",
    pack.seo_caption.search_optimized_tags
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .join(" "),
  ].join("\n")

  const email_drop = [
    `Subject: ${pack.email_drop.subject_line}`,
    `Preview: ${pack.email_drop.preview_text}`,
    "",
    "Body:",
    stripMarkdown(pack.email_drop.body_markdown),
  ].join("\n")

  const json_payload: Record<string, unknown> = {
    campaign_title: pack.campaign_title,
    algorithmic_signals: pack.algorithmic_signals,
    short_video: pack.short_video_script,
    carousel: pack.carousel,
    seo_caption: pack.seo_caption,
    email_drop: pack.email_drop,
    b2b_dm: pack.b2b_dm,
  }

  return {
    id: campaignId,
    teleprompter_script,
    carousel_copy,
    seo_captions,
    email_drop,
    json_payload,
  }
}

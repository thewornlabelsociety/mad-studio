import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import { composeCaption, dedupeSentences } from "@/lib/copy/caption-hygiene"
import { mergeCaptionWithTags } from "@/lib/inventory/optimization-tags"
import type { SchedulerChannel } from "@/lib/scheduling/brain-timing"
import type { ScheduledPostPayload } from "@/lib/scheduling/process-scheduled-posts"

function stripMarkdown(value: string): string {
  return value
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim()
}

/**
 * The exact text a Studio pack posts on each channel. Shared by the server
 * (which queues it) and the review screen (which shows it before scheduling),
 * so the preview can't drift from what goes out. Keep both copies identical.
 */
export function packPayloadFor(
  channel: SchedulerChannel,
  pack: CampaignPack,
  base: Pick<ScheduledPostPayload, "media_url" | "destination_url" | "slug_seed">
): ScheduledPostPayload {
  const socialCaption = mergeCaptionWithTags(
    dedupeSentences(pack.seo_caption.caption_body),
    pack.seo_caption.search_optimized_tags
  )
  if (channel === "email") {
    return {
      ...base,
      title: pack.campaign_title,
      headline: pack.email_drop.subject_line,
      caption: [pack.email_drop.preview_text, stripMarkdown(pack.email_drop.body_markdown)]
        .filter(Boolean)
        .join("\n\n"),
    }
  }
  if (channel === "tiktok") {
    return {
      ...base,
      title: pack.campaign_title,
      headline: pack.algorithmic_signals.on_screen_text,
      caption: composeCaption(pack.algorithmic_signals.spoken_hook, socialCaption),
    }
  }
  return {
    ...base,
    title: pack.campaign_title,
    headline: pack.algorithmic_signals.on_screen_text,
    caption: socialCaption,
  }
}

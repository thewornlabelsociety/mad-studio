import type { Json } from "@/lib/database.types"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import type {
  CampaignProgramDayRow,
  CampaignProgramRow,
} from "@/lib/campaigns/program-types"
import type { ProgramDayPackSnapshot } from "@/lib/studio/headless-generator"
import { mergeCaptionWithTags } from "@/lib/inventory/optimization-tags"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import {
  buildBrainPlan,
  CHANNEL_META,
  type SchedulerChannel,
} from "@/lib/scheduling/brain-timing"
import { resolveSlotTimes, validateArmSlots } from "@/lib/scheduling/arm-queue"
import type { ScheduledPostPayload } from "@/lib/scheduling/process-scheduled-posts"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"

const CHANNEL_ALIASES: Record<string, SchedulerChannel> = {
  instagram_feed: "instagram_feed",
  instagram_story: "instagram_story",
  instagram: "instagram_story",
  tiktok: "tiktok",
  facebook: "facebook",
  email: "email",
  email_newsletter: "email",
  meta: "instagram_feed",
}

function programChannels(program: CampaignProgramRow): SchedulerChannel[] {
  const fromProgram = (program.target_channels ?? [])
    .map((row) => CHANNEL_ALIASES[row])
    .filter((row): row is SchedulerChannel => Boolean(row))
  const unique = [...new Set(fromProgram)]
  if (unique.length > 0) return unique
  return ["instagram_story", "instagram_feed", "tiktok"]
}

function anchorForScheduledDate(scheduledDate: string): Date {
  const [y, m, d] = scheduledDate.split("-").map((part) => Number.parseInt(part, 10))
  const dayStart = new Date(y, m - 1, d, 8, 0, 0, 0)
  const now = new Date()
  return dayStart.getTime() > now.getTime() ? dayStart : now
}

async function oauthExpiresWithinHours(
  supabase: SupabaseClient,
  entityId: string,
  hours: number
): Promise<boolean> {
  const threshold = Date.now() + hours * 60 * 60 * 1000
  const { data: rows } = await supabase
    .from("social_connections")
    .select("token_expires_at, is_active")
    .eq("entity_id", entityId)
    .eq("is_active", true)

  for (const row of rows ?? []) {
    if (!row.token_expires_at) continue
    const expires = Date.parse(row.token_expires_at)
    if (Number.isFinite(expires) && expires <= threshold) return true
  }
  return false
}

function parseSnapshot(raw: Json | null): ProgramDayPackSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const row = raw as ProgramDayPackSnapshot
  if (!row.pack) return null
  return row
}

export async function armDayPosts(input: {
  dayId: string
  entityId: string
  userId: string
  force?: boolean
}): Promise<{ armed: number; day: CampaignProgramDayRow }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: day, error: dayError } = await admin
    .from("campaign_program_days")
    .select("*")
    .eq("id", input.dayId)
    .maybeSingle()

  if (dayError) throw new Error(dayError.message)
  if (!day) throw new Error("Program day not found.")

  const { data: program, error: programError } = await admin
    .from("campaign_programs")
    .select("*")
    .eq("id", day.program_id)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (programError) throw new Error(programError.message)
  if (!program) throw new Error("Program not found for this entity.")

  const programRow = program as CampaignProgramRow
  const dayRow = day as CampaignProgramDayRow

  if (dayRow.status === "armed" || dayRow.status === "published") {
    throw new Error("This day is already armed.")
  }

  if (dayRow.status !== "ready" && !input.force) {
    throw new Error("Generate a pack before arming this day.")
  }

  if (
    programRow.autonomy_mode === "suggest" &&
    !dayRow.approved_at &&
    !input.force
  ) {
    throw new Error("Suggest mode requires operator approval before arming.")
  }

  if (
    programRow.autonomy_mode === "full_auto" &&
    (await oauthExpiresWithinHours(admin, input.entityId, 48))
  ) {
    throw new Error(
      "A social OAuth token expires within 48 hours — refresh connections before full_auto arming."
    )
  }

  const snapshot = parseSnapshot(dayRow.pack_snapshot)
  if (!snapshot?.pack) {
    throw new Error("Missing pack_snapshot — run headless pack generation first.")
  }

  const pack = snapshot.pack as CampaignPack
  const marketingEntityId = snapshot.marketingEntityId ?? dayRow.marketing_entity_id
  if (!marketingEntityId) {
    throw new Error("No marketing inventory item linked to this program day.")
  }

  const { data: item, error: itemError } = await admin
    .from("marketing_entities")
    .select("id, title, images, copy_draft, website_item_id, status")
    .eq("id", marketingEntityId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (itemError || !item) {
    throw new Error(itemError?.message ?? "Inventory item not found.")
  }

  const mediaUrl =
    snapshot.attachedImageUrl ??
    (typeof item.copy_draft === "object" &&
    item.copy_draft &&
    !Array.isArray(item.copy_draft) &&
    typeof (item.copy_draft as { media_url?: string }).media_url === "string"
      ? (item.copy_draft as { media_url: string }).media_url
      : null) ??
    (Array.isArray(item.images)
      ? item.images.find(
          (url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)
        )
      : null)

  if (!mediaUrl) {
    throw new Error("Arming needs a public https media URL on the inventory item.")
  }

  const { data: entity } = await admin
    .from("entities")
    .select("website_url")
    .eq("id", input.entityId)
    .maybeSingle()

  const headline = pack.algorithmic_signals.on_screen_text.trim() || pack.campaign_title
  const captionBody = pack.seo_caption.caption_body.trim()
  const tags = pack.seo_caption.search_optimized_tags
  const caption =
    mergeCaptionWithTags([headline, captionBody].filter(Boolean).join("\n\n"), tags) ||
    item.title

  const payload: ScheduledPostPayload = {
    title: item.title,
    headline,
    caption,
    media_url: mediaUrl,
    destination_url: resolveItemDestinationUrl({
      entityId: input.entityId,
      websiteUrl: entity?.website_url ?? null,
      websiteItemId: item.website_item_id,
      copyDraft: item.copy_draft,
    }),
    slug_seed: pack.campaign_title,
  }

  const channels = programChannels(programRow)
  const anchor = anchorForScheduledDate(dayRow.scheduled_date)
  const plan = buildBrainPlan(channels, anchor).map((slot) => ({
    ...slot,
    enabled: channels.includes(slot.channel),
  }))

  const nowMs = Date.now()
  const validated = validateArmSlots(plan, nowMs)
  if (!validated.ok) throw new Error(validated.error)

  const { times, firstScheduledAt } = resolveSlotTimes(validated.slots, now)

  await admin
    .from("scheduled_posts")
    .update({ status: "cancelled", updated_at: now })
    .eq("program_day_id", input.dayId)
    .eq("status", "scheduled")

  const { data: inserted, error: insertError } = await admin
    .from("scheduled_posts")
    .insert(
      validated.slots.map((slot, index) => ({
        entity_id: input.entityId,
        marketing_entity_id: marketingEntityId,
        campaign_id: snapshot.campaignId ?? dayRow.campaign_id,
        program_day_id: input.dayId,
        platform: slot.channel,
        mode: slot.mode,
        status: "scheduled",
        scheduled_time: times[index],
        timing_source: slot.timingSource,
        demographic_tag: slot.demographicTag.slice(0, 120),
        caption,
        media_url: mediaUrl,
        payload: payload as Json,
        created_by: input.userId,
        max_retries: 3,
      }))
    )
    .select("id")

  if (insertError || !inserted?.length) {
    throw new Error(insertError?.message ?? "Failed to write scheduled posts.")
  }

  const channelsOut = Array.from(
    new Set(validated.slots.map((slot) => CHANNEL_META[slot.channel].dispatchChannel))
  )

  await admin
    .from("marketing_entities")
    .update({
      status: "scheduled",
      scheduled_at: firstScheduledAt ?? now,
      channels: channelsOut,
      updated_at: now,
    })
    .eq("id", marketingEntityId)

  const { data: updatedDay, error: updateError } = await admin
    .from("campaign_program_days")
    .update({
      status: "armed",
      last_error: null,
      updated_at: now,
    })
    .eq("id", input.dayId)
    .select("*")
    .single()

  if (updateError || !updatedDay) {
    throw new Error(updateError?.message ?? "Failed to mark day armed.")
  }

  return { armed: inserted.length, day: updatedDay as CampaignProgramDayRow }
}

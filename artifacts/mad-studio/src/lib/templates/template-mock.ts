import type {
  EntityTemplateInstance,
  PlatformTemplateDef,
  TemplateCategory,
} from "./template-schema.ts"
import { templatePayloadSchema } from "./template-schema.ts"

/** Stable demo UUIDs — never collide with real rows; clearly fake. */
export const MOCK_STARTER_IDS = {
  arrivals: "00000000-0000-4000-8000-000000000001",
  spotlight: "00000000-0000-4000-8000-000000000002",
  promo: "00000000-0000-4000-8000-000000000003",
  email: "00000000-0000-4000-8000-000000000004",
} as const

export const MOCK_INSTANCE_IDS = {
  draft: "00000000-0000-4000-8000-000000000101",
  active: "00000000-0000-4000-8000-000000000102",
} as const

function starter(
  id: string,
  slug: string,
  category: TemplateCategory,
  title: string,
  description: string,
  payload: Record<string, unknown>
): PlatformTemplateDef {
  return {
    id,
    slug,
    category,
    title,
    description,
    industry_tags: ["fashion", "food", "generic"],
    payload: templatePayloadSchema.parse(payload),
    version: 1,
    is_published: true,
  }
}

/** Labeled demo starters for UI when foundation tables are unavailable. */
export function getMockStarters(): PlatformTemplateDef[] {
  return [
    starter(
      MOCK_STARTER_IDS.arrivals,
      "demo-starter-new-arrivals",
      "new_arrivals",
      "New arrivals drop",
      "DEMO — generic arrival announcement for feed + story.",
      {
        surfaces: ["social_post", "story", "carousel"],
        default_channels: ["instagram_feed", "instagram_story"],
        creative_instructions:
          "Announce a new item with concrete details from the listing. No invented discounts.",
        formula_hook_id: "curiosity_gap",
        placeholders: ["item", "brand", "location"],
      }
    ),
    starter(
      MOCK_STARTER_IDS.spotlight,
      "demo-starter-product-spotlight",
      "product_spotlight",
      "Product spotlight",
      "DEMO — single-SKU deep dive.",
      {
        surfaces: ["social_post", "carousel", "video_brief"],
        default_channels: ["instagram_feed", "facebook"],
        creative_instructions:
          "Focus on one product: condition, fit, styling. Client voice only.",
        formula_hook_id: "price_contrast",
        placeholders: ["item", "brand", "priceA", "priceB"],
      }
    ),
    starter(
      MOCK_STARTER_IDS.promo,
      "demo-starter-promotional",
      "promotional",
      "Promotional campaign",
      "DEMO — multi-channel promo skeleton.",
      {
        surfaces: ["social_post", "story", "email", "multi_channel"],
        default_channels: ["instagram_feed", "instagram_story", "email"],
        creative_instructions:
          "Promote an offer only when slots provide real terms.",
        placeholders: ["campaignLine", "location", "item"],
      }
    ),
    starter(
      MOCK_STARTER_IDS.email,
      "demo-starter-email-newsletter",
      "email_newsletter",
      "Email newsletter",
      "DEMO — VIP email skeleton.",
      {
        surfaces: ["email", "multi_channel"],
        default_channels: ["email"],
        creative_instructions: "Subject + preview + body. One primary CTA.",
        placeholders: ["item", "brand", "campaignLine"],
        email_skeleton: {
          subject_hint: "This week at the shop",
          preview_hint: "Fresh drops inside",
        },
      }
    ),
  ]
}

/** Demo brand templates scoped to the requested entityId only. */
export function getMockInstances(entityId: string): EntityTemplateInstance[] {
  const starters = getMockStarters()
  const arrivals = starters[0]!
  return [
    {
      id: MOCK_INSTANCE_IDS.active,
      entity_id: entityId,
      source_def_id: arrivals.id,
      parent_instance_id: null,
      category: arrivals.category,
      name: "Brand arrivals (demo)",
      status: "active",
      version: 2,
      creative_instructions:
        "DEMO — announce this week’s drop with showroom try-on CTA.",
      formula_hook_id: "curiosity_gap",
      canvas_layout_id: null,
      story_style_preset: null,
      channel_plan: ["instagram_feed", "instagram_story"],
      placeholder_defaults: { location: "Whangārei" },
      payload: templatePayloadSchema.parse({
        ...arrivals.payload,
        creative_instructions:
          "DEMO — announce this week’s drop with showroom try-on CTA.",
      }),
      performance: {},
      created_by: null,
      updated_at: new Date().toISOString(),
    },
    {
      id: MOCK_INSTANCE_IDS.draft,
      entity_id: entityId,
      source_def_id: MOCK_STARTER_IDS.spotlight,
      parent_instance_id: null,
      category: "product_spotlight",
      name: "Spotlight draft (demo)",
      status: "draft",
      version: 1,
      creative_instructions: "DEMO — single piece spotlight; emphasize fit.",
      formula_hook_id: "price_contrast",
      canvas_layout_id: null,
      story_style_preset: null,
      channel_plan: ["instagram_feed"],
      placeholder_defaults: {},
      payload: templatePayloadSchema.parse({
        surfaces: ["social_post", "carousel"],
        default_channels: ["instagram_feed"],
        creative_instructions: "DEMO — single piece spotlight; emphasize fit.",
        formula_hook_id: "price_contrast",
        placeholders: ["item", "brand"],
      }),
      performance: {},
      created_by: null,
      updated_at: new Date().toISOString(),
    },
  ]
}

export function isMockTemplateId(id: string): boolean {
  return id.startsWith("00000000-0000-4000-8000-")
}

/**
 * In-app Help & SOP source of truth.
 * Update this file whenever user-facing features or workflows change.
 * See `.cursor/rules/mad-studio-help.mdc` for agent instructions.
 */
export const MAD_STUDIO_HELP_VERSION = "2026-09-30i"

export type HelpSop = {
  title: string
  audience: string
  prerequisites?: string[]
  steps: string[]
  tips?: string[]
}

export type HelpFeature = {
  name: string
  description: string
}

export type HelpSection = {
  id: string
  title: string
  summary: string
  route?: string
  features: HelpFeature[]
  sop?: HelpSop
}

export const MAD_STUDIO_HELP_INTRO = {
  title: "MAD Studio — Features & SOPs",
  tagline:
    "Multi-brand marketing ops: intake → Brain → Studio packs → schedule → ledger → learn.",
  version: MAD_STUDIO_HELP_VERSION,
  pillars: [
    "One active brand (entity) at a time — URL uses ?eid= for shareable context.",
    "All customer data lives in the MAD Studio Supabase project.",
    "FÜDI app Supabase is read-only for feed pull; never used for Brain or campaigns.",
  ],
}

export const MAD_STUDIO_HELP_SECTIONS: HelpSection[] = [
  {
    id: "platform",
    title: "Platform overview",
    summary:
      "MAD Studio is a multi-tenant campaign workspace for hospitality (FÜDI) and retail/fashion (e.g. Worn Label Society).",
    features: [
      {
        name: "Organizations & brands",
        description:
          "Users belong to an organization; each brand is an entity with DNA, inventory, campaigns, and social connections.",
      },
      {
        name: "Roles",
        description:
          "Org admins manage invites. Entity managers and creators can run Studio, intake, and Brain edits.",
      },
      {
        name: "Navigation",
        description:
          "Today (radar), Studio (pack builder), Campaigns (ledger), Meter (analytics), Socials (connections). Brain and Inventory are reached from Studio/Today flows and direct URLs.",
      },
    ],
    sop: {
      title: "Daily operator loop",
      audience: "Creator or entity manager",
      steps: [
        "Sign in and select the correct brand in the top bar (check ?eid=).",
        "Open Today — refresh intake if new drops are expected.",
        "Pick an unfeatured item → open in Studio → generate pack → arm schedule or save draft.",
        "After publish, log spend/sales in Campaigns and save post-mortem takeaways to Brain Memory.",
      ],
      tips: [
        "Switching brands in the dropdown keeps you on the same page with the new eid.",
      ],
    },
  },
  {
    id: "auth",
    title: "Auth, invites & new brands",
    route: "/login",
    summary: "Email/password or magic link; invitation tokens for team access.",
    features: [
      {
        name: "Login / signup",
        description: "Supabase Auth; session cookies power API calls from the UI.",
      },
      {
        name: "Invites",
        description:
          "/invite/[token] accepts org invitation and can scope entity access.",
      },
      {
        name: "Add New Brand",
        description:
          "/entities/new — 4-step wizard: scrape site, calibrate DNA, social handles, optional outbound webhook.",
      },
    ],
    sop: {
      title: "Onboard a new team member",
      audience: "Org admin",
      prerequisites: ["Organization admin role"],
      steps: [
        "Open team invite from the top bar (when admin).",
        "Generate invite link with role (and optional entity scope).",
        "Send link; recipient signs in and accepts — lands on Studio with access.",
      ],
    },
  },
  {
    id: "today",
    title: "Today — Command Hub",
    route: "/today",
    summary:
      "Daily radar: unfeatured intake count, armed posts, Brain directive, intake cards, refresh feed.",
    features: [
      {
        name: "Intake radar",
        description: "Count of unfeatured marketing_entities for the active entity.",
      },
      {
        name: "Refresh / Pull feed",
        description:
          "FÜDI: POST /api/intake/fudi-feed (read FÜDI Supabase tables fudi_deals, fudi_events, fudi_posts, marketplace_items, trails → MAD marketing_entities, latest 20 with image + title). Other brands: POST /api/sync/pull-new-arrivals.",
      },
      {
        name: "Intake cards",
        description:
          "Queue preview with drop badges (foodie, eatery, deal, event, marketplace, FÜDI promo). Quick Preview = scrollable live simulator (hook + caption as posted, no intake IDs) + Quick publish. FÜDI: Build feed carousel merges 2–10 intake stills into a platform promo draft (IG Carousel / Facebook).",
      },
      {
        name: "Armed today",
        description: "Scheduled posts dispatching today (from scheduled_posts queue).",
      },
    ],
    sop: {
      title: "Morning intake check (FÜDI)",
      audience: "Creator on FÜDI entity",
      steps: [
        "Confirm brand switcher shows FÜDI.",
        "Click [ ⟳ Pull Eatery / App Feed ] on Today.",
        "Review new cards; open one in Studio when ready to produce.",
        "Remove unwanted rows from /inventory if needed (unfeatured only).",
      ],
      tips: [
        "Pull reads FÜDI Supabase tables (fudi_deals, fudi_events, fudi_posts, marketplace_items, trails) via FUDI_SUPABASE_* on the API server; writes go to MAD marketing_entities only.",
      ],
    },
  },
  {
    id: "inventory",
    title: "Inventory ledger",
    route: "/inventory",
    summary:
      "Entity-scoped list of marketing_entities (drops). Does not show other brands' items.",
    features: [
      {
        name: "Pull Eatery / App Feed",
        description: "Same as Today refresh for FÜDI entity.",
      },
      {
        name: "Remove from intake",
        description:
          "Deletes unfeatured row in MAD Studio only; does not delete FÜDI app source. Item may reappear on a future pull if still in top 20.",
      },
      {
        name: "Open in Studio",
        description: "Link uses /studio?eid=&itemId= for drop-scoped pack generation.",
      },
      {
        name: "Drop workbench (Media step)",
        description:
          "Open a row → Step 1 Media: platform preview, Post intent chips (drop type, channel hint, listing vibe — same as Today; auto-saves to copy_draft.metadata), hook/caption fields, context hook cards, Rotate, AI enhance (POST /api/inventory/enhance-caption).",
      },
    ],
    sop: {
      title: "Curate intake before Studio",
      audience: "Creator",
      steps: [
        "Pull latest feed.",
        "Remove junk or duplicate unfeatured rows.",
        "Open keeper → Studio → generate pack.",
      ],
    },
  },
  {
    id: "brain",
    title: "Brain Lab",
    route: "/brain",
    summary:
      "Brand DNA, documents, Street Ear, Memory vault, Brand Director chat — all scoped to active entity.",
    features: [
      {
        name: "Core DNA",
        description: "Tone, segments, value props; feeds Studio and pack generation.",
      },
      {
        name: "Memory vault",
        description:
          "Winning rules from post-mortems and manual directives (POST /api/brain/memory → MAD campaigns table).",
      },
      {
        name: "Add Directive",
        description:
          "Manual one-line rules; saved to MAD Studio DB only (not FÜDI Supabase).",
      },
      {
        name: "Brand Director",
        description: "Chat with entity context; can save takeaways to Memory.",
      },
      {
        name: "Street Ear",
        description: "Hospitality trend seeds (FÜDI-oriented prompts).",
      },
    ],
    sop: {
      title: "Add a manual Brain directive",
      audience: "Creator or manager",
      steps: [
        "Brain → Memory tab.",
        "Type directive (min 3 characters) in Winning Rules field.",
        "Click [ + ADD DIRECTIVE ].",
        "Confirm toast; directive appears in list and informs future packs.",
      ],
      tips: [
        "If you see origin/env errors, ensure API server has NEXT_PUBLIC_SITE_URL or REPLIT_DOMAINS.",
      ],
    },
  },
  {
    id: "studio",
    title: "Campaign Studio (Multiplexer)",
    route: "/studio",
    summary:
      "Three-step flow: media/spark → formula or AI pack → edit, schedule, arm multi-channel.",
    features: [
      {
        name: "Formula bank ($0 render)",
        description:
          "Step 2: pick hook, visual direction, and conversion CTA from entity presets; fill bracket slots (item, location, prices). Step 3: Render formula pack builds the 5-piece pack locally with no Gemini tokens.",
      },
      {
        name: "AI pack (Gemini)",
        description:
          "Optional Generate with AI for open-ended copy when formulas are not enough; uses entity DNA and spark text.",
      },
      {
        name: "Entity presets",
        description: "FÜDI tracks (diners/partners) vs fashion presets adjust chips and objectives.",
      },
      {
        name: "Media library & carousel",
        description:
          "Step 1 / pack preview: Media library drawer lists recent entity images and reels with [ FÜDI App ] vs [ Upload ] badges; multi-select up to 10 → Build carousel mounts slides in the IG Feed simulator.",
      },
      {
        name: "On-canvas text styler",
        description:
          "Pack preview styling: headline/subhead overlays on the phone canvas (social fonts, brand swatches, shadow, highlight pill); PNG export via html-to-image includes overlays.",
      },
      {
        name: "CapCut bridge",
        description:
          "Step 1 (video) and pack preview: Edit reel in CapCut copies hook/caption/script JSON and opens CapCut Web; drop finished MP4 back to replace the draft reel without losing metadata.",
      },
      {
        name: "Multi-channel scheduler",
        description: "Arm Instagram/Facebook/TikTok/email slots; brain timing suggestions.",
      },
      {
        name: "Save / dispatch",
        description:
          "Save draft to campaigns; arm queue; optional outbound webhook dispatch for legacy flows.",
      },
    ],
    sop: {
      title: "Produce a drop from intake",
      audience: "Creator",
      prerequisites: ["Unfeatured item or fresh spark text"],
      steps: [
        "Open Studio with itemId from intake or enter a short spark (≤500 chars).",
        "Attach or confirm hero media.",
        "On Step 2, choose hook / visual / CTA and fill formula slots (defaults pull from spark).",
        "On Step 3, click Render formula pack ($0) for instant copy, or Generate with AI when you need a custom draft.",
        "Review tabs (video, carousel, caption, etc.), arm channels or save as draft.",
        "Confirm armed rows on Today and Campaigns ledger.",
      ],
    },
  },
  {
    id: "campaigns",
    title: "Campaigns — Drop Performance Ledger",
    route: "/campaigns",
    summary: "ROI logging, post-mortem training, scheduled queue visibility.",
    features: [
      {
        name: "Log spend / sales",
        description: "Bilingual ROI cards; writes ad_analytics for the entity.",
      },
      {
        name: "Post-mortem",
        description:
          "Outcome rating + notes → AI takeaway saved to campaign; feeds Brain Memory.",
      },
      {
        name: "Open Ledger from Studio",
        description: "Quick link from Studio action bar.",
      },
    ],
    sop: {
      title: "Close the loop after a drop",
      audience: "Creator or manager",
      steps: [
        "Open Campaigns for the entity.",
        "Find the campaign row; log spend and revenue for the window.",
        "Rate outcome; Save & Train Brain.",
        "Verify takeaway appears under Brain → Memory.",
      ],
    },
  },
  {
    id: "meter",
    title: "Meter (Analytics)",
    route: "/analytics",
    summary: "Entity analytics dashboard and metering views.",
    features: [
      {
        name: "Usage & performance",
        description: "Aggregated metrics tied to entity and campaigns.",
      },
    ],
    sop: {
      title: "Review performance weekly",
      audience: "Manager",
      steps: [
        "Select brand → Meter.",
        "Compare against Campaigns ledger entries.",
        "Adjust Brain directives or Studio presets based on winners.",
      ],
    },
  },
  {
    id: "socials",
    title: "Social connections",
    route: "/settings/social",
    summary: "Meta, TikTok OAuth, outbound webhooks, VIP email lists.",
    features: [
      {
        name: "Instagram / Facebook",
        description: "OAuth connect per entity; used for publish and optional IG intake fallback.",
      },
      {
        name: "TikTok",
        description: "OAuth and publish guards for media requirements.",
      },
      {
        name: "Outbound webhook",
        description: "Make/n8n style dispatch from generated packs (legacy/automation).",
      },
    ],
    sop: {
      title: "Connect Instagram for publishing",
      audience: "Entity manager",
      steps: [
        "Socials → Connect Meta.",
        "Complete OAuth; confirm account shows active.",
        "Arm a test post in Studio with Instagram channel only.",
      ],
    },
  },
  {
    id: "integrations",
    title: "Integrations & API (ops reference)",
    summary: "Server-side routes and secrets — for admins, not end users.",
    features: [
      {
        name: "FÜDI feed pull",
        description:
          "POST /api/intake/fudi-feed { sync: true } — SELECT from fudi_deals, fudi_events, fudi_posts, marketplace_items, trails on FÜDI; upsert marketing_entities on MAD.",
      },
      {
        name: "FÜDI webhook push",
        description:
          "Same route with item/items + FUDI_FEED_WEBHOOK_SECRET for app-push payloads.",
      },
      {
        name: "Website sync",
        description: "POST /api/sync/website with SYNC_WEBHOOK_SECRET for catalog rows.",
      },
      {
        name: "Cron",
        description:
          "/api/cron/dispatch-scheduled and sync-metrics with CRON_SECRET.",
      },
      {
        name: "MAD Supabase env",
        description: "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, anon key.",
      },
      {
        name: "FÜDI read-only env",
        description:
          "FUDI_SUPABASE_URL, FUDI_SUPABASE_ANON_KEY; optional FUDI_SUPABASE_PULL_LIMIT (default 20) and FUDI_SUPABASE_USE_SERVICE_ROLE_FOR_READ=1 (API only). Grant SELECT on fudi_deals, fudi_events, fudi_posts, marketplace_items, trails on the FÜDI project.",
      },
    ],
    sop: {
      title: "Replit secret checklist",
      audience: "Platform admin",
      steps: [
        "Set MAD Supabase URL/keys on API + frontend (VITE_* mirrors for UI).",
        "Never point NEXT_PUBLIC_SUPABASE_URL at the FÜDI project.",
        "Set FUDI_* only on API server for feed pull.",
        "Set NEXT_PUBLIC_SITE_URL to public app URL.",
        "Redeploy API after secret changes.",
      ],
    },
  },
]

export function helpSectionById(id: string): HelpSection | undefined {
  return MAD_STUDIO_HELP_SECTIONS.find((section) => section.id === id)
}

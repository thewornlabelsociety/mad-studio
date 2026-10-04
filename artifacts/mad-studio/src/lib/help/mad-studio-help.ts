/**
 * In-app Help & SOP source of truth.
 * Update this file whenever user-facing features or workflows change.
 * See `.cursor/rules/mad-studio-help.mdc` for agent instructions.
 */
export const MAD_STUDIO_HELP_VERSION = "2026-10-04f"

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
          "Top header: logo, brand switcher, Today · Studio · Campaigns, Help, Account. Meter and Socials live under Account. Brain and Inventory open from Studio/Today or direct URLs.",
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
      "Daily radar: mobile swipe deck (PWA) from daily_queue pending_review; desktop command hub with armed posts and Brain directive.",
    features: [
      {
        name: "Mobile swipe deck (PWA)",
        description:
          "On phone viewports, /today shows one card at a time from public.daily_queue (status pending_review). Header shows Archive ↔ Skip swipe pills; swipe left to archive, right to skip — both persist (daily_queue status + copy_draft.metadata.today_deck_status) so dismissed drops do not reappear on refresh. Bottom bar: Edit, Preview, 1-Tap Approve. Apply migration 20261002_daily_queue.sql on MAD for full queue sync.",
      },
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
          "Queue preview with drop badges (foodie, eatery, deal, event, marketplace, FÜDI promo). **[ 📱 Mobile Drop ]** rows come from POST /api/intake/mobile-drop (WhatsApp/SMS via Twilio/Make); **[ 🤖 Auto-Triggered ]** rows from GET/POST /api/cron/triggers (NZ-time lunch/knock-off/weekend templates). **Craft in Studio** opens Step 2 (Media). Quick Preview = scrollable live simulator + Quick publish. FÜDI: Build feed carousel picks 2–10 stills, then AI suggests three promo angles via POST /api/ai/carousel-suggest.",
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
        "For a multi-slide IG feed promo: select ≥2 still-image cards → Build feed carousel → pick an AI angle or Skip AI / manual order.",
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
          "Drop workbench: Phone preview keeps the same on-image text styling from Canvas through Copy and Schedule (photo + your font/color/tilt overlay). Hook and caption stay in the Copy fields, not burned on the photo unless Canvas text is enabled. Copy step tilt chips (−12° … +12°) and Canvas drag handles style text that bakes into the PNG on Save/Arm. **Clear on-image text** removes baked layers; re-save or download again for clean media. Story/TikTok download exports the source photo (plus Canvas text if enabled), not a phone-screenshot with extra words.",
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
        description:
          "Customer quote vault for hooks. Manual quotes plus inbound Instagram praise via Meta webhook POST /api/webhooks/meta-sentiment (comments + mentions). Positive comments map to the entity by connected Instagram account_id; stored with customer_emotion street_ear_inbound.",
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
      "Five-step wizard: Media → Intent → Canvas → Copy → Schedule. On phone, preview + icon channel rail sit above controls; draft/SOP live in ☰ Menu.",
    features: [
      {
        name: "Mobile Studio layout",
        description:
          "Under 768px: compact header (logo mark, brand pill, ☰ Menu). Step tracker shows Step N of 5 with dot progress. Preview phone + icon channel rail appear from Intent onward; Media step is tray-only (no phone).",
      },
      {
        name: "Intent step (Step 2)",
        description:
          "FÜDI drop type and listing vibe use dropdowns with a Custom… option (free-text when custom). Content pillar, persona, hook blueprint, and CTA are dropdowns tied to Brain DNA — no channel-hint pills on Intent; pick channels on Schedule.",
      },
      {
        name: "Auto-suggest intent from media",
        description:
          "On Step 2, Auto-Suggest Intent from Media maps drop type, vibe, pillar, persona, hook, and CTA from your attached image or reel (Gemini). If Step 1 vision has not run yet, the button inspects the public media URL on click. AI-filled dropdowns show a ✨ hint; change any field manually to override or pick Custom… for free text.",
      },
      {
        name: "In-flow wizard SOP",
        description:
          "Each Studio step shows a one-line SOP hint under the step tracker; hover a step tab (desktop) for the numbered checklist. Mobile uses the hint strip plus the ? icon for the full step list. Team SOP drawer still has the full two-track posting playbook.",
      },
      {
        name: "Formula bank ($0 render)",
        description:
          "Copy step: pick hook, visual direction, and conversion CTA from entity presets; fill bracket slots (item, location, prices). Schedule step: Render formula pack builds the 5-piece pack locally with no Gemini tokens.",
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
          "Media tray **Add** opens the entity media library (intake + uploads with [ FÜDI App ] / [ Upload ] badges). Select one or more → **Add to tray**, or **Upload new file** in the drawer. With multiple tray items, **IG Story** preview supports tap left/right on the phone, ‹ › arrows, progress-bar segments, and keyboard ← →; selection stays in sync with the tray. IG Feed uses carousel arrows when 2+ slides.",
      },
      {
        name: "On-canvas text styler",
        description:
          "Canvas step: draggable headline/subhead only — platforms reject baked poll, countdown, emoji decor, or fake link stickers in exported media. Style with font, color, shadow, Highlight pill (None, translucent black, or brand lime), align, size, and rotation. Quick presets: Center frame, Lower third, Reset size & tilt. Lime drag bar moves text; top-left rotates; bottom-right scales. Motion presets pause while you edit; Save/Arm bakes text into the PNG for dispatch. Native music, poll, and link stickers are added on your phone (Track 2 SOP).",
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
        name: "Two-track dispatch dock",
        description:
          "Schedule step preview dock follows platform: **Track 1 Autopilot** (IG Feed + Facebook) → **Confirm & publish live** via /api/social/publish with a trackable short link in the Facebook caption (FÜDI entity uses **https://fudi.nz/r/…**; other brands use your MAD Studio site /r/ slug). **Track 2 Draft & drop** (IG Story + TikTok) → **Download ready media (9:16)** and **Copy link sticker URL** — no fake link stickers in preview; native music/poll/link stickers are added on phone. Header **Team SOP & posting guide** opens the full slide-over playbook.",
      },
      {
        name: "Save / dispatch",
        description:
          "Save draft to campaigns; arm queue; optional outbound webhook dispatch for legacy flows.",
      },
    ],
    sop: {
      title: "Two-track team posting (Vanessa SOP)",
      audience: "Creator",
      prerequisites: ["Signed in", "Brand selected", "Media attached on Schedule step"],
      steps: [
        "Open **Team SOP & posting guide** from the top bar anytime.",
        "Track 1 (IG Feed / Facebook): review 4:5 preview → **Confirm & publish live**.",
        "Track 2 (IG Story / TikTok): **Download ready media** → **Copy link sticker URL** → post from phone with native Link/Music/Poll stickers.",
        "Optional: arm multi-channel rows on Schedule; confirm on Today and Campaigns.",
      ],
    },
  },
  {
    id: "campaigns",
    title: "Campaigns — Drop Performance Ledger",
    route: "/campaigns",
    summary:
      "Executive financial view: Money Spent, Sales Made, Net Profit, Return Multiplier (ROAS), published-drop conversion table, and post-mortem winners.",
    features: [
      {
        name: "Financial summary",
        description:
          "Top row aggregates ad_analytics across campaigns — plain-English Money Spent, Sales Made, Net Profit, and ROAS multiplier (not token telemetry).",
      },
      {
        name: "Conversion table",
        description:
          "Published marketing_entities with thumbnail, audience, CTR, direct conversions, and cost-per-click.",
      },
      {
        name: "Log spend / sales",
        description: "Per-drop ROI cards; writes ad_analytics for the entity.",
      },
      {
        name: "Post-mortem & Mark as Winner",
        description:
          "5-piece pack review, **Mark as Winner** (hook + audience + your one-line takeaway → campaigns.ai_takeaway for Brain), or full playbook notes.",
      },
      {
        name: "Brain Memory vault (excluded here)",
        description:
          "Save to Memory Vault / Teach Brain writes target_goal memory_vault on MAD campaigns — shown on Brain → Memory, not in this drop ledger.",
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
        description:
          "Settings → Connect with TikTok (Login Kit). OAuth stores access_token, refresh_token, and token_expires_at on social_connections. Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI. Cron: GET/POST /api/cron/refresh-tiktok-tokens with Authorization Bearer CRON_SECRET (refresh when expiry is within 6h). Publish also refreshes inline when needed. Direct Post: .mp4/.mov via /api/media/proxy. Unaudited apps: SELF_ONLY. Webhook fallback if no OAuth.",
      },
      {
        name: "Outbound webhook",
        description: "Make/n8n style dispatch from generated packs (legacy/automation).",
      },
    ],
    sop: {
      title: "Connect social accounts for publishing",
      audience: "Entity manager",
      steps: [
        "Settings → Social → Connect with Meta for IG Feed / Facebook autopilot.",
        "Connect with TikTok for Direct Post (video .mp4/.mov); Test Connection after OAuth.",
        "Verify TikTok URL prefix / media proxy on madstudio.nz in the TikTok developer portal.",
        "Studio Schedule → TikTok preview: download + link sticker for phone drop, or Send via TikTok API when connected.",
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
          "/api/cron/dispatch-scheduled, sync-metrics, and refresh-tiktok-tokens with Authorization Bearer CRON_SECRET (or x-cron-secret). Schedule refresh-tiktok-tokens every few hours.",
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

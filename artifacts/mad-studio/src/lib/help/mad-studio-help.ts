/**
 * In-app Help & SOP source of truth.
 * Update this file whenever user-facing features or workflows change.
 * See `.cursor/rules/mad-studio-help.mdc` for agent instructions.
 */
export const MAD_STUDIO_HELP_VERSION = "2026-10-23a"

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
          "Icon rail on the left (desktop): Workflow links plus **Brand Brain**, **Team SOP**, and **Account** at the bottom — expand the rail for labels (no MAD square logo). Top bar: brand switcher only. On mobile, use Menu for the same links.",
      },
    ],
    sop: {
      title: "Daily operator loop",
      audience: "Creator or entity manager",
      steps: [
        "Sign in and select the correct brand in the top bar (check ?eid=).",
        "Open Inbox (Today) — refresh intake if new drops are expected.",
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
          "On phone viewports, /today shows one card at a time from public.daily_queue (status pending_review). Header shows Archive / Skip swipe pills; swipe left to archive, right to skip — both persist (daily_queue status + copy_draft.metadata.today_deck_status) so dismissed drops do not reappear on refresh. Bottom bar: Edit, Preview, 1-Tap Approve. Apply migration 20261002_daily_queue.sql on MAD for full queue sync.",
      },
      {
        name: "Intake radar",
        description: "Count of unfeatured marketing_entities for the active entity.",
      },
      {
        name: "Refresh / Pull feed",
        description:
          "FÜDI: POST /api/intake/fudi-feed (read FÜDI Supabase tables fudi_deals, fudi_events, fudi_posts, marketplace_items, trails → MAD marketing_entities, latest 20 with image + title). Worn Label Society / fashion: POST /api/sync/pull-new-arrivals reads the brand website JSON catalog (default `entities.website_url` + `/api/public/marketplace/listings` and `/api/public/items`, or INVENTORY_FEED_URL / INVENTORY_FEED_URL_WORN_LABEL_SOCIETY). Only listings with live status (active/published) import; sold or delisted rows are skipped and stale unfeatured intake is removed on refresh. Toast shows the feed URL used. Dev-only INVENTORY_USE_DEMO_FEED=true injects a sample item — keep it false in production.",
      },
      {
        name: "Intake cards",
        description:
          "Queue preview with drop badges (foodie, eatery, deal, event, marketplace, FÜDI promo). **[ Mobile Drop ]** rows come from POST /api/intake/mobile-drop (WhatsApp/SMS via Twilio/Make); **[ Auto-Triggered ]** rows from GET/POST /api/cron/triggers (NZ-time lunch/knock-off/weekend templates). **Craft in Studio** opens Step 2 (Media). Quick Preview = scrollable live simulator + Quick publish. FÜDI: Build feed carousel picks 2–10 stills, then AI suggests three promo angles via POST /api/ai/carousel-suggest.",
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
    id: "planner",
    title: "Planner — Campaign timeline",
    route: "/planner",
    summary:
      "Split workspace: Campaign Engine (left) for multi-day launch briefs; calendar canvas (right) with Day, Week, and Month grids for Brain-injected timeline cards.",
    features: [
      {
        name: "Campaign Engine",
        description:
          "Monospace sidebar: launch brief textarea, duration pills (3-Day, 5-Day, 1-Week), and Generate timeline. POST /api/generate/campaign writes MAD `campaign_programs` + `campaign_program_days` (migration 20261008_campaign_programs.sql) and returns `programId` so refresh reloads the same flight plan.",
      },
      {
        name: "Calendar day cards",
        description:
          "After generation, each scheduled day shows a DRAFT card (phase title + shoot cue). Click for Hook / Vibe / Action detail; Craft in Studio opens /studio?eid=…&step=3 with the day’s creative angle pre-loaded (MAD Supabase only — not FÜDI).",
      },
      {
        name: "Calendar canvas",
        description:
          "Toolbar shows month/year (e.g. OCTOBER 2026) and view toggles [ DAY ] [ WEEK ] [ MONTH ] (active = solid black). Month view: 7-column Mon–Sun grid with 2px borders and date in the top-right of each cell. Only the calendar area scrolls; the sidebar stays fixed.",
      },
    ],
    sop: {
      title: "Generate and craft a planner day",
      audience: "Creator or entity manager",
      prerequisites: ["Signed in", "Correct brand selected in the top bar", "API server running (port 8080) with Gemini configured"],
      steps: [
        "Sidebar → Plan (multi-day campaign programs).",
        "Describe the event or launch in the Campaign Engine textarea (8+ characters).",
        "Pick duration: 3-Day, 5-Day, or 1-Week.",
        "Choose Autonomy: Suggest (packs only), Arm (auto-queue scheduled_posts), or Full auto (arm + cron dispatch).",
        "Click Generate timeline and confirm day cards appear on the calendar (URL may include programId=).",
        "Refresh the page — timeline should reload from MAD Supabase, not vanish.",
        "Open a card → Craft in Studio to continue on Studio Intent with hook and vibe seeded.",
        "Optional: Campaigns → Storyboard → Generate pack / Bulk generate for headless Studio packs.",
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
        name: "Website listing copy → Studio",
        description:
          "Photos pulled from the website (new arrivals, media library, Today build) carry the listing **description** and saved **copy_draft** into Studio. **Copy** prefills from that text (multi-item carousels join unique blocks). **Hashtags** chips include per-listing suggested tags (brand, garment, vibe from each row). Canvas tags still come from brand/size/price per slide. Prefer editing intake copy over Intent AI for Worn Label promos.",
      },
      {
        name: "Drop workbench (Media step)",
        description:
          "Drop workbench: New posts start with **no on-image words** — add headline/subhead only on **Canvas** (Words tab). Default brand layouts apply font/placement/shadow style only until you type on Canvas or **Apply layout** for saved starter wording. Hook and caption stay on **Copy**; they do not bake onto the photo unless you set Canvas text. Phone preview keeps Canvas styling through Copy and Schedule. **Clear on-image text** removes baked layers; re-save or download again for clean media.",
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
        name: "Audiences → forecasting tag",
        description:
          "Brain → **Audiences** → expand a segment → edit fields (each row needs a **segment name**). **Quick add** presets match the **active brand** (Worn Label vs FÜDI vs generic). Click **[ Save all audiences ]** — saves only audience rows (not brand identity). Max 5 segments; toast shows errors if save fails. Edit **Forecasting & analytics tag** (slug, no #). Studio uses the tag for the **Audience persona** on Intent.",
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
    id: "promo-builder",
    title: "Promo Builder (Color Dot Special)",
    route: "/promo",
    summary:
      "Worn Label Society only: generate weekly tag-color sale graphics (1:1 feed and 9:16 story) with isolated obsidian + champagne promo styling — separate from inventory Story Canvas themes.",
    features: [
      {
        name: "Tag color grid",
        description:
          "Pick one of eight in-store tag colors (purple, orange, black, pink, green, red, blue, yellow); discount text and headline are editable.",
      },
      {
        name: "Date treatments",
        description:
          "Date label with presets (e.g. THIS WEEKEND ONLY) and styles: gold pill, stamp, ribbon, or minimal.",
      },
      {
        name: "Social channel previews",
        description:
          "Social mode: phone mocks for Instagram Story (9:16), Instagram Feed and Facebook (1:1 square), and an email sales layout. Channel picker sets aspect ratio automatically.",
      },
      {
        name: "A4 print sheet",
        description:
          "Print mode: white A4 portrait flyer — large tag-color dot, bold black typography (discount, date, headline, footer). No dark social background. Download A4 PDF (210×297mm).",
      },
      {
        name: "High-res PNG export",
        description:
          "Per-channel Download PNG at 1080×1080 or 1080×1920 via 3× retina capture (clean asset, no phone chrome).",
      },
      {
        name: "FÜDI gate",
        description:
          "Hospitality deal layouts are Phase 2; FÜDI and other brands see a coming-soon state on /promo.",
      },
    ],
    sop: {
      title: "Export a Color Dot Special graphic",
      audience: "Creator or entity manager (Worn Label Society)",
      prerequisites: [
        "Signed in with Worn Label Society selected in the brand switcher.",
      ],
      steps: [
        "Header → Promo (or open /promo?eid=…).",
        "Social preview: pick Story, IG Feed, Facebook, or Email and check the phone/email mock.",
        "Select the tag color matching this week's in-store dots; enter discount, headline, and date.",
        "Download channel PNG for social, or switch to A4 print for boutique PDF.",
        "Post social files to Instagram/Facebook or paste email creative; print PDF for in-store.",
      ],
      tips: [
        "Promo visuals use #09090B / #C5A880 tokens; listing Story previews still use the emerald obsidian shop-by-vibe theme.",
      ],
    },
  },
  {
    id: "template-engine",
    title: "Template Engine (foundation)",
    summary:
      "Entity-owned templates forked from immutable platform starters. Phase 3B ships database + APIs only — Template Centre UI and autonomous generation land later.",
    features: [
      {
        name: "Platform starters",
        description:
          "Shared `platform_template_defs` (new arrivals, promo, email, etc.). Authenticated users can read published starters; ordinary roles cannot edit them. Fork via POST /api/templates/fork.",
      },
      {
        name: "Entity template instances",
        description:
          "`entity_template_instances` are brand-scoped (entity_id required). List/create via /api/templates/instances?entityId=…; update/duplicate under /api/templates/instances/:id. Cross-brand reads and writes are rejected by RLS + server checks.",
      },
      {
        name: "Append-only versions",
        description:
          "Edits bump `version` and append `entity_template_versions` snapshots. Campaigns can store `template_instance_id`, `template_version_id`, and `template_generation_key` for exact attribution (nullable; existing generate/publish paths unchanged in 3B).",
      },
      {
        name: "Creative recipes",
        description:
          "`entity_creative_recipes` stores remountable pack snapshots for a brand. API: GET/POST /api/templates/recipes. No recipe UI yet. Cross-entity campaign/template refs are rejected.",
      },
    ],
    sop: {
      title: "Apply template engine migration (non-prod first)",
      audience: "Org admin / engineer",
      prerequisites: [
        "MAD Studio Supabase project (never FÜDI)",
        "Explicit approval before production",
      ],
      steps: [
        "Sign in and confirm the correct brand (?eid=) — templates are entity-isolated.",
        "Review supabase/migrations/20261023_entity_template_engine.sql (additive only).",
        "Apply on local/staging MAD Supabase only after approval; do not use FÜDI credentials.",
        "Smoke-test GET /api/templates/starters and fork into the active entity.",
        "Confirm Entity A cannot list Entity B instances; confirm starter rows unchanged after fork.",
      ],
      tips: [
        "Platform starter updates never silently rewrite existing entity instances — forks copy payload at fork time.",
      ],
    },
  },
  {
    id: "studio",
    title: "Campaign Studio (Multiplexer)",
    route: "/studio",
    summary:
      "Create layout: thin step pills (not a large brand title), wide work column, slim phone preview flush right. Canvas tools (Words / Tags / Logo / Style) sit on one compact row. Saved layouts chrome is hidden from the Canvas step.",
    features: [
      {
        name: "Editorial Create layout",
        description:
          "Thin numbered step pills under the brand switcher. Work column left, slim **Preview** phone flush right. Canvas: Words / Tags / Logo / Style on one toolbar row; edit and see the mock update immediately.",
      },
      {
        name: "Live preview drawer",
        description:
          "On phones and narrow viewports, bottom dock **Preview** opens the slide-over drawer (same mock + channel icons). Desktop uses the inline column instead — no modal overlay while you design.",
      },
      {
        name: "Mobile Studio layout",
        description:
          "Under 1024px: single work column; **Preview** opens the drawer. Step tracker shows Step N of 5. Draft/SOP live in ☰ Menu.",
      },
      {
        name: "Intent step (Step 2)",
        description:
          "Retail/fashion: **Audience tone**, **Post focus** chips (Drive Sales, Build Hype, etc.), and **What is this post about?** (entity content pillars — defaults from brand profile). No separate Objective dropdown — AI target is built from focus + pillar + tone. Hook blueprint and CTA move to **Schedule** (formula bank); expand **Optional** on Intent if you need persona overrides. FÜDI keeps drop type, vibe, and full DNA dropdowns.",
      },
      {
        name: "Auto-suggest intent from media",
        description:
          "Optional on Intent. **Retail:** only suggests **What is this post about?** (pillar) from vision — it does not change audience tone, hook, or CTA. **FÜDI:** maps drop type, vibe, pillar, persona, hook, and CTA. Uses brand profile rules and your selected tone/focus; exact label matching (no fuzzy guess). Always review before continuing — AI is often wrong on promos and carousels.",
      },
      {
        name: "In-flow wizard SOP",
        description:
          "Each Studio step shows a one-line SOP hint under the step tracker; hover a step tab (desktop) for the numbered checklist. Mobile uses the hint strip plus the ? icon for the full step list. Team SOP drawer still has the full two-track posting playbook.",
      },
      {
        name: "Copy step",
        description:
          "Single card: caption beside optional opening line. **Carousels (2+ stills):** **Suggest with AI** and **Hashtags · AI suggest** use every slide — brands/vibes/listing copy from intake + merged vision per inspected photo — to write one overall edit caption and tags for all designers in the tray (not only the selected thumbnail). **Opening lines from Brain** are generic entity hooks; for carousels prefer your intake caption or AI caption over a single-item hook. Brain DNA (tone, forbidden words) shapes AI but you do not train carousel logic separately — link each slide to its listing (library / new arrivals) so brands and website copy flow in.",
      },
      {
        name: "Formula bank ($0 render)",
        description:
          "Schedule step (before generate): pick hook, visual direction, and CTA presets; fill bracket slots. Worn Label defaults to **Carousel / brand promo** for multi-image campaigns (campaign line = Copy spark; brand prefills from entity name). Inventory hooks (Just Landed, size, prices) are for single-piece posts. **Render formula pack** builds the 5-piece pack locally with no Gemini tokens. Review blocks only missing **prices**; other unfilled slots warn but still allow preview/export.",
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
          "Media tray **Upload** picks multiple PNG/JPG/WEBP/MP4/MOV from your device (or drag onto the tray). **Library** opens entity media (intake + uploads with [ FÜDI App ] / [ Upload ] badges) — multi-select → **Add to tray**, or **Upload files** in the drawer. With 2+ tray items, **drag thumbnails** to change carousel order (numbered 1, 2, 3…); when the tray is linked to an inventory item, that order is saved on the item’s `images` list. **One tray for all channels**. **IG Feed** / **Facebook**: 2–10 stills → one **carousel** (1:1 center crop per slide). **IG Story**: 2–10 stills → **consecutive Story frames** in tray order (viewers tap through — same as multi-select in the Instagram app). Each slide keeps its own Canvas text when you arm from **Review**. Single-photo Story still letterboxes non–9:16 art on black. **IG Story** preview supports tap left/right, ‹ ›, progress segments, and keyboard ← →.",
      },
      {
        name: "On-canvas text styler",
        description:
          "Canvas step toolbar: **Words**, **Tags**, **Logo**, **Style** on one row (Clear / On beside them). Drag the dashed box on Preview. Below: native-only phone features (link sticker, music, poll) plus **Copy link for sticker** when a trackable URL is set. Plain baked text only — no fake stickers in export.",
      },
      {
        name: "CapCut bridge",
        description:
          "Step 1 (video) and pack preview: **Edit reel in CapCut** copies hook/caption/script JSON and opens CapCut Web. Drop the finished MP4/MOV (or PNG/JPG) on **Drop finished render here** once — replaces active draft media and keeps hook, caption, and queue metadata.",
      },
      {
        name: "Multi-channel scheduler",
        description: "Arm Instagram/Facebook/TikTok/email slots; brain timing suggestions.",
      },
      {
        name: "Two-track dispatch dock",
        description:
          "Schedule step preview dock follows platform: **Track 1 Autopilot** (IG Feed + Facebook) → **Confirm & publish live** via /api/social/publish with a trackable short link in the Facebook caption (FÜDI entity uses **https://fudi.nz/r/…**; other brands use your MAD Studio site /r/ slug). **Track 2 Draft & drop** (IG Story + TikTok) → **Download ready media (9:16)** and **Copy link sticker URL** — no fake link stickers in preview; native music/poll/link stickers are added on phone. **Video drops (incl. FÜDI):** **Video audio** — *No audio (add music in-app)* strips the track before download or API dispatch (TikTok, Meta, webhooks); *Keep original audio* sends the file unchanged except TikTok Direct Post (AAC optimize). Header **Team SOP & posting guide** opens the full slide-over playbook.",
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
    title: "Campaigns — Storyboard & Ledger",
    route: "/campaigns",
    summary:
      "Dual-tab workspace on **MAD Studio** (not the consumer brand site): **Campaign storyboard** (planning scaffold) and **Past ledger** (financial view for the active brand). Phone/social mocks stay in **Studio → Schedule** — feed chrome is labeled “MAD Studio · channel mock”. Ledger loads via GET /api/campaigns/ledger when you open Past ledger.",
    features: [
      {
        name: "Campaign storyboard tab",
        description:
          "Lists `campaign_program_days` for the active or ?programId= program: status per day, Generate pack (POST /api/campaign-days/:id/generate), Arm posts (creates `scheduled_posts` with program_day_id), Bulk generate (POST /api/campaigns/orchestrate). Requires intake media with https URLs.",
      },
      {
        name: "Past ledger tab",
        description:
          "Former Campaigns page: financial summary, published drops table, campaign accordions, log spend/sales, post-mortem. Fetched via GET /api/campaigns/ledger?entityId=… on first visit.",
      },
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
        "Open Campaigns → **Past ledger** for the entity.",
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
      {
        name: "Date range",
        description:
          "Filter pills: Today, Last 7 Days, Last 30 Days (default when opening Meter), All Time. Changing range reloads telemetry for that window.",
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
          "Settings → Social (with the correct brand selected) → Connect with TikTok. OAuth is **per entity** — Worn Label and FÜDI each keep their own connection. Connect forces TikTok’s account picker (`disable_auto_auth`) so the browser does not silently reuse the last TikTok login (often FÜDI). Disconnect deactivates all TikTok rows for that brand. Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI. Cron: refresh-tiktok-tokens. Direct Post + Video audio as before; unaudited apps: SELF_ONLY.",
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
        "Confirm the top-bar brand is the one you want (e.g. Worn Label Society), then Settings → Social.",
        "Connect with Meta for IG Feed / Facebook autopilot.",
        "Connect with TikTok — pick that brand’s TikTok account (not FÜDI). If TikTok skips login, use a private window or log out of TikTok in the browser, then Connect again.",
        "Test Connection after OAuth. To switch accounts: Disconnect → Connect again and choose the other TikTok user.",
        "Studio Schedule → video: set **Video audio** (keep vs off); download + link sticker for phone drop, or **Send via TikTok API** / autopilot Meta when connected.",
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

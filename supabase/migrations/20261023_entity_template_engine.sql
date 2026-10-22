-- Phase 3B: Entity-owned Template Engine foundation
-- Additive only. Does not alter CampaignPack shape or formula_bank JSON.
-- Apply locally / staging with explicit approval before production.

-- ---------------------------------------------------------------------------
-- 1) Immutable platform starter definitions (no brand-owned writes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_template_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL
    CHECK (category IN (
      'new_arrivals',
      'product_spotlight',
      'promotional',
      'educational',
      'community',
      'seasonal',
      'events',
      'email_newsletter',
      'launch',
      'recurring_series'
    )),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  industry_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_template_defs_category
  ON public.platform_template_defs(category)
  WHERE is_published = true;

COMMENT ON TABLE public.platform_template_defs IS
  'Immutable shared starter templates. Ordinary users SELECT only; fork copies into entity_template_instances.';

COMMENT ON COLUMN public.platform_template_defs.payload IS
  'Structured starter: creative_instructions, surfaces, default_channels, formula_hook_id, story_style_preset, placeholders — never brand-specific copy.';

-- ---------------------------------------------------------------------------
-- 2) Entity-owned template instances
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entity_template_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  source_def_id uuid REFERENCES public.platform_template_defs(id) ON DELETE SET NULL,
  parent_instance_id uuid REFERENCES public.entity_template_instances(id) ON DELETE SET NULL,
  category text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  creative_instructions text NOT NULL DEFAULT '',
  formula_hook_id text,
  canvas_layout_id text,
  story_style_preset text,
  channel_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  placeholder_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_template_instances_name_unique UNIQUE (entity_id, name)
);

CREATE INDEX IF NOT EXISTS idx_entity_template_instances_entity_status
  ON public.entity_template_instances(entity_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_template_instances_source_def
  ON public.entity_template_instances(source_def_id)
  WHERE source_def_id IS NOT NULL;

COMMENT ON TABLE public.entity_template_instances IS
  'Entity-owned template instances. Forked from platform starters or created locally. Never shared across entities.';

-- ---------------------------------------------------------------------------
-- 3) Append-only version snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entity_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.entity_template_instances(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_template_versions_unique UNIQUE (instance_id, version),
  CONSTRAINT entity_template_versions_entity_matches CHECK (entity_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_entity_template_versions_instance
  ON public.entity_template_versions(instance_id, version DESC);

COMMENT ON TABLE public.entity_template_versions IS
  'Append-only snapshots. No UPDATE/DELETE for authenticated roles.';

-- ---------------------------------------------------------------------------
-- 4) Entity-owned creative recipes (winner remount foundation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entity_creative_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  source_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  source_template_instance_id uuid REFERENCES public.entity_template_instances(id) ON DELETE SET NULL,
  source_template_version_id uuid REFERENCES public.entity_template_versions(id) ON DELETE SET NULL,
  pack_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  canvas_layout_id text,
  formula_hook_id text,
  channel_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  text_overlay jsonb,
  performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_creative_recipes_name_unique UNIQUE (entity_id, name)
);

CREATE INDEX IF NOT EXISTS idx_entity_creative_recipes_entity_status
  ON public.entity_creative_recipes(entity_id, status, updated_at DESC);

COMMENT ON TABLE public.entity_creative_recipes IS
  'Entity-owned winner recipes for future remount. Cross-entity references rejected at API + RLS.';

-- ---------------------------------------------------------------------------
-- 5) Attribution on campaigns (additive, nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS template_instance_id uuid
    REFERENCES public.entity_template_instances(id) ON DELETE SET NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS template_version_id uuid
    REFERENCES public.entity_template_versions(id) ON DELETE SET NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS template_generation_key text;

CREATE INDEX IF NOT EXISTS idx_campaigns_template_instance
  ON public.campaigns(template_instance_id)
  WHERE template_instance_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_entity_generation_key
  ON public.campaigns(entity_id, template_generation_key)
  WHERE template_generation_key IS NOT NULL;

COMMENT ON COLUMN public.campaigns.template_instance_id IS
  'Optional attribution to entity_template_instances (Phase 3B).';
COMMENT ON COLUMN public.campaigns.template_version_id IS
  'Exact template version snapshot used at generation time.';
COMMENT ON COLUMN public.campaigns.template_generation_key IS
  'Idempotency key for template-driven generation (entity-scoped unique when set).';

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_template_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_template_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_creative_recipes ENABLE ROW LEVEL SECURITY;

-- Starters: authenticated may SELECT published rows only. No client writes.
DROP POLICY IF EXISTS "Authenticated users can view published starter templates"
  ON public.platform_template_defs;
CREATE POLICY "Authenticated users can view published starter templates"
  ON public.platform_template_defs
  FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Instances: entity-scoped
DROP POLICY IF EXISTS "Entity members can view template instances"
  ON public.entity_template_instances;
CREATE POLICY "Entity members can view template instances"
  ON public.entity_template_instances
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert template instances"
  ON public.entity_template_instances;
CREATE POLICY "Entity editors can insert template instances"
  ON public.entity_template_instances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can update template instances"
  ON public.entity_template_instances;
CREATE POLICY "Entity editors can update template instances"
  ON public.entity_template_instances
  FOR UPDATE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  )
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity managers can delete template instances"
  ON public.entity_template_instances;
CREATE POLICY "Entity managers can delete template instances"
  ON public.entity_template_instances
  FOR DELETE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

-- Versions: SELECT + INSERT only (append-only for clients)
DROP POLICY IF EXISTS "Entity members can view template versions"
  ON public.entity_template_versions;
CREATE POLICY "Entity members can view template versions"
  ON public.entity_template_versions
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert template versions"
  ON public.entity_template_versions;
CREATE POLICY "Entity editors can insert template versions"
  ON public.entity_template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

-- Recipes
DROP POLICY IF EXISTS "Entity members can view creative recipes"
  ON public.entity_creative_recipes;
CREATE POLICY "Entity members can view creative recipes"
  ON public.entity_creative_recipes
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert creative recipes"
  ON public.entity_creative_recipes;
CREATE POLICY "Entity editors can insert creative recipes"
  ON public.entity_creative_recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can update creative recipes"
  ON public.entity_creative_recipes;
CREATE POLICY "Entity editors can update creative recipes"
  ON public.entity_creative_recipes
  FOR UPDATE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  )
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity managers can delete creative recipes"
  ON public.entity_creative_recipes;
CREATE POLICY "Entity managers can delete creative recipes"
  ON public.entity_creative_recipes
  FOR DELETE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

-- ---------------------------------------------------------------------------
-- 6b) Same-entity integrity (defense in depth beyond API checks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_template_version_entity_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  instance_entity uuid;
BEGIN
  SELECT entity_id INTO instance_entity
  FROM public.entity_template_instances
  WHERE id = NEW.instance_id;

  IF instance_entity IS NULL THEN
    RAISE EXCEPTION 'template version references missing instance';
  END IF;

  IF NEW.entity_id IS DISTINCT FROM instance_entity THEN
    RAISE EXCEPTION 'template version entity_id must match instance entity_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_template_version_entity_match
  ON public.entity_template_versions;
CREATE TRIGGER trg_template_version_entity_match
  BEFORE INSERT OR UPDATE ON public.entity_template_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_template_version_entity_match();

CREATE OR REPLACE FUNCTION public.enforce_creative_recipe_same_entity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ref_entity uuid;
BEGIN
  IF NEW.source_campaign_id IS NOT NULL THEN
    SELECT entity_id INTO ref_entity
    FROM public.campaigns
    WHERE id = NEW.source_campaign_id;
    IF ref_entity IS NULL THEN
      RAISE EXCEPTION 'recipe source campaign not found';
    END IF;
    IF ref_entity IS DISTINCT FROM NEW.entity_id THEN
      RAISE EXCEPTION 'cross-entity recipe campaign reference rejected';
    END IF;
  END IF;

  IF NEW.source_template_instance_id IS NOT NULL THEN
    SELECT entity_id INTO ref_entity
    FROM public.entity_template_instances
    WHERE id = NEW.source_template_instance_id;
    IF ref_entity IS NULL THEN
      RAISE EXCEPTION 'recipe source template instance not found';
    END IF;
    IF ref_entity IS DISTINCT FROM NEW.entity_id THEN
      RAISE EXCEPTION 'cross-entity recipe template reference rejected';
    END IF;
  END IF;

  IF NEW.source_template_version_id IS NOT NULL THEN
    SELECT entity_id INTO ref_entity
    FROM public.entity_template_versions
    WHERE id = NEW.source_template_version_id;
    IF ref_entity IS NULL THEN
      RAISE EXCEPTION 'recipe source template version not found';
    END IF;
    IF ref_entity IS DISTINCT FROM NEW.entity_id THEN
      RAISE EXCEPTION 'cross-entity recipe version reference rejected';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creative_recipe_same_entity
  ON public.entity_creative_recipes;
CREATE TRIGGER trg_creative_recipe_same_entity
  BEFORE INSERT OR UPDATE ON public.entity_creative_recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_creative_recipe_same_entity();

CREATE OR REPLACE FUNCTION public.enforce_campaign_template_attribution_entity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ref_entity uuid;
BEGIN
  IF NEW.template_instance_id IS NOT NULL THEN
    SELECT entity_id INTO ref_entity
    FROM public.entity_template_instances
    WHERE id = NEW.template_instance_id;
    IF ref_entity IS NULL THEN
      RAISE EXCEPTION 'campaign template_instance_id not found';
    END IF;
    IF ref_entity IS DISTINCT FROM NEW.entity_id THEN
      RAISE EXCEPTION 'cross-entity campaign template_instance attribution rejected';
    END IF;
  END IF;

  IF NEW.template_version_id IS NOT NULL THEN
    SELECT entity_id INTO ref_entity
    FROM public.entity_template_versions
    WHERE id = NEW.template_version_id;
    IF ref_entity IS NULL THEN
      RAISE EXCEPTION 'campaign template_version_id not found';
    END IF;
    IF ref_entity IS DISTINCT FROM NEW.entity_id THEN
      RAISE EXCEPTION 'cross-entity campaign template_version attribution rejected';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_template_attribution_entity
  ON public.campaigns;
CREATE TRIGGER trg_campaign_template_attribution_entity
  BEFORE INSERT OR UPDATE OF template_instance_id, template_version_id, entity_id
  ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_template_attribution_entity();

-- ---------------------------------------------------------------------------
-- 7) Seed generic platform starters (no brand-specific copy)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_template_defs (slug, category, title, description, industry_tags, payload, version, is_published)
VALUES
  (
    'starter-new-arrivals',
    'new_arrivals',
    'New arrivals drop',
    'Generic arrival announcement for feed + story.',
    ARRAY['fashion', 'retail', 'food'],
    jsonb_build_object(
      'surfaces', ARRAY['social_post', 'story', 'carousel'],
      'default_channels', ARRAY['instagram_feed', 'instagram_story'],
      'creative_instructions', 'Announce a new item or dish with concrete details from the listing. No invented discounts.',
      'formula_hook_id', 'curiosity_gap',
      'placeholders', ARRAY['item', 'brand', 'location']
    ),
    1,
    true
  ),
  (
    'starter-product-spotlight',
    'product_spotlight',
    'Product spotlight',
    'Single-SKU deep dive for feed/carousel.',
    ARRAY['fashion', 'retail'],
    jsonb_build_object(
      'surfaces', ARRAY['social_post', 'carousel', 'video_brief'],
      'default_channels', ARRAY['instagram_feed', 'facebook'],
      'creative_instructions', 'Focus on one product: condition, fit, styling. Client voice only.',
      'formula_hook_id', 'price_contrast',
      'placeholders', ARRAY['item', 'brand', 'priceA', 'priceB']
    ),
    1,
    true
  ),
  (
    'starter-promotional',
    'promotional',
    'Promotional campaign',
    'Multi-channel promo skeleton.',
    ARRAY['fashion', 'retail', 'food'],
    jsonb_build_object(
      'surfaces', ARRAY['social_post', 'story', 'email', 'multi_channel'],
      'default_channels', ARRAY['instagram_feed', 'instagram_story', 'facebook', 'email'],
      'creative_instructions', 'Promote an offer only when slots provide real terms. Never invent SKUs or percentages.',
      'placeholders', ARRAY['campaignLine', 'location', 'item']
    ),
    1,
    true
  ),
  (
    'starter-educational',
    'educational',
    'Educational content',
    'How-to / tip content for trust building.',
    ARRAY['fashion', 'food', 'generic'],
    jsonb_build_object(
      'surfaces', ARRAY['social_post', 'carousel', 'video_brief'],
      'default_channels', ARRAY['instagram_feed', 'tiktok'],
      'creative_instructions', 'Teach one concrete tip tied to the brand niche. No agency jargon.',
      'placeholders', ARRAY['interest', 'cityArea']
    ),
    1,
    true
  ),
  (
    'starter-community',
    'community',
    'Community engagement',
    'Poll/question-style engagement (stickers added natively on phone).',
    ARRAY['fashion', 'food', 'generic'],
    jsonb_build_object(
      'surfaces', ARRAY['story', 'social_post'],
      'default_channels', ARRAY['instagram_story', 'tiktok'],
      'creative_instructions', 'Invite a reply or save. Keep lower third clear for native stickers.',
      'placeholders', ARRAY['campaignLine']
    ),
    1,
    true
  ),
  (
    'starter-seasonal',
    'seasonal',
    'Seasonal campaign',
    'Season or weather-tied creative.',
    ARRAY['fashion', 'food', 'generic'],
    jsonb_build_object(
      'surfaces', ARRAY['social_post', 'email', 'multi_channel'],
      'default_channels', ARRAY['instagram_feed', 'email'],
      'creative_instructions', 'Anchor copy in the current season from entity local_context when available.',
      'placeholders', ARRAY['campaignLine', 'location']
    ),
    1,
    true
  ),
  (
    'starter-events',
    'events',
    'Event announcement',
    'Local event or drop window.',
    ARRAY['food', 'fashion', 'generic'],
    jsonb_build_object(
      'surfaces', ARRAY['story', 'social_post', 'email'],
      'default_channels', ARRAY['instagram_story', 'instagram_feed'],
      'creative_instructions', 'State when/where clearly. Do not invent dates.',
      'placeholders', ARRAY['location', 'campaignLine']
    ),
    1,
    true
  ),
  (
    'starter-email-newsletter',
    'email_newsletter',
    'Email newsletter',
    'VIP email skeleton using pack email_drop fields.',
    ARRAY['fashion', 'food', 'generic'],
    jsonb_build_object(
      'surfaces', ARRAY['email', 'multi_channel'],
      'default_channels', ARRAY['email'],
      'creative_instructions', 'Subject + preview + body for email_drop. One primary CTA.',
      'placeholders', ARRAY['item', 'brand', 'campaignLine']
    ),
    1,
    true
  ),
  (
    'starter-launch',
    'launch',
    'Launch announcement',
    'New collection or menu launch.',
    ARRAY['fashion', 'food'],
    jsonb_build_object(
      'surfaces', ARRAY['social_post', 'carousel', 'video_brief', 'email'],
      'default_channels', ARRAY['instagram_feed', 'instagram_story', 'facebook'],
      'creative_instructions', 'Announce a launch with specific named items from inventory.',
      'placeholders', ARRAY['item', 'brand', 'campaignLine']
    ),
    1,
    true
  ),
  (
    'starter-recurring-series',
    'recurring_series',
    'Recurring content series',
    'Cadence series placeholder for weekly drops.',
    ARRAY['fashion', 'food', 'generic'],
    jsonb_build_object(
      'surfaces', ARRAY['social_post', 'multi_channel'],
      'default_channels', ARRAY['instagram_feed', 'tiktok'],
      'creative_instructions', 'Keep a recognizable series format; vary the item each week.',
      'placeholders', ARRAY['campaignLine', 'item']
    ),
    1,
    true
  )
ON CONFLICT (slug) DO NOTHING;

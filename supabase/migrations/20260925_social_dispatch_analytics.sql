-- In-house social dispatch + click analytics (replaces Ayrshare-style relays)

CREATE TABLE IF NOT EXISTS public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  platform text NOT NULL
    CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
  account_id text NOT NULL,
  access_token text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_connections_entity_platform_account_unique
    UNIQUE (entity_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_entity_active
  ON public.social_connections(entity_id, platform)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  marketing_entity_id uuid NOT NULL
    REFERENCES public.marketing_entities(id) ON DELETE CASCADE,
  slug text NOT NULL,
  destination_url text NOT NULL,
  click_count integer NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT link_clicks_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_entity
  ON public.link_clicks(entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_link_clicks_marketing_entity
  ON public.link_clicks(marketing_entity_id);

ALTER TABLE public.marketing_entities
  ADD COLUMN IF NOT EXISTS published_media_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.marketing_entities
  ADD COLUMN IF NOT EXISTS trackable_slug text;

ALTER TABLE public.marketing_entities
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_entities_trackable_slug
  ON public.marketing_entities(trackable_slug)
  WHERE trackable_slug IS NOT NULL;

-- Atomic click increment for public redirects (service role / anon via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.record_link_click(p_slug text)
RETURNS TABLE (
  destination_url text,
  entity_id uuid,
  marketing_entity_id uuid,
  click_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.link_clicks AS lc
  SET
    click_count = lc.click_count + 1,
    updated_at = now()
  WHERE lc.slug = p_slug
  RETURNING
    lc.destination_url,
    lc.entity_id,
    lc.marketing_entity_id,
    lc.click_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_link_click(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_link_click(text) TO anon, authenticated, service_role;

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity members can view social connections"
  ON public.social_connections;
CREATE POLICY "Entity members can view social connections"
  ON public.social_connections
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity managers can insert social connections"
  ON public.social_connections;
CREATE POLICY "Entity managers can insert social connections"
  ON public.social_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

DROP POLICY IF EXISTS "Entity managers can update social connections"
  ON public.social_connections;
CREATE POLICY "Entity managers can update social connections"
  ON public.social_connections
  FOR UPDATE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  )
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

DROP POLICY IF EXISTS "Entity managers can delete social connections"
  ON public.social_connections;
CREATE POLICY "Entity managers can delete social connections"
  ON public.social_connections
  FOR DELETE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

DROP POLICY IF EXISTS "Entity members can view link clicks"
  ON public.link_clicks;
CREATE POLICY "Entity members can view link clicks"
  ON public.link_clicks
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert link clicks"
  ON public.link_clicks;
CREATE POLICY "Entity editors can insert link clicks"
  ON public.link_clicks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can update link clicks"
  ON public.link_clicks;
CREATE POLICY "Entity editors can update link clicks"
  ON public.link_clicks
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_clicks TO authenticated;

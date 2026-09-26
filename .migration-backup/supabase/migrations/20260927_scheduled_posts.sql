-- Per-channel staggered dispatch queue (one row per platform per drop).
-- Idempotent: creates the table, or reconciles an earlier scheduled_posts shape.

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  marketing_entity_id uuid,
  platform text NOT NULL,
  scheduled_time timestamptz NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'scheduled',
  remote_media_id text,
  created_at timestamptz DEFAULT now(),
  published_at timestamptz
);

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS timing_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS demographic_tag text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Media lives in payload.media_url; the legacy column is optional.
ALTER TABLE public.scheduled_posts ALTER COLUMN media_url DROP NOT NULL;

ALTER TABLE public.scheduled_posts
  DROP CONSTRAINT IF EXISTS scheduled_posts_platform_check,
  DROP CONSTRAINT IF EXISTS scheduled_posts_status_check,
  DROP CONSTRAINT IF EXISTS scheduled_posts_mode_check,
  DROP CONSTRAINT IF EXISTS scheduled_posts_timing_source_check,
  DROP CONSTRAINT IF EXISTS scheduled_posts_attempts_check,
  DROP CONSTRAINT IF EXISTS scheduled_posts_marketing_entity_id_fkey;

ALTER TABLE public.scheduled_posts
  ADD CONSTRAINT scheduled_posts_platform_check
    CHECK (platform IN ('instagram_story', 'instagram_feed', 'facebook', 'tiktok', 'email')),
  ADD CONSTRAINT scheduled_posts_status_check
    CHECK (status IN ('scheduled', 'processing', 'publishing', 'published', 'failed', 'cancelled')),
  ADD CONSTRAINT scheduled_posts_mode_check
    CHECK (mode IN ('immediate', 'scheduled')),
  ADD CONSTRAINT scheduled_posts_timing_source_check
    CHECK (timing_source IN ('brain', 'manual', 'immediate')),
  ADD CONSTRAINT scheduled_posts_attempts_check
    CHECK (attempts >= 0),
  -- Deleting an inventory item must not leave an orphaned post that still publishes.
  ADD CONSTRAINT scheduled_posts_marketing_entity_id_fkey
    FOREIGN KEY (marketing_entity_id)
    REFERENCES public.marketing_entities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
  ON public.scheduled_posts(status, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_entity
  ON public.scheduled_posts(entity_id, scheduled_time DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_marketing_entity
  ON public.scheduled_posts(marketing_entity_id, status);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_campaign
  ON public.scheduled_posts(campaign_id, status);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity members can view scheduled posts"
  ON public.scheduled_posts;
CREATE POLICY "Entity members can view scheduled posts"
  ON public.scheduled_posts
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert scheduled posts"
  ON public.scheduled_posts;
CREATE POLICY "Entity editors can insert scheduled posts"
  ON public.scheduled_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can update scheduled posts"
  ON public.scheduled_posts;
CREATE POLICY "Entity editors can update scheduled posts"
  ON public.scheduled_posts
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

DROP POLICY IF EXISTS "Entity managers can delete scheduled posts"
  ON public.scheduled_posts;
CREATE POLICY "Entity managers can delete scheduled posts"
  ON public.scheduled_posts
  FOR DELETE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

REVOKE ALL ON public.scheduled_posts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;

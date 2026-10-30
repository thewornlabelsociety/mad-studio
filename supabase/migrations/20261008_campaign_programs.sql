-- Campaign program orchestration (planner → day flight plan → scheduled_posts link)

CREATE TABLE IF NOT EXISTS public.campaign_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  brief text NOT NULL,
  autonomy_mode text NOT NULL DEFAULT 'arm'
    CHECK (autonomy_mode IN ('suggest', 'arm', 'full_auto')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'active', 'paused', 'completed', 'failed')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  target_channels text[] NOT NULL DEFAULT ARRAY['instagram_feed', 'instagram_story', 'tiktok']::text[],
  spend_cap_cents integer NOT NULL DEFAULT 0,
  duration_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_programs_entity_status
  ON public.campaign_programs(entity_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.campaign_program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.campaign_programs(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  scheduled_date date NOT NULL,
  phase text NOT NULL,
  hook text NOT NULL,
  vibe text NOT NULL,
  directorial_action text,
  formula_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'ready', 'armed', 'published', 'failed', 'skipped')),
  pack_snapshot jsonb,
  marketing_entity_id uuid REFERENCES public.marketing_entities(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, scheduled_date),
  UNIQUE (program_id, day_index)
);

CREATE INDEX IF NOT EXISTS idx_campaign_program_days_program
  ON public.campaign_program_days(program_id, day_index);

CREATE INDEX IF NOT EXISTS idx_campaign_program_days_date
  ON public.campaign_program_days(scheduled_date);

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS program_day_id uuid
    REFERENCES public.campaign_program_days(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_program_day
  ON public.scheduled_posts(program_day_id)
  WHERE program_day_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cron_heartbeats (
  job_name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ok',
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.campaign_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity members can view campaign programs"
  ON public.campaign_programs;
CREATE POLICY "Entity members can view campaign programs"
  ON public.campaign_programs
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert campaign programs"
  ON public.campaign_programs;
CREATE POLICY "Entity editors can insert campaign programs"
  ON public.campaign_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can update campaign programs"
  ON public.campaign_programs;
CREATE POLICY "Entity editors can update campaign programs"
  ON public.campaign_programs
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

DROP POLICY IF EXISTS "Entity managers can delete campaign programs"
  ON public.campaign_programs;
CREATE POLICY "Entity managers can delete campaign programs"
  ON public.campaign_programs
  FOR DELETE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

DROP POLICY IF EXISTS "Entity members can view campaign program days"
  ON public.campaign_program_days;
CREATE POLICY "Entity members can view campaign program days"
  ON public.campaign_program_days
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_programs p
      WHERE p.id = program_id
        AND public.has_entity_access(
          p.entity_id,
          ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
        )
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert campaign program days"
  ON public.campaign_program_days;
CREATE POLICY "Entity editors can insert campaign program days"
  ON public.campaign_program_days
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campaign_programs p
      WHERE p.id = program_id
        AND public.has_entity_access(
          p.entity_id,
          ARRAY['entity_manager'::text, 'creator'::text]
        )
    )
  );

DROP POLICY IF EXISTS "Entity editors can update campaign program days"
  ON public.campaign_program_days;
CREATE POLICY "Entity editors can update campaign program days"
  ON public.campaign_program_days
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_programs p
      WHERE p.id = program_id
        AND public.has_entity_access(
          p.entity_id,
          ARRAY['entity_manager'::text, 'creator'::text]
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.campaign_programs p
      WHERE p.id = program_id
        AND public.has_entity_access(
          p.entity_id,
          ARRAY['entity_manager'::text, 'creator'::text]
        )
    )
  );

DROP POLICY IF EXISTS "Entity editors can delete campaign program days"
  ON public.campaign_program_days;
CREATE POLICY "Entity editors can delete campaign program days"
  ON public.campaign_program_days
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_programs p
      WHERE p.id = program_id
        AND public.has_entity_access(
          p.entity_id,
          ARRAY['entity_manager'::text, 'creator'::text]
        )
    )
  );

-- Heartbeats: service role / cron only (no authenticated read by default)
REVOKE ALL ON public.cron_heartbeats FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.campaign_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_program_days TO authenticated;

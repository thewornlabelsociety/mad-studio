-- Phase 4: atomic dispatch claim, retry ceiling, campaign takeaways, formula stats in DNA JSON

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3;

ALTER TABLE public.scheduled_posts
  DROP CONSTRAINT IF EXISTS scheduled_posts_max_retries_check;

ALTER TABLE public.scheduled_posts
  ADD CONSTRAINT scheduled_posts_max_retries_check
    CHECK (max_retries >= 1 AND max_retries <= 10);

CREATE TABLE IF NOT EXISTS public.campaign_takeaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.campaign_programs(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  metric_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_takeaway text NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_takeaways_entity_created
  ON public.campaign_takeaways(entity_id, created_at DESC);

ALTER TABLE public.campaign_takeaways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity members can view campaign takeaways"
  ON public.campaign_takeaways;
CREATE POLICY "Entity members can view campaign takeaways"
  ON public.campaign_takeaways
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert campaign takeaways"
  ON public.campaign_takeaways;
CREATE POLICY "Entity editors can insert campaign takeaways"
  ON public.campaign_takeaways
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

GRANT SELECT, INSERT ON public.campaign_takeaways TO authenticated;

-- Atomic claim: due scheduled rows -> processing (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_due_scheduled_posts(batch_size int DEFAULT 10)
RETURNS SETOF public.scheduled_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT sp.id
    FROM public.scheduled_posts sp
    WHERE sp.status = 'scheduled'
      AND sp.scheduled_time <= now()
      AND sp.attempts < sp.max_retries
    ORDER BY sp.scheduled_time ASC
    LIMIT GREATEST(1, LEAST(batch_size, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scheduled_posts sp
  SET
    status = 'processing',
    attempts = sp.attempts + 1,
    updated_at = now()
  FROM due
  WHERE sp.id = due.id
  RETURNING sp.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_scheduled_posts(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_posts(int) TO service_role;

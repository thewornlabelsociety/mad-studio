-- Today swipe deck queue (pending_review → archived | skipped | published)

CREATE TABLE IF NOT EXISTS public.daily_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  marketing_entity_id uuid NOT NULL REFERENCES public.marketing_entities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'skipped', 'archived', 'published')),
  proposed_hook text,
  proposed_headline text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_queue_entity_item_unique UNIQUE (entity_id, marketing_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_queue_entity_status
  ON public.daily_queue(entity_id, status, created_at DESC);

ALTER TABLE public.daily_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity members can view daily queue" ON public.daily_queue;
CREATE POLICY "Entity members can view daily queue"
  ON public.daily_queue
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert daily queue" ON public.daily_queue;
CREATE POLICY "Entity editors can insert daily queue"
  ON public.daily_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can update daily queue" ON public.daily_queue;
CREATE POLICY "Entity editors can update daily queue"
  ON public.daily_queue
  FOR UPDATE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can delete daily queue" ON public.daily_queue;
CREATE POLICY "Entity editors can delete daily queue"
  ON public.daily_queue
  FOR DELETE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

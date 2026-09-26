-- Phase 3: scheduling channels + reusable copy draft for repurpose loop

ALTER TABLE public.marketing_entities
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.marketing_entities
  ADD COLUMN IF NOT EXISTS copy_draft jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_marketing_entities_scheduled_at
  ON public.marketing_entities(entity_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

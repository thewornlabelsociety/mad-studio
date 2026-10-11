-- Repair partial campaign_programs installs (CREATE TABLE IF NOT EXISTS skips new columns).

ALTER TABLE public.campaign_programs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_key text,
  ADD COLUMN IF NOT EXISTS spend_cap_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_channels text[] NOT NULL DEFAULT ARRAY['instagram_feed', 'instagram_story', 'tiktok']::text[],
  ADD COLUMN IF NOT EXISTS autonomy_mode text NOT NULL DEFAULT 'arm',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- If table was created without defaults on NOT NULL cols, backfill before constraints bite.
UPDATE public.campaign_programs
SET
  autonomy_mode = COALESCE(autonomy_mode, 'arm'),
  target_channels = COALESCE(target_channels, ARRAY['instagram_feed', 'instagram_story', 'tiktok']::text[]),
  spend_cap_cents = COALESCE(spend_cap_cents, 0),
  updated_at = COALESCE(updated_at, now())
WHERE autonomy_mode IS NULL
   OR target_channels IS NULL
   OR spend_cap_cents IS NULL
   OR updated_at IS NULL;

ALTER TABLE public.campaign_program_days
  ADD COLUMN IF NOT EXISTS marketing_entity_id uuid REFERENCES public.marketing_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS pack_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS formula_id text,
  ADD COLUMN IF NOT EXISTS directorial_action text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';

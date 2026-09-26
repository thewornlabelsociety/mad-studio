-- Studio multiplexer context so drafts rehydrate spark/intent/persona after navigation

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS studio_context jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.campaigns.studio_context IS
  'Studio multiplexer draft context: event_description, intent, objective, persona_name';

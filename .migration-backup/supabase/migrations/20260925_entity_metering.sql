-- Dynamic AI model pricing + per-entity agent metering telemetry

CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  model_id text PRIMARY KEY,
  provider text NOT NULL,
  input_cost_per_million_usd numeric(10, 4) NOT NULL,
  output_cost_per_million_usd numeric(10, 4) NOT NULL,
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.ai_model_pricing (model_id, provider, input_cost_per_million_usd, output_cost_per_million_usd)
VALUES
  ('gemini-2.0-flash', 'google', 0.1000, 0.4000),
  ('gemini-1.5-flash', 'google', 0.0750, 0.3000),
  ('gemini-2.0-flash-lite', 'google', 0.0750, 0.3000),
  ('gemini-1.5-pro', 'google', 1.2500, 5.0000),
  ('gemini-2.5-flash', 'google', 0.3000, 2.5000),
  ('gemini-2.5-pro', 'google', 1.2500, 10.0000),
  ('gemini-3.5-flash', 'google', 0.3000, 2.5000),
  ('gemini-3.8-flash', 'google', 0.3000, 2.5000),
  ('claude-3-5-sonnet-latest', 'anthropic', 3.0000, 15.0000),
  ('gpt-4o-mini', 'openai', 0.1500, 0.6000)
ON CONFLICT (model_id) DO UPDATE SET
  input_cost_per_million_usd = EXCLUDED.input_cost_per_million_usd,
  output_cost_per_million_usd = EXCLUDED.output_cost_per_million_usd,
  provider = EXCLUDED.provider,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.entity_agent_metering (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  agent_type text NOT NULL,
  agent_label text NOT NULL,
  model_used text NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  raw_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  raw_cost_nzd numeric(12, 6) NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  summary text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_metering_entity
  ON public.entity_agent_metering(entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_metering_agent
  ON public.entity_agent_metering(agent_type);

ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_agent_metering ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read model pricing"
  ON public.ai_model_pricing;
CREATE POLICY "Authenticated users can read model pricing"
  ON public.ai_model_pricing
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Entity members can view metering telemetry"
  ON public.entity_agent_metering;
CREATE POLICY "Entity members can view metering telemetry"
  ON public.entity_agent_metering
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert metering telemetry"
  ON public.entity_agent_metering;
CREATE POLICY "Entity editors can insert metering telemetry"
  ON public.entity_agent_metering
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

GRANT SELECT ON public.ai_model_pricing TO authenticated;
GRANT SELECT, INSERT ON public.entity_agent_metering TO authenticated;

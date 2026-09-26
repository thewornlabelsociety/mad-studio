-- Marketing OS inventory items (product/stock), scoped to brand tenants (entities)

CREATE TABLE IF NOT EXISTS public.marketing_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  website_item_id text NOT NULL,
  title text NOT NULL,
  brand text,
  price numeric(12, 2),
  description text,
  images text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'unfeatured'
    CHECK (status IN ('unfeatured', 'draft', 'approved', 'scheduled', 'published')),
  metrics jsonb NOT NULL DEFAULT '{"views":0,"clicks":0,"sales":0}'::jsonb,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_entities_website_item_unique UNIQUE (entity_id, website_item_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_entities_entity_status
  ON public.marketing_entities(entity_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_entities_website_item
  ON public.marketing_entities(website_item_id);

ALTER TABLE public.marketing_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity members can view marketing inventory"
  ON public.marketing_entities;
CREATE POLICY "Entity members can view marketing inventory"
  ON public.marketing_entities
  FOR SELECT
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text, 'viewer'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can insert marketing inventory"
  ON public.marketing_entities;
CREATE POLICY "Entity editors can insert marketing inventory"
  ON public.marketing_entities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text, 'creator'::text]
    )
  );

DROP POLICY IF EXISTS "Entity editors can update marketing inventory"
  ON public.marketing_entities;
CREATE POLICY "Entity editors can update marketing inventory"
  ON public.marketing_entities
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

DROP POLICY IF EXISTS "Entity managers can delete marketing inventory"
  ON public.marketing_entities;
CREATE POLICY "Entity managers can delete marketing inventory"
  ON public.marketing_entities
  FOR DELETE
  TO authenticated
  USING (
    public.has_entity_access(
      entity_id,
      ARRAY['entity_manager'::text]
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_entities TO authenticated;

-- Ensure authenticated users can upload supplementary inventory media
DROP POLICY IF EXISTS "Authenticated asset insert" ON storage.objects;
CREATE POLICY "Authenticated asset insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'entity-assets');

DROP POLICY IF EXISTS "Authenticated asset select" ON storage.objects;
CREATE POLICY "Authenticated asset select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'entity-assets');

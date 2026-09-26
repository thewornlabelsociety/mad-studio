DROP POLICY IF EXISTS "Analytics manage" ON public.ad_analytics;
CREATE POLICY "Analytics manage"
  ON public.ad_analytics
  FOR ALL
  TO authenticated
  USING (public.has_entity_access(entity_id, ARRAY['entity_manager'::text, 'creator'::text]))
  WITH CHECK (public.has_entity_access(entity_id, ARRAY['entity_manager'::text, 'creator'::text]));

DROP POLICY IF EXISTS "Authenticated asset update" ON storage.objects;
CREATE POLICY "Authenticated asset update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'entity-assets')
  WITH CHECK (bucket_id = 'entity-assets');

DROP POLICY IF EXISTS "Authenticated asset delete" ON storage.objects;
CREATE POLICY "Authenticated asset delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'entity-assets');

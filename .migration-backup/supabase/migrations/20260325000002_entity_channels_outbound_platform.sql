ALTER TABLE public.entity_channels DROP CONSTRAINT IF EXISTS entity_channels_platform_check;
ALTER TABLE public.entity_channels ADD CONSTRAINT entity_channels_platform_check
  CHECK (platform = ANY (ARRAY[
    'instagram'::text,
    'tiktok'::text,
    'facebook'::text,
    'linkedin'::text,
    'threads'::text,
    'outbound'::text
  ]));

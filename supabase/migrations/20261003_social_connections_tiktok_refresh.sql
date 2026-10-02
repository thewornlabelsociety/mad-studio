-- TikTok OAuth refresh tokens (Meta rows leave these NULL)

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_social_connections_tiktok_refresh
  ON public.social_connections (token_expires_at)
  WHERE platform = 'tiktok' AND is_active = true AND refresh_token IS NOT NULL;

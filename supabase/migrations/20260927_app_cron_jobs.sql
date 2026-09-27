-- Replit has no built-in cron: Postgres pg_cron + pg_net call the app's cron routes.
-- Requires a Vault secret named 'cron_secret' matching the app's CRON_SECRET:
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.invoke_app_cron(p_path text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE NOTICE 'Vault secret cron_secret is missing; skipping %', p_path;
    RETURN NULL;
  END IF;

  RETURN net.http_get(
    url := 'https://madstudio.nz' || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  );
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_app_cron(text) FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('mad-dispatch-queue', 'mad-dispatch-legacy', 'mad-sync-metrics');

SELECT cron.schedule(
  'mad-dispatch-queue',
  '* * * * *',
  $$SELECT private.invoke_app_cron('/api/cron/dispatch')$$
);

SELECT cron.schedule(
  'mad-dispatch-legacy',
  '* * * * *',
  $$SELECT private.invoke_app_cron('/api/cron/dispatch-scheduled')$$
);

SELECT cron.schedule(
  'mad-sync-metrics',
  '0 * * * *',
  $$SELECT private.invoke_app_cron('/api/cron/sync-metrics')$$
);

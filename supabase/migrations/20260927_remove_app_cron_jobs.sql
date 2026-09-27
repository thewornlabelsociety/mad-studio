-- Scheduling moved to cron-job.org; keep private.invoke_app_cron as a fallback.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('mad-dispatch-queue', 'mad-dispatch-legacy', 'mad-sync-metrics');

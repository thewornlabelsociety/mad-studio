-- Drafts on the calendar: posts made for a day that wait for approval.
-- The dispatcher only claims status = 'scheduled', so a draft never posts;
-- Approve in the planner turns it into 'scheduled'.
-- Safe to run more than once.

ALTER TABLE public.scheduled_posts
  DROP CONSTRAINT IF EXISTS scheduled_posts_status_check;

ALTER TABLE public.scheduled_posts
  ADD CONSTRAINT scheduled_posts_status_check
    CHECK (status IN ('draft', 'scheduled', 'processing', 'publishing', 'published', 'failed', 'cancelled'));

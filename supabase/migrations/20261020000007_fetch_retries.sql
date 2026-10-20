-- Automatic refetches for social links (Facebook/Instagram) that answered with no content or only a preview:
-- they wait 30 min, 2 h, then 6 h before going to needs_review (see SOCIAL_RETRY_MINUTES in pipeline.ts).
alter table public.recipes add column fetch_retries smallint not null default 0;

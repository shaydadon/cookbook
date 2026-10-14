create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Calls the worker every minute. Needs two Vault secrets per environment (see docs/SETUP.md):
--   project_url   e.g. https://<ref>.supabase.co   (local: http://host.docker.internal:54321)
--   worker_secret same value as the WORKER_SECRET function secret
select cron.schedule(
  'process-recipes',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/process-recipe',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000)
  where exists (select 1 from public.recipes
                where status in ('queued','rewriting','imaging') and next_attempt_at <= now())
    and exists (select 1 from vault.decrypted_secrets where name = 'project_url');
  $$
);

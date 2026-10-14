create function public.claim_next_recipe(lease_seconds int default 300)
returns setof public.recipes
language sql security definer set search_path = public as $$
  update public.recipes
  set locked_until = now() + make_interval(secs => lease_seconds)
  where id = (
    select id from public.recipes
    where status in ('queued', 'rewriting', 'imaging')
      and next_attempt_at <= now()
      and (locked_until is null or locked_until < now())
    order by next_attempt_at
    for update skip locked
    limit 1)
  returning *;
$$;
revoke execute on function public.claim_next_recipe(int) from public, anon, authenticated;
grant execute on function public.claim_next_recipe(int) to service_role;

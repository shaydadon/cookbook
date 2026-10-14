-- Final-review hardening.

-- 1. Claim counter: a worker killed mid-step (wall-clock limit, crash) never reaches its catch block, so
--    `attempts` does not grow and the expired lease would be re-claimed forever. `claims` counts claims since
--    the last successful step (the worker resets it to 0 whenever a step changes `status`).
alter table public.recipes add column claims int not null default 0;

create or replace function public.claim_next_recipe(lease_seconds int default 300)
returns setof public.recipes
language plpgsql security definer set search_path = public as $$
declare
  r public.recipes;
begin
  loop
    select * into r from public.recipes
    where status in ('queued', 'rewriting', 'imaging')
      and next_attempt_at <= now()
      and (locked_until is null or locked_until < now())
    order by next_attempt_at
    for update skip locked
    limit 1;
    if not found then
      return;
    end if;

    if r.claims >= 3 then
      -- Claimed 3 times without a step finishing: stop looping on it.
      if r.status = 'imaging' then
        update public.recipes
        set status = 'published', published_at = now(), locked_until = null,
            error = 'יצירת התמונה נכשלה (חריגת זמן)'
        where id = r.id;
      else
        update public.recipes
        set status = 'failed', locked_until = null,
            error = 'העיבוד נקטע שוב ושוב (חריגת זמן)'
        where id = r.id;
      end if;
      continue;
    end if;

    return query
      update public.recipes
      set claims = claims + 1, locked_until = now() + make_interval(secs => lease_seconds)
      where id = r.id
      returning *;
    return;
  end loop;
end $$;
revoke execute on function public.claim_next_recipe(int) from public, anon, authenticated;
grant execute on function public.claim_next_recipe(int) to service_role;

-- 7. Members may see each other's names, not each other's email addresses.
--    (The app takes the signed-in user's own email from the auth session.)
revoke select on public.members from authenticated, anon;
grant select (id, display_name, whatsapp_name, role, created_at) on public.members to authenticated;

-- 11. A negative page_size must not raise "LIMIT must not be negative".
create or replace function public.search_recipes(
  q text default null, cat text default null, favorites_only boolean default false,
  page_size int default 24, page_offset int default 0)
returns setof public.recipes
language sql stable set search_path = public as $$
  select r.* from public.recipes r
  where r.status = 'published'
    and (coalesce(q, '') = ''
         or r.search_text like '%' || replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and (cat is null or r.category = cat)
    and (not favorites_only or exists (
         select 1 from public.favorites f where f.recipe_id = r.id and f.member_id = auth.uid()))
  order by r.published_at desc nulls last
  limit greatest(least(page_size, 100), 0) offset greatest(page_offset, 0);
$$;

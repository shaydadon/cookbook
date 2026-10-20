-- Personal recipe ratings: each member rates 1-5 stars for themselves only. Nobody sees another member's
-- ratings; the feed's star filter uses the caller's own ratings.
create table public.ratings (
  member_id  uuid not null references public.members (id) on delete cascade,
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (member_id, recipe_id)
);
create index ratings_member_stars_idx on public.ratings (member_id, stars);

alter table public.ratings enable row level security;
create policy ratings_own on public.ratings
  for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (member_id = auth.uid() and public.is_member());
grant select, insert, update, delete on public.ratings to authenticated;

-- search_recipes gains min_rating (the caller's own stars). The signature changes, so replace the old function
-- rather than adding an overload PostgREST would have to choose between.
drop function public.search_recipes(text, text, boolean, int, int);
create function public.search_recipes(
  q text default null, cat text default null, favorites_only boolean default false,
  page_size int default 24, page_offset int default 0, min_rating int default null)
returns setof public.recipes
language sql stable set search_path = public as $$
  select r.* from public.recipes r
  where r.status = 'published'
    and (coalesce(q, '') = ''
         or r.search_text like '%' || replace(replace(replace(lower(q), '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and (cat is null or r.category = cat)
    and (not favorites_only or exists (
         select 1 from public.favorites f where f.recipe_id = r.id and f.member_id = auth.uid()))
    and (min_rating is null or exists (
         select 1 from public.ratings rt where rt.recipe_id = r.id and rt.member_id = auth.uid() and rt.stars >= min_rating))
  order by r.published_at desc nulls last
  limit greatest(least(page_size, 100), 0) offset greatest(page_offset, 0);
$$;
grant execute on function public.search_recipes(text, text, boolean, int, int, int) to authenticated;

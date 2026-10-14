create extension if not exists pg_trgm with schema extensions;

create table public.allowed_emails (
  email         text primary key check (email = lower(email)),
  whatsapp_name text,
  role          text not null default 'member' check (role in ('admin', 'member'))
);

create table public.members (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  display_name  text not null,
  whatsapp_name text,
  role          text not null default 'member' check (role in ('admin', 'member')),
  created_at    timestamptz not null default now()
);

create table public.recipes (
  id                    uuid primary key default gen_random_uuid(),
  status                text not null default 'queued'
                        check (status in ('queued','rewriting','imaging','published','needs_review','failed')),
  source_url            text not null,
  source_url_normalized text not null unique,
  source_platform       text not null check (source_platform in ('web','instagram','tiktok','youtube','facebook')),
  raw_content           text,
  title                 text,
  description           text,
  ingredients           jsonb not null default '[]'::jsonb,
  steps                 jsonb not null default '[]'::jsonb,
  prep_minutes          int,
  cook_minutes          int,
  servings              int,
  category              text check (category is null or category in
                        ('ארוחת בוקר','מנות עיקריות','תוספות','סלטים','מרקים','אפייה וקינוחים','לחמים ובצקים','משקאות','נשנושים')),
  tags                  text[] not null default '{}',
  image_prompt          text,
  image_path            text,
  search_text           text not null default '',
  error                 text,
  attempts              int not null default 0,
  next_attempt_at       timestamptz not null default now(),
  locked_until          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  published_at          timestamptz
);

create index recipes_queue_idx     on public.recipes (status, next_attempt_at);
create index recipes_published_idx on public.recipes (published_at desc) where status = 'published';
create index recipes_search_idx    on public.recipes using gin (search_text extensions.gin_trgm_ops);

create function public.recipes_before_write() returns trigger
language plpgsql set search_path = public as $$
begin
  new.search_text := lower(concat_ws(' ',
    new.title, new.description, new.category,
    (select string_agg(i ->> 'name', ' ') from jsonb_array_elements(new.ingredients) as i),
    array_to_string(new.tags, ' ')));
  new.updated_at := now();
  return new;
end $$;

create trigger recipes_before_write
  before insert or update on public.recipes
  for each row execute function public.recipes_before_write();

create table public.shares (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references public.recipes (id) on delete cascade,
  shared_by_name text,
  message_text   text,
  shared_at      timestamptz not null default now(),
  submitted_by   uuid references public.members (id) on delete set null,
  via            text not null check (via in ('whatsapp','app','import')),
  constraint shares_idempotent unique nulls not distinct (recipe_id, shared_by_name, shared_at)
);
create index shares_recipe_idx on public.shares (recipe_id);

create table public.favorites (
  member_id  uuid not null references public.members (id) on delete cascade,
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, recipe_id)
);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- Feed + search + favorites filter in one call. SECURITY INVOKER: RLS still applies.
create function public.search_recipes(
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
  limit least(page_size, 100) offset greatest(page_offset, 0);
$$;

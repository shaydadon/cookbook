-- Role helpers (security definer so policies can call them without recursive RLS)
create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid());
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and role = 'admin');
$$;

-- Avoids recipes <-> shares policy recursion
create function public.is_submitter(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shares where recipe_id = rid and submitted_by = auth.uid());
$$;

-- Auth hook: only allow-listed emails may sign up
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.allowed_emails where email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'הגישה מותרת לחברי הקבוצה בלבד'));
end $$;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- Provision a members row only for allow-listed emails (defence in depth if the hook is off)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.allowed_emails;
begin
  select * into a from public.allowed_emails where email = lower(new.email);
  if found then
    insert into public.members (id, email, display_name, whatsapp_name, role)
    values (new.id, lower(new.email),
            coalesce(a.whatsapp_name, new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
            a.whatsapp_name, a.role);
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.allowed_emails     enable row level security;
alter table public.members            enable row level security;
alter table public.recipes            enable row level security;
alter table public.shares             enable row level security;
alter table public.favorites          enable row level security;
alter table public.push_subscriptions enable row level security;

create policy allowed_emails_admin on public.allowed_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy members_read on public.members
  for select to authenticated using (public.is_member());
create policy members_admin_write on public.members
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy members_admin_delete on public.members
  for delete to authenticated using (public.is_admin());

create policy recipes_read on public.recipes
  for select to authenticated using (
    (status = 'published' and public.is_member())
    or public.is_admin()
    or public.is_submitter(recipes.id));
create policy recipes_admin_update on public.recipes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy recipes_admin_delete on public.recipes
  for delete to authenticated using (public.is_admin());

create policy shares_read on public.shares
  for select to authenticated using (
    public.is_member() and exists (select 1 from public.recipes r where r.id = shares.recipe_id));

create policy favorites_own on public.favorites
  for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (member_id = auth.uid() and public.is_member());

create policy push_own on public.push_subscriptions
  for all to authenticated
  using (member_id = auth.uid() and public.is_member())
  with check (member_id = auth.uid() and public.is_member());

-- Storage: public-read bucket, writes only via service role (no insert policy for clients)
insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- Realtime status card in the app
alter publication supabase_realtime add table public.recipes;

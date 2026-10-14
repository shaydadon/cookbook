create extension if not exists pgtap with schema extensions;
begin;
select plan(12);

-- hook
select is(public.hook_before_user_created('{"user":{"email":"Stranger@Example.com"}}'::jsonb) -> 'error' ->> 'http_code',
          '403', 'hook rejects unknown email');
insert into public.allowed_emails (email, whatsapp_name, role) values
  ('admin@test.local', 'שי', 'admin'),
  ('member@test.local', 'רחל', 'member');
select is(public.hook_before_user_created('{"user":{"email":"Member@Test.local"}}'::jsonb),
          '{}'::jsonb, 'hook allows allow-listed email case-insensitively');

-- member provisioning trigger
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000ad01', 'admin@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000ee01', 'member@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000bad1', 'sneaky@test.local', '{}');
select is((select role from public.members where id = '00000000-0000-0000-0000-00000000ad01'), 'admin', 'admin provisioned with role');
select is((select display_name from public.members where id = '00000000-0000-0000-0000-00000000ee01'), 'רחל', 'display name from whatsapp_name');
select is((select count(*)::int from public.members where id = '00000000-0000-0000-0000-00000000bad1'), 0,
          'user not on allow-list gets no members row');

insert into public.recipes (id, source_url, source_url_normalized, source_platform, status, title) values
  ('00000000-0000-0000-0000-0000000000b1', 'https://x.test/p', 'https://x.test/p', 'web', 'published', 'פורסם'),
  ('00000000-0000-0000-0000-0000000000b2', 'https://x.test/q', 'https://x.test/q', 'web', 'queued', null),
  ('00000000-0000-0000-0000-0000000000b3', 'https://x.test/m', 'https://x.test/m', 'web', 'rewriting', null);
insert into public.shares (recipe_id, shared_by_name, via, submitted_by) values
  ('00000000-0000-0000-0000-0000000000b3', 'רחל', 'app', '00000000-0000-0000-0000-00000000ee01');

-- as member
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000ee01","role":"authenticated"}';
select is((select count(*)::int from public.recipes), 2, 'member sees published + own submission only');
select is_empty($$ update public.recipes set title = 'x' returning id $$, 'member cannot update recipes');
select throws_ok($$ insert into public.recipes (source_url, source_url_normalized, source_platform)
                    values ('https://x.test/z','https://x.test/z','web') $$, '42501', null, 'member cannot insert recipes');
select lives_ok($$ insert into public.favorites (member_id, recipe_id)
                   values ('00000000-0000-0000-0000-00000000ee01','00000000-0000-0000-0000-0000000000b1') $$,
                'member can favorite');
select throws_ok($$ insert into public.favorites (member_id, recipe_id)
                    values ('00000000-0000-0000-0000-00000000ad01','00000000-0000-0000-0000-0000000000b1') $$,
                 '42501', null, 'member cannot favorite for someone else');

-- as non-member authenticated user
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000bad1","role":"authenticated"}';
select is((select count(*)::int from public.recipes), 0, 'non-member sees nothing');

-- as admin
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000ad01","role":"authenticated"}';
select is((select count(*)::int from public.recipes), 3, 'admin sees all statuses');

select * from finish();
rollback;

create extension if not exists pgtap with schema extensions;
begin;
select plan(14);

-- 1. claim counter
insert into public.recipes (id, source_url, source_url_normalized, source_platform, status, next_attempt_at, claims, locked_until) values
  ('00000000-0000-0000-0000-0000000000d1', 'https://h.test/1', 'https://h.test/1', 'web', 'rewriting', now() - interval '3 min', 3, now() - interval '1 sec'),
  ('00000000-0000-0000-0000-0000000000d2', 'https://h.test/2', 'https://h.test/2', 'web', 'imaging',   now() - interval '2 min', 3, null);

select is((select count(*)::int from public.claim_next_recipe(300)), 0, 'rows claimed 3 times are not returned');
select is((select status from public.recipes where id = '00000000-0000-0000-0000-0000000000d1'), 'failed',
          'rewriting row with claims=3 becomes failed');
select is((select error from public.recipes where id = '00000000-0000-0000-0000-0000000000d1'),
          'העיבוד נקטע שוב ושוב (חריגת זמן)', 'failed row gets the Hebrew timeout error');
select is((select locked_until from public.recipes where id = '00000000-0000-0000-0000-0000000000d1'), null,
          'failed row lease cleared');
select is((select status from public.recipes where id = '00000000-0000-0000-0000-0000000000d2'), 'published',
          'imaging row with claims=3 is published');
select is((select image_path from public.recipes where id = '00000000-0000-0000-0000-0000000000d2'), null,
          'published without an image');
select isnt((select published_at from public.recipes where id = '00000000-0000-0000-0000-0000000000d2'), null,
            'published_at set');
select is((select error from public.recipes where id = '00000000-0000-0000-0000-0000000000d2'),
          'יצירת התמונה נכשלה (חריגת זמן)', 'image timeout error recorded');

insert into public.recipes (id, source_url, source_url_normalized, source_platform, status, next_attempt_at) values
  ('00000000-0000-0000-0000-0000000000d3', 'https://h.test/3', 'https://h.test/3', 'web', 'queued', now() - interval '1 min');
select is((select id from public.claim_next_recipe(300)), '00000000-0000-0000-0000-0000000000d3'::uuid,
          'row with claims=0 is returned');
select is((select claims from public.recipes where id = '00000000-0000-0000-0000-0000000000d3'), 1, 'claim increments claims');

-- 11. negative page_size
select lives_ok($$ select * from public.search_recipes(null, null, false, -5, 0) $$, 'negative page_size does not raise');
select is((select count(*)::int from public.search_recipes(null, null, false, -5, 0)), 0, 'negative page_size returns no rows');

-- 7. members email is not readable by clients
insert into public.allowed_emails (email, whatsapp_name, role) values ('hard-member@test.local', 'דנה', 'member');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000ee05', 'hard-member@test.local', '{}');
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000ee05","role":"authenticated"}';
select throws_ok($$ select email from public.members $$, '42501', null, 'member cannot select email');
select is((select display_name from public.members where id = '00000000-0000-0000-0000-00000000ee05'), 'דנה',
          'member can still read display_name');

select * from finish();
rollback;

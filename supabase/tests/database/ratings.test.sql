create extension if not exists pgtap with schema extensions;
begin;
select plan(9);

-- Personal ratings: each member rates for themselves; nobody sees or changes another member's ratings,
-- and the feed's star filter uses only the caller's own ratings.
insert into public.allowed_emails (email, whatsapp_name, role) values
  ('a@test.local', 'א', 'member'), ('b@test.local', 'ב', 'member');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'b@test.local', '{}');
insert into public.recipes (id, source_url, source_url_normalized, source_platform, status, title, published_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'https://r.test/1', 'https://r.test/1', 'web', 'published', 'מרק', now()),
  ('00000000-0000-0000-0000-0000000000c2', 'https://r.test/2', 'https://r.test/2', 'web', 'published', 'עוגה', now()),
  ('00000000-0000-0000-0000-0000000000c3', 'https://r.test/3', 'https://r.test/3', 'web', 'published', 'סלט', now());

set local role authenticated;
-- member A rates
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok($$ insert into public.ratings (member_id, recipe_id, stars) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 5),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', 3) $$, 'member can rate');
select throws_ok($$ insert into public.ratings (member_id, recipe_id, stars) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 6) $$,
  '23514', null, 'stars must be 1-5');
select throws_ok($$ insert into public.ratings (member_id, recipe_id, stars) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c3', 4) $$,
  '42501', null, 'member cannot rate for someone else');
select is((select count(*)::int from public.search_recipes(min_rating => 4)), 1, 'A: ★4+ finds only A''s 5-star recipe');
select is((select count(*)::int from public.search_recipes(min_rating => 3)), 2, 'A: ★3+ finds both rated recipes');
select is((select count(*)::int from public.search_recipes()), 3, 'no star filter shows everything');

-- member B sees none of A's ratings and filters by B's own
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is((select count(*)::int from public.ratings), 0, 'B cannot see A''s ratings');
select is_empty($$ update public.ratings set stars = 1 returning recipe_id $$, 'B cannot change A''s ratings');
select is((select count(*)::int from public.search_recipes(min_rating => 3)), 0, 'B''s star filter ignores A''s ratings');

select * from finish();
rollback;

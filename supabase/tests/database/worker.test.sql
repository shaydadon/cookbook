create extension if not exists pgtap with schema extensions;
begin;
select plan(5);

insert into public.recipes (id, source_url, source_url_normalized, source_platform, status, next_attempt_at, locked_until) values
  ('00000000-0000-0000-0000-0000000000c1', 'https://w.test/1', 'https://w.test/1', 'web', 'queued',    now() - interval '2 min', null),
  ('00000000-0000-0000-0000-0000000000c2', 'https://w.test/2', 'https://w.test/2', 'web', 'rewriting', now() - interval '1 min', now() + interval '4 min'),
  ('00000000-0000-0000-0000-0000000000c3', 'https://w.test/3', 'https://w.test/3', 'web', 'imaging',   now() + interval '5 min', null),
  ('00000000-0000-0000-0000-0000000000c4', 'https://w.test/4', 'https://w.test/4', 'web', 'rewriting', now() - interval '1 min', now() - interval '1 sec'),
  ('00000000-0000-0000-0000-0000000000c5', 'https://w.test/5', 'https://w.test/5', 'web', 'published', now() - interval '9 min', null);

select is((select id from public.claim_next_recipe(300)), '00000000-0000-0000-0000-0000000000c1'::uuid, 'oldest due row first');
select isnt((select locked_until from public.recipes where id = '00000000-0000-0000-0000-0000000000c1'), null, 'claimed row is leased');
select is((select id from public.claim_next_recipe(300)), '00000000-0000-0000-0000-0000000000c4'::uuid,
          'expired lease is reclaimed; live lease (c2) and future retry (c3) are skipped');
select is((select count(*)::int from public.claim_next_recipe(300)), 0, 'nothing else due');

set local role authenticated;
select throws_ok($$ select * from public.claim_next_recipe(300) $$, '42501', null, 'clients cannot claim');

select * from finish();
rollback;

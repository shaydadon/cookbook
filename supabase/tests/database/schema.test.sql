create extension if not exists pgtap with schema extensions;
begin;
select plan(10);

select has_table('public', 'recipes', 'recipes table exists');
select has_table('public', 'shares', 'shares table exists');

insert into public.recipes (id, source_url, source_url_normalized, source_platform, status, title, description, ingredients, tags, category)
values ('00000000-0000-0000-0000-0000000000a1', 'https://x.test/a', 'https://x.test/a', 'web', 'published',
        'שקשוקה ירוקה', 'ארוחת בוקר מהירה',
        '[{"group":null,"name":"תרד","amount":"200","unit":"גרם","note":null}]'::jsonb,
        array['צמחוני'], 'ארוחת בוקר');

select matches((select search_text from public.recipes where id = '00000000-0000-0000-0000-0000000000a1'),
               'תרד', 'search_text includes ingredient names');
select matches((select search_text from public.recipes where id = '00000000-0000-0000-0000-0000000000a1'),
               'צמחוני', 'search_text includes tags');

select throws_ok(
  $$ insert into public.recipes (source_url, source_url_normalized, source_platform, category)
     values ('https://x.test/b', 'https://x.test/b', 'web', 'פיצות') $$,
  '23514', null, 'category must be one of the fixed list');

select throws_ok(
  $$ insert into public.recipes (source_url, source_url_normalized, source_platform)
     values ('https://x.test/a2', 'https://x.test/a', 'web') $$,
  '23505', null, 'normalized url is unique');

select is((select count(*)::int from public.search_recipes('תרד', null, false, 24, 0)), 1,
          'search_recipes finds by ingredient');
select is((select count(*)::int from public.search_recipes('%', null, false, 24, 0)), 0, 'percent is literal');
select lives_ok($$ select * from public.search_recipes('a\', null, false, 24, 0) $$, 'trailing backslash does not error');
select is((select count(*)::int from public.search_recipes(null, 'מרקים', false, 24, 0)), 0, 'category filter excludes other categories');

select * from finish();
rollback;

begin;
insert into auth.users(id,email) values
 ('91000000-0000-0000-0000-000000000001','category-admin@example.com'),
 ('91000000-0000-0000-0000-000000000002','category-student@example.com');
update public.profiles set role='admin' where id='91000000-0000-0000-0000-000000000001';
insert into public.mock_tests(id,title,slug,duration_minutes) values
 ('92000000-0000-0000-0000-000000000001','Category assignment fixture','category-assignment-fixture',10);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare c uuid; begin
 select id into c from public.categories where slug='aptitude';
 perform public.set_test_categories('92000000-0000-0000-0000-000000000001',array[c,c]);
 perform t.eq((select count(*) from public.mock_test_categories where test_id='92000000-0000-0000-0000-000000000001'),1::bigint,'duplicate categories are deduplicated');
 perform t.throws($q$select public.set_test_categories('92000000-0000-0000-0000-000000000001',array['93000000-0000-0000-0000-000000000000'::uuid])$q$,'23503','invalid category fails transaction');
 perform t.eq((select category_id from public.mock_test_categories where test_id='92000000-0000-0000-0000-000000000001'),c,'failed replacement preserves original categories');
 perform public.set_test_categories('92000000-0000-0000-0000-000000000001','{}');
 perform t.eq((select count(*) from public.mock_test_categories where test_id='92000000-0000-0000-0000-000000000001'),0::bigint,'empty selection clears categories');
 perform t.throws($q$select public.set_test_categories('92000000-0000-0000-0000-000000000002','{}')$q$,'P0002','missing test rejected');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 perform t.throws($q$select public.set_test_categories('92000000-0000-0000-0000-000000000001','{}')$q$,'42501','student cannot replace categories');
end $$;
reset role;
set local role anon;
do $$ begin
 perform t.throws($q$select public.set_test_categories('92000000-0000-0000-0000-000000000001','{}')$q$,'42501','anon cannot replace categories');
end $$;
reset role;
rollback;

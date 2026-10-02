begin;
insert into auth.users(id,email) values ('b1000000-0000-4000-8000-000000000001','analytics@example.com'),('b1000000-0000-4000-8000-000000000002','analytics-other@example.com');
insert into public.questions(id,category_id,question_type,question_text,correct_answer,explanation,slug,is_practice,status)
select ('b2000000-0000-4000-8000-00000000000'||n)::uuid,c.id,'mcq','Analytics question '||n,'A','Explanation '||n,'analytics-q-'||n,true,'published'
from generate_series(1,3) n cross join public.categories c where c.slug='percentages';
insert into public.question_options(question_id,option_key,option_text)
select ('b2000000-0000-4000-8000-00000000000'||n)::uuid,k,k from generate_series(1,3) n cross join unnest(array['A','B']) k;
insert into public.mock_tests(id,title,slug,duration_minutes,status) values('b3000000-0000-4000-8000-000000000001','Analytics test','analytics-test',10,'published');
insert into public.test_questions(test_id,question_id,question_order,marks)
select 'b3000000-0000-4000-8000-000000000001',('b2000000-0000-4000-8000-00000000000'||n)::uuid,n,1 from generate_series(1,3) n;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare a uuid; stats jsonb; begin
 perform public.submit_practice('b2000000-0000-4000-8000-000000000001','B');
 perform public.submit_practice('b2000000-0000-4000-8000-000000000002','B');
 perform public.submit_practice('b2000000-0000-4000-8000-000000000003','B');
 stats:=public.get_learning_analytics();
 perform t.eq(jsonb_array_length(stats->'recommendations'),1,'three weak answers trigger recommendation');
 perform t.eq((stats->'topics'->0->>'correct')::int,0,'incorrect practice counted');
 a:=public.start_test_attempt('b3000000-0000-4000-8000-000000000001');
 perform set_config('t.analytics_attempt',a::text,true);
 perform t.eq(jsonb_array_length(public.get_learning_analytics()->'history'),0,'running mocks excluded from analytics');
 perform public.submit_attempt(a,'[{"question_id":"b2000000-0000-4000-8000-000000000001","selected_answer":"A"}]');
 stats:=public.get_learning_analytics();
 perform t.eq(jsonb_array_length(stats->'history'),1,'completed mock appears in history');
 perform t.eq((stats->'topics'->0->>'correct')::int,1,'server graded mock combined with practice');
end $$;
reset role;
select t.throws($q$update public.questions set correct_answer='B' where id='b2000000-0000-4000-8000-000000000001'$q$,'23514','used answer key immutable');
select t.throws($q$update public.question_options set option_text='Changed' where question_id='b2000000-0000-4000-8000-000000000001'$q$,'23514','used options immutable');
select t.throws($q$update public.test_questions set marks=99 where test_id='b3000000-0000-4000-8000-000000000001'$q$,'23514','test weights immutable after attempt');
select t.throws($q$update public.mock_tests set duration_minutes=99 where id='b3000000-0000-4000-8000-000000000001'$q$,'23514','test duration immutable after attempt');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select t.eq(jsonb_array_length(public.get_learning_analytics()->'topics'),0,'other student has no analytics from first account');
select t.throws($q$select public.get_attempt_result_internal(current_setting('t.analytics_attempt')::uuid)$q$,'42501','internal functions inaccessible');
reset role;
set local role anon;
select t.throws($q$select public.get_learning_analytics()$q$,'42501','anonymous analytics denied');
reset role;
rollback;

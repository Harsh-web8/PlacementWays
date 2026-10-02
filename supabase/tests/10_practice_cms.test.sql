begin;
insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','practice-admin@example.com'),
 ('a1000000-0000-4000-8000-000000000002','practice-student@example.com'),
 ('a1000000-0000-4000-8000-000000000003','practice-other@example.com');
update public.profiles set role='admin' where id='a1000000-0000-4000-8000-000000000001';
insert into public.questions(id,category_id,question_type,question_text,correct_answer,explanation,slug,is_practice,status,difficulty)
select 'a2000000-0000-4000-8000-000000000001',id,'mcq','Practice fixture','B','Private explanation','practice-fixture',true,'draft','easy_medium' from public.categories where slug='aptitude';
insert into public.question_options(question_id,option_key,option_text) values
 ('a2000000-0000-4000-8000-000000000001','A','One'),('a2000000-0000-4000-8000-000000000001','B','Two');
update public.questions set status='published' where slug='practice-fixture';
insert into public.blog_posts(title,slug,body,status) values('Draft','private-draft','Private draft','draft'),('Public','public-post','Public text','published');
set local role anon;
do $$ begin
 perform t.eq((select count(*) from public.practice_questions where slug='practice-fixture'),1::bigint,'anon sees public prompt');
 perform t.eq(not(public.get_practice_question('practice-fixture') ? 'correct_answer'),true,'question RPC excludes answer');
 perform t.eq(not(public.get_practice_question('practice-fixture') ? 'explanation'),true,'question RPC excludes explanation');
 perform t.throws($q$select correct_answer from public.questions$q$,'42501','anon cannot read answer bank');
 perform t.eq((select count(*) from public.blog_posts where slug='private-draft'),0::bigint,'draft articles hidden');
 perform t.throws($q$select public.submit_practice('a2000000-0000-4000-8000-000000000001','B')$q$,'42501','anon cannot submit');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 perform t.throws($q$select public.submit_practice('a2000000-0000-4000-8000-000000000001','Z')$q$,'22023','invalid answer rejected');
 perform public.submit_practice('a2000000-0000-4000-8000-000000000001','B');
 perform t.eq((select is_correct from public.practice_attempts limit 1),true,'server grades correct answer');
 perform t.eq((select explanation from public.practice_attempts limit 1),'Private explanation','explanation available after submission');
 perform t.throws($q$insert into public.practice_attempts(user_id,question_id,category_id,difficulty,selected_answer,is_correct) select auth.uid(),id,category_id,difficulty,'B',true from public.questions limit 1$q$,'42501','student cannot write scores');
 perform t.throws($q$select public.admin_set_student_active('a1000000-0000-4000-8000-000000000003',false)$q$,'42501','student cannot suspend another account');
 perform t.throws($q$insert into public.blog_posts(title,slug,body) values('Attack','attack','x')$q$,'42501','student cannot publish articles');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin perform t.eq((select count(*) from public.practice_attempts),0::bigint,'other student cannot see submissions');end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.admin_set_student_active('a1000000-0000-4000-8000-000000000002',false);
do $$ begin
 perform t.eq(not(select is_active from public.profiles where id='a1000000-0000-4000-8000-000000000002'),true,'admin can suspend student');
 perform t.throws($q$select public.admin_set_student_active('a1000000-0000-4000-8000-000000000001',false)$q$,'P0002','student action cannot disable an admin');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin perform t.throws($q$select public.submit_practice('a2000000-0000-4000-8000-000000000001','B')$q$,'42501','suspended student cannot submit');end $$;
reset role;
rollback;

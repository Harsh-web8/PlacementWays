begin;
insert into auth.users(id,email) values
 ('81000000-0000-0000-0000-000000000001','learn-one@example.com'),
 ('81000000-0000-0000-0000-000000000002','learn-two@example.com'),
 ('81000000-0000-0000-0000-000000000003','learn-admin@example.com');
update public.profiles set role='admin' where id='81000000-0000-0000-0000-000000000003';
insert into public.courses(id,title,slug,status,is_free,price_paise) values
 ('82000000-0000-0000-0000-000000000001','Free course','free-fixture','published',true,0),
 ('82000000-0000-0000-0000-000000000002','Premium course','premium-fixture','published',false,12345),
 ('82000000-0000-0000-0000-000000000003','Draft course','draft-fixture','draft',true,0);
insert into public.course_modules(id,course_id,title,status) values
 ('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','Free module','published'),
 ('83000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000002','Premium module','published'),
 ('83000000-0000-0000-0000-000000000003','82000000-0000-0000-0000-000000000003','Draft parent module','published');
insert into public.lessons(id,module_id,title,slug,status,is_free) values
 ('84000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','Free lesson','free','published',false),
 ('84000000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000002','Locked lesson','locked','published',false),
 ('84000000-0000-0000-0000-000000000003','83000000-0000-0000-0000-000000000002','Preview lesson','preview','published',true),
 ('84000000-0000-0000-0000-000000000004','83000000-0000-0000-0000-000000000003','Hidden lesson','hidden','published',true);
insert into public.lesson_contents(lesson_id,body,resource_url) select id,'Educational content','https://example.com/resource.pdf' from public.lessons where id::text like '84000000%';
set local role anon;
do $$ begin
 perform t.eq((select count(*) from public.courses where id::text like '82000000%'),2::bigint,'only published courses visible');
 perform t.eq((select count(*) from public.lesson_contents where lesson_id::text like '84000000%'),2::bigint,'free lesson and premium preview bodies visible');
 perform t.eq((select count(*) from public.lesson_contents where lesson_id='84000000-0000-0000-0000-000000000002'),0::bigint,'locked body and resource URL not exposed');
 perform t.eq((select count(*) from public.lessons where id='84000000-0000-0000-0000-000000000004'),0::bigint,'draft ancestor hides syllabus');
 perform t.throws($q$select public.complete_lesson('84000000-0000-0000-0000-000000000001')$q$,'42501','anonymous cannot write progress');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 perform public.start_course('82000000-0000-0000-0000-000000000001');
 perform public.start_course('82000000-0000-0000-0000-000000000001');
 perform public.complete_lesson('84000000-0000-0000-0000-000000000001');
 perform public.complete_lesson('84000000-0000-0000-0000-000000000001');
 perform t.eq((select count(*) from public.course_progress),1::bigint,'enrollment is idempotent');
 perform t.eq((select count(*) from public.lesson_progress),1::bigint,'completion is idempotent');
 perform t.throws($q$select public.start_course('82000000-0000-0000-0000-000000000002')$q$,'42501','premium enrollment denied');
 perform t.throws($q$select public.complete_lesson('84000000-0000-0000-0000-000000000002')$q$,'42501','locked completion denied');
 perform t.throws($q$select public.complete_lesson('84000000-0000-0000-0000-000000000004')$q$,'42501','draft completion denied');
 perform public.complete_lesson('84000000-0000-0000-0000-000000000003');
 perform t.eq((select count(*) from public.lesson_progress),2::bigint,'premium preview can be completed');
 perform t.throws($q$insert into public.lesson_progress(user_id,lesson_id) values('81000000-0000-0000-0000-000000000002','84000000-0000-0000-0000-000000000001')$q$,'42501','cannot forge another student progress');
 perform t.throws($q$insert into public.courses(title,slug) values('Unauthorized','unauthorized')$q$,'42501','student cannot create courses');
 perform t.throws($q$select public.admin_save_lesson(null,'{}','{}')$q$,'42501','student cannot invoke lesson management');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 perform t.eq((select count(*) from public.course_progress),0::bigint,'enrollment is private');
 perform t.eq((select count(*) from public.lesson_progress),0::bigint,'lesson progress is private');
end $$;
reset role;
update public.profiles set is_active=false where id='81000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin
 perform t.throws($q$select public.complete_lesson('84000000-0000-0000-0000-000000000001')$q$,'42501','inactive student cannot complete lessons');
 perform t.throws($q$select public.start_course('82000000-0000-0000-0000-000000000001')$q$,'42501','inactive student cannot enroll');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_id uuid; begin
 perform t.eq((select count(*) from public.lesson_contents where lesson_id::text like '84000000%'),4::bigint,'admin can edit locked and draft bodies');
 v_id:=public.admin_save_lesson(null,jsonb_build_object('module_id','83000000-0000-0000-0000-000000000001','title','New lesson','slug','new','duration_minutes',15,'sort_order',2,'is_free',false,'status','draft'),jsonb_build_object('body','Worked examples'));
 perform t.eq((select body from public.lesson_contents where lesson_id=v_id),'Worked examples','lesson body saved atomically');
 perform t.throws($q$select public.admin_save_lesson(null,'{"module_id":"83000000-0000-0000-0000-000000000001","title":"Invalid","slug":"invalid","duration_minutes":15,"sort_order":2,"is_free":false,"status":"draft"}','{"body":"Invalid","resource_url":"javascript:alert(1)"}')$q$,'23514','unsafe resource URL rejected in DB');
 perform t.eq((select count(*) from public.lessons where slug='invalid'),0::bigint,'invalid body rolls back lesson');
 perform t.throws($q$delete from public.lessons where id='84000000-0000-0000-0000-000000000001'$q$,'23503','student history prevents destructive delete');
 update public.course_modules set status='draft' where id='83000000-0000-0000-0000-000000000001';
end $$;
reset role;
set local role anon;
do $$ begin
 perform t.eq((select count(*) from public.lesson_contents where lesson_id='84000000-0000-0000-0000-000000000001'),0::bigint,'unpublishing a module revokes body access');
end $$;
reset role;
-- Verify the transitive RLS chain specifically raised in the code review.
-- The policy subqueries run as the caller, so hidden ancestors hide descendants.
update public.course_modules set status='published' where id='83000000-0000-0000-0000-000000000001';
insert into public.companies(id,name,slug,status) values('86000000-0000-0000-0000-000000000001','Hidden company fixture','hidden-company-fixture','draft');
update public.courses set company_id='86000000-0000-0000-0000-000000000001' where id='82000000-0000-0000-0000-000000000001';
set local role anon;
do $$ begin
 perform t.eq((select count(*) from public.lessons where id='84000000-0000-0000-0000-000000000001'),0::bigint,'anon cannot read lesson metadata under a draft company');
 perform t.eq((select count(*) from public.lesson_contents where lesson_id='84000000-0000-0000-0000-000000000001'),0::bigint,'anon cannot read lesson body under a draft company');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 perform t.eq((select count(*) from public.lessons where id='84000000-0000-0000-0000-000000000001'),0::bigint,'student cannot read lesson metadata under a draft company');
 perform t.eq((select count(*) from public.lessons where id='84000000-0000-0000-0000-000000000004'),0::bigint,'student cannot read lesson metadata under a draft course');
end $$;
reset role;
update public.companies set status='published' where id='86000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
 perform t.eq((select count(*) from public.lessons where id='84000000-0000-0000-0000-000000000001'),1::bigint,'student can read lesson metadata once every ancestor is published');
end $$;
reset role;
rollback;

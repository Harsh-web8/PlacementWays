begin;
insert into auth.users(id,email) values
 ('12000000-0000-0000-0000-000000000001','access-one@example.test'),
 ('12000000-0000-0000-0000-000000000002','access-two@example.test');
insert into public.mock_tests(id,title,slug,duration_minutes,status,access_type,is_free,guest_attempt_allowed,authenticated_attempt_limit)
values
 ('12100000-0000-0000-0000-000000000001','Guest fixture','guest-fixture',20,'published','GUEST_FREE',true,true,1),
 ('12100000-0000-0000-0000-000000000002','Second fixture','second-fixture',20,'published','PUBLIC',true,true,null),
 ('12100000-0000-0000-0000-000000000003','Premium fixture','paid-fixture',20,'published','PREMIUM',false,false,null),
 ('12100000-0000-0000-0000-000000000004','Login fixture','login-fixture',20,'published','LOGIN_REQUIRED',true,false,null);
insert into public.questions(id,category_id,question_text,correct_answer,status)
select '12200000-0000-0000-0000-000000000001',id,'Guest question','B','published' from public.categories where slug='percentages';
insert into public.question_options(question_id,option_key,option_text) values
 ('12200000-0000-0000-0000-000000000001','A','Incorrect'),('12200000-0000-0000-0000-000000000001','B','Correct');
insert into public.test_questions(test_id,question_id,question_order,marks)
select id,'12200000-0000-0000-0000-000000000001',1,2 from public.mock_tests where id::text like '12100000%';
set constraints all immediate;
set local role anon;
select t.throws($q$select public.guest_mock_gateway('start',repeat('a',64))$q$,'42501','anon cannot call service gateway');
select t.throws($q$select * from public.guest_mock_sessions$q$,'42501','guest identities are private');
select t.throws($q$select * from public.guest_mock_rate_limits$q$,'42501','rate keys are private');
select t.throws($q$select public.get_attempt_state_internal(gen_random_uuid())$q$,'42501','internal state cannot bypass authorization');
reset role;
set local role service_role;
do $$ declare r jsonb; a uuid; begin
 r:=public.guest_mock_gateway('start',repeat('a',64),'12100000-0000-0000-0000-000000000001',p_network_hash=>repeat('b',64));
 perform t.eq(r->>'decision','allow','first guest starts without auth');
 a:=(r->>'attempt_id')::uuid; perform set_config('t.guest_attempt',a::text,true);
 perform t.eq(public.guest_mock_gateway('start',repeat('a',64),'12100000-0000-0000-0000-000000000001',p_network_hash=>repeat('b',64))->>'attempt_id',a::text,'repeat start resumes without spending quota');
 perform t.eq(public.guest_mock_gateway('start',repeat('a',64),'12100000-0000-0000-0000-000000000002',p_network_hash=>repeat('b',64))->>'decision','login','parallel second mock cannot bypass reserved quota');
 r:=public.guest_mock_gateway('state',repeat('a',64),p_attempt_id=>a);
 perform t.eq(position('correct_answer' in r::text),0,'guest state has no correct answers');
 perform t.eq(public.guest_mock_gateway('result',repeat('a',64),p_attempt_id=>a) is null,true,'results hidden before submission');
 perform t.eq(public.guest_mock_gateway('state',repeat('c',64),p_attempt_id=>a) is null,true,'another cookie cannot read state');
 perform t.eq(public.guest_mock_gateway('save',repeat('c',64),p_attempt_id=>a,p_question_id=>'12200000-0000-0000-0000-000000000001',p_selected=>'B') is null,true,'another cookie cannot write');
 perform t.eq(public.guest_mock_gateway('submit',repeat('c',64),p_attempt_id=>a) is null,true,'another cookie cannot submit');
 perform public.guest_mock_gateway('save',repeat('a',64),p_attempt_id=>a,p_question_id=>'12200000-0000-0000-0000-000000000001',p_selected=>'B');
 perform t.eq(public.guest_mock_gateway('submit',repeat('a',64),p_attempt_id=>a),to_jsonb('submitted'::text),'guest submits');
 perform t.eq(public.guest_mock_gateway('submit',repeat('a',64),p_attempt_id=>a),to_jsonb('submitted'::text),'guest submission idempotent');
 r:=public.guest_mock_gateway('result',repeat('a',64),p_attempt_id=>a);
 perform t.eq((r->'attempt'->>'score')::numeric,2::numeric,'server scores guest correctly');
 perform t.eq(r->'summary'->>'correct','1','guest sees summary');
 perform t.eq(public.guest_mock_gateway('result',repeat('c',64),p_attempt_id=>a) is null,true,'another cookie cannot read results');
 perform t.eq(public.guest_mock_gateway('start',repeat('a',64),'12100000-0000-0000-0000-000000000002',p_network_hash=>repeat('b',64))->>'decision','login','second guest requires login after completion');
 perform t.eq(public.guest_mock_gateway('start',repeat('d',64),'12100000-0000-0000-0000-000000000003',p_network_hash=>repeat('b',64))->>'decision','premium','premium never grants guest');
 perform t.eq(public.guest_mock_gateway('start',repeat('d',64),'12100000-0000-0000-0000-000000000004',p_network_hash=>repeat('b',64))->>'decision','login','login-only policy enforced');
 perform t.eq(public.claim_guest_mock(repeat('c',64),a,'12000000-0000-0000-0000-000000000001'),false,'wrong cookie cannot claim');
 perform t.eq(public.claim_guest_mock(repeat('a',64),a,'12000000-0000-0000-0000-000000000001'),true,'verified owner can save to account');
 perform t.eq(public.claim_guest_mock(repeat('a',64),a,'12000000-0000-0000-0000-000000000002'),false,'claimed result cannot be stolen');
 perform t.eq(public.guest_mock_gateway('result',repeat('a',64),p_attempt_id=>a) is null,true,'claimed result no longer available to guest');
 perform t.eq(public.guest_mock_gateway('start',repeat('a',64),'12100000-0000-0000-0000-000000000002',p_network_hash=>repeat('b',64))->>'decision','login','claim does not reset guest allowance');
end $$;
reset role;
update public.site_settings set guest_network_daily_limit=1;
set local role service_role;
select t.eq(public.guest_mock_gateway('start',repeat('d',64),'12100000-0000-0000-0000-000000000001',p_network_hash=>repeat('b',64))->>'decision','rate_limited','cookie clearing still hits network limit');
reset role;
update public.site_settings set guest_mock_enabled=false;
set local role service_role;
select t.eq(public.guest_mock_gateway('start',repeat('d',64),'12100000-0000-0000-0000-000000000001',p_network_hash=>repeat('e',64))->>'decision','login','global guest toggle enforced');
reset role;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select t.eq((public.get_attempt_result(current_setting('t.guest_attempt')::uuid)->'attempt'->>'score')::numeric,2::numeric,'claimed result visible to owning student');
select t.throws($q$select public.start_test_attempt('12100000-0000-0000-0000-000000000001')$q$,'23514','configured account attempt limit enforced including claimed result');
select t.throws($q$select public.start_test_attempt('12100000-0000-0000-0000-000000000003')$q$,'42501','premium without entitlement denied');
select t.throws($q$insert into public.content_entitlements(user_id,test_id) values(auth.uid(),'12100000-0000-0000-0000-000000000003')$q$,'42501','student cannot forge purchase');
select t.throws($q$select public.claim_guest_mock(repeat('a',64),gen_random_uuid(),auth.uid())$q$,'42501','claim only through verified server identity');
reset role;
insert into public.content_entitlements(user_id,test_id) values('12000000-0000-0000-0000-000000000001','12100000-0000-0000-0000-000000000003');
set local role authenticated;
select t.eq(public.mock_access_decision('12100000-0000-0000-0000-000000000003'),'allow','paid entitlement permits mock');
select t.eq(public.start_test_attempt('12100000-0000-0000-0000-000000000003') is not null,true,'paid mock starts');
reset role;
update public.content_entitlements set expires_at=now()-interval '1 second';
set local role authenticated;
select t.eq(public.mock_access_decision('12100000-0000-0000-0000-000000000003'),'premium','expired grant denies new access');
select t.throws($q$select public.start_test_attempt('12100000-0000-0000-0000-000000000003')$q$,'42501','expired entitlement rejected at start');
reset role;
-- Paid course body and progress use the same entitlement check.
insert into public.courses(id,title,slug,status,is_free,price_paise) values('12300000-0000-0000-0000-000000000001','Paid','paid-access','published',false,100);
insert into public.course_modules(id,course_id,title,status) values('12400000-0000-0000-0000-000000000001','12300000-0000-0000-0000-000000000001','Module','published');
insert into public.lessons(id,module_id,title,slug,status) values('12500000-0000-0000-0000-000000000001','12400000-0000-0000-0000-000000000001','Lesson','paid-lesson','published');
insert into public.lesson_contents(lesson_id,body) values('12500000-0000-0000-0000-000000000001','Private lesson');
insert into public.content_entitlements(user_id,course_id) values('12000000-0000-0000-0000-000000000001','12300000-0000-0000-0000-000000000001');
set local role authenticated;
select t.eq(public.can_read_lesson('12500000-0000-0000-0000-000000000001'),true,'paid course body unlocked');
select public.start_course('12300000-0000-0000-0000-000000000001');
select public.complete_lesson('12500000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select t.eq(public.can_read_lesson('12500000-0000-0000-0000-000000000001'),false,'another student cannot use entitlement');
select t.eq(public.get_attempt_result(current_setting('t.guest_attempt')::uuid) is null,true,'another student cannot see claimed result');
select t.eq((select count(*) from public.content_entitlements),0::bigint,'another student cannot see purchases');
reset role;
rollback;

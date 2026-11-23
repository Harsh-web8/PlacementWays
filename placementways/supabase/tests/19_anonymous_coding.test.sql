-- M05 guarded anonymous coding. Runs only in the throwaway postgres test database.
begin;
set local role anon;
select t.throws($q$select public.start_guest_coding_submission(repeat('a',64),repeat('b',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047','python','print(1)','submit')$q$,'42501','anonymous SQL role cannot call privileged guest gateway');
select t.throws($q$select public.get_guest_coding_submission(repeat('a',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047')$q$,'42501','anonymous cannot read guest results by RPC');
reset role;
set local role authenticated;
select t.throws($q$select public.start_guest_coding_submission(repeat('a',64),repeat('b',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047','python','print(1)','submit')$q$,'42501','signed-in student cannot bypass coding quotas via guest gateway');
reset role;
update public.site_settings set coding_enabled=true;
insert into public.worker_heartbeats(name,last_seen) values('coding',now()) on conflict(name) do update set last_seen=excluded.last_seen;
set local role service_role;
select t.throws($q$select public.start_guest_coding_submission('invalid',repeat('b',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047','python','print(1)','run')$q$,'22023','malformed identity hash rejected');
select set_config('t.guest_coding_id',public.start_guest_coding_submission(repeat('a',64),repeat('b',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047','python','print(1)','submit')::text,true);
select t.eq((select total from public.coding_submissions where id=current_setting('t.guest_coding_id')::uuid),3,'guest submission includes all test cases');
select t.eq((select user_id from public.coding_submissions where id=current_setting('t.guest_coding_id')::uuid),null::uuid,'anonymous submission has no student profile');
select t.eq((public.get_guest_coding_submission(repeat('a',64),current_setting('t.guest_coding_id')::uuid)->>'source_code')::text,'print(1)'::text,'guest sees own source');
select t.eq(public.get_guest_coding_submission(repeat('c',64),current_setting('t.guest_coding_id')::uuid) IS NULL,true,'different guest cannot read result');
select t.throws($q$select public.start_guest_coding_submission(repeat('a',64),repeat('b',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047','python','print(1)','submit')$q$,'23514','one in-flight job per guest');
select set_config('t.guest_job',public.claim_coding_job()::text,true);
select t.eq(public.finish_coding_job(current_setting('t.guest_coding_id')::uuid,(current_setting('t.guest_job')::jsonb->>'lease')::uuid,'accepted',3,'[]'),true,'worker finishes anonymous job');
select t.eq((select count(*) from public.practice_attempts where question_id='935a88eb-af88-5cc8-8957-f68ba9ae6047'),0::bigint,'guest jobs do not create a student practice row');
-- Same guest can perform a limited number of jobs after previous runs finish.
do $$ declare i integer; j uuid; v jsonb; begin
 for i in 1..5 loop
  j:=public.start_guest_coding_submission(repeat('a',64),repeat('b',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047','python','print(1)','run');
  v:=public.claim_coding_job();
  if (v->>'id')::uuid IS DISTINCT FROM j then raise exception 'unexpected claimed coding job'; end if;
  if not public.finish_coding_job(j,(v->>'lease')::uuid,'accepted',1,'[]') then raise exception 'could not finish guest run'; end if;
 end loop;
end $$;
select t.throws($q$select public.start_guest_coding_submission(repeat('a',64),repeat('b',64),'935a88eb-af88-5cc8-8957-f68ba9ae6047','python','print(1)','run')$q$,'23514','six-per-hour guest quota enforced');
reset role;
set local role anon;
select t.throws($q$select * from public.coding_submissions$q$,'42501','anonymous visitors cannot read submission table');
select t.throws($q$select * from public.coding_jobs$q$,'42501','anonymous visitors cannot inspect hidden coding tests');
reset role;
rollback;

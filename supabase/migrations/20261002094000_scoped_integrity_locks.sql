-- Scope integrity locks to the affected visitor, user, questions and tests.
-- CREATE OR REPLACE preserves the existing RPC and trigger grants.

create or replace function public.guard_used_test_content() returns trigger
language plpgsql security definer set search_path='' as $$
declare qids uuid[]:='{}'; tids uuid[]:='{}'; lock_id uuid; unchanged boolean:=false;
begin
 if tg_table_name='questions' then
  qids:=array[old.id];
  unchanged:=tg_op='UPDATE' and (new.question_text,new.question_type,new.correct_answer,new.explanation,new.category_id,new.difficulty)
    is not distinct from (old.question_text,old.question_type,old.correct_answer,old.explanation,old.category_id,old.difficulty);
 elsif tg_table_name='question_options' then
  if tg_op<>'INSERT' then qids:=array_append(qids,old.question_id); end if;
  if tg_op<>'DELETE' then qids:=array_append(qids,new.question_id); end if;
 elsif tg_table_name='test_questions' then
  if tg_op<>'INSERT' then qids:=array_append(qids,old.question_id);tids:=array_append(tids,old.test_id); end if;
  if tg_op<>'DELETE' then qids:=array_append(qids,new.question_id);tids:=array_append(tids,new.test_id); end if;
 elsif tg_table_name='mock_tests' then
  tids:=array[old.id];
  unchanged:=tg_op='UPDATE' and (new.company_id,new.duration_minutes,new.difficulty) is not distinct from (old.company_id,old.duration_minutes,old.difficulty);
 end if;
 -- Membership edits and question/option edits share question locks, so the set
 -- of affected tests cannot change while it is being collected. Starts need
 -- only their test lock. Always acquire question IDs, then test IDs, sorted.
 for lock_id in select distinct id from unnest(qids) id where id is not null order by id loop
  perform pg_advisory_xact_lock(hashtextextended('pw:question:' || lock_id::text,0));
 end loop;
 for lock_id in select id from (
  select unnest(tids) id union select tq.test_id from public.test_questions tq where tq.question_id=any(qids)
 ) affected where id is not null order by id loop
  perform pg_advisory_xact_lock(hashtextextended('pw:test:' || lock_id::text,0));
 end loop;
 if unchanged then return new; end if;
 if exists(select 1 from public.test_attempts a where a.test_id=any(tids))
 or exists(select 1 from public.test_questions tq join public.test_attempts a on a.test_id=tq.test_id where tq.question_id=any(qids)) then
  -- For membership-only edits, history in another test does not freeze this test.
  if tg_table_name<>'test_questions' or exists(select 1 from public.test_attempts a where a.test_id=any(tids)) then
   raise exception 'This content is used in test history. Create a new version; archive the old content if needed.' using errcode='23514';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;

create or replace function public.guard_attempt_start() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.user_id is not null then perform pg_advisory_xact_lock(hashtextextended('pw:user:' || new.user_id::text,0)); end if;
 perform pg_advisory_xact_lock(hashtextextended('pw:test:' || new.test_id::text,0));
 if new.user_id is not null and not exists(select 1 from public.profiles where id=new.user_id and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
 if exists(select 1 from public.mock_tests t join public.companies c on c.id=t.company_id where t.id=new.test_id and c.status<>'published') then
  raise exception 'Company preparation is unavailable' using errcode='23514';
 end if;
 if exists(select 1 from public.test_questions tq join public.questions q on q.id=tq.question_id where tq.test_id=new.test_id and (q.status<>'published' or q.question_type<>'mcq')) then
  raise exception 'Timed mocks require published multiple-choice questions' using errcode='23514';
 end if;
 if (select count(*) from public.test_attempts where user_id=new.user_id and started_at>now()-interval '1 hour')>=30 then
  raise exception 'Too many test starts. Try again later.' using errcode='23514';
 end if;
 return new;
end $$;

create or replace function public.start_test_attempt(p_test_id uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_active  boolean;
  v_attempt public.test_attempts;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select is_active into v_active from public.profiles where id = v_uid;
  if v_active is not true then
    raise exception 'Account is not active' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pw:user:' || v_uid::text,0));
  perform pg_advisory_xact_lock(hashtextextended('pw:test:' || p_test_id::text,0));
  if exists(select 1 from public.mock_tests where id=p_test_id and status<>'published') then raise exception 'Test is not available' using errcode='23514'; end if;
  if exists(select 1 from public.mock_tests where id=p_test_id and not is_free) and not public.has_content_access(p_test_id,null) then
    raise exception 'Premium access required' using errcode='42501';
  end if;

  -- The user lock also serializes this start against practice submissions.

  select * into v_attempt
  from public.test_attempts
  where user_id = v_uid and test_id = p_test_id and status = 'in_progress'
  for update;

  if found then
    if now() <= v_attempt.expires_at + public.attempt_grace() then
      return v_attempt.id; -- resume the running attempt
    end if;
    perform public.finalize_attempt(v_attempt.id, 'expired', v_attempt.expires_at);
  end if;

  if (select count(*) from public.test_attempts where user_id=v_uid and test_id=p_test_id) >= (select authenticated_attempt_limit from public.mock_tests where id=p_test_id) then raise exception 'You have reached the attempt limit for this mock.' using errcode='23514'; end if;

  if not exists (select 1 from public.test_questions where test_id = p_test_id) then
    raise exception 'This test has no questions yet' using errcode = '23514';
  end if;

  -- A trigger rejects unpublished tests and sets the server-side deadline.
  insert into public.test_attempts (user_id, test_id) values (v_uid, p_test_id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.guest_mock_gateway(
 p_operation text, p_token_hash text, p_test_id uuid default null,
 p_attempt_id uuid default null, p_network_hash text default null,
 p_question_id uuid default null, p_selected text default null,
 p_marked boolean default false, p_answers jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.guest_mock_sessions; a public.test_attempts; t public.mock_tests; s public.site_settings; v_id uuid; n integer;
begin
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid session' using errcode='22023'; end if;
 perform set_config('placementways.guest_hash',p_token_hash,true);
 if p_operation in ('start','access') then
  -- One token shares its allowance across mocks; unrelated visitors do not block it.
  perform pg_advisory_xact_lock(hashtextextended('pw:guest:' || p_token_hash,0));
  perform pg_advisory_xact_lock(hashtextextended('pw:test:' || p_test_id::text,0));
  select * into t from public.mock_tests where id=p_test_id and status='published';
  if not found then return jsonb_build_object('decision','unavailable'); end if;
  if not t.is_free or t.access_type='PREMIUM' then return jsonb_build_object('decision','premium'); end if;
  select * into s from public.site_settings where id=true;
  if s.guest_mock_enabled is not true or not t.guest_attempt_allowed or t.access_type='LOGIN_REQUIRED' then
   return jsonb_build_object('decision','login'); end if;
  select * into g from public.guest_mock_sessions where token_hash=p_token_hash and expires_at>now();
  if g.id is not null then
   select * into a from public.test_attempts where guest_id=g.id and user_id is null and test_id=p_test_id and status='in_progress' for update;
   if found and now() <= a.expires_at+public.attempt_grace() then return jsonb_build_object('decision','allow','attempt_id',a.id); end if;
   if a.id is not null then perform public.finalize_attempt(a.id,'expired',a.expires_at); end if;
  end if;
  -- Starts reserve quota immediately, preventing parallel mocks or abandoned-test resets.
  if (select count(*) from public.test_attempts where guest_id=g.id)>=s.guest_mock_limit
   or (select count(*) from public.test_attempts where guest_id=g.id and test_id=p_test_id)>=t.guest_attempt_limit
   or s.guest_mock_limit=0 or t.guest_attempt_limit=0 then return jsonb_build_object('decision','login'); end if;
  if p_operation='access' then return jsonb_build_object('decision','allow'); end if;
  if p_network_hash is null or p_network_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid rate key' using errcode='22023'; end if;
  delete from public.guest_mock_rate_limits where expires_at<now();
  insert into public.guest_mock_rate_limits(network_hash) values(p_network_hash) on conflict do nothing;
  select starts into n from public.guest_mock_rate_limits where network_hash=p_network_hash for update;
  if n>=s.guest_network_daily_limit then return jsonb_build_object('decision','rate_limited'); end if;
  if not exists(select 1 from public.test_questions where test_id=p_test_id) then return jsonb_build_object('decision','unavailable'); end if;
  if g.id is null then
   -- Expired tokens cannot silently regain quota: only the server can issue another token.
   if exists(select 1 from public.guest_mock_sessions where token_hash=p_token_hash) then return jsonb_build_object('decision','login'); end if;
   insert into public.guest_mock_sessions(token_hash) values(p_token_hash) returning * into g;
  end if;
  insert into public.test_attempts(guest_id,test_id) values(g.id,p_test_id) returning id into v_id;
  update public.guest_mock_rate_limits set starts=starts+1 where network_hash=p_network_hash;
  return jsonb_build_object('decision','allow','attempt_id',v_id);
 end if;
 if not exists(select 1 from public.test_attempts where id=p_attempt_id and public.owns_attempt(test_attempts)) then return null; end if;
 case p_operation
 when 'state' then return public.get_attempt_state_internal(p_attempt_id);
 when 'result' then return public.get_attempt_result_internal(p_attempt_id);
 when 'save' then return to_jsonb(public.save_attempt_answer_internal(p_attempt_id,p_question_id,p_selected,p_marked));
 when 'submit' then
  if p_answers is not null and (jsonb_typeof(p_answers)<>'array' or octet_length(p_answers::text)>200000) then raise exception 'Invalid answers' using errcode='22023'; end if;
  return to_jsonb(public.submit_attempt_internal(p_attempt_id,p_answers));
 else raise exception 'Invalid operation' using errcode='22023';
 end case;
end $$;

-- Prevent new practice answers from disclosing an active mock solution.
create or replace function public.submit_practice(p_question_id uuid,p_answer text) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.questions; result uuid;
begin
 -- Acquire the same user lock as start_test_attempt BEFORE the profile row.
 perform pg_advisory_xact_lock(hashtextextended('pw:user:' || auth.uid()::text,0));
 -- Lock the profile to serialize the per-account rate check.
 perform 1 from public.profiles where id=auth.uid() and is_active for update;
 if not found then raise exception 'Active account required' using errcode='42501'; end if;
 if (select count(*) from public.practice_attempts where user_id=auth.uid() and created_at>now()-interval '1 minute')>=20 then
  raise exception 'Please wait a minute before another submission' using errcode='P0001';
 end if;
 select * into q from public.questions where id=p_question_id and status='published' and is_practice;
 if not found then raise exception 'Practice unavailable' using errcode='42501'; end if;
 -- The same question may appear in practice and a timed mock. Do not reveal
 -- its solution through a new practice submission while that mock is running.
 if exists(select 1 from public.test_attempts a join public.test_questions tq on tq.test_id=a.test_id
   where a.user_id=auth.uid() and a.status='in_progress' and now()<=a.expires_at+public.attempt_grace() and tq.question_id=q.id) then
  raise exception 'Finish your active mock before practising this question' using errcode='23514';
 end if;
 if p_answer is null or char_length(trim(p_answer)) not between 1 and 20000 then raise exception 'Answer required' using errcode='22023'; end if;
 if q.question_type='mcq' and not exists(select 1 from public.question_options where question_id=q.id and option_key=p_answer) then
  raise exception 'Invalid option' using errcode='22023';
 end if;
 insert into public.practice_attempts(user_id,question_id,category_id,difficulty,selected_answer,is_correct,explanation,correct_answer)
 values(auth.uid(),q.id,q.category_id,q.difficulty,p_answer,case when q.question_type='mcq' then q.correct_answer=p_answer else null end,q.explanation,q.correct_answer)
 returning id into result;
 return result;
end $$;


create or replace view public.published_mock_tests
with (security_invoker = false) as
select
  t.id,
  t.company_id,
  t.title,
  t.slug,
  t.description,
  t.duration_minutes,
  t.difficulty,
  t.is_free,
  t.created_at,
  (select count(*)::int from public.test_questions tq where tq.test_id = t.id)              as question_count,
  (select coalesce(sum(tq.marks), 0) from public.test_questions tq where tq.test_id = t.id) as total_marks,
  (select count(*)::int from public.test_attempts a where a.test_id = t.id)                 as attempt_count,
  exists (select 1 from public.test_questions tq
          where tq.test_id = t.id and tq.negative_marks > 0)                                as has_negative_marking
from public.mock_tests t
where t.status = 'published'
 and (t.company_id is null or exists(select 1 from public.companies c where c.id=t.company_id and c.status='published'));

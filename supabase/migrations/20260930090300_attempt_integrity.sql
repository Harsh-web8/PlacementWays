-- A question/test definition used by a student is immutable. Archive it and
-- create a new version to edit; results and running attempts retain their facts.
create function public.guard_used_test_content() returns trigger
language plpgsql security definer set search_path='' as $$
declare used boolean:=false; qid uuid; tid uuid;
begin
 perform pg_advisory_xact_lock(73501901);
 if tg_table_name='questions' then
  if tg_op='UPDATE' and (new.question_text,new.question_type,new.correct_answer,new.explanation,new.category_id,new.difficulty)
    is not distinct from (old.question_text,old.question_type,old.correct_answer,old.explanation,old.category_id,old.difficulty) then return new; end if;
  qid:=old.id;
 elsif tg_table_name='question_options' then
  qid:=case when tg_op='INSERT' then new.question_id else old.question_id end;
 elsif tg_table_name='test_questions' then
  tid:=case when tg_op='INSERT' then new.test_id else old.test_id end;
  used:=exists(select 1 from public.test_attempts where test_id=tid);
  if tg_op='UPDATE' then used:=used or exists(select 1 from public.test_attempts where test_id=new.test_id); end if;
 elsif tg_table_name='mock_tests' then
  if tg_op='UPDATE' and (new.company_id,new.duration_minutes,new.difficulty) is not distinct from (old.company_id,old.duration_minutes,old.difficulty) then return new; end if;
  tid:=old.id;
  used:=exists(select 1 from public.test_attempts where test_id=tid);
 end if;
 if qid is not null then
  used:=exists(select 1 from public.test_questions tq join public.test_attempts a on a.test_id=tq.test_id where tq.question_id=qid);
  if tg_table_name='question_options' and tg_op='UPDATE' then
   used:=used or exists(select 1 from public.test_questions tq join public.test_attempts a on a.test_id=tq.test_id where tq.question_id=new.question_id);
  end if;
 end if;
 if used then raise exception 'This content is used in test history. Create a new version; archive the old content if needed.' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if;return new;
end $$;
revoke all on function public.guard_used_test_content() from public,anon,authenticated;
create trigger questions_history_guard before update or delete on public.questions for each row execute function public.guard_used_test_content();
create trigger options_history_guard before insert or update or delete on public.question_options for each row execute function public.guard_used_test_content();
create trigger test_questions_history_guard before insert or update or delete on public.test_questions for each row execute function public.guard_used_test_content();
create trigger tests_history_guard before update or delete on public.mock_tests for each row execute function public.guard_used_test_content();

create function public.guard_attempt_start() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(73501901);
 if not exists(select 1 from public.profiles where id=new.user_id and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
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
revoke all on function public.guard_attempt_start() from public,anon,authenticated;
create trigger attempt_start_integrity before insert on public.test_attempts for each row execute function public.guard_attempt_start();

-- Check activity at the RPC boundary even when a suspended user still has a JWT.
-- Wrappers preserve the existing result/expiry contracts and underlying grants.
alter function public.get_attempt_state(uuid) rename to get_attempt_state_internal;
alter function public.get_attempt_result(uuid) rename to get_attempt_result_internal;
alter function public.save_attempt_answer(uuid,uuid,text,boolean) rename to save_attempt_answer_internal;
alter function public.submit_attempt(uuid,jsonb) rename to submit_attempt_internal;
revoke all on function public.get_attempt_state_internal(uuid),public.get_attempt_result_internal(uuid),public.save_attempt_answer_internal(uuid,uuid,text,boolean),public.submit_attempt_internal(uuid,jsonb) from public,anon,authenticated;
create function public.get_attempt_state(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
 return public.get_attempt_state_internal(p_attempt_id);end $$;
create function public.get_attempt_result(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
 return public.get_attempt_result_internal(p_attempt_id);end $$;
create function public.save_attempt_answer(p_attempt_id uuid,p_question_id uuid,p_selected text,p_marked boolean) returns text language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
 return public.save_attempt_answer_internal(p_attempt_id,p_question_id,p_selected,p_marked);end $$;
create function public.submit_attempt(p_attempt_id uuid,p_answers jsonb default null) returns text language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.profiles where id=auth.uid() and is_active) then raise exception 'Active account required' using errcode='42501'; end if;
 if p_answers is not null and (jsonb_typeof(p_answers)<>'array' or octet_length(p_answers::text)>200000) then raise exception 'Invalid answer payload' using errcode='22023'; end if;
 return public.submit_attempt_internal(p_attempt_id,p_answers);end $$;
revoke all on function public.get_attempt_state(uuid),public.get_attempt_result(uuid),public.save_attempt_answer(uuid,uuid,text,boolean),public.submit_attempt(uuid,jsonb) from public,anon;
grant execute on function public.get_attempt_state(uuid),public.get_attempt_result(uuid),public.save_attempt_answer(uuid,uuid,text,boolean),public.submit_attempt(uuid,jsonb) to authenticated;

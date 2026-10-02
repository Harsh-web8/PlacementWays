-- =====================================================================
-- PlacementWays -- Phase 3, migration 3: integrity rules
--
-- These rules live in the database so they hold no matter which code path
-- (admin UI, CSV import, a future script, a bug) writes the data.
--
-- "Publish gates" are DEFERRED constraint triggers: they are checked at
-- COMMIT, so a process/question/test and its children can be created in one
-- transaction in any order (needed for CSV import and admin "save" flows).
-- =====================================================================

-- ---------- publish gate: recruitment process needs a source ---------
create function public.enforce_process_publishable() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_process_id uuid;
begin
  if tg_table_name = 'process_sources' then
    v_process_id := old.recruitment_process_id;
  else
    v_process_id := new.id;
  end if;

  if exists (select 1 from public.recruitment_processes p
             where p.id = v_process_id and p.status = 'published')
     and not exists (select 1 from public.process_sources s
                     where s.recruitment_process_id = v_process_id) then
    raise exception 'A published recruitment process needs at least one source link'
      using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger process_publishable_on_process
  after insert or update of status on public.recruitment_processes
  deferrable initially deferred
  for each row execute function public.enforce_process_publishable();

create constraint trigger process_publishable_on_source
  after delete or update of recruitment_process_id on public.process_sources
  deferrable initially deferred
  for each row execute function public.enforce_process_publishable();

-- ---------- publish gate: MCQ needs at least two options -------------
create function public.enforce_question_publishable() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_question_id uuid;
begin
  if tg_table_name = 'question_options' then
    v_question_id := old.question_id;
  else
    v_question_id := new.id;
  end if;

  if exists (select 1 from public.questions q
             where q.id = v_question_id
               and q.status = 'published'
               and q.question_type = 'mcq')
     and (select count(*) from public.question_options o
          where o.question_id = v_question_id) < 2 then
    raise exception 'A published multiple-choice question needs at least two options'
      using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger question_publishable_on_question
  after insert or update of status, question_type on public.questions
  deferrable initially deferred
  for each row execute function public.enforce_question_publishable();

create constraint trigger question_publishable_on_option
  after delete or update of question_id on public.question_options
  deferrable initially deferred
  for each row execute function public.enforce_question_publishable();

-- ---------- publish gate: a test needs at least one question ---------
create function public.enforce_test_publishable() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_test_id uuid;
begin
  if tg_table_name = 'test_questions' then
    v_test_id := old.test_id;
  else
    v_test_id := new.id;
  end if;

  if exists (select 1 from public.mock_tests t
             where t.id = v_test_id and t.status = 'published')
     and not exists (select 1 from public.test_questions tq
                     where tq.test_id = v_test_id) then
    raise exception 'A published mock test needs at least one question'
      using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger test_publishable_on_test
  after insert or update of status on public.mock_tests
  deferrable initially deferred
  for each row execute function public.enforce_test_publishable();

create constraint trigger test_publishable_on_question
  after delete or update of test_id on public.test_questions
  deferrable initially deferred
  for each row execute function public.enforce_test_publishable();

-- ---------- attempts: server-authoritative deadline ------------------
create function public.test_attempts_before_insert() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_duration integer;
  v_status   public.content_status;
begin
  select t.duration_minutes, t.status into v_duration, v_status
  from public.mock_tests t where t.id = new.test_id;

  if v_status is distinct from 'published' then
    raise exception 'Test is not available' using errcode = '23514';
  end if;

  -- Whatever the caller sent, the deadline is start + configured duration.
  new.started_at := now();
  new.expires_at := new.started_at + make_interval(mins => v_duration);
  return new;
end
$$;

create trigger test_attempts_before_insert
  before insert on public.test_attempts
  for each row execute function public.test_attempts_before_insert();

-- ---------- attempts: a finished attempt is frozen ------------------
-- Prevents double submission and any after-the-fact score tampering, even
-- from privileged (service-role) code.
create function public.test_attempts_before_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'in_progress' then
    raise exception 'This attempt has already been finalised' using errcode = '55000';
  end if;

  if new.user_id     is distinct from old.user_id
  or new.test_id     is distinct from old.test_id
  or new.started_at  is distinct from old.started_at
  or new.expires_at  is distinct from old.expires_at then
    raise exception 'Attempt identity and deadline are immutable' using errcode = '55000';
  end if;
  return new;
end
$$;

create trigger test_attempts_before_update
  before update on public.test_attempts
  for each row execute function public.test_attempts_before_update();

-- ---------- answers: must belong to an ACTIVE attempt of that test ---
create function public.attempt_answers_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status  public.attempt_status;
  v_test_id uuid;
begin
  select a.status, a.test_id into v_status, v_test_id
  from public.test_attempts a where a.id = new.attempt_id;

  if v_status is distinct from 'in_progress' then
    raise exception 'Answers can only be changed while the attempt is in progress'
      using errcode = '55000';
  end if;

  if not exists (select 1 from public.test_questions tq
                 where tq.test_id = v_test_id and tq.question_id = new.question_id) then
    raise exception 'Question does not belong to this test' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger attempt_answers_guard
  before insert or update on public.attempt_answers
  for each row execute function public.attempt_answers_guard();

-- ---------- audit log: append-only ----------------------------------
-- The only permitted change is ON DELETE SET NULL of actor_id when a profile
-- is removed (so deleting a user account is still possible).
create function public.audit_logs_immutable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.actor_id is null
     and (old.id, old.action, old.entity_type, old.entity_id, old.metadata, old.created_at)
         is not distinct from
         (new.id, new.action, new.entity_type, new.entity_id, new.metadata, new.created_at) then
    return new;
  end if;
  raise exception 'audit_logs is append-only' using errcode = '55000';
end
$$;

create trigger audit_logs_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

create function public.audit_logs_no_truncate() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '55000';
end
$$;

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_no_truncate();

-- None of these trigger functions should be callable through the API.
revoke all on function public.enforce_process_publishable()  from public, anon, authenticated;
revoke all on function public.enforce_question_publishable() from public, anon, authenticated;
revoke all on function public.enforce_test_publishable()     from public, anon, authenticated;
revoke all on function public.test_attempts_before_insert()  from public, anon, authenticated;
revoke all on function public.test_attempts_before_update()  from public, anon, authenticated;
revoke all on function public.attempt_answers_guard()        from public, anon, authenticated;
revoke all on function public.audit_logs_immutable()         from public, anon, authenticated;
revoke all on function public.audit_logs_no_truncate()       from public, anon, authenticated;

-- =====================================================================
-- PlacementWays -- Phase 6: the student test experience, server side
--
-- Students have READ-ONLY access to attempts/answers and NO access to the
-- question bank (migration 4), on purpose: every correct answer lives in
-- `questions`. So everything a student does during a test goes through the
-- functions below.
--
-- Why SECURITY DEFINER functions rather than the service-role key in the
-- app: the app keeps using the public (anon) key everywhere, so there is no
-- all-powerful secret to leak, and each function derives the user from
-- auth.uid() itself -- a caller can never act as someone else by passing an
-- id. Each function has `search_path = ''` (no schema-hijacking) and is
-- granted to `authenticated` only.
--
-- Time is enforced HERE, not in the browser: the deadline is
-- test_attempts.expires_at (set by a trigger). A small grace period
-- (attempt_grace) absorbs network latency around the auto-submit at 0:00.
-- =====================================================================

-- ---------- listing view: also expose "is there negative marking?" ---
-- (added at the END so CREATE OR REPLACE VIEW is allowed)
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
where t.status = 'published';

-- ---------- constants ------------------------------------------------
create function public.attempt_grace() returns interval
language sql immutable
as $$ select interval '15 seconds' $$;

-- ---------- internal: save (or clear) one answer ---------------------
-- Selecting nothing AND not marking for review removes the row entirely.
create function public.upsert_attempt_answer(
  p_attempt_id uuid, p_question_id uuid, p_selected text, p_marked boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_selected is null and not coalesce(p_marked, false) then
    delete from public.attempt_answers
    where attempt_id = p_attempt_id and question_id = p_question_id;
    return;
  end if;

  insert into public.attempt_answers (attempt_id, question_id, selected_answer, marked_for_review)
  values (p_attempt_id, p_question_id, p_selected, coalesce(p_marked, false))
  on conflict (attempt_id, question_id) do update
    set selected_answer = excluded.selected_answer,
        marked_for_review = excluded.marked_for_review,
        answered_at = now();
end;
$$;

-- ---------- internal: score and freeze an attempt --------------------
-- Scoring uses the TEST's own marks/negative marks (a snapshot taken when
-- the question was added), never the question bank's current values.
create function public.finalize_attempt(
  p_attempt_id uuid, p_status public.attempt_status, p_submitted_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test_id uuid;
  v_started timestamptz;
  v_expires timestamptz;
  v_score   numeric;
  v_total   numeric;
  v_used    integer;
begin
  select test_id, started_at, expires_at into v_test_id, v_started, v_expires
  from public.test_attempts
  where id = p_attempt_id and status = 'in_progress'
  for update;

  if not found then
    return; -- already finalised: nothing to do (keeps callers idempotent)
  end if;

  -- One row per question, so the result page can show every question.
  insert into public.attempt_answers (attempt_id, question_id)
  select p_attempt_id, tq.question_id from public.test_questions tq where tq.test_id = v_test_id
  on conflict (attempt_id, question_id) do nothing;

  update public.attempt_answers aa
  set is_correct = case when aa.selected_answer is null then null
                        else aa.selected_answer = q.correct_answer end,
      marks_awarded = case when aa.selected_answer is null then 0
                           when aa.selected_answer = q.correct_answer then tq.marks
                           else - tq.negative_marks end
  from public.test_questions tq
  join public.questions q on q.id = tq.question_id
  where aa.attempt_id = p_attempt_id
    and tq.test_id = v_test_id
    and tq.question_id = aa.question_id;

  select coalesce(sum(marks_awarded), 0) into v_score
  from public.attempt_answers where attempt_id = p_attempt_id;
  select coalesce(sum(marks), 0) into v_total
  from public.test_questions where test_id = v_test_id;

  v_used := greatest(0, least(
    extract(epoch from (p_submitted_at - v_started))::integer,
    extract(epoch from (v_expires - v_started))::integer));

  update public.test_attempts
  set status = p_status,
      submitted_at = p_submitted_at,
      score = v_score,
      total_marks = v_total,
      time_used_seconds = v_used
  where id = p_attempt_id;
end;
$$;

-- ---------- start (idempotent) ---------------------------------------
create function public.start_test_attempt(p_test_id uuid) returns uuid
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

  -- Serialise concurrent "start" clicks / tabs for the same student + test.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_test_id::text, 0));

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

  if not exists (select 1 from public.test_questions where test_id = p_test_id) then
    raise exception 'This test has no questions yet' using errcode = '23514';
  end if;

  -- A trigger rejects unpublished tests and sets the server-side deadline.
  insert into public.test_attempts (user_id, test_id) values (v_uid, p_test_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- save one answer ------------------------------------------
-- Returns 'saved', or 'closed' if the attempt is over (submitted or out of time).
create function public.save_attempt_answer(
  p_attempt_id uuid, p_question_id uuid, p_selected text, p_marked boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.test_attempts;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.test_attempts
  where id = p_attempt_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;
  if v_attempt.status <> 'in_progress' then
    return 'closed';
  end if;
  if now() > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    return 'closed';
  end if;

  -- A trigger rejects questions that aren't in this test; a foreign key
  -- rejects an option key that isn't one of the question's options.
  perform public.upsert_attempt_answer(p_attempt_id, p_question_id, p_selected, p_marked);
  return 'saved';
end;
$$;

-- ---------- submit (idempotent) --------------------------------------
-- p_answers optionally carries the client's FULL answer map
-- [{"question_id":..,"selected_answer":..,"marked_for_review":..}] so that a
-- save lost to a network blip can't cost the student an answer. Entries that
-- no longer make sense (e.g. an admin removed the question mid-test) are
-- skipped rather than blocking the submission.
-- Returns the final status: 'submitted' or 'expired'.
create function public.submit_attempt(p_attempt_id uuid, p_answers jsonb default null) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.test_attempts;
  v_now     timestamptz := now();
  v_item    jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.test_attempts
  where id = p_attempt_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  -- Submitting twice is harmless: report what already happened.
  if v_attempt.status <> 'in_progress' then
    return v_attempt.status::text;
  end if;

  if v_now > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    return 'expired';
  end if;

  if jsonb_typeof(p_answers) = 'array' then
    for v_item in select * from jsonb_array_elements(p_answers)
    loop
      begin
        perform public.upsert_attempt_answer(
          p_attempt_id,
          (v_item->>'question_id')::uuid,
          nullif(v_item->>'selected_answer', ''),
          coalesce((v_item->>'marked_for_review')::boolean, false)
        );
      exception
        when foreign_key_violation or check_violation or invalid_text_representation then
          null; -- skip a stale/invalid entry; the rest of the answers still count
      end;
    end loop;
  end if;

  perform public.finalize_attempt(p_attempt_id, 'submitted', v_now);
  return 'submitted';
end;
$$;

-- ---------- read: what the test-taking screen needs ------------------
-- NEVER includes correct_answer or explanation. Returns null if the
-- attempt doesn't exist or isn't the caller's. Questions/answers are only
-- included while the attempt is in progress.
create function public.get_attempt_state(p_attempt_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.test_attempts;
  v_test    public.mock_tests;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_attempt from public.test_attempts where id = p_attempt_id and user_id = v_uid;
  if not found then
    return null;
  end if;

  if v_attempt.status = 'in_progress' and now() > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    select * into v_attempt from public.test_attempts where id = p_attempt_id;
  end if;

  select * into v_test from public.mock_tests where id = v_attempt.test_id;

  v_result := jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'status', v_attempt.status,
      'started_at', v_attempt.started_at,
      'expires_at', v_attempt.expires_at,
      'server_now', now()
    ),
    'test', jsonb_build_object(
      'id', v_test.id,
      'title', v_test.title,
      'slug', v_test.slug,
      'instructions', v_test.instructions,
      'duration_minutes', v_test.duration_minutes
    )
  );

  if v_attempt.status = 'in_progress' then
    v_result := v_result || jsonb_build_object(
      'questions', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'order', tq.question_order,
            'type', q.question_type,
            'text', q.question_text,
            'marks', tq.marks,
            'negative_marks', tq.negative_marks,
            'options', (
              select coalesce(jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.option_text)
                                        order by o.option_key), '[]'::jsonb)
              from public.question_options o where o.question_id = q.id
            )
          ) order by tq.question_order
        ), '[]'::jsonb)
        from public.test_questions tq
        join public.questions q on q.id = tq.question_id
        where tq.test_id = v_attempt.test_id
      ),
      'answers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'question_id', aa.question_id,
          'selected_answer', aa.selected_answer,
          'marked_for_review', aa.marked_for_review
        )), '[]'::jsonb)
        from public.attempt_answers aa where aa.attempt_id = p_attempt_id
      )
    );
  end if;

  return v_result;
end;
$$;

-- ---------- read: the result (only after the attempt is over) --------
-- Returns null for someone else's attempt OR one that's still running, so
-- correct answers and explanations can't be read early.
create function public.get_attempt_result(p_attempt_id uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.test_attempts;
  v_test    public.mock_tests;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_attempt from public.test_attempts where id = p_attempt_id and user_id = v_uid;
  if not found then
    return null;
  end if;

  if v_attempt.status = 'in_progress' and now() > v_attempt.expires_at + public.attempt_grace() then
    perform public.finalize_attempt(p_attempt_id, 'expired', v_attempt.expires_at);
    select * into v_attempt from public.test_attempts where id = p_attempt_id;
  end if;

  if v_attempt.status = 'in_progress' then
    return null;
  end if;

  select * into v_test from public.mock_tests where id = v_attempt.test_id;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'status', v_attempt.status,
      'started_at', v_attempt.started_at,
      'submitted_at', v_attempt.submitted_at,
      'score', v_attempt.score,
      'total_marks', v_attempt.total_marks,
      'time_used_seconds', v_attempt.time_used_seconds
    ),
    'test', jsonb_build_object(
      'id', v_test.id, 'title', v_test.title, 'slug', v_test.slug,
      'duration_minutes', v_test.duration_minutes
    ),
    'summary', (
      select jsonb_build_object(
        'question_count', count(*),
        'correct',    count(*) filter (where aa.is_correct is true),
        'incorrect',  count(*) filter (where aa.is_correct is false),
        'unanswered', count(*) filter (where aa.selected_answer is null)
      )
      from public.attempt_answers aa where aa.attempt_id = p_attempt_id
    ),
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'order', tq.question_order,
          'type', q.question_type,
          'text', q.question_text,
          'difficulty', q.difficulty,
          'category_id', q.category_id,
          'category_name', c.name,
          'explanation', q.explanation,
          'correct_answer', q.correct_answer,
          'selected_answer', aa.selected_answer,
          'is_correct', aa.is_correct,
          'marks_awarded', aa.marks_awarded,
          'marked_for_review', aa.marked_for_review,
          'marks', tq.marks,
          'negative_marks', tq.negative_marks,
          'options', (
            select coalesce(jsonb_agg(jsonb_build_object('key', o.option_key, 'text', o.option_text)
                                      order by o.option_key), '[]'::jsonb)
            from public.question_options o where o.question_id = q.id
          )
        ) order by tq.question_order nulls last
      ), '[]'::jsonb)
      from public.attempt_answers aa
      join public.questions q on q.id = aa.question_id
      join public.categories c on c.id = q.category_id
      left join public.test_questions tq on tq.test_id = v_attempt.test_id and tq.question_id = aa.question_id
      where aa.attempt_id = p_attempt_id
    )
  );
end;
$$;

-- ---------- privileges -----------------------------------------------
-- Internal helpers: not callable by any API role (only by the functions above).
revoke all on function public.attempt_grace() from public, anon, authenticated;
revoke all on function public.upsert_attempt_answer(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.finalize_attempt(uuid, public.attempt_status, timestamptz) from public, anon, authenticated;

-- Public surface: signed-in users only.
revoke all on function public.start_test_attempt(uuid) from public, anon;
revoke all on function public.save_attempt_answer(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.submit_attempt(uuid, jsonb) from public, anon;
revoke all on function public.get_attempt_state(uuid) from public, anon;
revoke all on function public.get_attempt_result(uuid) from public, anon;
grant execute on function public.start_test_attempt(uuid) to authenticated;
grant execute on function public.save_attempt_answer(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.submit_attempt(uuid, jsonb) to authenticated;
grant execute on function public.get_attempt_state(uuid) to authenticated;
grant execute on function public.get_attempt_result(uuid) to authenticated;

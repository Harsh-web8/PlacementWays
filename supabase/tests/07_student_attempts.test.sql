-- Student test-taking functions (migration 20260927090000).
begin;

-- ---------- fixtures (as superuser) ---------------------------------
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'attempt-s1@example.com'),
  ('a2222222-2222-2222-2222-222222222222', 'attempt-s2@example.com');

insert into public.mock_tests (id, title, slug, duration_minutes, status)
values ('70000000-0000-0000-0000-000000000001', 'Attempt fixture', 'attempt-fixture', 30, 'published');
insert into public.mock_tests (id, title, slug, duration_minutes, status)
values ('70000000-0000-0000-0000-000000000002', 'Draft fixture', 'draft-fixture', 30, 'draft');

insert into public.questions (id, category_id, question_type, question_text, difficulty, explanation, correct_answer, marks, negative_marks, status)
select q.id, c.id, 'mcq', q.text, 'easy', q.expl, q.answer, q.marks, q.neg, 'published'
from public.categories c,
  (values
    ('71000000-0000-0000-0000-000000000001'::uuid, 'Q1', 'because A', 'A', 2::numeric, 0.5::numeric),
    ('71000000-0000-0000-0000-000000000002'::uuid, 'Q2', 'because B', 'B', 2::numeric, 0.5::numeric),
    ('71000000-0000-0000-0000-000000000003'::uuid, 'Q3', 'because C', 'C', 1::numeric, 0::numeric),
    ('71000000-0000-0000-0000-000000000004'::uuid, 'Q4 (not in the test)', 'because A', 'A', 1::numeric, 0::numeric)
  ) as q(id, text, expl, answer, marks, neg)
where c.slug = 'aptitude';

insert into public.question_options (question_id, option_key, option_text)
select q, k, 'option ' || k
from unnest(array[
  '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000003', '71000000-0000-0000-0000-000000000004'
]::uuid[]) as q, unnest(array['A', 'B', 'C']) as k;

insert into public.test_questions (test_id, question_id, question_order, marks, negative_marks) values
  ('70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 1, 2, 0.5),
  ('70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 2, 2, 0.5),
  ('70000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 3, 1, 0);

-- ---------- anonymous visitors --------------------------------------
set local role anon;
do $$
begin
  perform t.throws($q$select public.start_test_attempt('70000000-0000-0000-0000-000000000001')$q$, '42501', 'anon cannot start an attempt');
  perform t.eq((select count(*) from public.published_mock_tests where slug = 'attempt-fixture'), 1::bigint, 'the published test is listed');
  perform t.eq((select has_negative_marking from public.published_mock_tests where slug = 'attempt-fixture'), true, 'listing view reports negative marking');
  perform t.eq((select question_count from public.published_mock_tests where slug = 'attempt-fixture'), 3, 'listing view reports the question count');
  perform t.eq((select count(*) from public.published_mock_tests where slug = 'draft-fixture'), 0::bigint, 'a draft test is not listed');
end $$;
reset role;

-- ---------- student 1: the happy path -------------------------------
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_id    uuid;
  v_state jsonb;
begin
  v_id := public.start_test_attempt('70000000-0000-0000-0000-000000000001');
  perform set_config('t.a1', v_id::text, true);
  perform t.eq(public.start_test_attempt('70000000-0000-0000-0000-000000000001'), v_id, 'starting twice resumes the same attempt');

  v_state := public.get_attempt_state(v_id);
  perform t.eq(jsonb_array_length(v_state->'questions'), 3, 'all three questions are served');
  perform t.eq(v_state->'attempt'->>'status', 'in_progress', 'the attempt is in progress');
  perform t.eq(position('correct_answer' in v_state::text), 0, 'the correct answer is NOT sent during the test');
  perform t.eq(position('explanation' in v_state::text), 0, 'explanations are NOT sent during the test');
  perform t.eq(
    (select (v_state->'attempt'->>'expires_at')::timestamptz > (v_state->'attempt'->>'started_at')::timestamptz),
    true, 'a server-side deadline exists');

  perform t.eq(public.save_attempt_answer(v_id, '71000000-0000-0000-0000-000000000001', 'A', false), 'saved', 'save an answer');
  perform public.save_attempt_answer(v_id, '71000000-0000-0000-0000-000000000002', 'C', true);
  perform public.save_attempt_answer(v_id, '71000000-0000-0000-0000-000000000003', 'B', false);
  perform public.save_attempt_answer(v_id, '71000000-0000-0000-0000-000000000003', null, false);
  perform t.eq((select count(*) from public.attempt_answers where attempt_id = v_id), 2::bigint, 'clearing an unmarked answer removes its row');

  perform t.throws(
    format($q$select public.save_attempt_answer(%L, '71000000-0000-0000-0000-000000000004', 'A', false)$q$, v_id),
    '23514', 'a question that is not in this test is rejected');
  perform t.throws(
    format($q$select public.save_attempt_answer(%L, '71000000-0000-0000-0000-000000000001', 'Z', false)$q$, v_id),
    '23503', 'an option that does not exist is rejected');

  perform t.eq(public.get_attempt_result(v_id) is null, true, 'no result (and no answers) while the attempt is running');
end $$;

-- Students can't write, and can't read the question bank.
do $$
begin
  perform t.throws($q$insert into public.test_attempts (user_id, test_id) values ('a1111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000001')$q$, '42501', 'no direct attempt inserts');
  perform t.throws($q$update public.test_attempts set score = 999$q$, '42501', 'no direct score edits');
  perform t.throws($q$insert into public.attempt_answers (attempt_id, question_id) values (gen_random_uuid(), gen_random_uuid())$q$, '42501', 'no direct answer inserts');
  perform t.eq((select count(*) from public.questions), 0::bigint, 'a student cannot read the question bank');
  perform t.eq((select count(*) from public.test_questions), 0::bigint, 'a student cannot read test_questions');
end $$;

-- Unavailable tests.
do $$
begin
  perform t.throws($q$select public.start_test_attempt('70000000-0000-0000-0000-000000000002')$q$, '23514', 'a draft test cannot be started');
end $$;
reset role;

-- ---------- student 2: isolation ------------------------------------
select set_config('request.jwt.claims', '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_a1 uuid := current_setting('t.a1')::uuid;
begin
  perform t.eq(public.get_attempt_state(v_a1) is null, true, 'another student cannot load the attempt');
  perform t.eq(public.get_attempt_result(v_a1) is null, true, 'another student cannot read the result');
  perform t.throws(format($q$select public.save_attempt_answer(%L, '71000000-0000-0000-0000-000000000001', 'A', false)$q$, v_a1), 'P0002', 'another student cannot save answers');
  perform t.throws(format($q$select public.submit_attempt(%L)$q$, v_a1), 'P0002', 'another student cannot submit');
  perform t.eq((select count(*) from public.test_attempts), 0::bigint, 'another student cannot even see the attempt row');
end $$;
reset role;

-- An inactive account cannot start attempts.
update public.profiles set is_active = false where id = 'a2222222-2222-2222-2222-222222222222';
set local role authenticated;
do $$
begin
  perform t.throws($q$select public.start_test_attempt('70000000-0000-0000-0000-000000000001')$q$, '42501', 'a deactivated account cannot start a test');
end $$;
reset role;

-- ---------- student 1: submit and score -----------------------------
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
declare
  v_id     uuid := current_setting('t.a1')::uuid;
  v_status text;
  v_result jsonb;
begin
  -- Full answer map: Q3 is now answered correctly; the Q4 entry is stale and skipped.
  v_status := public.submit_attempt(v_id, jsonb_build_array(
    jsonb_build_object('question_id', '71000000-0000-0000-0000-000000000001', 'selected_answer', 'A', 'marked_for_review', false),
    jsonb_build_object('question_id', '71000000-0000-0000-0000-000000000002', 'selected_answer', 'C', 'marked_for_review', true),
    jsonb_build_object('question_id', '71000000-0000-0000-0000-000000000003', 'selected_answer', 'C', 'marked_for_review', false),
    jsonb_build_object('question_id', '71000000-0000-0000-0000-000000000004', 'selected_answer', 'A', 'marked_for_review', false)
  ));
  perform t.eq(v_status, 'submitted', 'submit succeeds');

  perform t.eq((select score from public.test_attempts where id = v_id), 2.5::numeric, 'score = +2 -0.5 +1, computed on the server');
  perform t.eq((select total_marks from public.test_attempts where id = v_id), 5::numeric, 'total marks come from the test');

  perform t.eq(public.submit_attempt(v_id), 'submitted', 'submitting twice is harmless');
  perform t.eq((select score from public.test_attempts where id = v_id), 2.5::numeric, 'the score is unchanged by a second submit');
  perform t.eq(public.save_attempt_answer(v_id, '71000000-0000-0000-0000-000000000001', 'B', false), 'closed', 'answers cannot change after submission');

  v_result := public.get_attempt_result(v_id);
  perform t.eq((v_result->'summary'->>'correct')::int, 2, 'result: 2 correct');
  perform t.eq((v_result->'summary'->>'incorrect')::int, 1, 'result: 1 incorrect');
  perform t.eq((v_result->'summary'->>'unanswered')::int, 0, 'result: 0 unanswered');
  perform t.eq((v_result->'summary'->>'question_count')::int, 3, 'the stale answer for a non-test question was ignored');
  perform t.eq(position('correct_answer' in v_result::text) > 0, true, 'after submission the correct answers are revealed');
end $$;

-- A finished attempt is frozen, even against a crafted update.
do $$
begin
  perform t.throws($q$update public.test_attempts set score = 999$q$, '42501', 'a finished attempt cannot be edited by the student');
end $$;

-- Premium gating is enforced even when calling the RPC directly.
reset role;
update public.mock_tests set is_free=false where id='70000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
 perform t.throws($q$select public.start_test_attempt('70000000-0000-0000-0000-000000000001')$q$,'42501','premium test cannot be started without verified access');
end $$;
reset role;
update public.mock_tests set is_free=true where id='70000000-0000-0000-0000-000000000001';
set local role authenticated;

-- ---------- expiry --------------------------------------------------
do $$
declare
  v_id uuid;
begin
  v_id := public.start_test_attempt('70000000-0000-0000-0000-000000000001');
  perform set_config('t.a3', v_id::text, true);
  perform public.save_attempt_answer(v_id, '71000000-0000-0000-0000-000000000001', 'A', false);
end $$;
reset role;

-- Pretend the attempt started two hours ago. (The immutability trigger is
-- what stops anyone else doing this, so switch it off just for the fixture.)
alter table public.test_attempts disable trigger test_attempts_before_update;
update public.test_attempts
   set started_at = now() - interval '2 hours', expires_at = now() - interval '90 minutes'
 where id = current_setting('t.a3')::uuid;
alter table public.test_attempts enable trigger test_attempts_before_update;

set local role authenticated;
do $$
declare
  v_id  uuid := current_setting('t.a3')::uuid;
  v_new uuid;
begin
  perform t.eq(public.save_attempt_answer(v_id, '71000000-0000-0000-0000-000000000002', 'B', false), 'closed', 'no saving after the deadline');
  perform t.eq((select status::text from public.test_attempts where id = v_id), 'expired', 'the attempt was expired by the server');
  perform t.eq((select score from public.test_attempts where id = v_id), 2::numeric, 'only the answer saved in time counts');
  perform t.eq((select time_used_seconds from public.test_attempts where id = v_id), 1800, 'time used is capped at the test duration');
  perform t.eq(public.submit_attempt(v_id), 'expired', 'a late submit reports the expiry, it does not rescue the attempt');

  v_new := public.start_test_attempt('70000000-0000-0000-0000-000000000001');
  perform t.eq(v_new <> v_id, true, 'after an attempt ends, a fresh one can be started');

  -- No answers at all: everything unanswered, score zero.
  perform t.eq(public.submit_attempt(v_new), 'submitted', 'submitting an empty attempt works');
  perform t.eq((select score from public.test_attempts where id = v_new), 0::numeric, 'empty attempt scores zero');
  perform t.eq((public.get_attempt_result(v_new)->'summary'->>'unanswered')::int, 3, 'all three are unanswered');
end $$;
reset role;

rollback;

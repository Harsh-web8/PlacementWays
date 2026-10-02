-- admin_save_question / move_test_question / admin_import_questions
-- (see migration 20260926080000_admin_question_test_rpcs.sql)
begin;

insert into auth.users (id, email) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'admin-qbank@example.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'student-qbank@example.com');
update public.profiles set role = 'admin' where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}', true);
set local role authenticated;

-- ---------- admin_save_question: create -------------------------------
do $$
declare
  v_category_id uuid;
  v_question_id uuid;
  v_option_count int;
begin
  select id into v_category_id from public.categories where slug = 'aptitude';

  v_question_id := public.admin_save_question(
    null, v_category_id, 'mcq', 'What is 2 + 2?', 'easy', null, 'B', 1, 0.25, 'draft',
    '[{"option_key":"A","option_text":"3"},{"option_key":"B","option_text":"4"},{"option_key":"C","option_text":"5"}]'::jsonb,
    null
  );

  perform t.eq((select question_text from public.questions where id = v_question_id), 'What is 2 + 2?', 'question row created');
  perform t.eq((select correct_answer from public.questions where id = v_question_id), 'B', 'correct answer stored');

  select count(*) into v_option_count from public.question_options where question_id = v_question_id;
  perform t.eq(v_option_count, 3, 'all three options created atomically with the question');
end $$;

-- ---------- admin_save_question: update replaces options --------------
do $$
declare
  v_category_id uuid;
  v_question_id uuid;
  v_option_count int;
begin
  select id into v_category_id from public.categories where slug = 'aptitude';

  v_question_id := public.admin_save_question(
    null, v_category_id, 'mcq', 'Original text', 'easy', null, 'A', 1, 0, 'draft',
    '[{"option_key":"A","option_text":"x"},{"option_key":"B","option_text":"y"}]'::jsonb, null
  );

  perform public.admin_save_question(
    v_question_id, v_category_id, 'mcq', 'Updated text', 'hard', 'now explained', 'C', 2, 0.5, 'published',
    '[{"option_key":"C","option_text":"new-1"},{"option_key":"D","option_text":"new-2"}]'::jsonb, null
  );

  perform t.eq((select question_text from public.questions where id = v_question_id), 'Updated text', 'update applied');
  perform t.eq((select correct_answer from public.questions where id = v_question_id), 'C', 'correct answer updated');

  select count(*) into v_option_count from public.question_options where question_id = v_question_id and option_key in ('A', 'B');
  perform t.eq(v_option_count, 0, 'old options were replaced, not kept');

  select count(*) into v_option_count from public.question_options where question_id = v_question_id;
  perform t.eq(v_option_count, 2, 'new options present');
end $$;

-- ---------- admin_save_question: correct_answer must be a real option --
do $$
declare
  v_category_id uuid;
begin
  select id into v_category_id from public.categories where slug = 'aptitude';
  perform t.throws(
    format(
      $q$select public.admin_save_question(null, %L, 'mcq', 'Bad question', 'easy', null, 'Z', 1, 0, 'draft',
              '[{"option_key":"A","option_text":"x"},{"option_key":"B","option_text":"y"}]'::jsonb, null);
              set constraints all immediate$q$,
      v_category_id
    ),
    '23503', 'correct_answer must reference a real option (deferred FK, checked at commit)'
  );
end $$;
set constraints all deferred;

-- ---------- admin_import_questions: atomic batch -----------------------
do $$
declare
  v_category_id uuid;
  v_before      bigint;
  v_after       bigint;
  v_ids         uuid[];
begin
  select id into v_category_id from public.categories where slug = 'reasoning';
  select count(*) into v_before from public.questions;

  select array_agg(x) into v_ids from public.admin_import_questions(
    jsonb_build_array(
      jsonb_build_object(
        'category_id', v_category_id, 'question_type', 'mcq', 'question_text', 'Import row 1',
        'difficulty', 'medium', 'correct_answer', 'A', 'marks', 1, 'negative_marks', 0, 'status', 'draft',
        'options', jsonb_build_array(jsonb_build_object('option_key','A','option_text','yes'), jsonb_build_object('option_key','B','option_text','no'))
      ),
      jsonb_build_object(
        'category_id', v_category_id, 'question_type', 'mcq', 'question_text', 'Import row 2',
        'difficulty', 'medium', 'correct_answer', 'A', 'marks', 1, 'negative_marks', 0, 'status', 'draft',
        'options', jsonb_build_array(jsonb_build_object('option_key','A','option_text','yes'), jsonb_build_object('option_key','B','option_text','no'))
      )
    )
  ) as x;

  select count(*) into v_after from public.questions;
  perform t.eq(v_after - v_before, 2::bigint, 'both rows imported');
  perform t.eq(coalesce(array_length(v_ids, 1), 0), 2, 'returned one id per imported row');
end $$;

-- A batch with one bad row (references a non-existent category) rolls back entirely.
do $$
declare
  v_category_id uuid;
  v_before      bigint;
  v_after       bigint;
begin
  select id into v_category_id from public.categories where slug = 'reasoning';
  select count(*) into v_before from public.questions;

  perform t.throws(
    format(
      $q$select public.admin_import_questions(jsonb_build_array(
        jsonb_build_object('category_id', %L, 'question_type', 'mcq', 'question_text', 'Good row',
          'difficulty', 'medium', 'correct_answer', 'A', 'marks', 1, 'negative_marks', 0, 'status', 'draft',
          'options', jsonb_build_array(jsonb_build_object('option_key','A','option_text','yes'), jsonb_build_object('option_key','B','option_text','no'))),
        jsonb_build_object('category_id', gen_random_uuid(), 'question_type', 'mcq', 'question_text', 'Bad row (fake category)',
          'difficulty', 'medium', 'correct_answer', 'A', 'marks', 1, 'negative_marks', 0, 'status', 'draft',
          'options', jsonb_build_array(jsonb_build_object('option_key','A','option_text','yes'), jsonb_build_object('option_key','B','option_text','no')))
      ))$q$,
      v_category_id
    ),
    '23503', 'the batch fails on the bad row'
  );

  select count(*) into v_after from public.questions;
  perform t.eq(v_after, v_before, 'the whole batch rolled back -- the good row was NOT left behind');
end $$;

-- ---------- move_test_question -----------------------------------------
do $$
declare
  v_category_id uuid;
  v_test_id     uuid;
  v_q1 uuid; v_q2 uuid; v_q3 uuid;
  v_tq1 uuid; v_tq2 uuid; v_tq3 uuid;
begin
  select id into v_category_id from public.categories where slug = 'aptitude';

  v_q1 := public.admin_save_question(null, v_category_id, 'mcq', 'Q1', 'easy', null, 'A', 1, 0, 'draft',
    '[{"option_key":"A","option_text":"x"},{"option_key":"B","option_text":"y"}]'::jsonb, null);
  v_q2 := public.admin_save_question(null, v_category_id, 'mcq', 'Q2', 'easy', null, 'A', 1, 0, 'draft',
    '[{"option_key":"A","option_text":"x"},{"option_key":"B","option_text":"y"}]'::jsonb, null);
  v_q3 := public.admin_save_question(null, v_category_id, 'mcq', 'Q3', 'easy', null, 'A', 1, 0, 'draft',
    '[{"option_key":"A","option_text":"x"},{"option_key":"B","option_text":"y"}]'::jsonb, null);

  insert into public.mock_tests (id, title, slug, duration_minutes)
  values ('90000000-0000-0000-0000-0000000000b1', 'Reorder fixture test', 'reorder-fixture-test', 30)
  returning id into v_test_id;

  insert into public.test_questions (id, test_id, question_id, question_order) values
    (gen_random_uuid(), v_test_id, v_q1, 1) returning id into v_tq1;
  insert into public.test_questions (id, test_id, question_id, question_order) values
    (gen_random_uuid(), v_test_id, v_q2, 2) returning id into v_tq2;
  insert into public.test_questions (id, test_id, question_id, question_order) values
    (gen_random_uuid(), v_test_id, v_q3, 3) returning id into v_tq3;

  perform public.move_test_question(v_tq2, 'up');
  perform t.eq((select question_order from public.test_questions where id = v_tq1), 2, 'Q1 took Q2''s slot');
  perform t.eq((select question_order from public.test_questions where id = v_tq2), 1, 'Q2 moved up');

  perform public.move_test_question(v_tq1, 'up'); -- Q1 is now last (order 2); moving "up" swaps with tq2? no: order is tq2=1, tq1=2, tq3=3. Moving tq1 up swaps with tq2.
  perform t.eq((select question_order from public.test_questions where id = v_tq1), 1, 'tq1 moved up again');

  perform t.throws(format('select public.move_test_question(%L, %L)', v_tq3, 'sideways'), '22023', 'rejects an invalid direction');

  -- last item, moving down is a no-op
  perform public.move_test_question(v_tq3, 'down');
  perform t.eq((select question_order from public.test_questions where id = v_tq3), 3, 'already last: no-op');
end $$;

reset role;
rollback;

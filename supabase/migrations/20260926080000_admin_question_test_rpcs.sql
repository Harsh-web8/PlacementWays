-- =====================================================================
-- PlacementWays -- Phase 5: question save + test-question reorder
--
-- Two atomicity problems that plain PostgREST calls can't solve on their
-- own (same reasoning as migration 5's move_process_stage):
--
-- 1. A question and its options are two different tables, but an MCQ
--    question's `correct_answer` is checked immediately (CHECK,
--    questions_mcq_has_answer) while it must also reference a real row in
--    question_options (a DEFERRED FK). Saving them across two separate
--    REST calls can't satisfy both at once -- they need one transaction.
-- 2. Reordering a test's questions needs to swap two rows sharing a
--    DEFERRED UNIQUE(test_id, question_order), exactly like stage_order.
--
-- Both functions are SECURITY INVOKER (the default): they run as the
-- calling user, so Row Level Security still requires an admin.
-- =====================================================================

-- ---------- save a question, replacing its options and tag links -----
create function public.admin_save_question(
  p_question_id    uuid,             -- null = create a new question
  p_category_id    uuid,
  p_question_type  public.question_type,
  p_question_text  text,
  p_difficulty     public.difficulty_level,
  p_explanation    text,
  p_correct_answer text,
  p_marks          numeric,
  p_negative_marks numeric,
  p_status         public.content_status,
  p_options        jsonb,            -- [{"option_key":"A","option_text":"..."}, ...]
  p_tag_ids        uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_option      jsonb;
begin
  if p_question_id is null then
    insert into public.questions (
      category_id, question_type, question_text, difficulty,
      explanation, correct_answer, marks, negative_marks, status
    ) values (
      p_category_id, p_question_type, p_question_text, p_difficulty,
      p_explanation, p_correct_answer, p_marks, p_negative_marks, p_status
    )
    returning id into v_question_id;
  else
    update public.questions set
      category_id    = p_category_id,
      question_type  = p_question_type,
      question_text  = p_question_text,
      difficulty     = p_difficulty,
      explanation    = p_explanation,
      correct_answer = p_correct_answer,
      marks          = p_marks,
      negative_marks = p_negative_marks,
      status         = p_status
    where id = p_question_id
    returning id into v_question_id;

    if v_question_id is null then
      raise exception 'Question not found' using errcode = 'P0002';
    end if;

    delete from public.question_options where question_id = v_question_id;
    delete from public.question_tags where question_id = v_question_id;
  end if;

  for v_option in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb))
  loop
    insert into public.question_options (question_id, option_key, option_text)
    values (v_question_id, v_option->>'option_key', v_option->>'option_text');
  end loop;

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    insert into public.question_tags (question_id, tag_id)
    select v_question_id, t from unnest(p_tag_ids) as t
    on conflict do nothing;
  end if;

  return v_question_id;
end;
$$;

revoke all on function public.admin_save_question(
  uuid, uuid, public.question_type, text, public.difficulty_level, text, text,
  numeric, numeric, public.content_status, jsonb, uuid[]
) from public, anon;
grant execute on function public.admin_save_question(
  uuid, uuid, public.question_type, text, public.difficulty_level, text, text,
  numeric, numeric, public.content_status, jsonb, uuid[]
) to authenticated;

-- ---------- reorder a test's assigned questions -----------------------
create function public.move_test_question(p_test_question_id uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_test_id        uuid;
  v_order          integer;
  v_neighbor_id    uuid;
  v_neighbor_order integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be ''up'' or ''down''' using errcode = '22023';
  end if;

  select test_id, question_order into v_test_id, v_order
  from public.test_questions
  where id = p_test_question_id;

  if v_test_id is null then
    raise exception 'Test question not found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select id, question_order into v_neighbor_id, v_neighbor_order
    from public.test_questions
    where test_id = v_test_id and question_order < v_order
    order by question_order desc
    limit 1;
  else
    select id, question_order into v_neighbor_id, v_neighbor_order
    from public.test_questions
    where test_id = v_test_id and question_order > v_order
    order by question_order asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    return;
  end if;

  update public.test_questions set question_order = v_neighbor_order where id = p_test_question_id;
  update public.test_questions set question_order = v_order          where id = v_neighbor_id;
end;
$$;

revoke all on function public.move_test_question(uuid, text) from public, anon;
grant execute on function public.move_test_question(uuid, text) to authenticated;

-- ---------- bulk import (CSV) -----------------------------------------
-- Rows are pre-validated by the app (Zod) before this is ever called, so a
-- failure here means something changed underneath the preview (e.g. a
-- category was deleted); rolling back the WHOLE batch is the safe choice
-- rather than importing half a CSV file silently.
create function public.admin_import_questions(p_questions jsonb)
returns setof uuid
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb;
  v_id  uuid;
begin
  for v_row in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb))
  loop
    v_id := public.admin_save_question(
      null,
      (v_row->>'category_id')::uuid,
      (v_row->>'question_type')::public.question_type,
      v_row->>'question_text',
      (v_row->>'difficulty')::public.difficulty_level,
      v_row->>'explanation',
      v_row->>'correct_answer',
      (v_row->>'marks')::numeric,
      (v_row->>'negative_marks')::numeric,
      coalesce((v_row->>'status')::public.content_status, 'draft'),
      coalesce(v_row->'options', '[]'::jsonb),
      case when jsonb_typeof(v_row->'tag_ids') = 'array'
           then (select array_agg(x::uuid) from jsonb_array_elements_text(v_row->'tag_ids') as x)
           else null end
    );
    return next v_id;
  end loop;
  return;
end;
$$;

revoke all on function public.admin_import_questions(jsonb) from public, anon;
grant execute on function public.admin_import_questions(jsonb) to authenticated;

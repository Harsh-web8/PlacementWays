-- Row Level Security: what each role can and cannot do.
begin;

-- ---------- fixtures (as superuser) ---------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student1@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'student2@example.com'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.com');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.companies (id, name, slug, status) values
  ('c0000000-0000-0000-0000-00000000000d', 'Draft Co', 'draft-co', 'draft'),
  ('c0000000-0000-0000-0000-00000000000a', 'Archived Co', 'archived-co', 'archived');

-- Published process for a published company, with a source.
insert into public.recruitment_processes (id, company_id, title, status, last_verified_on, hiring_year)
select 'b0000000-0000-0000-0000-000000000001', id, 'Published drive', 'published', '2026-01-01', 2026
  from public.companies where slug = 'tcs-nqt';
insert into public.process_sources (recruitment_process_id, label, url)
  values ('b0000000-0000-0000-0000-000000000001', 'Official page', 'https://example.com/careers');
insert into public.process_stages (recruitment_process_id, name, stage_order)
  values ('b0000000-0000-0000-0000-000000000001', 'Online test', 1);
-- Draft process for the same company.
insert into public.recruitment_processes (id, company_id, title, status)
select 'b0000000-0000-0000-0000-000000000002', id, 'Draft drive', 'draft' from public.companies where slug = 'tcs-nqt';
insert into public.process_stages (recruitment_process_id, name, stage_order)
  values ('b0000000-0000-0000-0000-000000000002', 'Secret stage', 1);
-- Published process on an UNpublished company: must stay hidden.
insert into public.recruitment_processes (id, company_id, title, status, last_verified_on)
  values ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000d', 'Hidden by company', 'published', '2026-01-01');
insert into public.process_sources (recruitment_process_id, label, url)
  values ('b0000000-0000-0000-0000-000000000003', 'src', 'https://example.com/x');

-- A question with a correct answer, in a published test.
insert into public.questions (id, category_id, question_text, correct_answer, status)
select 'd0000000-0000-0000-0000-000000000001', id, 'What is 2+2?', 'B', 'published'
  from public.categories where slug = 'percentages';
insert into public.question_options (question_id, option_key, option_text) values
  ('d0000000-0000-0000-0000-000000000001', 'A', '3'),
  ('d0000000-0000-0000-0000-000000000001', 'B', '4');
insert into public.mock_tests (id, title, slug, duration_minutes, status) values
  ('e0000000-0000-0000-0000-000000000001', 'Pub test', 'pub-test', 30, 'published'),
  ('e0000000-0000-0000-0000-000000000002', 'Draft test', 'draft-test', 30, 'draft');
insert into public.test_questions (test_id, question_id, question_order, marks)
  values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, 4);

-- One attempt each for student1 and student2.
insert into public.test_attempts (id, user_id, test_id) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'e0000000-0000-0000-0000-000000000001');
insert into public.attempt_answers (attempt_id, question_id, selected_answer) values
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'A'),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'B');

set constraints all immediate;

-- =====================================================================
-- ANONYMOUS VISITOR
-- =====================================================================
set local role anon;
do $$
begin
  perform t.eq((select count(*)::int from public.companies), 3, 'anon sees only the 3 published companies');
  perform t.eq((select count(*)::int from public.categories), 77, 'anon can read categories');
  perform t.eq((select count(*)::int from public.recruitment_processes), 1, 'anon sees only the published process of a published company');
  perform t.eq((select count(*)::int from public.process_stages), 1, 'anon cannot see stages of draft / hidden processes');
  perform t.eq((select count(*)::int from public.process_sources), 1, 'anon cannot see sources of hidden processes');
  perform t.eq((select count(*)::int from public.mock_tests where id::text like 'e0000000%'), 1, 'anon sees only published tests');
  perform t.eq((select question_count from public.published_mock_tests where id='e0000000-0000-0000-0000-000000000001'), 1, 'listing view exposes question_count');
  perform t.eq((select total_marks from public.published_mock_tests where id='e0000000-0000-0000-0000-000000000001'), 4::numeric, 'listing view exposes total_marks');
  perform t.eq((select attempt_count from public.published_mock_tests where id='e0000000-0000-0000-0000-000000000001'), 2, 'listing view exposes attempt_count');
  perform t.throws('select * from public.profiles',        '42501', 'anon cannot read profiles');
  perform t.throws('select * from public.questions',       '42501', 'anon cannot read questions');
  perform t.throws('select * from public.question_options','42501', 'anon cannot read options (correct answers)');
  perform t.throws('select * from public.test_questions',  '42501', 'anon cannot read test_questions');
  perform t.throws('select * from public.test_attempts',   '42501', 'anon cannot read attempts');
  perform t.throws('select * from public.audit_logs',      '42501', 'anon cannot read audit log');
  perform t.throws($q$insert into public.companies (name, slug) values ('Evil', 'evil')$q$, '42501', 'anon cannot insert companies');
  perform t.throws($q$update public.companies set name = 'Hacked'$q$, '42501', 'anon cannot update companies');
end $$;
reset role;

-- =====================================================================
-- STUDENT 1
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  perform t.eq((select count(*)::int from public.profiles), 1, 'student sees exactly one profile (their own)');
  perform t.eq((select count(*)::int from public.companies), 3, 'student sees only published companies');
  perform t.eq((select count(*)::int from public.questions), 0, 'student sees ZERO questions (RLS hides the bank)');
  perform t.eq((select count(*)::int from public.question_options), 0, 'student sees ZERO options / correct answers');
  perform t.eq((select count(*)::int from public.test_questions), 0, 'student cannot read test_questions');
  perform t.eq((select count(*)::int from public.test_attempts), 1, 'student sees only their own attempt');
  perform t.eq((select count(*)::int from public.attempt_answers), 1, 'student sees only their own answers');
  perform t.eq((select count(*)::int from public.audit_logs), 0, 'student cannot read audit log');

  -- Legit edit.
  update public.profiles set name = 'Asha', college = 'ABC College', graduation_year = 2027
   where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform t.eq(n, 1, 'student can edit own profile fields');

  -- Cannot touch someone else's profile: RLS filters the row, 0 rows change.
  update public.profiles set name = 'Pwned' where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  perform t.eq(n, 0, 'student cannot edit another profile (0 rows affected)');

  -- Privilege escalation attempts.
  perform t.throws($q$update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111'$q$, '42501', 'student cannot promote self to admin');
  perform t.throws($q$update public.profiles set is_active = true where id = '11111111-1111-1111-1111-111111111111'$q$, '42501', 'student cannot change is_active');
  perform t.throws($q$update public.profiles set email = 'x@y.com' where id = '11111111-1111-1111-1111-111111111111'$q$, '42501', 'student cannot change email');
  perform t.throws($q$update public.profiles set id = gen_random_uuid() where id = '11111111-1111-1111-1111-111111111111'$q$, '42501', 'student cannot change id');
  perform t.throws($q$insert into public.profiles (id, email, role) values (gen_random_uuid(), 'a@b.com', 'admin')$q$, '42501', 'student cannot insert profiles');
  perform t.throws($q$delete from public.profiles$q$, '42501', 'student cannot delete profiles');

  -- Content is read-only.
  perform t.throws($q$insert into public.companies (name, slug) values ('Evil', 'evil')$q$, '42501', 'student cannot insert company (RLS)');
  perform t.throws($q$insert into public.questions (category_id, question_text, correct_answer) select id, 'q', 'A' from public.categories limit 1$q$, '42501', 'student cannot insert question (RLS)');
  update public.companies set name = 'Hacked';
  get diagnostics n = row_count;
  perform t.eq(n, 0, 'student cannot update companies (0 rows)');
  delete from public.companies;
  get diagnostics n = row_count;
  perform t.eq(n, 0, 'student cannot delete companies (0 rows)');

  -- Attempts / scores cannot be forged from the browser.
  perform t.throws($q$insert into public.test_attempts (user_id, test_id) values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001')$q$, '42501', 'student cannot create attempts directly');
  perform t.throws($q$update public.test_attempts set score = 999$q$, '42501', 'student cannot edit a score');
  perform t.throws($q$update public.attempt_answers set is_correct = true$q$, '42501', 'student cannot mark own answers correct');
  perform t.throws($q$insert into public.audit_logs (actor_id, action, entity_type) values ('11111111-1111-1111-1111-111111111111', 'x', 'y')$q$, '42501', 'student cannot write audit log');

  -- Preferences: own only.
  insert into public.profile_preferred_companies (profile_id, company_id)
    select '11111111-1111-1111-1111-111111111111', id from public.companies where slug = 'infosys';
  perform t.throws($q$insert into public.profile_preferred_companies (profile_id, company_id) select '22222222-2222-2222-2222-222222222222', id from public.companies where slug = 'infosys'$q$, '42501', 'student cannot set another user''s preferences');
  perform t.eq((select count(*)::int from public.profile_preferred_companies), 1, 'student sees own preferences');
end $$;
reset role;

-- =====================================================================
-- ADMIN
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
do $$
declare n integer;
begin
  perform t.eq((select count(*)::int from public.profiles), 3, 'admin sees all profiles');
  perform t.eq((select count(*)::int from public.companies), 5, 'admin sees drafts and archived companies');
  perform t.eq((select count(*)::int from public.recruitment_processes), 3, 'admin sees all processes');
  perform t.eq((select count(*)::int from public.questions where id='d0000000-0000-0000-0000-000000000001'), 1, 'admin can read the question bank');
  perform t.eq((select count(*)::int from public.question_options where question_id='d0000000-0000-0000-0000-000000000001'), 2, 'admin can read options');
  perform t.eq((select count(*)::int from public.test_attempts), 2, 'admin can read all attempts');
  perform t.eq((select count(*)::int from public.mock_tests where id::text like 'e0000000%'), 2, 'admin sees draft tests');

  insert into public.companies (name, slug, status) values ('New Co', 'new-co', 'draft');
  update public.companies set description = 'edited' where slug = 'new-co';
  get diagnostics n = row_count;
  perform t.eq(n, 1, 'admin can create and edit companies');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'company.create', 'company', 'new-co');
  perform t.eq((select count(*)::int from public.audit_logs), 1, 'admin can write and read audit entries');
  perform t.throws($q$insert into public.audit_logs (actor_id, action, entity_type) values ('11111111-1111-1111-1111-111111111111', 'forged', 'x')$q$, '42501', 'admin cannot forge another actor in audit log');
  perform t.throws($q$update public.audit_logs set action = 'tampered'$q$, '42501', 'admin cannot edit audit log');
  perform t.throws($q$delete from public.audit_logs$q$, '42501', 'admin cannot delete audit log');

  -- Even an admin cannot change roles through the API layer.
  perform t.throws($q$update public.profiles set role = 'admin' where id = '22222222-2222-2222-2222-222222222222'$q$, '42501', 'admin cannot change roles via API (server-only operation)');
  -- Nor tamper with scores.
  perform t.throws($q$update public.test_attempts set score = 100$q$, '42501', 'admin cannot edit scores via API');
end $$;
reset role;

-- =====================================================================
-- DEACTIVATED ADMIN loses admin powers immediately
-- =====================================================================
update public.profiles set is_active = false where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
do $$
begin
  perform t.eq((select public.is_admin()), false, 'deactivated admin is not admin');
  perform t.throws($q$insert into public.companies (name, slug) values ('Late', 'late')$q$, '42501', 'deactivated admin cannot write');
  perform t.eq((select count(*)::int from public.questions), 0, 'deactivated admin cannot read questions');
end $$;
reset role;

-- =====================================================================
-- A JWT for a user that has no profile at all is nobody.
-- =====================================================================
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  perform t.eq((select public.is_admin()), false, 'unknown subject is not admin');
  perform t.eq((select count(*)::int from public.profiles), 0, 'unknown subject sees no profiles');
end $$;
reset role;

rollback;

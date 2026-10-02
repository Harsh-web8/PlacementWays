-- Integrity rules enforced by the database itself.
begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'student1@example.com'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@example.com');

-- =====================================================================
-- Recruitment process publishing
-- =====================================================================
insert into public.recruitment_processes (id, company_id, title)
  select 'b0000000-0000-0000-0000-000000000001', id, 'Drive A' from public.companies where slug = 'infosys';

select t.throws($$update public.recruitment_processes set status = 'published' where id = 'b0000000-0000-0000-0000-000000000001'$$,
  '23514', 'cannot publish a process without a last-verified date');

select t.throws($$update public.recruitment_processes set status = 'published', last_verified_on = '2026-09-01' where id = 'b0000000-0000-0000-0000-000000000001'; set constraints all immediate$$,
  '23514', 'cannot publish a process without any source link');

select t.throws($$insert into public.process_sources (recruitment_process_id, label, url) values ('b0000000-0000-0000-0000-000000000001', 'x', 'javascript:alert(1)')$$,
  '23514', 'source URL must be http(s) (blocks javascript: URLs)');

do $$
begin
  -- Publish + add source in one transaction, either order: OK at commit time.
  update public.recruitment_processes set status = 'published', last_verified_on = '2026-09-01'
   where id = 'b0000000-0000-0000-0000-000000000001';
  insert into public.process_sources (recruitment_process_id, label, url)
   values ('b0000000-0000-0000-0000-000000000001', 'Careers page', 'https://example.com/careers');
  set constraints all immediate;
  perform t.eq((select status::text from public.recruitment_processes where id = 'b0000000-0000-0000-0000-000000000001'),
               'published', 'process publishes once verified date and a source exist');
  set constraints all deferred;
end $$;

select t.throws($$delete from public.process_sources where recruitment_process_id = 'b0000000-0000-0000-0000-000000000001'; set constraints all immediate$$,
  '23514', 'cannot remove the last source from a published process');

-- Multiple processes per company (different years/drives).
insert into public.recruitment_processes (company_id, title, hiring_year, drive_name)
  select id, 'Drive B', 2027, 'Off-campus' from public.companies where slug = 'infosys';
select t.eq((select count(*)::int from public.recruitment_processes p join public.companies c on c.id = p.company_id where c.slug = 'infosys'),
            2, 'a company can have several processes');

-- =====================================================================
-- Stage ordering
-- =====================================================================
insert into public.process_stages (recruitment_process_id, name, stage_order, stage_type, topics, duration_minutes) values
  ('b0000000-0000-0000-0000-000000000001', 'Aptitude',  1, 'aptitude', array['percentages','ratios'], 45),
  ('b0000000-0000-0000-0000-000000000001', 'Interview', 2, 'technical_interview', '{}', null);

do $$
begin
  -- Swap two stages in ONE statement (drag-and-drop reorder).
  update public.process_stages set stage_order = 3 - stage_order
   where recruitment_process_id = 'b0000000-0000-0000-0000-000000000001';
  set constraints all immediate;
  perform t.eq((select name from public.process_stages where recruitment_process_id = 'b0000000-0000-0000-0000-000000000001' and stage_order = 1),
               'Interview', 'stages can be swapped in a single statement');
  set constraints all deferred;
end $$;

select t.throws($$update public.process_stages set stage_order = 1 where name = 'Aptitude'; set constraints all immediate$$,
  '23505', 'two stages cannot share an order');
select t.throws($$update public.process_stages set duration_minutes = 0 where name = 'Aptitude'$$,
  '23514', 'duration must be positive when provided');

-- =====================================================================
-- Questions
-- =====================================================================
insert into public.questions (id, category_id, question_text, correct_answer)
  select 'd0000000-0000-0000-0000-000000000001', id, 'Q1', 'B' from public.categories where slug = 'percentages';
insert into public.question_options (question_id, option_key, option_text) values
  ('d0000000-0000-0000-0000-000000000001', 'A', 'one'),
  ('d0000000-0000-0000-0000-000000000001', 'B', 'two');
set constraints all immediate;
set constraints all deferred;

select t.throws($$insert into public.questions (category_id, question_text, correct_answer) select id, 'Q-bad', 'D' from public.categories where slug = 'percentages'; set constraints all immediate$$,
  '23503', 'correct answer must be one of the real options');
select t.throws($$insert into public.questions (category_id, question_text) select id, 'Q-noanswer' from public.categories where slug = 'percentages'$$,
  '23514', 'an MCQ must have a correct answer');
select t.throws($$update public.question_options set option_text = '' where question_id = 'd0000000-0000-0000-0000-000000000001'$$,
  '23514', 'option text cannot be empty');
select t.throws($$delete from public.question_options where question_id = 'd0000000-0000-0000-0000-000000000001' and option_key = 'B'; set constraints all immediate$$,
  '23503', 'cannot delete the option that is the correct answer');
select t.throws($$insert into public.question_options (question_id, option_key, option_text) values ('d0000000-0000-0000-0000-000000000001', 'A', 'dup')$$,
  '23505', 'option keys are unique per question');

-- Publish gate: needs >= 2 options.
insert into public.questions (id, category_id, question_text, correct_answer)
  select 'd0000000-0000-0000-0000-000000000002', id, 'Q2', 'A' from public.categories where slug = 'percentages';
insert into public.question_options (question_id, option_key, option_text)
  values ('d0000000-0000-0000-0000-000000000002', 'A', 'only');
select t.throws($$update public.questions set status = 'published' where id = 'd0000000-0000-0000-0000-000000000002'; set constraints all immediate$$,
  '23514', 'cannot publish an MCQ with fewer than two options');
insert into public.question_options (question_id, option_key, option_text)
  values ('d0000000-0000-0000-0000-000000000002', 'B', 'second');
do $$
begin
  update public.questions set status = 'published' where id = 'd0000000-0000-0000-0000-000000000002';
  set constraints all immediate;
  perform t.eq((select status::text from public.questions where id = 'd0000000-0000-0000-0000-000000000002'), 'published', 'MCQ with two options publishes');
  set constraints all deferred;
end $$;

-- A question outside any test, for the membership check.
insert into public.questions (id, category_id, question_text, correct_answer)
  select 'd0000000-0000-0000-0000-000000000003', id, 'Q3 (not in test)', 'A' from public.categories where slug = 'percentages';
insert into public.question_options (question_id, option_key, option_text) values
  ('d0000000-0000-0000-0000-000000000003', 'A', 'x'), ('d0000000-0000-0000-0000-000000000003', 'B', 'y');

-- =====================================================================
-- Mock tests
-- =====================================================================
insert into public.mock_tests (id, title, slug, duration_minutes) values
  ('e0000000-0000-0000-0000-000000000001', 'Test 1', 'test-1', 30);
select t.throws($$update public.mock_tests set status = 'published' where id = 'e0000000-0000-0000-0000-000000000001'; set constraints all immediate$$,
  '23514', 'cannot publish a test with no questions');
insert into public.test_questions (test_id, question_id, question_order, marks, negative_marks) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, 4, 1),
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 2, 4, 1);
do $$
begin
  update public.mock_tests set status = 'published' where id = 'e0000000-0000-0000-0000-000000000001';
  set constraints all immediate;
  perform t.eq((select status::text from public.mock_tests where id = 'e0000000-0000-0000-0000-000000000001'), 'published', 'test with questions publishes');
  set constraints all deferred;
end $$;
select t.throws($$insert into public.test_questions (test_id, question_id, question_order) values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 2); set constraints all immediate$$,
  '23505', 'two questions cannot share an order in a test');
select t.throws($$insert into public.test_questions (test_id, question_id, question_order) values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 9)$$,
  '23505', 'a question cannot appear twice in a test');
select t.throws($$update public.mock_tests set duration_minutes = 0$$, '23514', 'duration must be positive');
select t.throws($$update public.mock_tests set slug = 'Bad Slug!'$$, '23514', 'slug format enforced');
select t.throws($$delete from public.questions where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '23503', 'cannot delete a question used by a test');

insert into public.mock_tests (id, title, slug, duration_minutes) values
  ('e0000000-0000-0000-0000-000000000002', 'Draft', 'draft-test', 30);
select t.throws($$insert into public.test_attempts (user_id, test_id) values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002')$$,
  '23514', 'cannot start an attempt on an unpublished test');

-- =====================================================================
-- Attempt lifecycle
-- =====================================================================
-- The lifecycle fixture must contain published questions under the start gate.
update public.questions set status='published' where id='d0000000-0000-0000-0000-000000000001';
-- Caller tries to choose their own (far-future) deadline: ignored.
insert into public.test_attempts (id, user_id, test_id, expires_at, started_at)
  values ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          'e0000000-0000-0000-0000-000000000001', '2099-01-01', '2000-01-01');
select t.eq((select expires_at - started_at from public.test_attempts where id = 'f0000000-0000-0000-0000-000000000001'),
            interval '30 minutes', 'deadline = start + test duration, caller-supplied values are ignored');
select t.eq((select started_at = now() from public.test_attempts where id = 'f0000000-0000-0000-0000-000000000001'),
            true, 'started_at is server time');

select t.throws($$insert into public.test_attempts (user_id, test_id) values ('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001')$$,
  '23505', 'only one in-progress attempt per student per test');

-- Answers
insert into public.attempt_answers (attempt_id, question_id, selected_answer, marked_for_review)
  values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'A', true);
select t.throws($$insert into public.attempt_answers (attempt_id, question_id, selected_answer) values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'A')$$,
  '23514', 'cannot answer a question that is not in the test');
select t.throws($$insert into public.attempt_answers (attempt_id, question_id, selected_answer) values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Z')$$,
  '23503', 'selected answer must be a real option of that question');
select t.throws($$insert into public.attempt_answers (attempt_id, question_id, selected_answer) values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'B')$$,
  '23505', 'one answer row per question per attempt');
-- Option belonging to a DIFFERENT question is rejected (composite FK).
select t.throws($$insert into public.attempt_answers (attempt_id, question_id, selected_answer) values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'C')$$,
  '23503', 'option key not present on this question is rejected');
-- Changing an answer while in progress is fine (autosave).
update public.attempt_answers set selected_answer = 'B'
 where attempt_id = 'f0000000-0000-0000-0000-000000000001' and question_id = 'd0000000-0000-0000-0000-000000000001';

select t.throws($$update public.test_attempts set status = 'submitted', submitted_at = now() where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '23514', 'a finalised attempt must carry its score');
select t.throws($$update public.test_attempts set user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '55000', 'attempt owner is immutable');
select t.throws($$update public.test_attempts set expires_at = '2099-01-01' where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '55000', 'deadline cannot be extended');

-- Second answer, on a NON-correct option of Q2 (used later for the delete-protection test).
insert into public.attempt_answers (attempt_id, question_id, selected_answer)
  values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'B');

-- Server-side scoring, then final submit.
update public.attempt_answers set is_correct = true, marks_awarded = 4
 where attempt_id = 'f0000000-0000-0000-0000-000000000001' and question_id = 'd0000000-0000-0000-0000-000000000001';
update public.test_attempts
   set status = 'submitted', submitted_at = now(), score = 4, total_marks = 8, time_used_seconds = 600
 where id = 'f0000000-0000-0000-0000-000000000001';
select t.eq((select status::text from public.test_attempts where id = 'f0000000-0000-0000-0000-000000000001'), 'submitted', 'attempt can be finalised once');

-- After submission everything is frozen: no double submit, no tampering.
select t.throws($$update public.test_attempts set score = 8 where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '55000', 'cannot change score after submission');
select t.throws($$update public.test_attempts set status = 'submitted', submitted_at = now(), score = 4, total_marks = 8 where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '55000', 'a second (duplicate) submission is rejected');
select t.throws($$update public.test_attempts set status = 'in_progress', submitted_at = null where id = 'f0000000-0000-0000-0000-000000000001'$$,
  '55000', 'a submitted attempt cannot be re-opened');
select t.throws($$update public.attempt_answers set selected_answer = 'A' where attempt_id = 'f0000000-0000-0000-0000-000000000001'$$,
  '55000', 'answers are frozen after submission');
select t.throws($$insert into public.attempt_answers (attempt_id, question_id, selected_answer) values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'A')$$,
  '55000', 'no new answers after submission');

-- A student can retake once the previous attempt is finished.
insert into public.test_attempts (id, user_id, test_id)
  values ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001');
select t.eq((select count(*)::int from public.test_attempts where user_id = '11111111-1111-1111-1111-111111111111'), 2, 'retake allowed after submit');

-- History is protected from careless deletes.
select t.throws($$delete from public.mock_tests where id = 'e0000000-0000-0000-0000-000000000001'$$,
  '23514', 'cannot delete a test that students have attempted (archive instead)');
select t.throws($$delete from public.question_options where question_id = 'd0000000-0000-0000-0000-000000000002' and option_key = 'B'; set constraints all immediate$$,
  '23514', 'cannot delete an option that appears in a student answer');

-- =====================================================================
-- Audit log is append-only, yet deleting a user still works
-- =====================================================================
insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'company.create', 'company', 'x');
select t.throws($$update public.audit_logs set action = 'tampered'$$, '55000', 'audit rows cannot be edited');
select t.throws($$delete from public.audit_logs$$, '55000', 'audit rows cannot be deleted');
select t.throws($$truncate public.audit_logs$$, '55000', 'audit log cannot be truncated');

delete from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select t.eq((select count(*)::int from public.audit_logs where action = 'company.create' and actor_id is null), 1,
            'deleting an admin account keeps the audit row (actor set to NULL)');

-- Deleting a student removes their attempts and answers.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select t.eq((select count(*)::int from public.test_attempts) + (select count(*)::int from public.attempt_answers), 0,
            'deleting a student removes their attempts and answers');

-- Restricted parents.
select t.throws($$delete from public.categories where slug = 'aptitude'$$, '23503', 'cannot delete a category that has topics');
select t.throws($$update public.categories set parent_id = id where slug = 'aptitude'$$, '23514', 'a category cannot be its own parent');

-- Isolate cascade fixtures from seeded courses referencing Infosys.
insert into public.companies(id,name,slug,status) values('c0000000-0000-0000-0000-000000000099','Cascade fixture','cascade-fixture','published');
update public.recruitment_processes set company_id='c0000000-0000-0000-0000-000000000099';
delete from public.companies where slug = 'cascade-fixture';
select t.eq((select count(*)::int from public.recruitment_processes) + (select count(*)::int from public.process_stages) + (select count(*)::int from public.process_sources),
            0, 'deleting a company removes its processes, stages and sources');

rollback;

-- =====================================================================
-- PlacementWays -- Phase 3, migration 4: Row Level Security and grants
--
-- Defence in depth, two independent layers:
--   1. GRANTS   -- which SQL verbs an API role may even attempt
--   2. POLICIES -- which ROWS it may touch
--
-- Supabase exposes every public table to the browser through PostgREST using
-- the anon key. So every table has RLS enabled and starts with NO access.
--
-- What each role can do
--   anon           read published public content (companies, processes ...)
--   authenticated  the same, plus own profile / own attempts (read only)
--   admin          (an authenticated user whose profile.role = 'admin')
--                  full CRUD on content via the same RLS layer
--   service_role   server-only; bypasses RLS. Reserved for privileged code
--                  (role changes, scoring) -- not used in the browser.
--
-- Deliberately NOT possible from the browser, for any student:
--   * reading questions, options or correct answers
--   * creating/updating attempts or answers, or setting a score
--   * changing their own role or is_active flag
-- =====================================================================

-- ---------- 1. reset API-role privileges to zero ---------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- Future tables must not be auto-exposed either.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------- 2. enable RLS everywhere --------------------------------
alter table public.profiles                    enable row level security;
alter table public.categories                  enable row level security;
alter table public.tags                        enable row level security;
alter table public.companies                   enable row level security;
alter table public.recruitment_processes       enable row level security;
alter table public.process_stages              enable row level security;
alter table public.process_sources             enable row level security;
alter table public.questions                   enable row level security;
alter table public.question_options            enable row level security;
alter table public.question_tags               enable row level security;
alter table public.mock_tests                  enable row level security;
alter table public.mock_test_categories        enable row level security;
alter table public.test_questions              enable row level security;
alter table public.test_attempts               enable row level security;
alter table public.attempt_answers             enable row level security;
alter table public.profile_preferred_companies enable row level security;
alter table public.profile_interests           enable row level security;
alter table public.audit_logs                  enable row level security;

-- ---------- 3. public, read-only content ----------------------------
grant select on public.categories, public.tags, public.companies,
                public.recruitment_processes, public.process_stages,
                public.process_sources, public.mock_tests,
                public.mock_test_categories
  to anon, authenticated;

create policy categories_read on public.categories for select using (true);
create policy tags_read       on public.tags       for select using (true);

-- Drafts and archived rows are visible to admins only.
create policy companies_read on public.companies for select
  using (status = 'published' or (select public.is_admin()));

-- A process is public only if it AND its company are published. The
-- sub-select is itself filtered by RLS, so child tables just ask
-- "can I see the parent?" -- one rule, no duplicated logic.
create policy processes_read on public.recruitment_processes for select
  using (
    (select public.is_admin())
    or (status = 'published'
        and exists (select 1 from public.companies c where c.id = company_id))
  );
create policy stages_read on public.process_stages for select
  using (exists (select 1 from public.recruitment_processes p
                 where p.id = recruitment_process_id));
create policy sources_read on public.process_sources for select
  using (exists (select 1 from public.recruitment_processes p
                 where p.id = recruitment_process_id));

create policy tests_read on public.mock_tests for select
  using (status = 'published' or (select public.is_admin()));
create policy test_categories_read on public.mock_test_categories for select
  using (exists (select 1 from public.mock_tests t where t.id = test_id));

-- ---------- 4. admin write access to content ------------------------
-- Grants let the verbs through; the policy decides who. A student holding
-- these grants still fails the is_admin() check on every row.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'categories', 'tags', 'companies', 'recruitment_processes',
    'process_stages', 'process_sources', 'questions', 'question_options',
    'question_tags', 'mock_tests', 'mock_test_categories', 'test_questions'
  ] loop
    execute format('grant insert, update, delete on public.%I to authenticated', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select public.is_admin()))
         with check ((select public.is_admin()))',
      tbl || '_admin_write', tbl);
  end loop;
end $$;

-- The question bank (and therefore every correct answer) is admin-only.
-- Students receive questions through server code during a test (Phase 6),
-- which controls exactly what is revealed and when.
grant select on public.questions, public.question_options,
                public.question_tags, public.test_questions
  to authenticated;
create policy questions_admin_read        on public.questions        for select to authenticated using ((select public.is_admin()));
create policy question_options_admin_read on public.question_options for select to authenticated using ((select public.is_admin()));
create policy question_tags_admin_read    on public.question_tags    for select to authenticated using ((select public.is_admin()));
create policy test_questions_admin_read   on public.test_questions   for select to authenticated using ((select public.is_admin()));

-- ---------- 5. profiles ---------------------------------------------
grant select on public.profiles to authenticated;
-- COLUMN-level grant: a student may edit these four fields and nothing else.
-- `role`, `is_active`, `email`, `id` are not in the list, so
--   update profiles set role = 'admin' ...
-- fails with "permission denied" regardless of policies.
grant update (name, college, degree, graduation_year) on public.profiles to authenticated;

create policy profiles_read_own_or_admin on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- 6. attempts and answers: READ ONLY from the browser -----
grant select on public.test_attempts, public.attempt_answers to authenticated;

create policy attempts_read_own_or_admin on public.test_attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- Visibility of answers follows visibility of the parent attempt.
create policy answers_read on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.test_attempts a where a.id = attempt_id));

-- ---------- 7. preferences ------------------------------------------
grant select, insert, delete on public.profile_preferred_companies, public.profile_interests to authenticated;

create policy pref_companies_read on public.profile_preferred_companies for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy pref_companies_insert on public.profile_preferred_companies for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy pref_companies_delete on public.profile_preferred_companies for delete to authenticated
  using (profile_id = (select auth.uid()));

create policy interests_read on public.profile_interests for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy interests_insert on public.profile_interests for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy interests_delete on public.profile_interests for delete to authenticated
  using (profile_id = (select auth.uid()));

-- ---------- 8. audit log --------------------------------------------
grant select, insert on public.audit_logs to authenticated;
create policy audit_read on public.audit_logs for select to authenticated
  using ((select public.is_admin()));
-- An admin can only write entries in their OWN name.
create policy audit_insert on public.audit_logs for insert to authenticated
  with check ((select public.is_admin()) and actor_id = (select auth.uid()));

-- ---------- 9. public test listing view -----------------------------
-- Students cannot read test_questions (it would expose question ids), yet the
-- public listing needs "how many questions / total marks / how popular".
-- This view runs with its OWNER's rights (security_invoker = false, chosen
-- explicitly) and exposes only aggregates of published tests.
create view public.published_mock_tests
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
  (select count(*)::int from public.test_attempts a where a.test_id = t.id)                 as attempt_count
from public.mock_tests t
where t.status = 'published';

revoke all on public.published_mock_tests from public;
grant select on public.published_mock_tests to anon, authenticated, service_role;

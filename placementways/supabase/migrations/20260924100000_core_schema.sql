-- =====================================================================
-- PlacementWays -- Phase 3, migration 1: core schema
--
-- Conventions
--   * uuid primary keys (safe to expose in URLs, no enumeration)
--   * timestamptz everywhere; updated_at maintained by trigger
--   * enums for closed sets (status, difficulty, role ...)
--   * CHECK constraints so bad data is rejected even if app code has a bug
--   * ON DELETE choices are deliberate: owned content CASCADEs, student
--     history and shared content RESTRICT (archive instead of delete)
-- =====================================================================

-- ---------- enums ----------------------------------------------------
create type public.user_role         as enum ('student', 'admin');
create type public.content_status    as enum ('draft', 'published', 'archived');
create type public.difficulty_level  as enum ('easy', 'medium', 'hard');
create type public.question_type     as enum ('mcq', 'coding', 'debugging');
create type public.attempt_status    as enum ('in_progress', 'submitted', 'expired');
create type public.stage_type        as enum (
  'online_assessment', 'aptitude', 'coding', 'communication',
  'technical_interview', 'managerial_interview', 'hr_interview',
  'group_discussion', 'other'
);

-- ---------- shared trigger function ---------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- ---------- profiles (one row per auth user) -------------------------
-- Credentials live in Supabase's auth.users. This table holds app data.
-- `role` and `is_active` can only be changed by privileged server code
-- (see the grants in the RLS migration) -- never by the student.
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  name             text not null default '',
  role             public.user_role not null default 'student',
  is_active        boolean not null default true,
  college          text,
  degree           text,
  graduation_year  smallint,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint profiles_email_lowercase   check (email = lower(email)),
  constraint profiles_name_length       check (char_length(name) <= 100),
  constraint profiles_college_length    check (char_length(college) <= 150),
  constraint profiles_degree_length     check (char_length(degree) <= 100),
  constraint profiles_grad_year_range   check (graduation_year between 2000 and 2100)
);
create unique index profiles_email_key on public.profiles (email);
create index profiles_role_idx on public.profiles (role) where role = 'admin';
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- categories (self-referencing tree) -----------------------
create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.categories (id) on delete restrict,
  name         text not null,
  slug         text not null,
  description  text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint categories_slug_format  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_name_length  check (char_length(name) between 1 and 100),
  constraint categories_not_own_parent check (parent_id is null or parent_id <> id),
  constraint categories_slug_key unique (slug)
);
create index categories_parent_idx on public.categories (parent_id, sort_order);
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  created_at  timestamptz not null default now(),
  constraint tags_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint tags_name_length check (char_length(name) between 1 and 60),
  constraint tags_slug_key unique (slug)
);

-- ---------- companies ------------------------------------------------
-- Adding a company is an INSERT, never a code change.
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null,
  description      text,
  logo_url         text,
  website_url      text,
  status           public.content_status not null default 'draft',
  sort_order       integer not null default 0,
  seo_title        text,
  seo_description  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint companies_slug_format   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint companies_name_length   check (char_length(name) between 1 and 120),
  constraint companies_logo_url_http check (logo_url ~* '^https?://'),
  constraint companies_website_http  check (website_url ~* '^https?://'),
  constraint companies_seo_title_len check (char_length(seo_title) <= 70),
  constraint companies_seo_desc_len  check (char_length(seo_description) <= 200),
  constraint companies_slug_key unique (slug)
);
create unique index companies_name_key on public.companies (lower(name));
create index companies_listing_idx on public.companies (status, sort_order, name);
create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------- recruitment processes -----------------------------------
-- Several processes per company are allowed (patterns change by year/drive).
-- A process can only be published with a verification date (CHECK below) and
-- at least one source (trigger in migration 3).
create table public.recruitment_processes (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  title             text not null,
  description       text,
  hiring_year       smallint,
  drive_name        text,
  eligibility       text,
  status            public.content_status not null default 'draft',
  last_verified_on  date,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint processes_title_length  check (char_length(title) between 1 and 200),
  constraint processes_year_range    check (hiring_year between 2010 and 2100),
  constraint processes_published_needs_verification
    check (status <> 'published' or last_verified_on is not null)
);
create index processes_company_idx on public.recruitment_processes (company_id, status, hiring_year desc);
create trigger processes_set_updated_at before update on public.recruitment_processes
  for each row execute function public.set_updated_at();

create table public.process_stages (
  id                      uuid primary key default gen_random_uuid(),
  recruitment_process_id  uuid not null references public.recruitment_processes (id) on delete cascade,
  name                    text not null,
  stage_type              public.stage_type not null default 'other',
  description             text,
  topics                  text[] not null default '{}',
  stage_order             integer not null,
  duration_minutes        integer,   -- NULL = not verified
  question_count          integer,   -- NULL = not verified
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint stages_name_length    check (char_length(name) between 1 and 150),
  constraint stages_order_positive check (stage_order >= 1),
  constraint stages_duration_pos   check (duration_minutes > 0),
  constraint stages_qcount_pos     check (question_count > 0),
  -- DEFERRABLE so an admin can reorder (swap two stages) in one transaction.
  constraint stages_order_unique unique (recruitment_process_id, stage_order)
    deferrable initially deferred
);
create trigger stages_set_updated_at before update on public.process_stages
  for each row execute function public.set_updated_at();

create table public.process_sources (
  id                      uuid primary key default gen_random_uuid(),
  recruitment_process_id  uuid not null references public.recruitment_processes (id) on delete cascade,
  label                   text not null,
  url                     text not null,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now(),
  constraint sources_label_length check (char_length(label) between 1 and 150),
  constraint sources_url_http     check (url ~* '^https?://')
);
create index sources_process_idx on public.process_sources (recruitment_process_id, sort_order);

-- ---------- question bank -------------------------------------------
create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.categories (id) on delete restrict,
  question_type  public.question_type not null default 'mcq',
  question_text  text not null,
  difficulty     public.difficulty_level not null default 'medium',
  explanation    text,
  correct_answer text,
  marks          numeric(6,2) not null default 1,
  negative_marks numeric(6,2) not null default 0,
  status         public.content_status not null default 'draft',
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint questions_text_length    check (char_length(question_text) between 1 and 5000),
  constraint questions_marks_positive check (marks > 0),
  constraint questions_negative_nonneg check (negative_marks >= 0),
  constraint questions_mcq_has_answer check (question_type <> 'mcq' or correct_answer is not null)
);
create index questions_category_idx on public.questions (category_id, status, difficulty);
create index questions_status_idx   on public.questions (status);
create trigger questions_set_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions (id) on delete cascade,
  option_key   text not null,
  option_text  text not null,
  constraint options_key_format  check (option_key ~ '^[A-Z]$'),
  constraint options_text_length check (char_length(option_text) between 1 and 1000),
  constraint options_key_unique  unique (question_id, option_key)
);

-- The correct answer must be one of the question's real options. Expressed as
-- a composite foreign key (no trigger needed). NULL correct_answer (coding
-- questions) is skipped by MATCH SIMPLE. DEFERRED so a question and its
-- options can be inserted in one transaction, in any order.
alter table public.questions
  add constraint questions_correct_option_fk
  foreign key (id, correct_answer)
  references public.question_options (question_id, option_key)
  deferrable initially deferred;

create table public.question_tags (
  question_id  uuid not null references public.questions (id) on delete cascade,
  tag_id       uuid not null references public.tags (id) on delete cascade,
  primary key (question_id, tag_id)
);
create index question_tags_tag_idx on public.question_tags (tag_id);

-- ---------- mock tests ----------------------------------------------
create table public.mock_tests (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies (id) on delete set null,
  title            text not null,
  slug             text not null,
  description      text,
  instructions     text,
  duration_minutes integer not null,
  difficulty       public.difficulty_level not null default 'medium',
  status           public.content_status not null default 'draft',
  is_free          boolean not null default true,  -- future monetisation hook
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint tests_title_length check (char_length(title) between 1 and 200),
  constraint tests_slug_format  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint tests_duration_range check (duration_minutes between 1 and 600),
  constraint tests_slug_key unique (slug)
);
create index tests_listing_idx on public.mock_tests (status, company_id, difficulty);
create trigger tests_set_updated_at before update on public.mock_tests
  for each row execute function public.set_updated_at();

create table public.mock_test_categories (
  test_id      uuid not null references public.mock_tests (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  primary key (test_id, category_id)
);
create index mock_test_categories_cat_idx on public.mock_test_categories (category_id);

-- marks / negative_marks are a per-test SNAPSHOT: editing a question later
-- must not silently change how past attempts were scored.
create table public.test_questions (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references public.mock_tests (id) on delete cascade,
  question_id     uuid not null references public.questions (id) on delete restrict,
  question_order  integer not null,
  marks           numeric(6,2) not null default 1,
  negative_marks  numeric(6,2) not null default 0,
  constraint tq_order_positive check (question_order >= 1),
  constraint tq_marks_positive check (marks > 0),
  constraint tq_negative_nonneg check (negative_marks >= 0),
  constraint tq_question_unique unique (test_id, question_id),
  constraint tq_order_unique unique (test_id, question_order) deferrable initially deferred
);
create index test_questions_question_idx on public.test_questions (question_id);

-- ---------- attempts -------------------------------------------------
create table public.test_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  test_id           uuid not null references public.mock_tests (id) on delete restrict,
  status            public.attempt_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  -- Server-authoritative deadline. Always overwritten by a trigger; a client
  -- (or a buggy caller) cannot choose its own deadline.
  expires_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  score             numeric(8,2),
  total_marks       numeric(8,2),
  time_used_seconds integer,
  constraint attempts_submitted_consistent
    check ((status = 'in_progress' and submitted_at is null)
        or (status <> 'in_progress' and submitted_at is not null)),
  constraint attempts_final_has_score
    check (status = 'in_progress' or (score is not null and total_marks is not null)),
  constraint attempts_time_nonneg check (time_used_seconds >= 0)
);
-- At most ONE active attempt per student per test: makes double-clicks and
-- multi-tab "start" requests harmless.
create unique index attempts_one_active_key on public.test_attempts (user_id, test_id)
  where status = 'in_progress';
create index attempts_user_idx on public.test_attempts (user_id, started_at desc);
create index attempts_test_idx on public.test_attempts (test_id);

create table public.attempt_answers (
  id                 uuid primary key default gen_random_uuid(),
  attempt_id         uuid not null references public.test_attempts (id) on delete cascade,
  question_id        uuid not null references public.questions (id) on delete restrict,
  selected_answer    text,
  is_correct         boolean,        -- NULL until server-side scoring
  marks_awarded      numeric(6,2),   -- NULL until server-side scoring
  marked_for_review  boolean not null default false,
  answered_at        timestamptz not null default now(),
  constraint answers_unique_per_attempt unique (attempt_id, question_id),
  -- A selected answer must be a real option of THAT question.
  constraint answers_selected_is_option_fk
    foreign key (question_id, selected_answer)
    references public.question_options (question_id, option_key)
);
create index answers_question_idx on public.attempt_answers (question_id);

-- ---------- student preferences (only what the product needs) --------
create table public.profile_preferred_companies (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  primary key (profile_id, company_id)
);
create table public.profile_interests (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  primary key (profile_id, category_id)
);

-- ---------- audit log (append-only) ---------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,          -- e.g. 'company.create'
  entity_type  text not null,
  entity_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint audit_action_length check (char_length(action) between 1 and 100)
);
create index audit_created_idx on public.audit_logs (created_at desc);
create index audit_entity_idx  on public.audit_logs (entity_type, entity_id);
create index audit_actor_idx   on public.audit_logs (actor_id);

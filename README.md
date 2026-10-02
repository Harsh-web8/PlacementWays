# PlacementWays

A placement preparation platform for Indian college students — company-specific
mock tests, coding practice, and performance analytics.

## Public access and guest mocks

See [ACCESS_CONTROL.md](docs/ACCESS_CONTROL.md) for the configurable guest allowance,
secure guest cookies, rate limits, premium grants, result claiming and required environment settings.
The original uploaded archive remains at the parent repository root.

## Current development status

The uploaded Phase 6 archive has been restored as a runnable Next.js project.
The archive used an earlier roadmap; it did not contain a course system.
This iteration adds company pages and the course/module/lesson foundation,
admin content editors, private student progress, and database-enforced premium locks.

See [the phase-by-phase status and remaining gates](docs/DEVELOPMENT_STATUS.md).
**This is a production-hardened candidate, not a completed launch** (headers/CSP, container image, CI audit and root error boundary are in place; the operator gates below remain). Hosted Supabase checks and the remaining
production provider, security, editorial and deployment gates are still required. See
[the release runbook](docs/PRODUCTION_RELEASE.md) for the web/worker architecture and exact configuration.

## Phase 3: what's included
- PostgreSQL schema (18 tables), migrations, seed data – see `docs/DATABASE.md`
- Supabase Auth: register, email confirmation, login, logout, forgot/reset password
- Student and admin roles, enforced in the database (RLS) **and** on the server (data-access layer)
- Protected routes: `/dashboard`, `/profile` (students), `/admin` (admins; everyone else gets 404)
- Profile management (name, college, degree, graduation year)

## Phase 4: what's included
- `/admin/companies` – list every company (any status), add one
- `/admin/companies/[id]` – edit details (name, slug, description, logo/website URLs, SEO fields, sort
  order), publish / unpublish / archive, and see its recruitment processes
- `/admin/companies/[id]/processes/new`, `/admin/processes/[id]` – create and edit a recruitment
  process (title, hiring year, drive name, eligibility, last-verified date); publish / unpublish /
  archive / delete; manage assessment stages (add, edit, delete, **reorder**) and source links (add,
  delete)
- **Publishing is gated by the database, not just the UI**: a process can't be published without a
  source link and a verification date (see `docs/DATABASE.md` and migration 3). The admin UI catches
  that rejection and shows a plain-language message instead of a raw Postgres error.
- **Stage reordering is atomic**: swapping two stages' order needs one transaction (see migration 5,
  `move_process_stage`), because two separate API calls can't satisfy the deferred uniqueness
  constraint on their own.
- Every create/update/publish/archive/delete writes an `audit_logs` row (actor, action, entity, metadata).
- All of it is still gated by `requireAdmin()` on every page **and** by Row Level Security underneath —
  the admin UI is a convenience layer, not the security boundary.

## Phase 5: what's included
- `/admin/categories` – the seeded 77-category taxonomy, add/edit/delete (delete is refused by the
  database while a category still has questions or subcategories, and the UI says so)
- `/admin/questions` – paginated, filterable question bank (category, difficulty, type, status, text
  search); `/new` and `/[id]` to create/edit; publish / unpublish / archive (questions are archived,
  never deleted, because tests reference them)
  - MCQs take 2–6 options and a correct answer; tags are typed inline and find-or-created
  - Coding and debugging question *types* can be created (text + explanation only) — the test-case and
    execution machinery is Phase 8
- `/admin/questions/import` – CSV import in three explicit steps: **upload → preview with per-row errors
  → confirm**. Nothing is written until you confirm; the confirm step re-parses and re-validates the
  file server-side rather than trusting anything echoed back by the browser. Imported questions are
  always saved as **drafts**. Only the valid rows are imported.
- `/admin/tests` – mock-test CRUD (title, slug, duration, difficulty, company, free/premium, instructions),
  publish / unpublish / archive / delete, category assignment, and question assignment
  (`/admin/tests/[id]/add-questions`) with reorder, removal and a **per-test marks / negative-marks
  override** (a snapshot, so editing a question later never changes how a test is scored)
- **Atomicity lives in the database** (migration 6): saving a question and its options is one transaction
  (`admin_save_question`) because an MCQ's correct answer must be a real option; the CSV import
  (`admin_import_questions`) is all-or-nothing; reordering a test's questions (`move_test_question`)
  is an atomic swap. All three are `SECURITY INVOKER`, so RLS still requires an admin.
- `npm run db:types` now also maps scalar and `SETOF` return types and treats RPC arguments as nullable.

## Phase 6: what's included
- `/tests` – public, filterable listing of published tests (company, topic, difficulty, free/premium,
  max duration, minimum questions, newest/most-attempted) reading only `published_mock_tests`, a view
  that exposes aggregates (question count, total marks, attempt count) without exposing any question
- `/tests/[slug]` – instructions page (duration, question count, total marks, topics, scoring rules,
  an honest line that no online test can fully prevent cheating) with a Start button that becomes
  Resume if the student already has that test open
- `/attempts/[id]` – the timed test-taking screen: countdown, question palette (answered / not answered
  / marked for review), previous/next, mark for review, clear answer, autosave with visible status and
  automatic retry on a dropped connection, and a submit-confirmation dialog. Works down to a phone width.
- `/attempts/[id]/result` – score, accuracy, time used, and every question with the correct answer,
  the student's answer, and its explanation -- available only once the attempt is over
- Dashboard now lists recent attempts (resume an in-progress one, or open its result)
- **The server is the only authority.** Five `SECURITY DEFINER` functions (migration 7) do all of it:
  - `start_test_attempt` -- resumes a running attempt or starts a new one; rejects an unpublished test,
    an inactive account, or a test with no questions; concurrent clicks are serialised per student+test
  - `save_attempt_answer` -- saves one answer; a trigger rejects a question that isn't in this test, a
    foreign key rejects an option that doesn't exist, and it refuses once the attempt is over
  - `submit_attempt` -- idempotent (submitting twice reports the existing outcome rather than re-scoring);
    optionally takes the browser's full answer map as a safety net for a save lost to a network blip;
    a stale or invalid entry in that map is skipped rather than failing the whole submission
  - `get_attempt_state` / `get_attempt_result` -- the state call never includes a correct answer; the
    result call returns nothing at all while the attempt is still running
  - The deadline (`expires_at`) is set by a database trigger and enforced in these functions, not by the
    browser's clock; a small grace period absorbs the auto-submit's own network latency. All five derive
    the student from the signed-in session (`auth.uid()`) and are typed and content-validated end to end
    with Zod before anything reaches the database.
- Scoring uses the **test's own** `marks`/`negative_marks` (the Phase 5 snapshot), never the question
  bank's current values, so editing a question after the fact can't change anyone's past score.

## Deploy
See the *Container deployment* section of [PRODUCTION_RELEASE.md](docs/PRODUCTION_RELEASE.md) (`Dockerfile`, build args, web + worker roles).

## Setup
1. Use Node.js 24 and run `npm ci`
2. Follow **`docs/SUPABASE_SETUP.md`** (create project, apply migrations, env vars, email templates, first admin).
3. `npm run dev` → http://localhost:3000

## Scripts
- `npm run dev` / `build` / `start` / `lint` / `typecheck`
- `npm test` – unit tests (Vitest)
- `npm run test:db` – database tests (needs a local PostgreSQL; never touches Supabase)
- `npm run test:e2e` – end-to-end auth flow test against a mock Supabase (builds the app itself; no separate build step needed)
- `npm run db:types` – regenerate `src/types/database.ts` after a migration (now types multi-argument
  RPC functions too, e.g. `move_process_stage`, not just zero-arg ones)

## Security notes (plain language)
- **Passwords** are handled by Supabase Auth (bcrypt); this app never stores or logs them.
- **Roles** live only in `profiles.role`. Signing up can never create an admin, whatever the browser sends.
- **Every table has Row Level Security.** Even if the app had a bug, a student's token cannot read questions/answers or edit scores.
- **Session cookies are HttpOnly** – page scripts can't read them.
- **`proxy.ts` is only a convenience redirect.** The real checks are `requireUser()` / `requireAdmin()` in `src/server/auth/session.ts`, called by every protected page and Server Action.
- **Login/reset messages don't reveal whether an email is registered.**
- Redirect targets (`?next=`) are validated to prevent open-redirect phishing.
- CSRF: Server Actions are origin-checked by Next.js.
- **Rate limiting:** Supabase Auth rate-limits its endpoints server-side. Guest mocks now have database attempt quotas and daily network rate limits; see ACCESS_CONTROL.md. Broader endpoint controls remain a launch gate.

## Remaining work

See [DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md) for the authoritative mapping
to the current ten-phase plan, database changes, local validation limits and next steps.

## Project structure

```
src/
  app/
    (auth)/         login, register, forgot-password, reset-password
    (student)/      dashboard, profile            (requireUser)
    (admin)/admin/  overview, companies/, processes/, categories/, questions/ (+import), tests/  (requireAdmin)
    (marketing)/    tests/, tests/[slug]/                                                        (public)
    attempts/[id]/  the timed test screen, and /result                                            (student or guest owner)
    auth/confirm/   email-link handler (token_hash -> session)
    page.tsx        homepage with published company/course/mock listings
  components/       ui/ primitives, auth/ forms, admin/ forms + status controls, layout/ header
  lib/              env, validation (Zod), route rules, Supabase clients, proxy logic
  server/           auth/session.ts (data-access layer), Server Actions, admin/ (companies, processes)
  types/database.ts generated from the migrations
  proxy.ts          optimistic route protection + session refresh
supabase/
  migrations/       schema, auth sync, integrity rules, RLS, stage-reorder RPC, question/test RPCs, student attempt functions
  seed.sql          companies + category taxonomy (no unverified claims)
  tests/            SQL test-suite + local harness
tests/              unit/ (Vitest), e2e/ (mock Supabase smoke test)
docs/               DATABASE.md, SUPABASE_SETUP.md
```

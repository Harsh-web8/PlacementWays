# Database design

PostgreSQL via Supabase. Migrations live in `supabase/migrations/` and run in filename order.

## Public tables (38) and views (3)

| Group | Table | Purpose |
|---|---|---|
| Identity | `profiles` | One row per Supabase auth user. Role, active flag, college, degree, graduation year. |
| | `profile_preferred_companies`, `profile_interests` | Optional preferences (join tables). |
| Companies | `companies` | Adding a company is an INSERT, not a code change. Draft/published/archived + SEO fields. |
| | `recruitment_processes` | Many per company (year/drive). Publishing requires a **last-verified date** and **≥1 source**. |
| | `process_stages`, `process_sources` | Ordered stages (swap-safe reorder); multiple source links. |
| Content | `categories` | Two-level tree (6 sections, 71 topics seeded). |
| | `questions`, `question_options`, `tags`, `question_tags` | Question bank. |
| Tests | `mock_tests`, `mock_test_categories`, `test_questions` | `test_questions` snapshots marks/negative marks per test. |
| Attempts | `test_attempts`, `attempt_answers` | Server-authoritative deadline; one active attempt per student per test. |
| Learning | `courses`, `course_modules`, `lessons`, `lesson_contents`, `lesson_questions` | Public discovery/metadata and access-controlled lesson bodies/resources. |
| Progress | `course_progress`, `lesson_progress`, `practice_attempts` | Private enrollment, lesson completion and practice results. |
| Publishing | `blog_posts`, `site_settings` | Published articles and configurable public platform settings. |
| Guest mocks | `guest_mock_sessions`, `guest_mock_rate_limits` | Server-owned hashed guest identifiers and temporary network quotas; attempts reuse `test_attempts`. |
| Access/billing | `content_entitlements`, `purchase_orders`, `payment_events` | Manual/purchase grants, private orders and idempotent verified provider events. |
| Coding | `coding_languages`, `coding_test_cases`, `coding_submissions`, `coding_jobs`, `worker_heartbeats` | Public language choices/examples, private hidden tests, owned results and service-only leased jobs. |
| Ops | `audit_logs` | Append-only admin activity log. |

Views: `published_mock_tests` exposes mock metadata only for published tests with published
companies (or no company); `practice_questions` exposes published practice prompts;
`coding_examples` exposes only sample inputs/outputs for published practice coding problems.

## Deliberate differences from the suggested schema
- **`users` → `profiles`**: Supabase owns credentials in `auth.users`; duplicating them would be a security risk. `profiles.id` = `auth.users.id`.
- **`status` enum instead of `is_published`** on companies: needs three states (draft/published/archived) for the archive requirement.
- **`process_sources` table instead of one `source_url`**: your spec asks for multiple source links per process.
- **Added**: `expires_at`, `marked_for_review` (test reliability), `slug` on tests, `topics[]` on stages, `audit_logs`, tags, preference tables.
- `OOP` appears once (under Programming) so category slugs stay unique.

## What the database enforces itself
- A process can't be published without a verification date and a source (checked at commit, so parent + children can be saved together).
- The correct answer must be one of the question's real options (composite FK); a published MCQ needs ≥2 options; a published test needs ≥1 question.
- An attempt's deadline is `start + test duration`, set by a trigger – callers can't choose it.
- A submitted attempt is frozen: no double submit, no score/answer edits, not even from server code.
- An answer must belong to a question of that attempt's test, and its chosen option must exist on that question.
- Deleting content that students' history depends on is refused (archive instead); deleting a student removes their attempts; audit rows survive with `actor_id` = NULL.
- URLs must be http(s) (blocks `javascript:` links); slugs are format-checked.

## Security model (RLS + grants)

| Who | Can |
|---|---|
| Anonymous database role | Read published public company/process/mock/course metadata, permitted lesson previews, practice prompts, coding examples, articles, categories, enabled languages and public settings. Cannot directly read guest tracking, private attempts, orders, jobs or the answer bank. |
| Student | Above plus own profile, progress, submissions, results, orders and entitlements through RLS. Answers/explanations are returned through authorized result flows. Cannot forge scores, payment events, hidden cases, worker jobs or roles. |
| Admin | Manage content, access rules, settings and coding cases with an active admin profile. Refund requests use an admin-checked RPC; payment confirmation and grading remain server-controlled. |
| Trusted server/service role | Scoped application operations after authorization: guest gateway/result claiming, verified billing webhooks, private resource upload/signing, and coding worker RPCs (`claim_coding_job`, `save_coding_tokens`, `finish_coding_job`). Its key is never exposed to browsers. |

Guests access their mock through `guest_mock_gateway`, called only by server code after
validating the opaque cookie. Guests do not receive direct database access to attempt rows.
The shared scoring engine and existing ownership rules apply to guest and account attempts.
The billing webhook verifies its signature, payment mode and database order amount before
applying an event; clients cannot grant themselves purchased access. Hidden coding test
inputs and provider tokens are kept behind service/admin boundaries.

See [ACCESS_CONTROL.md](ACCESS_CONTROL.md) for the access matrix, cookie ownership and
quota rules, and [PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md) for privileged service
configuration and hosted verification requirements.

## Testing
`npm run test:db` builds a scratch PostgreSQL DB, applies every migration and the seed (twice), and runs the SQL security and integrity suites, including attacks (privilege escalation, forged scores, cross-user reads). Requires a local PostgreSQL superuser connection (`PGHOST`, `PGUSER`, …). It never touches Supabase.

## Adding a migration
Create `supabase/migrations/<timestamp>_name.sql`, run `npm run test:db`, then `npm run db:types` to refresh `src/types/database.ts`. Every new table must enable RLS – `01_structure.test.sql` fails if one doesn't.

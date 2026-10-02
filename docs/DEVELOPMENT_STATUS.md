# Production completion update — 29 September 2026

This is an implementation candidate, **not a deployed or certified production release**.
The earlier phase notes below are historical and are superseded by this table.

| Phase | Implemented and locally checked | Launch gate |
| --- | --- | --- |
| 1 — Foundation | Extracted source, Node 24 toolchain, CI, typed database | Target Supabase and hosting configuration |
| 2 — Public discovery | Company/course/mock/question browsing, public previews, SEO metadata | Production URL and reviewed company content |
| 3 — Authentication | Supabase Auth integration, role guards, confirmation/recovery flows, RLS | Actual email delivery and hosted API verification |
| 4 — Admin | Content/settings/access controls, activity feed, execution cases/languages, orders/refunds | Hosted administrator acceptance checks |
| 5 — Curriculum | Courses, lessons, questions, CSV, assignments, difficulty levels | Editorial approval of initial catalog |
| 6 — Learning | Timed mocks, guest-first experience, progress, private PDF download, isolated coding queue | Hosted Storage and dedicated compiler verification |
| 7 — Personalization | Saved history, analytics, recommendations, coding verdicts in progress | Hosted student journey and operational monitoring |
| 8 — Content | Original starter curriculum and executable sample problems | Source-verified recruitment facts per hiring cohort |
| 9 — Quality/security | SQL/RLS suites, unit tests, build/HTTP smoke; real compiler probes and worker tests | Hosted security/load tests and final review results |
| 10 — Commerce/operations | Signed payment webhook, paid entitlements, full refunds, sitemap/robots, health/preflight, release runbook | Stripe test-mode verification, owner policies, backup/restore drill, domain/deployment |

New code includes an isolated Judge0-compatible worker for Python, JavaScript, C++ and Java,
admin-managed hidden/public test cases and quotas, private coding results, optional Stripe
checkout/refund support, private lesson PDFs, admin activity, settings display and SEO.
Execution and purchases default to disabled until configured. Student code is never run
inside Next.js. Production payments require verified provider events.

Read [PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md) for configuration and release gates.
The provided screenshot contains public Supabase configuration; it does not provide the
server/database credentials needed for deployment. No remote migration, real charge, public
launch or production restore has been performed. Local Stripe emulator limitations mean
real Stripe test-mode checkout remains unverified. Official recruitment source requests
returned HTTP 403 in this sandbox; no unverified hiring rules were added.

---

## Historical implementation notes

# Public access implementation update

The extracted application now includes database-configured guest mocks, account attempt
limits, premium entitlements, admin controls and guest result claiming. See
[ACCESS_CONTROL.md](ACCESS_CONTROL.md) for migration and deployment instructions.

Local validation for this update is recorded in the task workspace. The earlier
seed-sensitive SQL assertions have been repaired. Hosted Supabase/email verification,
production trusted-ingress configuration, payment processing and deployment remain
separate launch gates. The historical status below describes the uploaded baseline.

# Master plan status

The repository originally contained only `placementways-phase6.zip`. Its phase labels
refer to an earlier mock-test roadmap, not completion of the current ten-phase brief.
The source is now restored at the repository root; the archive is preserved unchanged.

## Latest delivery status

This archive includes the latest work in progress. Development was interrupted at
an export request; this is not a production release.

New additions since the earlier ZIP:

- Public practice and coding catalogs, private submissions/results, and saved draft answers.
- Admin practice visibility/slugs and lesson-to-question assignment.
- Five difficulty levels across question, course, mock and CSV validation.
- Blog publishing, student access management and editable site settings.
- Private topic/subject/difficulty/company analytics, weak-topic recommendations and retest history.
- Database guards preserving used mock content, account checks and submission/start limits.
- Original starter content: three free courses, nine lessons, 27 MCQs, three coding exercises,
  three nine-question checkpoints and one study-planning article.

Verification at export:

- TypeScript, lint and 149 unit tests passed before the final seed-content addition.
- All 11 SQL suites passed before the final seed-content addition.
- The latest SQL rerun stops in `03_rls.test.sql`: an old assertion expects one published
  mock, but the three new seeded mocks make the count four. Fixture-specific assertions
  must be updated and the entire suite rerun. Other global-count assertions also need review.
- Production build/HTTP smoke and full browser checks have not been rerun for these additions.
- Real local Supabase Auth and PostgREST reached health/readiness checks, but full signup,
  email confirmation, recovery and application flows remain unverified. Local runtime
  configuration and credentials are deliberately excluded from this ZIP.
- The final review of the earlier patch was interrupted. These latest additions still
  require a completed CodeRabbit review.

## Remaining work, in order

1. Repair seed-sensitive test assertions; add browser/HTTP coverage for the new features,
   then rerun SQL, TypeScript, lint, unit tests, production build and code review.
2. Complete real Supabase signup/login/logout/confirmation/recovery, private-data and
   premium-content checks. Configure the target project and apply migrations in order.
3. Finish the settings display and expanded admin activity reporting. Verify all lesson
   assignment, practice, analytics and mobile flows, including refresh/network interruption.
4. Add current recruitment processes and eligibility from verified official sources.
   Source lookup was blocked; no new recruitment claims were published. Expand and
   editorially review the initial curriculum as needed.
5. Complete the security audit: private resource delivery, broader abuse/rate controls,
   historical-result behaviour and hosted RLS verification.
6. After Phase 9 is stable, implement Phase 10: dynamic SEO, sitemap/robots/canonicals,
   structured data, Search Console, analytics, verified payments, purchase entitlements,
   refund handling, orders, deployment, monitoring and launch checks.

## Earlier implementation

- Reproducible npm install and clean-checkout type checking (`next typegen` first).
- Public company listing/search and published recruitment detail pages, including
  eligibility, ordered stages, source links, verification dates, and mock/course links.
- Public course listing/search/filtering/pagination, syllabus, lesson navigation,
  free lesson reading, enrollment and completion, and dashboard continuation.
- Admin course/module/lesson CRUD, publication, numeric ordering, category/company/mock
  associations, HTTPS resource/video links, and prices in integer INR paise.
- Separate public lesson metadata and access-controlled lesson bodies/resources.
- Private progress with server-derived identity and idempotent database writes.
- Premium courses deny enrollment and body access; designated free previews are readable.
- Existing premium mock start RPC bypass closed. Paid access is not granted yet.
- Original authentication, question bank, CSV import, test management and timed attempts retained.

## Database changes

Apply migrations in filename order. Existing installations apply only unapplied migrations.
No existing table or data is recreated by the new migrations.

`20260929090000_learning_content.sql` adds:

- `courses`, `course_modules`, `lessons`, `lesson_contents`, `lesson_questions`
- `course_progress`, `lesson_progress`
- RLS, grants, indexes, update timestamps, price and URL constraints
- `can_read_lesson`, `start_course`, `complete_lesson`, `admin_save_lesson`

`20260929090100_premium_mock_guard.sql` updates `start_test_attempt` to refuse
premium mocks until verified access exists.

`20260929090200_atomic_test_categories.sql` adds the admin-only
`set_test_categories` RPC. It locks the test row and atomically replaces its categories,
preserving the previous assignments if any new category is invalid.

Categories already model subjects and topics as a hierarchy. Reuse them; do not create
an unrelated duplicate topic taxonomy. `lesson_questions` prepares question reuse;
student practice and its admin assignment screen have now been added and await full integration checks.

Deletion is refused when a course/module has children or a lesson has student progress.
Use archive status to preserve that history. Text content is escaped plain text, not HTML.
Video/resource URLs must use HTTPS. A linked external file is accessible to anyone who
already knows its URL; do not put premium files in public storage. Signed private storage
access is a separate launch requirement.

## Phase gates against the new brief

| Phase | Current coverage and remaining work |
| --- | --- |
| 1 | Source/tooling work. Production Supabase configuration remains. |
| 2 | Public company/course/mock/practice/coding/blog routes exist; new pages need browser/mobile verification. |
| 3 | Auth and RLS exist; real confirmation/recovery/application integration remains. |
| 4 | Content, students, blog and settings management exist. Settings display, activity reporting and integration checks remain. |
| 5 | Course hierarchy, question bank, CSV, lesson assignments, five difficulties and practice are implemented; final validation remains. |
| 6 | Course learning, progress, practice and timed mocks exist; refresh/offline/browser checks remain. |
| 7 | Analytics/recommendations/history implemented with SQL tests; real application verification remains. |
| 8 | Starter curriculum added. Seed-sensitive tests need repair; verified recruitment facts and editorial review remain. |
| 9 | Partial checks passed. Latest seed change fails an old test count; complete audit and review remain. |
| 10 | Not started: gated on Phase 9. SEO expansion, payments, analytics, deployment and launch remain. |

Do not describe the platform as production-ready or mark Phases 1–9 complete from local
mock checks. No hosted migration, remote deployment, purchase or public launch occurred.

## Continue in order

1. Configure Supabase and apply migrations; verify live auth/email/PostgREST with the
   checklist in `SUPABASE_SETUP.md`. Never provide service-role credentials to the browser.
2. Validate the new practice, admin and analytics implementation; finish remaining settings/activity gaps.
3. Add sourced initial company ecosystems, then complete the Phase 9 audit.
4. Begin Phase 10 only when those gates pass.

## Verification

- Unit validation covers pricing, references and HTTPS resource URLs.
- SQL suite covers enrollment/completion idempotency, private progress, locked bodies,
  draft ancestors, inactive users, atomic lesson writes, student/admin access and premium mocks.
- HTTP smoke uses synthetic fixtures, including the course editor and student progress actions.
  It tests application wiring; it does not stand in for Supabase's PostgREST implementation.
- The shared browser is used for mobile public navigation checks.
- The first three CodeRabbit passes reported 7, 2 and 3 findings respectively.
  Eleven actionable findings were fixed: editable slugs, preserved test filters,
  attempt ownership, CSV limits/error handling, category validation, homepage failure
  isolation, smoke startup handling and form accessibility. The lesson-visibility
  concern was verified as already enforced by the transitive RLS policies; additional
  direct anonymous/student PostgreSQL tests confirm unpublished ancestors stay hidden.
  The fourth pass found five additional minor issues, addressed with consistent
  startup polling delays, a single pending answer-save retry, improved focus contrast,
  merged accessibility descriptions and atomic test-category assignment.
  The fifth pass found six issues, addressed with source ordering, explicit dashboard
  errors, missing-process detection, question-picker pagination, positive stage metadata
  guards and stricter synthetic Auth tokens.
  The fixes are covered by the checks above. Subsequent review outcomes are recorded
  in the workspace validation record.

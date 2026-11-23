# PlacementWays Milestone 6 — Recruitment Content Quality & Staging Readiness

## Implemented in this milestone

1. **Private editorial coverage page** at `/admin/recruitment/coverage`: published company/role/drive/round counts, monitored-source coverage, missing guides, missing round evidence, stale source scans and stale review dates. Results are never shown to anonymous visitors. The page requires `requireAdmin()` and paginates source records to avoid silently counting only the first 1,000 rows.
2. **Public evidence-quality indicators** on company role pages. Review timestamps older than 30 days are flagged for rechecking, unknown dates are labeled honestly, and drives that remain listed `open` after their recorded deadline show an explicit deadline warning. These are guidance flags, not an assertion that sources or jobs are current.
3. **Staging smoke-test command** `npm run smoke:staging` checks anonymous public routes, the disabled student registration redirect, admin route authentication, the database health endpoint and unauthorized recruitment-scheduler calls. No valid admin or API secrets are sent; the scheduler is tested only without authorization.
4. **Release gate improvements** in `npm run check:production`: Node.js 24, 32+ character scheduler secret, approved source host list, and strictly disabled payments for the V1 free launch. Do not mistake a passing config check for a live end-to-end test.
5. New automated unit suites for coverage/freshness rules and the staging smoke evaluation. CI runs both suites alongside existing checks.
6. A separate editorial source onboarding/verification protocol (`docs/CONTENT_VERIFICATION.md`) and an empty research worksheet (`docs/source-intake-template.csv`). No fictitious recruitment claims or automatically published company data are included.

## Staging activation — required manual steps

1. Use **Node.js 24** and run `npm ci` inside `PlacementWays/placementways`. Do not run on the Node.js 22 sandbox used for the limited tests below.
2. Create **separate staging Supabase** with a backup and apply all SQL migrations in timestamp order. Do not run disposable `supabase/tests/run.sh` against staging or production; that script drops a throwaway database.
3. Configure server-side Supabase credentials, `RECRUITMENT_ALLOWED_HOSTS`, `RECRUITMENT_CRON_SECRET` (32+ characters), trusted ingress/rate limiting, and optionally `OPENAI_API_KEY` in your staging environment. Do not upload `.env.local` or credentials to a shared ZIP.
4. Add specific permitted official recruitment source URLs via authenticated `/admin/recruitment`. An initial scan usually establishes a baseline; later changes can generate review proposals, and discoveries may be suggested from the initial scan only when supported by explicit evidence.
5. Keep `PLACEMENTWAYS_ENABLE_COMMERCE=false`, `STRIPE_LIVE_MODE=false` and database `site_settings.commerce_enabled=false`. Student login remains optional/not required; protected admin authentication remains essential.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:quality`, `npm run test:staging-smoke`, `npm run test:sql`, `npm run test:discovery`, and `npm run build`. Run DB suites only on the intended disposable PostgreSQL test environment.
7. Deploy staging HTTPS; run `STAGING_BASE_URL=https://your-staging-domain npm run smoke:staging`. The smoke test must report 9/9 checks. It is a minimal route/security probe, not full end-to-end assurance.
8. In staging, verify AI detection → source quote → draft → authenticated admin approval → correct role/drive/round field → public update → rollback, with controlled test data and **no** unapproved publication.
9. In separate browsers, verify unrestricted page viewing and mock tests, and that guest coding ownership and quotas work with the real isolated Judge0-compatible service. Confirm the service cannot access Supabase secrets or other guests' results.
10. Test PDF and JSON source adapters with approved fixtures, source failure/retry, backup-restore, mobile accessibility, page performance and cron/scheduler reliability. Run `npm run report:coverage`, then inspect `/admin/recruitment/coverage` for editorial gaps.

## Actual local validation status

- 10/10 new content-quality unit tests passed (Node.js 22 experimental TypeScript stripping).
- 6/6 new staging-smoke **logic tests** passed (mocked HTTP responses only).
- 9/9 existing recruitment discovery tests and 6/6 SQL lab tests passed.
- TypeScript parser accepted 230 TS/TSX source/test files without syntax errors.
- The project was **not** compiled with Next.js 16, tested against a running Supabase/PostgreSQL instance, or checked against live recruitment sources in this environment. Neither Node.js 24 nor populated staging credentials are available. Do not claim a production launch.

## Milestone 6 acceptance before release

- The admin coverage dashboard reads real staging rows and correctly ranks a deliberately incomplete company.
- Public role page shows correct evidence-age and expired-deadline warnings.
- Official source URLs can be registered, scanned, checked and approved without cross-company data leaks.
- Anonymous visitors can browse all public learning sections without a login or payment prompt.
- Coding runs only in the sandbox; the limited SQL lab cannot query live application data.
- Health and admin probes pass, test suites complete, and no published source or pattern is fabricated.

## Remaining work

- Real staging deployment with credentials and isolated executor, database integration and end-to-end browser validation.
- Source onboarding and editorial verification for each desired employer (the software cannot promise every company is covered).
- Large-scale reviewed question and mock-test content, accessibility checks, and measured performance tuning.
- Operational monitoring, backup recovery exercise and final launch review.

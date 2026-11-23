# PlacementWays Milestone 7 — Integration hardening & launch acceptance

## Status (23 November 2026)

**Implemented and locally tested** code-level improvements for deployment acceptance. **Not a live staging deployment.** The sandbox has Node.js 22, lacks Next.js dependencies/PostgreSQL, and has no supplied Supabase, AI, or Judge0 credentials. Accordingly, no full Next.js build, migration execution, public-domain hosting check, or actual official-source scan was performed here.

## Delivered in source

1. **Recruitment scanner recovery fix:** an evidence-backed role, drive or selection-round change is now queued for human review even on a first source scan. If a source change was captured while AI was unavailable, a later successful AI parse can enrich the original *pending* proposal without requiring the website to change again. Database uniqueness still enforces one proposal per source fingerprint; an already-approved or rejected proposal is never silently overwritten. See `src/server/recruitment/monitor-policy.ts` and `tests/recruitment/monitor-policy.test.mjs`.
2. **Real database acceptance suite prepared:** `supabase/tests/20_recruitment_structured_approval.test.sql` creates synthetic company-role-drive-round fixtures in a throwaway transaction. It checks anonymous/student denial, admin-only atomic field publication, idempotency, rollback and stale-value conflict rejection. Included in the existing `npm run test:db`, which intentionally creates and DROPS a dedicated **local** database. **Never use this test command with hosted staging/production credentials.**
3. **V1 public-launch end-to-end smoke:** `npm run test:e2e` now runs `tests/e2e/public-launch.mjs`, which builds the actual app against a local mocked Supabase, serves it and checks anonymous public catalogs, registration redirect, admin denial and scheduler denial. The test keeps the mock HTTP server responsive during the build. The old account/payment test remains available as `npm run test:e2e:legacy`, but is not a V1 release gate because it expects registration and premium content.
4. **Expanded read-only hosted staging smoke:** `npm run smoke:staging` now covers 12 routes, including free coding, practice, tests and SQL. The scheduler is probed **only without** its credential, to verify a 401 response. It does not publish or mutate content.
5. **Staging configuration gate:** `npm run check:staging` validates basic HTTPS origins, separate-staging confirmation, protected Supabase key separation, disabled commerce, source allowlisting and scheduler secret length. An AI key and isolated Judge0 endpoint are flagged as warnings or as blockers with `--require-ai --require-coding`. This is a configuration check, not proof that an external service works.
6. **CI updates:** repo root `.github/workflows/ci.yml` now runs the scanner and staging configuration unit suites, in addition to the existing Node 24, PostgreSQL, unit, mocked HTTP and Docker checks.

## Staging integration steps (owner/operator action required)

1. Install Node.js **24**, use `npm ci`, and configure a **new isolated Supabase staging project**, not the production database. Set its URL and service credentials only through the deployment secret store; do not include `.env.local` in an archive.
2. Back up the staging database and apply SQL migrations from `supabase/migrations/` in chronological order. **Never run `npm run test:db` against this hosted project**: it is a destructive local disposable-DB harness.
3. Set `DEPLOYMENT_ENV=staging`, `STAGING_DB_ISOLATED=true` (only after independently verifying isolation), `STAGING_BASE_URL` and `NEXT_PUBLIC_SITE_URL` to the HTTPS staging domain. Keep `PLACEMENTWAYS_ENABLE_COMMERCE=false`, `STRIPE_LIVE_MODE=false`, and database commerce settings disabled.
4. Configure a 32+ character `RECRUITMENT_CRON_SECRET` and `RECRUITMENT_ALLOWED_HOSTS` containing **approved** official-source hostnames. Set `OPENAI_API_KEY` server-side if structured extraction is needed. `npm run check:staging -- --require-ai` should pass before full AI acceptance.
5. Configure a trusted visitor IP header, `GUEST_RATE_LIMIT_SECRET`, an HTTPS isolated Judge0-compatible service and a coding worker if anonymous coding execution is to be enabled. `npm run check:staging -- --require-coding` checks initial configuration, but you must also verify quotas and worker completion live.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:monitor`, `npm run test:discovery`, `npm run test:sql`, `npm run test:quality`, `npm run test:staging-config`, `npm run test:staging-smoke`, `npm run test:e2e`. Run `npm run test:db` **only on a throwaway LOCAL PostgreSQL server** with CI-style credentials.
7. Deploy HTTPS staging. Set `STAGING_BASE_URL=https://...` and run `npm run smoke:staging` — all **12** checks must pass, including denial of unauthenticated admin and scheduler requests.
8. Add one *approved* recruitment source to a published test role/drive; scan to establish a baseline. Change a fixture/source you control, then verify: source fetch -> AI field extraction -> pending proposal + quoted evidence -> no public change before approval -> admin approval -> correct public role/round data -> audit history -> safe rollback. Use synthetic test records; never publish a false employer announcement on a public site.
9. Simulate an AI extraction outage followed by recovery while the source fingerprint remains unchanged. Confirm that pending proposals get newly validated field changes without duplicate publication. Confirm rejected/approved proposals cannot be changed by a delayed model response.
10. Verify browser performance and accessibility on a small phone and desktop, original content integrity, source-coverage report, access control, real backup/restore, uptime alerts, and worker isolation. Save evidence in `docs/M07_STAGING_ACCEPTANCE.md`.

## What is and is not verified locally

- **Passed locally:** 6 monitor-policy tests; 6 staging config tests; 6 staging smoke-logic tests; 10 recruitment-quality tests; 9 discovery tests; 6 SQL Lab tests. Total **43 unit/smoke-logic checks**. TypeScript/TSX files parse without syntax errors (see release notes).
- **Prepared but not executable locally:** the new PostgreSQL approval test and `npm run test:e2e` (requires Node 24 plus `npm ci`). The 12 HTTP checks need a deployed staging origin to verify actual routes.
- **Not activated:** live recruitment monitors, AI provider, public website deployment, isolated Judge0 worker, Supabase migrations and production backup/restore.

## Boundaries for the free launch

No student login or payment is required to browse companies, learn, practice or take available tests. Admin login remains private. No student-facing AI doubts/chatbot or AI mock interviewer is added. AI drafts are never published without admin approval. Company coverage depends on individually registered and accessible authorized sources; there is no claim of complete coverage of all employers.

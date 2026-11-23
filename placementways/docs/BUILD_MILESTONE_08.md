# Milestone 8 integration readiness

Validation on 23 November 2026 used Node.js 24.22.3, Next.js 16.4.6, a disposable PostgreSQL 16.16 database with Supabase role and Auth stubs, and Chrome against the production Next.js build.

## Changes

- Regenerated Supabase types from the applied migration chain and fixed production build and lint errors.
- Updated Next.js and its ESLint config to 16.4.6, updated Zod, and refreshed the affected transitive lockfile entries. The production dependency audit reported zero vulnerabilities.
- Restored browser-owned coding result pages. A guest can submit and poll with their own secure cookie. The page and API return a private 404 for a different browser.
- Made direct mock URLs obey company publication status. Anonymous mock errors describe availability and quota limits. The staging preflight requires the rate-limit secret and trusted ingress header because mocks and practice need both.
- Fixed structured AI extraction, preserved the previous source snapshot during retry, and committed proposal, field and discovery writes together. Approval and queue enrichment lock the same proposal row. A delayed scan leaves an approved or rejected proposal intact.
- Added explicit database grants for service-role queries used by monitoring and release diagnostics. New Supabase projects require these grants for Data API access. [Supabase Data API changes](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- Loaded role drives and their rounds together and reused that result between metadata and page rendering. Applied the role filter before limiting its updates. These changes reduce database round trips and retain recent updates for the selected role.
- Added a keyboard skip link, phone navigation with larger touch targets, improved text contrast and keyboard-scrollable SQL tables. SQL accepts formatted multiline queries, and the first exercise starts with a blank query stub.

## Local acceptance

| Check | Result |
|---|---|
| Lockfile installation | `npm ci` completed on Node.js 24. |
| Production build, TypeScript, ESLint | Passed. |
| Unit and scripted suites | 189 Vitest tests, including the previously excluded company directory suite, and 45 checks across SQL Lab, monitor policy, discovery, recruitment quality, staging config and staging smoke logic passed. |
| PostgreSQL | Applied 26 migrations and seeded twice. All 21 SQL suites and both concurrency scripts passed. On Windows the SQL files ran in the same order as the psql harness through the `pg` driver. |
| Recruitment | The scanner test exercised synthetic HTTPS content, AI outage, retry with the previous snapshot, and rejection of an unsupported quote. PostgreSQL exercised private queueing, enrichment of the same fingerprint, admin publication, stale-write rejection, rollback and late retry denial. |
| Free public launch | Production HTTP tests verified public catalogs and representative course and role details, anonymous mock start, coding result ownership, and denial of anonymous admin and scheduler access. |
| Browser | Checked seven layouts at 320 px, keyboard skip navigation, SQL grading, a timed guest mock through submission and result, anonymous coding, independent browser denial, and role navigation at 1440 px. |
| Coding worker | The actual worker completed a guest job on local PostgreSQL with a simulated Judge0 API. Verified the network-disabled flag, resource-limit settings, hidden-output redaction and ownership. |

The hosted Supabase project, authorized-source access, AI account, Judge0 isolation, HTTPS ingress, container deployment and staging backup/restore still need verification. The legacy student-registration and checkout HTTP suite remains available for historical testing.

## Staging deployment checklist

Use [the executable staging deployment and acceptance guide](STAGING_DEPLOYMENT.md) for the web/worker Compose setup, test fixtures and hosted verification commands.

1. **Prepare the target.** Record the HTTPS staging URL, artifact hash, and Supabase project ref in [the staging evidence log](M07_STAGING_ACCEPTANCE.md). Confirm that staging uses its own account or project data and backups. Build the Dockerfile from `placementways/` with Node.js 24, `DEPLOYMENT_ENV=staging`, and the three public build args from `.env.example`.
2. **Migrate the staging database.** Back it up and confirm the linked project ref before applying the migration files in order. Confirm `20261123170000_atomic_recruitment_queue` and `20261123171000_public_mock_visibility` are present. Use seed and acceptance fixtures only in a fresh, isolated environment. Run `npm run test:db` only on a disposable local PostgreSQL instance. The command recreates `placementways_test`.
3. **Configure web and admin Auth.** Set the Supabase Auth site and recovery URLs to staging, disable public sign-ups, and provision a dedicated admin plus a synthetic non-admin through the dashboard. Confirm that both users receive the expected role. Exercise admin sign-in, reset email, and rejection of the non-admin. See [Supabase setup](SUPABASE_SETUP.md).
4. **Set runtime secrets and free-launch settings.** Provide the staging-only service-role credential, scheduler secret, guest HMAC secret, and AI key through the secret store. Set `STAGING_DB_ISOLATED=true` after verifying the target. Keep `PLACEMENTWAYS_ENABLE_COMMERCE=false`, `STRIPE_LIVE_MODE=false`, and `site_settings.commerce_enabled=false`. Verify published content is free, `guest_mock_enabled=true`, and guest limits are positive.
5. **Configure ingress and the worker.** Choose a trusted visitor-IP header that the ingress overwrites. Configure an isolated HTTPS Judge0 endpoint with egress blocked and keep provider credentials in the worker environment. Run the web and worker as distinct processes. Verify heartbeat, sample and hidden verdicts, stale-lease recovery, rate limits, and result access from a second browser.
6. **Run preflight and HTTPS smoke checks.** Run `npm run check:staging -- --require-ai --require-coding` and `npm run smoke:staging`. In a fresh browser, open a published company and role guide, start and submit a company mock, run and submit code, open a course lesson, and grade a SQL exercise. Check the published routes and run keyboard and mobile checks at the staging URL.
7. **Exercise editorial approval.** Allowlist only authorized source hostnames and configure a scheduler to send an authenticated `POST /api/cron/recruitment`. Use a synthetic company, role and drive with an authorized fixture URL in the private staging environment. Establish a baseline, introduce an evidence-backed change, and record the pending diff and source quote. Confirm the role and feed remain unchanged until admin approval. Approve, verify the public role and feed, confirm audit history, and exercise rollback.
8. **Exercise recovery.** Simulate an AI failure and retry while the fixture fingerprint stays unchanged. Verify one pending proposal is enriched, closed decisions stay intact, and a conflicting edit fails atomically. Check monitor failures and alerts, test a restore into a separate environment, and record mobile accessibility and performance from staging.
9. **Review launch evidence.** Use `npm run report:coverage` to identify missing or stale employer sources. Review only source-backed claims. Record critical acceptance evidence and obtain the release owner's approval before any production changes.

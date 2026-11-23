# PlacementWays Milestone 05 — Anonymous Coding & Guided SQL + Release Readiness

## What this package implements

- All earlier Milestones 1–4 are retained, including the AI-assisted recruitment source watcher, admin-only one-click approvals, role/drive discovery, public company directory and source-health console.
- **Anonymous coding:** Public `Run` and `Submit` now use the existing isolated coding worker, with a protected server-only gateway. The visitor owns a 256-bit HttpOnly cookie; only its SHA-256 hash is stored. Result retrieval checks the cookie hash on the server. Neither a submission UUID nor a guest cookie grants SQL table access or hidden test-case access.
- **Per-guest and per-network quotas:** No more than 6 requests/hour or 20/day per guest; 24/hour or 80/day per trusted-ingress daily pseudonymous network. Existing global admin coding limits and the worker heartbeat also apply. Concurrency locks serialize quota checks. The visitor's raw IP address is not stored.
- **Privacy:** Guest coding submissions do not create student profiles or practice-attempt records; anonymous completed submissions can be purged after 30 days with `purge_guest_coding_history()` (schedule `npm run cleanup:guest-coding` daily on a private server, after applying the migration). The public result route is now under the marketing layout, without student authentication.
- **Guided SQL lab:** `/sql` works without a login or database. It includes six deterministic placement-style exercises over six employee rows with instant read-only SELECT-subset evaluation. This is explicitly a **limited learning interpreter, not a general PostgreSQL judge**; SELECT, WHERE (including IN and AND), GROUP BY, COUNT, AVG, DISTINCT, ORDER BY and LIMIT are supported. It does not query the production database and rejects mutations, joins and stacked queries.
- **Recruitment coverage report:** `npm run report:coverage` creates a read-only server-side JSON report showing published companies/roles/drives and source coverage gaps. It does **not** populate missing companies or claim all employers are supported.
- **Quality gates:** New SQL subset unit tests, a throwaway PostgreSQL guest-coding authorization/integrity test (`supabase/tests/19_anonymous_coding.test.sql`) and CI commands.

## Required activation steps (staging FIRST)

1. Back up your Supabase data and use a separate **staging** Supabase project. Install **Node.js 24**, then `npm ci` inside the inner `PlacementWays/placementways` folder.
2. Apply SQL migrations in filename order, including `20261123150000_anonymous_coding.sql`. **Never run `supabase/tests/run.sh` against an actual Supabase instance**: it is designed for disposable local PostgreSQL and DROPS a test database.
3. Configure `.env.local` with Supabase credentials; `GUEST_RATE_LIMIT_SECRET` (>=32 random chars), `GUEST_TRUSTED_IP_HEADER` (set to a header that your trusted ingress fully overwrites with one validated visitor IP); a dedicated private Judge0-compatible service (`JUDGE0_URL` and its credentials), and the public origin. If no safe ingress header is available, anonymous coding intentionally fails closed.
4. Start the isolated worker as a **separate service**, `npm run worker:coding`, with service credentials. Set coding languages/provider IDs and enable coding execution under `/admin/coding` after the worker shows a fresh heartbeat. **Never allow code to execute within the Next.js server, nor run student SQL on Supabase.**
5. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:sql`, `npm run test:discovery`, `npm run test:db` on a throwaway PostgreSQL instance and `npm run build` on Node.js 24. Run `npm run test:e2e` against its expected local harness and manually test the anonymous browser workflows.
6. Visit `/questions/<published-coding-question-slug>` in an incognito window. Submit an example run, confirm polling and result. Confirm result URL returns 404 in a different browser or after deleting the ownership cookie. Confirm quotas, hidden-test isolation, stale worker failure, concurrent requests and server-only credentials.
7. Visit `/sql`, run/check all six exercises; try a forbidden UPDATE, a JOIN and a multi-statement query. They must fail without executing anything on the database.
8. Run `npm run report:coverage` server-side (service-role credentials required). Fill source coverage gaps through the existing authenticated admin source registration and review portal. The AI detection job still needs official source URLs, an enabled scheduler, allowlisted hosts and an AI key for extraction.
9. Perform real staging integration and browser acceptance testing, credential redaction, backup/restore, load/abuse checks, accessibility and mobile tests before advertising the website as production-ready.

## Limits and known gaps

- This archive has **not** been deployed, connected to live Supabase or exercised with a live Judge0 provider here. The SQL migration and Postgres acceptance suite have been authored but cannot be claimed as passed until executed on a disposable PostgreSQL instance.
- Staging configuration, official-company source onboarding and AI keys are not included. Public pages only reflect **actual populated, approved data**, not every company in India.
- The SQL learning engine is intentionally a restricted subset. Full PostgreSQL judging requires isolated, disposable database environments and an independent worker, which should not share production secrets.
- Normal Supabase-backed site pages require valid Supabase configuration. Anonymous coding additionally requires a trusted ingress header and worker.
- No student login, subscription, pricing, AI doubt-solving chatbot or AI mock interviewer has been introduced.

## Release acceptance

Do not mark production complete unless: (1) live route and database tests pass; (2) anonymous run and submit work without bypassing quotas; (3) other guests cannot view results; (4) hidden cases are never sent to the browser; (5) admin-only recruitment approvals remain enforced; (6) both automatic source scanning and rollback are tested on staging; (7) deployment performance and security gates pass.

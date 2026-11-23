# PlacementWays — Milestone 04: Recruitment Discovery and Source Reliability

**Starting point:** `PlacementWays-Milestone-03-Professional-Experience.zip` (23 November 2026).  
**Delivery:** Updated project source archive, **not** a deployed or production-certified website.

## New functionality in this milestone

### New role / hiring-drive discovery

- The same authorized recruitment URL can now be registered for multiple company/role/drive scopes without breaking deduplication within a scope.
- The monitoring extractor may now propose **new roles** on company-scoped sources and **new hiring drives** on company- or role-scoped sources.
- Proposals must include exact textual evidence in the captured HTTPS source; the title, role association, and source scope are checked server-side. Existing roles/drives are matched from the company catalog, never from an AI-selected row ID.
- First successful scans still set a baseline, but **can queue explicit AI discoveries immediately**, if the AI key is configured. Scans without an AI key save source snapshots and can retry AI discovery after a key is added.
- The discovery queue is separate from the existing M02 structured-field approval queue. Admins approve, reject or roll back new role/drive guides independently of the announcement approval.
- Approvals run through `decide_recruitment_discovery`, an admin-only `SECURITY DEFINER` PostgreSQL RPC, transactionally inserting a published role and optionally its initial hiring drive, or just a new drive on an existing role. Role slugs and parent role UUIDs are determined by trusted code/DB, not accepted blindly from AI.
- Approval stores evidence provenance and source links on public role/drive guides. Duplicate checks and a company-level advisory transaction lock prevent racing duplicate approval.
- `rollback_recruitment_discovery` removes an untouched newly created guide. It rejects rollback once a new role/drive has dependent recruitment content. In this case, archive it manually instead.
- A role/drive is **not** announced as currently open merely because it was discovered. Drive status defaults to `unknown`; use a separately approved source-supported change to mark it open.

### More resilient monitoring

- New atomic `claim_recruitment_watch_sources` RPC leases sources due for checking, so overlapping cron invocations don't scan the same source concurrently.
- Per-source check interval (default 6 hours), next-check schedule, last success, failure count, and exponentially increasing backoff on repeated errors (capped at 24h).
- Admin source-health cards now show next check time and failure counts, with **Enable/Disable** and **Queue next check** actions.
- AI extraction uses a separate `last_ai_fingerprint` so an unchanged baseline can still be reviewed later when an AI key becomes available or a previous extraction failed.
- Existing safe HTTPS allowlist, DNS pinning, bounded HTML/text/JSON/PDF adapters, source evidence, deduplicated proposals, admin review, and field-level rollback remain in place.

### Public company information

- Newly approved roles/drives appear on existing free company pages without student sign-in.
- Role and hiring-drive source links are displayed along with the date of human review where present.
- No speculative cutoff, assessment duration, eligibility or current-open status is generated.

## Files added / changed

- `supabase/migrations/20261123130000_recruitment_discoveries.sql`
- `src/server/recruitment/discovery.ts`, `discovery-core.ts`, `monitor.ts`, `structured.ts`, `actions.ts`, `queries.ts`
- `src/app/(admin)/admin/recruitment/page.tsx`
- `src/components/admin/recruitment-forms.tsx`, `watch-source-dashboard.tsx`
- `src/app/(marketing)/companies/[slug]/roles/[roleSlug]/page.tsx`
- `tests/recruitment/discovery-core.test.mjs`
- `supabase/tests/18_recruitment_discovery.test.sql`

## Deployment and acceptance procedure (staging environment)

1. Back up the existing Supabase database. Have a restore/rollback plan before applying migrations. **Do not apply test fixtures or run `supabase/tests/run.sh` against production.**
2. Install Node.js **24** in the inner `PlacementWays/placementways` project. Run `npm ci`.
3. Apply all SQL migrations in name order, including `20261123130000_recruitment_discoveries.sql`. Do not modify existing migrations on a live database.
4. Set Supabase env values, a strong (32+ character) `RECRUITMENT_CRON_SECRET`, `RECRUITMENT_ALLOWED_HOSTS` for authorized official hosts, and server-only `OPENAI_API_KEY` plus optional `RECRUITMENT_AI_MODEL`.
5. Run `npm run typecheck`, `npm test`, `npm run test:discovery`, `npm run lint` and `npm run build` on Node 24. Run `npm run test:db` only on a local **throwaway PostgreSQL instance**. This DB suite includes a discovery transaction/rollback/authorization test.
6. Sign in as admin and register an authorized public company- or role-scoped source. Set polling frequency.
7. Configure an external scheduler to POST `/api/cron/recruitment` with `Authorization: Bearer <RECRUITMENT_CRON_SECRET>` every 5 minutes. The handler processes a small batch of due sources per call. **The scanner does not run in the background without this scheduler.** Configure sufficient throughput for your registered source count.
8. Use **Queue next check**, then **Scan next 3 due sources now** if needed. Confirm a baseline was saved and any source-supported new role/drive appears under **New roles and hiring drives** as **pending**, with exact evidence and a link to the original source.
9. Approve a test candidate and confirm the matching company role page is visible anonymously; reject a second candidate; confirm it never publishes. Test duplicate role and drive submissions, an evidence mismatch, and rollback of an untouched approved guide.
10. Test ordinary M02 field proposals (cutoff/eligibility/exam-round changes), admin-only RLS, concurrent source cron requests, a temporarily unreachable source, and the retry/backoff schedule.
11. Run mobile browser tests, check links, monitor logs/costs, and validate site behavior for a genuinely new official notice before a public launch.

## Known limitations and follow-up items

- Source coverage remains **only the company/role URLs that administrators register**. The system cannot guarantee every employer, hiring update, private campus drive, CAPTCHA-protected portal, scanned/image-only PDF, or JavaScript-only dynamic site. These may require approved custom adapters or manual upload/review.
- The extractor needs an AI provider key and properly configured runtime network access. Without it, changed sources can generate a source-change review notice, but **new roles/drives are not extracted automatically**.
- Each discovery record contains one new role (optionally its first drive) **or** one drive for an existing role; no autonomous company creation. Add companies and register sources from the admin area first.
- If a source uses the same title for separate drives, the database's `(role_id,title)` uniqueness may require an admin to use a more specific drive name. The system intentionally errs on the side of blocking duplicates.
- The monitor does not bypass websites' anti-bot or access restrictions. Use published APIs/feeds or approved adapters as needed.
- This milestone does not include anonymous coding execution, new test questions, student login, payment processing, AI doubt solving or AI interviewing.
- The new migration and database tests are **written but were not executed against a real PostgreSQL/Supabase server in this environment**. This is a release gate, not a completed validation.

## Validation carried out in the authoring environment

- `node --experimental-strip-types --test tests/recruitment/discovery-core.test.mjs`: **9/9 tests passed**, checking scope, deduplication, role matching, exact evidence and first-time proposals.
- TypeScript compiler API syntax parsing of project TS/TSX source: passed (syntax only, **not** typecheck).
- ZIP integrity and archive contents: checked before delivery.
- The provided environment has Node.js 22, not the required Node.js 24. Project dependency cache is incomplete, so full Next.js build, runtime integration and PostgreSQL test execution were **not** carried out here.

## Recommended Milestone 05

1. Deploy to an isolated Supabase staging project and pass the full DB test suite, security checks, cron/AI integration tests, and real browser flows.
2. Build authorized source-specific adapters for high-priority employers and track per-source coverage gaps; begin verified company/role content onboarding.
3. Complete anonymous coding and SQL judging with resource isolation, rate limits and cost controls.

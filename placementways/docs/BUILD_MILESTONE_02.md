# PlacementWays — Milestone 02: Structured recruitment updates

**Built from:** Milestone 01 ZIP, 23 November 2026. This ZIP is a code deliverable, not a deployed product.

## What changed

1. **Versioned, typed update proposals**: AI suggests limited field-level changes after comparing two registered source snapshots. Suggestions attach to a particular role/drive/round; the model cannot choose a target UUID.
2. **Evidence**: every field suggestion must carry an exact quote from the stored observed source excerpt. The administrator sees previous/proposed values and source evidence side-by-side.
3. **Atomic approval**: `approve_recruitment_proposal()` now applies all reviewed field patches in one DB transaction, publishes an update entry and creates a field-level audit history. A stale field aborts the entire transaction.
4. **New rounds**: supports proposing creation of a named assessment round with structured topics, count, duration and marking rules; new or changed facts are initially marked **unverified**, not automatically 'official'.
5. **Rollback**: authenticated admins may retract an approved update and reverse its tracked field edits if they have not been overwritten since publication. A conflict fails safely.
6. **Source adapters**: allowlisted HTTPS HTML/text, official JSON job feeds and text-based PDF notices are supported. DNS is checked for public IPs and the request pins the approved address. Redirects are never followed.
7. **Manual structured patch**: where AI is disabled/uncertain, the admin can enter source-supported typed field changes into the same approval queue.
8. **Expanded source scoping**: a monitor may be attached to a particular company, role and drive. A company-wide source produces only an announcement until it is mapped to a role/drive for structured updates.
9. **Original public access retained**: no student login, paid access, student AI chatbot or AI interviewer added.

## Install / migration order

1. Back up the live or staging database and test rollback procedures.
2. Use **Node.js 24**. In `PlacementWays/placementways`, run `npm ci`.
3. Apply migration `20261123090000_public_recruitment_intelligence.sql` first if not already applied, **then** `20261123110000_structured_recruitment_approvals.sql`. For a new deployment, apply all existing SQL migrations in chronological order.
4. Configure Supabase environment from `.env.example`, including the **server-only** `SUPABASE_SERVICE_ROLE_KEY` and `RECRUITMENT_CRON_SECRET` (32+ random characters). Set `RECRUITMENT_ALLOWED_HOSTS` to a comma-separated list of exact official domains you have reviewed. Optionally configure `OPENAI_API_KEY` / `RECRUITMENT_AI_MODEL` for proposed field extraction.
5. Start the app on staging, sign in **as admin only**, and open `/admin/recruitment`.
6. Create/import company → role → drive → rounds. Register each supported source with the matching company/role/drive. Ensure the official source legally permits automated fetching.
7. Click **Scan now** to create a snapshot baseline (not an update). Make an authorized change to a test source, scan again, then review the proposed diff. Test approve, public page refresh and rollback.
8. Schedule `POST /api/cron/recruitment` with `Authorization: Bearer <RECRUITMENT_CRON_SECRET>`. Scheduler must be configured separately; no task runs while the app is offline.
9. Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, database integration tests and browser tests before deployment.

## PDF deployment notes

- The Docker runtime installs `poppler-utils` and uses `pdftotext` through a bounded server-side subprocess. Other hosts must install and permit `pdftotext` explicitly. PDF parsing may require additional sandboxing depending on threat model.
- PDFs are limited to 2.5 MB and extracted text to 12,000 characters. Image-only/scanned PDFs are **not** handled; the system reports an error rather than guessing.
- JavaScript-only portals, authenticated applicant portals, CAPTCHAs, and sites which block bot access are **not** supported by this generic adapter. Use official APIs or individually authorized source adapters in a later milestone.
- JSON support is for public feeds over HTTPS; deeply nested or enormous payloads are truncated for safety.

## Approval semantics and safety

- **AI never publishes directly**. Its proposals are drafts that may be wrong. Exact substring evidence does not prove a claim is correct; the admin must check the original notice.
- The second migration revokes browser update privileges for proposal status and adds row locks, audited RPCs and a patch guard. Do not grant these RPCs to `anon` or expose service-role tokens.
- Approved fields modify the existing `company_roles`, `recruitment_drives`, `recruitment_rounds` records that the role pages already display. The public feed displays only active approved notices.
- Manual patch values must follow types: ordinary text, integer counts, ISO timestamps with timezone, JSON string arrays for skills/topics, and JSON objects for new rounds.
- Rollback is deliberately conservative. It fails on conflicts rather than clobber newer data. Combined date changes can encounter immediate database checks and may require separate reviewed updates.
- Initial scans do not auto-populate a full company directory. **No source list, role information, exam pattern or current recruitment claim is seeded**. Source coverage and official details must be configured and verified.

## Verification status in this development environment

- TypeScript/TSX syntax parsed with the globally installed TypeScript compiler API.
- Unit tests for field proposal validation were authored but could not execute here because project `node_modules` are not installed; an empty package directory is not a working dependency install.
- The project requires Node.js 24 (local runtime is Node.js 22), so Next.js build, full typecheck, Vitest, integration tests and end-to-end tests **remain unverified**.
- SQL migration has not been executed against a real Supabase/PostgreSQL database. **Apply to staging and test before touching production.**

## Next priorities after Milestone 02

- Verify SQL migrations and every approval/rollback flow on staging with real data.
- Add verified, permission-aware source adapters for recruiters with JavaScript portals and separate official JSON APIs.
- Extend change proposal support to creating a new drive and role, not only changing an existing role/drive and creating a round.
- Improve content sourcing, automated source-health alerts and operations dashboards.
- Finish anonymous coding/SQL execution and full production testing.

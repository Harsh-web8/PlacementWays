# PlacementWays — Milestone 03: Professional Company Directory & Source Onboarding

**Date:** 23 November 2026  
**Starting point:** Milestone 02 `PlacementWays-Milestone-02-Structured-Recruitment.zip`  
**Delivery:** Updated source archive, **not** a hosted or production-certified website.

## What this milestone actually implements

### Public company discovery (`/companies`)

- Redesigned public directory with clear hero, dynamic published company/role/drive counts, responsive cards and accessible search.
- Client-side instant search matches **published company name, description and published role titles**. Search terms can be in any order; all words must match the combined record.
- Interactive filters: all published companies, companies with published roles, companies with published hiring drives.
- Sorting by company name and number of published roles; helpful empty and reset states.
- Search accepts an initial `?q=` query; the existing homepage search links to it. Client-side edits update results instantly but do not write every keystroke into the URL.
- Server-side directory source reads `companies`, `company_roles` and `recruitment_drives` and explicitly restricts all to `status='published'`, in addition to database row-level security. If recruitment tables are unavailable, the public company list still renders with honest zero role/drive counts.
- Directory counts reflect currently published database records; **this does not seed companies or guarantee that any company is currently recruiting**. The published drive status is not treated as a real-time hiring confirmation.

### Company/role pages

- Company page now prominently links to published role guides, with short descriptions; the older company-wide process format is explicitly labeled as an archive so it is not mistaken for a role/drive-specific current pattern.
- New role guide layout groups salary, skills, eligibility, responsibilities, recruitment drives, and selection rounds into scannable sections.
- Each drive shows status, last review timestamp if available, application/source link, notes, round order, duration, counts, marking rules, and syllabus topics **only where data actually exists**.
- Linked, reviewed announcements display with source links; unknown values are labeled rather than invented.
- Sticky desktop table of contents, mobile-friendly cards and direct links to the existing free mocks and coding sections.

### Private admin source onboarding (`/admin/recruitment`)

- Guided four-step interface: create role → drive → round → register monitoring source.
- Role URL slugs are suggested automatically from role title and remain editable.
- Source-form role dropdown now filters to the chosen company; drive dropdown filters to the chosen role. Changing an ancestor clears invalid descendants.
- Visible scope preview explains that company-/role-wide sources produce announcements, while drive-linked sources support structured pattern proposals.
- New source-health board shows counts, failure states, whether baseline scanning has happened, source-to-company scope, last check time, and search/filter controls.
- Admin quick links jump to pending approvals, source health, onboarding and publishing history.
- The **existing Milestone 02 secure approval, rollback, PDF/HTML/JSON monitoring and database functions are retained** and remain the authority for mutations.

### Tests

- `tests/company-directory.test.ts`: Vitest tests for role-name searching, multiword matching, role/drive filters, sorting and immutability.

## Setup (staging first)

1. Back up existing database and verify a restore procedure.
2. Use **Node.js 24** in `PlacementWays/placementways` and run `npm ci`.
3. Configure `.env.local` according to `.env.example` and `docs/BUILD_MILESTONE_01.md`/`02.md`.
4. Apply the Milestone 01 and 02 SQL migrations **in order**, if not already applied. **No new database migration is needed for Milestone 03.**
5. Run `npm run typecheck && npm test && npm run lint && npm run build`.
6. Start the staging app. Visit `/companies`, search by both company and role, test filters/empty states and inspect individual role guides at multiple viewport sizes.
7. Sign in as **admin** (not as a student), open `/admin/recruitment`, register an official HTTPS source linked to the correct company/role/drive. Its hostname must be in `RECRUITMENT_ALLOWED_HOSTS`.
8. Scan once for baseline, then stage an authorized source change, review its proposed field-level diff, approve, verify public pages, and test conflict-aware rollback.
9. Check public access without student login; verify anonymous requests cannot access admin-only tables, actions or internal source snapshots.
10. Configure and deploy the scheduler, domain, Supabase credentials and production infrastructure only after staging and security tests pass.

## Important boundaries

- The archive contains **no automatically discovered or verified company-specific recruitment facts**. Administrators still need to create companies/roles/drives and register supported sources with permission to monitor them.
- No new browser automation for JavaScript-only or login-protected recruiters. The source adapter remains as described in Milestone 02.
- Student-facing AI chatbot and AI interviewer remain excluded. No student registration or payment requirement was introduced.
- Search is browser-local over the published directory data currently fetched in one batch; for thousands of companies, add server-side pagination/search.
- Source-health is a **read-only overview**. Enable/disable controls and a full source management lifecycle are later enhancements. Source errors are reported, not fixed automatically.
- This milestone does not change the guest/anonymous coding backend, create fresh question banks or certify the website for production. Those remain separate release gates.

## Local verification performed here

- TypeScript/TSX syntax parsing completed with the installed TypeScript compiler API.
- Pure directory filtering was exercised using Node's TypeScript type stripping for a direct smoke check; a Vitest test suite is included but cannot run without dependencies.
- `npm ci --offline --ignore-scripts` was **attempted and failed** with `ENOTCACHED` (`zod-validation-error` tarball unavailable). Local Node is v22, not the project's required v24.
- No live Next.js build, Supabase integration test or browser UI run is claimed. These must happen on a configured Node 24 staging environment.

## Recommended Milestone 04

1. Stage and validate the structured recruitment approval SQL/RLS and source monitoring against a real Supabase environment.
2. Improve source onboarding with a permission-aware registry, enable/disable and per-source scheduling, clear error handling and custom adapters where legally supported.
3. Extend structured proposal support to **new companies, roles and drives** so detected new vacancies don't require manual pre-creation.
4. Build and test anonymous coding/SQL judging and mobile mock-test flows; monitor cost/rate limits.
5. Populate reviewed company content with citations and begin SEO/quality audits.

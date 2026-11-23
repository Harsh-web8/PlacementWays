# PlacementWays — Development milestone 01 (23 November 2026)

## Implemented in this ZIP

- Free public-first header, navigation, homepage messaging and footers. Student signup entry point redirects to company guides; admin login remains.
- New database migration `20261123090000_public_recruitment_intelligence.sql` makes existing courses/tests free, sets bounded anonymous allowances and prevents new premium prices while the public-launch triggers remain enabled.
- No-login mock-test entry and guest practice MCQ checks (guest practice requires ingress HMAC configuration).
- Role → hiring drive → ordered assessment rounds, with evidence types and public role pages. Older company/process content remains intact.
- Public `/recruitment` page shows only admin-approved source-linked changes.
- `/admin/recruitment` dashboard: add role, drive, round, and monitored source; scan on demand, review pending proposals, approve/reject.
- `/api/cron/recruitment` secured POST scheduler. A first scan captures a baseline; subsequent changed snapshots queue human-review proposals. Optional OpenAI summarization creates a suggested headline/summary with a substring-supported evidence quote; AI never directly publishes.
- Database approval RPC locks and authorizes the proposal, writes the public record, and appends an audit entry atomically.
- The anonymous code editor remains accessible, preserving drafts in local storage; server-side anonymous code execution is **not yet implemented**.

## Launch configuration, in order

1. Use **Node.js 24**. Run `npm ci` in `PlacementWays/placementways`.
2. Copy `.env.example` to `.env.local`. Supply the existing Supabase URL and publishable key, service-role key, `GUEST_RATE_LIMIT_SECRET` and **trusted proxy-overwritten** IP header used by the existing guest gateway.
3. Apply all SQL migrations in timestamp order. In an existing database, apply **only** the new `20261123090000_public_recruitment_intelligence.sql` migration. Back up first.
4. In Admin > Recruitment AI, create role/drives/rounds and add public official source URLs. Set `RECRUITMENT_ALLOWED_HOSTS` to their specific hostnames. Examples are placeholders, not sources.
5. Generate `RECRUITMENT_CRON_SECRET` of 32+ random characters and configure a scheduled HTTPS POST to `/api/cron/recruitment` with `Authorization: Bearer <secret>`. A 15–60 minute cadence is a sensible initial choice depending on source permissions and budgets.
6. Optionally configure `OPENAI_API_KEY` and a supported `RECRUITMENT_AI_MODEL`. Without credentials, snapshots still generate conservative manual-review change notices.
7. Test the app on **staging** with a real Supabase project, configured worker, verified official sources, reverse-proxy headers and browser testing. Do not claim production readiness without security, rate-limit, and integration verification.

## Deliberate limitations and follow-up milestones

- The watcher supports HTML/plain-text pages only; PDF extraction, JavaScript-only job portals, site-specific APIs and high-frequency monitoring need adapters.
- A one-click approval currently publishes a **reviewed announcement** on the recruitment feed and company/role page. It does **not yet automatically overwrite structured salary, eligibility, deadlines or assessment-round fields**. Implement a typed, field-by-field proposal diff/approval workflow next, with rollback and conflict handling.
- There are no seed claims about live company processes in this ZIP. Populate official-sourced facts through admin first.
- The public launch does not yet provide anonymous code execution / SQL judging. The current browser-based editor supports unsent drafts.
- Code execution remains disabled until a dedicated sandbox and anonymous abuse-control gateway are tested.
- Student login, payments, AI chatbot and AI mock interviewer remain out of scope.
- Source fetching requires an explicitly approved domain, public DNS, HTTPS and HTML/text; rejects redirects and large responses. Monitor source terms/robots and use official APIs when available.

## Testing in this build environment

- A global TypeScript parser checked syntax across **200 source TS/TSX files** (0 parse errors).
- Full `npm test`, `npm run typecheck`, `npm run build`, Postgres migration integration tests, and browser smoke tests could **not** run here: the project requires Node 24 (only Node 22 is installed) and dependency installation from the npm registry timed out. They are required before deployment.

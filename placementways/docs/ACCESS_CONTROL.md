# Public browsing and guest mocks

The runnable project lives in `placementways/` inside the repository. The original
uploaded archive is preserved. Apply migrations in filename order; existing projects
need `20261001090000_flexible_access.sql`. No existing tables are recreated.

## Deployment configuration

- Use the existing Supabase URL and public key.
- Set `SUPABASE_SERVICE_ROLE_KEY` **only on the server**. Guest RPCs are denied to
  `anon` and `authenticated`; ordinary signed-in operations still use user RLS.
- Generate `GUEST_RATE_LIMIT_SECRET` with at least 32 random characters.
- Set `GUEST_TRUSTED_IP_HEADER` to a single-address header that your ingress
  **overwrites**, strips from incoming client requests, and supplies on every request.
  Restrict origin access to that ingress. Do not trust an arbitrary forwarded header.
  Missing/invalid trusted addresses fail closed for guest starts. Use a deployment WAF
  for request flooding; the database quota limits successful test starts.
- Update the signup email template in `SUPABASE_SETUP.md` to preserve `next`.
  Signup now supplies `/auth/confirm?next=...` as its redirect URL. Keep the project's
  redirect URL allowlist restricted to your own origins.

## Admin controls

`/admin/tests/[id]` controls access type, guest permission, per-mock guest allowance,
account attempt limit (empty = unlimited; zero = no new starts), price in INR paise,
and publication via the existing status controls. Attempt totals distinguish starts
made as guests from starts made with accounts, even after a guest result is claimed.

`/admin/settings` controls guest access globally, the total allowance across all mocks
(default **one**), and daily network starts (default **five**, allowing shared networks).
`PUBLIC` and `GUEST_FREE` both allow anonymous starts only when guest permission and
both allowances permit them. Public metadata is always readable for published mocks.
`LOGIN_REQUIRED` and `PREMIUM` disable guest starts. `is_free` is kept in sync for old
catalog code; premium writes always lock access. Publication uses existing `status`.

`/admin/access` grants/revokes mock or course entitlements, optionally with expiry.
Use it for complimentary access or manual access adjustments. Checkout purchases grant
paid access only through verified Stripe webhooks. See [PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md)
for commerce configuration and release gates. Students cannot create or modify their own entitlements.
Expired/revoked grants prevent new starts/enrollment and premium lesson reading;
already issued attempts and past results remain accessible to their owner.

## Guest security and lifecycle

A server-generated 256-bit random token is stored in a SameSite=Lax, HttpOnly cookie
(`__Host-pw-guest`, Secure in production). Only SHA-256 of that token enters the DB.
The attempt's random UUID alone grants no access. All read/save/submit/result operations
verify ownership and expiry, and reuse the existing deadline/scoring/immutable-content
functions. There is no anonymous Supabase Auth account or client-owned quota flag.

Starting reserves an allowance immediately: closing tabs cannot obtain extra concurrent
mocks. Repeated starts resume a running mock; abandoned/expired mocks count. Completion
shows the result without redirecting to login. The visitor can register/login, return to
that result, and explicitly save it to their account. Claims preserve score, original
guest attribution and quota consumption; results enter existing history and analytics.

The browser token and guest result access expire after 30 days. A cleared cookie loses
access to unclaimed results. Network rate keys are daily HMACs; raw addresses and device
fingerprints are never stored. Expired rate rows are deleted on subsequent guest starts.
Guest quota is per browser identity, with network limits mitigating simple resets;
privacy-preserving controls cannot guarantee one attempt per physical person.
Guest rows retain only random identifiers and attempt data; deployment retention jobs
may remove expired, unclaimed attempts/answers and then unreferenced guest sessions.
Preserve claimed attempts as student history and apply the site's account retention policy.

## Public and private pages

Company/recruitment, course discovery, free lessons/previews, practice questions, coding
prompts, resources/blog, and mock descriptions keep their existing public routes.
Guests can draft practice answers and code; running or submitting code requires login.
When enabled, coding runs and submissions are graded by a separate Judge0-compatible
worker, never inside Next.js. See [PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md) for
execution provider configuration and release gates.
Premium course bodies remain protected through `can_read_lesson` and RLS, now supporting
valid entitlements. Free previews stay public. Account pages, admin pages and all attempt
pages are noindex; attempt responses also use private, no-store caching.

## Verification

`npm run test:db` tests RLS, guest ownership, early-answer protection, idempotence, quotas,
network reset mitigation, claims, account limits and premium entitlements in PostgreSQL.
`node tests/db/access-concurrency.mjs` additionally tests concurrent resume, cross-mock
quota races and shared network limits against the disposable local database.
`npm test`, `npm run typecheck`, `npm run lint`, and `npm run test:e2e` cover application
regressions. The HTTP suite uses synthetic Supabase Auth; it does not certify hosted
email delivery, real payments or a production ingress configuration.


For browser integration, `tests/e2e/access-server.mjs` offers the existing synthetic Auth
fixture with real PostgreSQL RPC execution. It only accepts a local `placementways_test`
database; set a synthetic `ACCESS_TEST_SERVICE_KEY`, reuse it as the app's server key,
and point the app to port 54400. Set a private test rate secret and a trusted fixture
header, then send a reserved documentation IP in that header from the test browser.
Never deploy this fixture as a public service. Rebuild/reset the SQL test database before
reproducible test runs; its state is disposable. The shared preview in this task uses it.

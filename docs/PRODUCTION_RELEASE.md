# Production release and operations

The application has a buildable implementation of the ten-phase feature set. **A local pass is not a production release.** `DEVELOPMENT_STATUS.md` lists outstanding environment and editorial gates.

## Deployment topology

- Web: Node 24, Next.js App Router, application root `placementways/` in this repository. Run `npm ci`, `npm run build`, then `npm start -- --hostname 0.0.0.0`. Configure the hosting platform's assigned port using `PORT`.
- Database/Auth/Storage: your Supabase project. Apply unapplied files from `supabase/migrations` in filename order using the Supabase migration workflow. Back up an existing database first; never run `test:db` or `supabase db reset` against production. Review starter curriculum in `supabase/seed.sql` before optional import.
- Coding worker: a separate continuously running Node 24 process, `npm run worker:coding`, supervised with automatic restart. It needs the Supabase URL/server key and the isolated Judge0-compatible endpoint/token. Run multiple workers if required; database leases prevent concurrent ownership. Serverless web request handlers do not run submitted code.
- Compiler: a dedicated, maintained Judge0-compatible service with its own isolated sandbox infrastructure. Require HTTPS, disable execution-network access, enforce provider quotas. Never run untrusted code in the Next.js process or use the public demo endpoint for student data.
- Payments: optional Stripe hosted Checkout, INR amounts stored in paise. The application grants access only after a verified webhook. No card data is stored by PlacementWays.

## Configuration

Copy `.env.example` into the hosting environment's secret configuration. Public variables must be present at **build time**. Server keys must never have a `NEXT_PUBLIC_` prefix or be committed. Keep staging and production Supabase, Stripe and compiler credentials separate.

1. Set the exact Supabase project URL, publishable/anon key, server key, and canonical HTTPS site URL.
2. Set Supabase Auth Site URL and permitted redirect URLs for `/auth/confirm` and the documented confirmation/recovery templates in `SUPABASE_SETUP.md`. Configure real SMTP delivery and verify signup, confirmation, login, logout and password reset using an actual mailbox.
3. Create the initial administrator as documented in `SUPABASE_SETUP.md`, then review admin/student/anonymous RLS using the hosted API. No shared default production admin is seeded.
4. Set a random `GUEST_RATE_LIMIT_SECRET` of at least 32 characters and `GUEST_TRUSTED_IP_HEADER`. The ingress **must overwrite** that header with a single verified client IP and prevent bypass via an untrusted alternate origin. Validate this on the selected host; do not assume forwarded headers are trustworthy. See `ACCESS_CONTROL.md` for guest expiry and quotas.
5. Set the monitored support email and announcement in Admin settings. Keep `coding_enabled` and `commerce_enabled` disabled until their release checks pass.
6. Confirm the private `learning-resources` Storage bucket was created by migration. Never make it public. Upload a sample PDF via Admin, verify permitted download, and deny an anonymous/nonpaying account for a protected lesson. URLs expire after 60 seconds; external resource links are not private storage.
7. Configure Judge0 and match Admin language IDs to the provider catalog. Start the worker, inspect its heartbeat under Admin → Coding, then enable execution. Run and submit a synthetic solution in each language, test compile/time-limit/failure behavior, and verify another user cannot read the result.
8. For payments, set Stripe keys and the webhook secret. Subscribe `/api/webhooks/stripe` to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `refund.failed`. Use Stripe API version `2024-12-18.acacia` for the endpoint payload. Test successful/failed/delayed checkout, repeated delivery and a full refund in Stripe **test mode** before enabling live mode. `STRIPE_LIVE_MODE` must match the endpoint. Partial refunds do not revoke access; the Admin action requests a full refund. A failed or uncertain refund request remains pending for a safe retry with the same idempotency key.
9. Remove local service overrides. Set `DEPLOYMENT_ENV=production` only for the public production deployment. Staging robots prohibit indexing. Run `npm run check:production` in the deployment environment; then complete the gates below.

## Release gates

- CI: `npm run typecheck`, `npm run lint`, `npm test`, local `npm run test:db`, `node tests/db/access-concurrency.mjs`, `node tests/db/scoped-concurrency.mjs`, `npm run test:e2e` (includes production build/HTTP smoke). CI is in the repository root `.github/workflows/ci.yml`.
- Hosted tests: real Auth emails, PostgREST/RLS, secure cookies and trusted ingress, private Storage, actual compiler credentials, Stripe test-mode checkout/refund, HTTP health and mobile navigation. Local synthetic Auth cannot certify these.
- Editorial: approve recruitment source links, cohort-specific eligibility/patterns and verification dates; publish reviewed content. The starter curriculum is original practice, not an official exam pattern.
- Owner decisions: publish the operator's identity/contact and approved privacy/refund/terms policies. The included legal text remains a draft until reviewed by the operator.
- Review: resolve security/code-review findings and review dependencies. Local tests cannot guarantee production capacity; run realistic concurrency/load tests against staging with provider quotas before announcing a scale target.
- Browser: public company discovery → guest mock → result → registration → additional mock; paid checkout → lesson/mock access; coding submit → private result/history; admin save/reload and role denial.

## Monitoring and recovery

- External uptime monitoring should call `GET /api/health` every minute and alert the operator on consecutive non-200 responses. It checks database reachability without disclosing credentials.
- Alert when coding heartbeat is older than two minutes, queue age exceeds five minutes, or provider failures rise. The UI rejects new execution when no live worker exists. Leases expire after 90 seconds, retry up to three times, and queue records older than 15 minutes terminate with an error. Reclaimed jobs reuse saved provider tokens; a crash between provider creation and saving tokens can cause a bounded duplicate provider submission.
- Monitor Stripe webhook delivery failures/retries and pending orders/refunds. A success redirect alone is never payment proof. Use provider dashboard replay after correcting a configuration fault. Keep audit records and order references; do not log source code, hidden cases, access tokens, or card information.
- Enable automated Supabase database backups/PITR appropriate to the account. Store encrypted offsite backups and rehearse restore into a separate staging project. Database backups do **not** contain Storage object bytes: back up the private bucket separately. Test both database and object restoration before launch.
- Before release record the application commit and applied migration list. Roll back application code to the previous artifact first; migrations are additive. Do not delete new tables or payment/audit history to roll back a deploy. Disable coding/purchases via Admin if a provider fails, retain receipts/results, and reconcile pending work before re-enabling.
- Review data retention with the operator. Guest expiry cleanup is documented in `ACCESS_CONTROL.md`; account deletion cascades personal learning/coding data while orders retain transaction records with their user reference cleared. Protect and limit administrative access to backups/audit history.

## Local provider verification limits

The pinned CodeRabbit emulate v0.0.1 Stripe service supports product/price checkout, but does not implement inline `price_data` checkout or provide the complete payment fields required by this webhook. Those events are rejected. Local signed Stripe-shaped HTTP events verify the application signature, mode, amount, replay, grant and refund boundaries against real PostgreSQL. These tests are not a substitute for Stripe test-mode end-to-end verification.

Opt-in synthetic compiler probes: `RUN_LIVE_JUDGE_TEST=true JUDGE0_URL=<endpoint> node tests/integration/judge0-live.mjs`. The full worker test additionally needs the disposable local database/access fixture and its private environment: `RUN_LIVE_JUDGE_TEST=true JUDGE0_URL=<endpoint> node tests/integration/coding-worker.mjs`. Never run these scripts against customer data.

## Container deployment

The `Dockerfile` builds one image used for both roles. `NEXT_PUBLIC_*` values and `DEPLOYMENT_ENV` are inlined at **build time** (pass them as `--build-arg`); every secret (`SUPABASE_SERVICE_ROLE_KEY`, `GUEST_RATE_LIMIT_SECRET`, `STRIPE_*`, `JUDGE0_*`) is supplied only at **runtime**.

```bash
docker build -t placementways \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key> \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain \
  --build-arg DEPLOYMENT_ENV=production .

# web (HEALTHCHECK polls /api/health)
docker run -p 3000:3000 --env-file prod.env placementways
# coding worker: same image, no HTTP server, so disable the web healthcheck
docker run --no-healthcheck --env-file prod.env placementways npm run worker:coding
```

The container runs as the unprivileged `node` user. The image has not been built in the authoring sandbox (no Docker daemon); the CI `docker` job builds it on every push.

## HTTP security headers

`next.config.ts` sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy` always, a `Content-Security-Policy` in every production build, and HSTS plus `upgrade-insecure-requests` only when `DEPLOYMENT_ENV=production`. The CSP allows inline scripts/styles because Next.js emits inline bootstrap code; moving to nonces requires rendering every page dynamically. If you add a third-party script, embed, analytics or a browser-side Supabase client, extend the policy deliberately (`tests/unit/security-headers.test.ts` guards the baseline). Verify the policy in a real browser on staging and watch the console for violations before launch. HSTS `includeSubDomains` assumes every subdomain serves HTTPS.

## Still required from the operator

These cannot be completed from the repository: the monitored support email (placeholder `TODO before launch` comments remain in the Terms and Privacy pages), reviewed legal text, hosted Supabase/Auth/SMTP verification, Stripe test-mode run, real Judge0 credentials, backups/restore drill, and uptime/error monitoring (no error-tracking SDK is bundled; add one such as Sentry if you want exception alerts).

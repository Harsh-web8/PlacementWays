# Deploy and verify isolated staging

Use a dedicated Supabase project, isolated HTTPS Judge0 endpoint, staging API keys and a staging hostname reachable by the QA team. Restrict staging access using the host firewall or your existing access layer. Allow the authorized scheduler and QA runner through that access layer.

## Deploy the web and worker

The provided Docker Compose setup is for a host where Caddy receives the client connection directly. Caddy terminates HTTPS and overwrites `X-PlacementWays-Visitor-IP` before forwarding to the private web container. If a managed ingress sits in front of Caddy, configure the selected ingress to pass a verified single visitor IP and adapt the trusted header accordingly. Verify that the web port cannot be reached around that ingress. [Caddy reverse proxy configuration](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)

1. Confirm the target Supabase project ref and take a backup if the project already has data. Apply all migrations in order, then apply [the staging fixture SQL](../supabase/fixtures/staging_acceptance.sql) to the private project only. The fixture provides an original mock, lesson, coding question and synthetic recruitment role.
2. Configure the Auth Site URL and recovery redirect, disable public sign-ups, and provision a dedicated admin and a synthetic non-admin. Set up staging SMTP and a mailbox for the reset-password rehearsal. Follow [Supabase setup](SUPABASE_SETUP.md).
3. Set the following variables in private environment files or the deployment secret store. Build args contain public values only.

   | File or scope | Values |
   |---|---|
   | `.env.staging.deploy` | `STAGING_HOST` as a bare hostname, `STAGING_IMAGE_TAG` as a release identifier, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | `.env.staging.web` | `SUPABASE_SERVICE_ROLE_KEY`, `GUEST_RATE_LIMIT_SECRET`, `RECRUITMENT_CRON_SECRET`, `RECRUITMENT_ALLOWED_HOSTS`, `OPENAI_API_KEY`, optional `RECRUITMENT_AI_MODEL` |
   | `.env.staging.worker` | `SUPABASE_SERVICE_ROLE_KEY`, `JUDGE0_URL`, provider credential if required |
   | QA runner | `DEPLOYMENT_ENV=staging`, `STAGING_DB_ISOLATED=true`, matching `STAGING_BASE_URL` and `NEXT_PUBLIC_SITE_URL`. Supply Supabase values and credentials only for the commands that use them. |

4. Point DNS at the ingress and allow HTTPS certificate validation. Run the deployment from the application directory. [Docker Compose environment variables](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)

   ```sh
   docker compose --env-file .env.staging.deploy -f compose.staging.yaml config --quiet
   docker compose --env-file .env.staging.deploy -f compose.staging.yaml build web
   docker compose --env-file .env.staging.deploy -f compose.staging.yaml up -d --no-build
   docker compose --env-file .env.staging.deploy -f compose.staging.yaml ps
   ```

5. In Admin settings, verify commerce is disabled and anonymous mocks have positive limits. Confirm the Judge0 language mapping, check the worker heartbeat in Admin → Coding and enable coding. Set up an external scheduler for the authenticated recruitment POST, for example by scheduling `npm run scan:staging` with the staging runner environment and scheduler secret.

## Exercise the release

Run on Node.js 24 with the staging environment loaded. Install the test browser with `npx --no-install playwright-core install chromium`, or set `STAGING_BROWSER_EXECUTABLE` to a local Chromium or Chrome executable. The fixture option creates one guest mock attempt and submits one harmless program to the configured worker. The auth option signs in with `STAGING_ADMIN_EMAIL`, `STAGING_ADMIN_PASSWORD`, `STAGING_STUDENT_EMAIL`, and `STAGING_STUDENT_PASSWORD`.

```sh
npm run check:staging -- --require-ai --require-coding
npm run smoke:staging
npm run browser:staging -- --exercise-fixtures --auth
npm run inspect:staging
```

Use the browser results to record public desktop and phone behavior, keyboard navigation, offline SQL, private guest results, and admin access. The printed page load timings describe the current runner and network. Record a separate mobile performance measurement under representative conditions.

## Exercise recruitment publication and recovery

1. Serve [the baseline notice](../supabase/fixtures/recruitment-baseline.txt) as a text response from an authorized HTTPS host you control. In Admin → Recruitment link its URL to **Synthetic acceptance drive**, with its parent role and company, and allowlist the host. Run `npm run scan:staging` and confirm the source reports a successful baseline scan.
2. Serve [the updated notice](../supabase/fixtures/recruitment-updated.txt) at the same URL. In Admin → Recruitment mark the fixture source due, then scan again. Confirm the draft contains a duration change from 20 to 35 minutes with the exact quoted evidence. Use the proposal UUID from the private staging database as `STAGING_PROPOSAL_ID` in the QA runner.
3. Run the commands below one at a time, with an administrator reviewing the source and clicking **Approve changes & publish** after the first command, then clicking **Rollback publication** after the second. Each command checks the hosted anonymous Data API and the administrator's publication history. Open the role and feed over HTTPS after each decision.

   ```sh
   npm run recruitment:staging -- pending
   npm run recruitment:staging -- approved
   npm run recruitment:staging -- rolled-back
   ```

4. For the outage exercise, establish a fresh synthetic source URL and baseline, then temporarily disable the AI credential in the staging web process before serving the updated notice. Confirm one pending fallback. Restore the credential, mark the fixture source due, and rescan without changing the notice. Run the pending verifier on the original proposal UUID. It must show the evidence and structured patch after enrichment.

## Record live evidence

- Verify password recovery through the staging mailbox. Confirm trusted ingress rate limits and provider isolation, and record approved Judge0 verdict checks and fresh worker heartbeat.
- Alert on consecutive failures of `GET /api/health` and nonzero exits from `npm run inspect:staging` or the scheduled scan. Test alert delivery by simulating an outage from staging. The scheduler prints counts and skips source excerpts and credentials.
- Restore a backup into a different isolated project. Verify previously seeded records, schema, Auth behavior and private storage access. Restore private Storage objects from their separate backup and compare the expected object manifest.
- Review `npm run report:coverage` against the intended launch catalog and resolve missing evidence before publishing any employer claims. Record the artifact, deployed target, migration list and results in [the staging evidence log](M07_STAGING_ACCEPTANCE.md).

Local validation passed for the production build, type checking, lint, 189 Vitest tests, the staging acceptance tests and the browser flows against a mock Data API. Disposable PostgreSQL verified repeatable fixture loading, anonymous visibility, and the pending, approved and rolled-back phases. Docker Compose accepted the deployment configuration, and a loopback Caddy request verified that the ingress replaces a client-supplied visitor IP. The deployment image and live release checks require the staging host. Record those results in the evidence log.

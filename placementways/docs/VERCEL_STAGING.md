# PlacementWays staging on Vercel

Use a dedicated Vercel project named `placementways-staging` and deploy it as a protected **Preview**. Use a new Supabase project also named `placementways-staging`. Student-facing app routes stay anonymous. Vercel's separate access restriction protects the staging URL while the QA team exercises those routes.

## 1. Create the empty Supabase project

1. Open the [Supabase dashboard](https://supabase.com/dashboard), select your organization, and choose **New project**. Name it `placementways-staging`. Choose a region, create a unique strong database password, and store the password privately. Confirm the plan before creating the project.
2. Once the project is ready, note its **project ref**. Use **Connect** for the Project URL and **Settings → API Keys** for its publishable and secret keys. Keep this project's credentials separate from every other deployment. Leave the schema empty at this stage. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
3. After the staging preview origin and database are confirmed, set it as the Auth **Site URL** and add its exact `/auth/confirm` redirect URL. Disable public and anonymous sign-ups. Configure the recovery email template and staging SMTP. Provision a dedicated administrator and a synthetic non-admin after the schema has been applied. [Supabase Auth and admin setup](SUPABASE_SETUP.md)

## 2. Connect the private GitHub repository

1. In GitHub, confirm the private repository contains the updated project, including `placementways/vercel.json`. For the exported layout, the Git root is the directory containing `.github/` and `placementways/`. Use a `staging` branch for the checkout you will release. The checked-in Vercel configuration disables Git-triggered deployment builds, so the first Preview is started explicitly after confirmation. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration)
2. Sign in to Vercel with your GitHub account. Authorize the Vercel GitHub app for **Only select repositories** and select the private repo. For a GitHub organization, request approval from its owner if required. A Vercel Hobby team cannot deploy a private organization repository, so verify team eligibility before provisioning. [Vercel private Git repositories](https://vercel.com/docs/git#deploying-private-git-repositories)
3. From the private clone, open a terminal in the app directory and use the Vercel CLI to link or create the project without starting a deployment. Use your actual Vercel scope and GitHub repo coordinates.

   ```sh
   npx vercel@latest login
   npx vercel@latest link --project placementways-staging --scope YOUR_VERCEL_SCOPE
   ```

   Confirm the selected team and `placementways-staging` in the prompts. In the project's **Settings → Build and Deployment**, choose **Next.js**, Node.js **24.x**, and set **Root Directory** to `placementways` if the Git root contains that folder. If `package.json` is at the Git root, leave the root directory at its default. Keep the Next.js output directory default. [Project linking](https://vercel.com/docs/cli/link) · [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

4. In **Settings → Deployment Protection**, enable **Vercel Authentication** with at least Standard Protection and use a Preview URL. Enable **Protection Bypass for Automation** for the acceptance runner. Connect Git from the linked app checkout:

   ```sh
   npx vercel@latest git connect https://github.com/YOUR_OWNER/YOUR_PRIVATE_REPO.git --scope YOUR_VERCEL_SCOPE
   ```

   Verify the connected repo under **Settings → Git**. If you use the dashboard import flow instead, stop at **Configure Project**. Clicking **Deploy** starts a build. Keep the Preview protected and review the configured project and scope before the first deployment. [Vercel Git CLI](https://vercel.com/docs/cli/git) · [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)

## 3. Configure staging variables

Scope the app values to **Preview** on the staging project. Use branch-scoped variables if this project will also build unrelated branches. Set secret values in the relevant secret store.

| Scope | Variable | Value or purpose |
|---|---|---|
| Vercel Preview | `DEPLOYMENT_ENV` | `staging` |
| Vercel Preview | `NEXT_PUBLIC_SUPABASE_URL` | `https://<staging-project-ref>.supabase.co` |
| Vercel Preview | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key from the staging project |
| Vercel Preview | `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret key from that same project |
| Vercel Preview | `NEXT_PUBLIC_SITE_URL` | Stable HTTPS Preview origin if known. With Vercel system variables enabled, the app uses the generated `VERCEL_URL` for the first Preview when this is omitted. |
| Vercel Preview | `GUEST_RATE_LIMIT_SECRET` | Independent random secret of at least 32 characters |
| Vercel Preview | `GUEST_TRUSTED_IP_HEADER` | `x-vercel-forwarded-for` when using direct Vercel ingress |
| Vercel Preview | `RECRUITMENT_CRON_SECRET` | Independent random secret of at least 32 characters |
| Vercel Preview | `RECRUITMENT_ALLOWED_HOSTS` | Comma-separated authorized HTTPS source hostnames |
| Vercel Preview | `OPENAI_API_KEY` | Staging AI credential for full structured extraction acceptance |
| Vercel Preview | `RECRUITMENT_AI_MODEL` | Optional extraction model override |
| Vercel Preview | `PLACEMENTWAYS_ENABLE_COMMERCE`, `STRIPE_LIVE_MODE`, `ALLOW_LOCAL_SERVICES` | `false` for each |
| Separate worker host | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | The same isolated staging Supabase project, with its server-only key |
| Separate worker host | `JUDGE0_URL` | Dedicated isolated HTTPS Judge0-compatible endpoint |
| Separate worker host | `JUDGE0_AUTH_TOKEN` or `JUDGE0_RAPIDAPI_KEY` | Only if your execution provider requires one |
| QA runner | `DEPLOYMENT_ENV`, `STAGING_DB_ISOLATED`, `STAGING_BASE_URL`, `NEXT_PUBLIC_SITE_URL` | Set `staging` and `true` after confirming isolation, then set both URLs to the same protected Preview origin |
| QA runner | `STAGING_SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL` | The confirmed staging ref and matching API URL |
| QA runner and scheduler | `VERCEL_AUTOMATION_BYPASS_SECRET` | Private Preview bypass credential |
| QA runner | `STAGING_ADMIN_EMAIL`, `STAGING_ADMIN_PASSWORD`, `STAGING_STUDENT_EMAIL`, `STAGING_STUDENT_PASSWORD` | Dedicated accounts for the `--auth` check |
| QA runner | `STAGING_PROPOSAL_ID` | Synthetic proposal UUID for the recruitment verifier |
| QA runner | `STAGING_BROWSER_EXECUTABLE` | Optional local Chrome path, if Chromium was not installed through Playwright |
| Migration operator | `SUPABASE_DB_PASSWORD` | Optional private CLI environment value in place of an interactive password prompt |

Provide the relevant staging keys and scheduler secret to the local QA commands that require them. Keep the worker and Judge0 running independently of Vercel. For scheduling, use an external job to call `npm run scan:staging`. The app's authenticated route accepts POST, while Vercel's built-in Cron sends GET and runs on Production deployments. Use text, HTML, or JSON sources for this Preview. The PDF adapter uses a Poppler executable available in the container deployment. [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables) · [Vercel ingress headers](https://vercel.com/docs/headers/request-headers) · [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) · [Automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)

## 4. Review the migrations and run the dry-run

The local review covers 26 ordered SQL migrations, from `20260924100000_core_schema.sql` through `20261123171000_public_mock_visibility.sql`. The chain creates the schema and Auth profile trigger, establishes RLS and RPC grants, adds course and mock content, creates the private resource bucket, and introduces anonymous practice plus admin-reviewed recruitment. The public-launch migration updates existing course and mock access and guest quotas. The later recruitment and visibility migrations change service-role grants, editorial transaction boundaries, and which mock metadata is public. SQL invoked by application RPCs includes scoped cleanup and rollback. The local tests create and recreate their own loopback database.

The Node.js 24 build, type check, lint, 191 Vitest tests, release scripts, browser end-to-end tests, 21 SQL suites, and PostgreSQL concurrency checks passed locally. A separate fresh-database rehearsal with restrictive default grants verified RLS, public mock access, admin-only approval, and the monitor and worker read grants. The coding worker passed with a simulated Judge0 API. Hosted migration history is checked by the linked dry-run after target confirmation.

Run the credential-free plan now and retain its ordered filenames and fingerprints:

```sh
npm run db:plan
```

After you confirm the fresh project's name and ref against the Supabase dashboard, use the authenticated CLI with Node.js 24 from the directory containing `package.json`, `scripts/`, and `supabase/config.toml`. From the outer folder of the original download, first run `Set-Location -LiteralPath '.\PlacementWays\placementways'` in PowerShell. The Supabase link is scoped to the directory where you run the command.

```powershell
$env:DEPLOYMENT_ENV = 'staging'
$env:STAGING_DB_ISOLATED = 'true'
$env:STAGING_SUPABASE_PROJECT_REF = '<confirmed-staging-ref>'
$env:NEXT_PUBLIC_SUPABASE_URL = "https://$($env:STAGING_SUPABASE_PROJECT_REF).supabase.co"
npx.cmd supabase login
if ($LASTEXITCODE -ne 0) { throw 'Supabase login failed' }
npx.cmd supabase link --project-ref $env:STAGING_SUPABASE_PROJECT_REF
if ($LASTEXITCODE -ne 0) { throw 'Staging link failed' }
node scripts/plan-migrations.mjs --verify-staging-link
if ($LASTEXITCODE -ne 0) { throw 'Staging target verification failed' }
npx.cmd supabase db push "--remote=$env:STAGING_SUPABASE_PROJECT_REF" --dry-run
```

Review the dry-run against the local plan. The first run on an empty project should list the full chain in order. Stop if the target, linked migration history, order, or pending list differs from what you expect. The staging fixtures are a separate step after migration approval. [Supabase CLI database push and dry-run](https://supabase.com/docs/reference/cli/supabase-db-push)

## 5. Handoff for explicit confirmation

Record the Vercel scope and project, private GitHub repo and staging branch, and the Supabase staging project ref. The hosted migration and Preview deployment require confirmation of those targets and review of the dry-run. After approval, apply the reviewed migrations, seed only the staging fixtures, and start a manual **Preview** deployment from the linked checkout. Record the issued Preview origin and finish the Auth URL configuration. Then run:

```sh
npm run check:staging -- --vercel-preview --require-ai --require-coding
npm run smoke:staging
npm run browser:staging -- --exercise-fixtures --auth
npm run inspect:staging
```

Follow the [recruitment acceptance and recovery steps](STAGING_DEPLOYMENT.md#exercise-recruitment-publication-and-recovery) and record results in the [staging evidence log](M07_STAGING_ACCEPTANCE.md). An administrator still approves publication from the app after reviewing the evidence. The acceptance runner observes each phase using the hosted anonymous and admin paths.

# Supabase setup (one-time, ~15 minutes)

## 1. Create the project
1. Sign in at https://supabase.com and create a project. Choose the region closest to your students (e.g. **Mumbai / ap-south-1**).
2. Save the database password somewhere safe.

## 2. Apply the database
**Option A – Supabase CLI (recommended, repeatable)**
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*.sql in order
```
Then load the seed (categories + 3 companies): open **SQL Editor**, paste `supabase/seed.sql`, Run.
(`supabase db reset` runs the seed automatically, but only against a *local* database – never run it on production.)

**Option B – SQL Editor:** run all migration files in `supabase/migrations/` in filename order, then `supabase/seed.sql`.

Verify: **Table Editor** shows the migrated tables, each with the "RLS enabled" badge.

## 3. Environment variables
Copy `.env.example` → `.env.local` and fill in from **Project Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `anon` legacy key or the newer *publishable* key – either works)

## 4. Auth settings (Authentication → …)
| Setting | Value |
|---|---|
| Providers → Email | Enabled |
| **Confirm email** | **ON** (stops fake sign-ups) |
| Minimum password length | 8 |
| URL Configuration → Site URL | `http://localhost:3000` (production: your real domain) |
| URL Configuration → Redirect URLs | add `http://localhost:3000/**` (and your production domain) |
| Anonymous sign-ins | OFF |

## 5. Email templates (Authentication → Email Templates)
Our app exchanges a one-time `token_hash` on the server. This works even when a student opens the email on another device or inside Gmail's in-app browser. Replace the link in each template:

**Confirm signup**
```html
<h2>Confirm your email</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup">Confirm my email</a></p>
```
**Reset password**
```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
```
(Change-email template: `type=email_change`.)

> Supabase's built-in email sender is heavily rate-limited (a few emails/hour). Fine for development; before launch configure a real SMTP provider under **Authentication → SMTP**.

## 6. Create your first admin
Nobody can become an admin through the website – that is deliberate.
1. Register normally at `/register` and confirm your email.
2. In **SQL Editor** run (as the project owner):
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
3. Log in again. You land on `/admin`.

To remove admin rights or disable an account:
```sql
update public.profiles set role = 'student'   where email = '...';
update public.profiles set is_active = false  where email = '...';  -- blocks login and all access
```

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| `/dashboard` shows "Authentication is not configured" | `.env.local` missing/invalid. Restart `npm run dev` after editing it. |
| Sign-up succeeds but no profile row | Migration 2 not applied (the `on_auth_user_created` trigger). Re-run it. |
| Confirmation link says "invalid or expired" | Email template still uses `{{ .ConfirmationURL }}`; use the `token_hash` links above. Links are single-use. |
| Logged in but `/admin` is 404 | Your profile `role` is still `student` – see step 6. 404 is intentional for non-admins. |
| "Email rate limit exceeded" | Built-in mailer limit; configure SMTP. |

## Manual verification checklist (do once with your real project)
Automated tests use a mock Supabase, so confirm the real thing works:
- [ ] Register with a real email → confirmation email arrives → link opens `/dashboard`
- [ ] Table Editor → `profiles` has your row with `role = student`
- [ ] Log out, log in with wrong password → generic error; right password → dashboard
- [ ] Forgot password → email → link → set new password → land on dashboard
- [ ] While logged in as a student, open `/admin` → 404
- [ ] Promote yourself (step 6) → `/admin` shows counts (3 companies, 77 categories)
- [ ] Edit your profile → row updates in Table Editor
- [ ] In a private window, `/dashboard` redirects to `/login?next=/dashboard`

## Learning content verification

After applying all migrations, sign in as an admin and create a free course, a module,
and a lesson from the new admin navigation. Publish all three. Verify:

- Anonymous course listing and syllabus load, and a free lesson is readable.
- A student can start the course and mark a lesson complete; refresh preserves progress.
- Another student cannot read that progress using either the UI or REST API.
- Changing a course to premium requires a positive price in paise.
- Without an entitlement, its non-preview bodies/resources cannot be fetched through REST, and enrollment fails.
- A free-preview lesson remains accessible. Unpublishing its module hides its body.
- A student cannot call the admin lesson RPC or write course rows.
- A student without an entitlement cannot start a published premium mock by calling its RPC directly.

Premium access is enforced through `content_entitlements`. Verified Stripe payments create
purchase grants; confirmed full refunds revoke those grants. Verify an entitled student can
access the purchased course/mock and that another student cannot use their grant. Complete
the commerce gates in [PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md) before enabling purchases.

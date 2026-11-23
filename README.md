# PlacementWays — Milestone 07: Staging integration hardening

**Start with** [`placementways/docs/BUILD_MILESTONE_07.md`](placementways/docs/BUILD_MILESTONE_07.md). This version fixes AI-retry proposal loss, adds structured approval/rollback database acceptance tests, a free-launch HTTP E2E test, 12 hosted staging smoke routes, and a staging configuration gate. Locally tested logic only; **not deployed or certified production-ready**.

---

# PlacementWays — Milestone 03: Public company discovery and admin source onboarding

Updated 23 November 2026. **Start with** [`placementways/docs/BUILD_MILESTONE_03.md`](placementways/docs/BUILD_MILESTONE_03.md) for the new directory, role-guide and admin changes, testing status and deployment prerequisites. Built on Milestones 01 and 02; not deployed or production-certified.

---

# PlacementWays public-first source — Milestone 01

The implementation started on 23 November 2026. Read [`placementways/docs/BUILD_MILESTONE_01.md`](placementways/docs/BUILD_MILESTONE_01.md) for exactly what has changed, which features require a Supabase migration and credentials, and what remains unimplemented. **Not production-deployed or certified.**

---

# PlacementWays

The application from `placementways-updated-project.zip` is extracted in
[`placementways/`](placementways/). The original upload is preserved.

```sh
cd placementways
npm ci
# Configure .env.local and apply Supabase migrations; see docs/SUPABASE_SETUP.md.
npm run dev
```

See [access control and guest-mock setup](placementways/docs/ACCESS_CONTROL.md),
[application documentation](placementways/README.md), and
[development status](placementways/docs/DEVELOPMENT_STATUS.md).


### Milestone 6 — Recruitment quality and staging verification
The updated source includes a protected editorial completeness dashboard, role-page evidence freshness warnings, a staged public/auth smoke test and tighter free-launch release checks. Read `placementways/docs/BUILD_MILESTONE_06.md`. This is a source package, **not** a verified live deployment.

# M07 staging acceptance evidence log (operator fills in)

**Staging deployment URL:** ____________________  
**Application commit / artifact hash:** ____________________  
**Node runtime:** ____________________  
**Date, timezone and operator:** ____________________  
**Confirmed staging-only Supabase project (no secrets):** `placementways-staging` (`xmhztcvoaiprniboysbz`)  
**Applied migration IDs:** ____________________

| Acceptance check | Result (PASS/FAIL/NOT RUN) | Evidence (screenshot, sanitized log or issue ID) |
|---|---|---|
| Node 24 build, typecheck, lint and CI green | NOT RUN | |
| Hosted staging migration dry-run | PASS | 24 November 2026. The confirmed staging ref returned all 26 migration filenames in local order, with an empty seed and role-file list. |
| All SQL migrations applied to separate staging | NOT RUN | |
| 12/12 live anonymous/staging HTTP checks | NOT RUN | |
| Student pages free and no registration/payment needed | NOT RUN | |
| Unauthenticated admin and cron requests denied | NOT RUN | |
| Source allowlist and HTTPS DNS/redirect checks | NOT RUN | |
| Authorized official source baseline and follow-up change detected | NOT RUN | |
| Source quote and old/new structured field review | NOT RUN | |
| AI outage followed by retry enriches pending review | NOT RUN | |
| No changes visible before admin approval | NOT RUN | |
| Admin approval updates correct role/drive/round | NOT RUN | |
| Stale/conflicting proposal rejected atomically | NOT RUN | |
| Rollback restores fields and retracts feed item | NOT RUN | |
| Anonymous coding worker sandbox, ownership and quotas | NOT RUN | |
| SQL Lab cannot access the production database | NOT RUN | |
| Mobile layout, accessibility and performance checked | NOT RUN | |
| Backup and restore into a separate test project | NOT RUN | |
| Monitoring scheduler retry, alerting and source health | NOT RUN | |

**Launch decision:** BLOCKED until critical entries above are verified and outstanding defects are resolved.

Do not paste access tokens, API keys, private student submissions or personal data into this record.

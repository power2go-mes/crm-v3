# FINLONEXA CRM v3 - Current Status Master Audit

**Audit date:** 2026-11-26  
**Mode:** Initial read-only audit with subsequent authorized development fixes  
**Decision:** Engineering CONDITIONAL; production security BLOCKED; CRM v2 parity NOT VERIFIED

## Executive summary

The original audit was read-only. Subsequent authorized work applied new forward-only migrations and synthetic rollback tests to the administrator-confirmed disposable development database; no real business data or credentials were used, and the historical migration ledger remains untouched.

The web app currently builds and passes its automated tests, and its health endpoint responds. This does **not** prove that CRM workflows are correct: the authenticated UI could not be inspected because `/leads` redirected to `/login`, and no authenticated end-to-end tests were run. The database contains only 21 Leads, so the 100,000-lead scale target has not been demonstrated.

The initial audit found two publicly executable `SECURITY DEFINER` RPCs. Forward-only fixes for the report and reminder RPCs have since been applied and verified on the disposable development database; this is not a production deployment. The MCP TypeScript build now passes, and a new owner-scoped audit table has been applied and RLS-tested on that development database. MCP runtime/client acceptance and Streamable HTTP remain outstanding.

The source tree contains 55 page files, 12 `/api` route files, 17 MCP tools, and 87 migration files. The migration ledger has 71 entries, with a latest receipt of `20261123224500`. Six newer migration objects are present in the database, but their migration receipts are absent; the six corresponding files are untracked in this worktree. There is also a duplicate migration version.

## Current inventory

Counts are filesystem/source counts, not counts of permission-visible or browser-accepted features.

| Inventory | Current count | Evidence / qualification |
|---|---:|---|
| User-facing page files | 55 | `page.tsx` files under `apps/web/src/app`; dynamic segments count as route templates |
| API route files | 12 | Under `apps/web/src/app/api`; 18 exported HTTP-method handlers including OPTIONS |
| Auth callback route | 1 | Separate `/auth/callback` handler |
| Settings page routes | 23 | Includes Settings hub |
| Primary CRM areas | 15 | Leads, Accounts, Contacts, Opportunities, Campaigns, Activities, Calendar, My Jobs, Forecast, Sales Performance, Reports, Dashboards, Users/Roles, Settings, Imports/Exports |
| MCP tools | 17 | `apps/mcp-server/src/tools.ts` |
| MCP HTTP handlers | 4 | `/health`, `/auth/token`, `/sse`, `/message` |
| SQL migration files | 89 | `supabase/migrations`; 88 distinct version prefixes; the prior duplicate remains |
| Migration ledger rows | 71 | Live `supabase_migrations.schema_migrations` read-only query |

The approved sidebar structure is represented in source: Home; Sales (Leads, Campaigns, Opportunities, Forecast); People (Accounts, Contacts); Analytics (Reports, Dashboards); Schedule (Calendar, Activities); My Jobs; Settings. Visibility is permission-filtered in source. Role-specific visibility was not tested in a browser.

## Live database snapshot

Read-only snapshot window: **2026-11-26 09:23:54-09:24:20 UTC**. The counts were collected in separate read-only transactions, so this is a short snapshot window rather than one globally consistent transaction snapshot. Environment identity was not independently labeled as production or staging; the connection came from the repository root `DATABASE_URL`.

| Entity / subsystem | Current count |
|---|---:|
| Accounts | 17 |
| Contacts | 17 |
| Leads | 21 |
| Opportunities | 29 |
| Campaigns | 16 |
| Products | 6 |
| Price Books | 7 |
| Price Book entries | 6 |
| Quotes | 4 |
| Quote revisions | 10 |
| Quote line items | 4 |
| Opportunity line items | 7 |
| Opportunity team members | 2 |
| Activities total | 10 |
| - Tasks | 9 (8 not started, 1 in progress) |
| - Meetings | 1 |
| - Calls | 0 |
| Sales quotas | 1 |
| Workflow rules / logs | 2 / 9 |
| Lead assignment rules | 3 |
| Lead stages/statuses | 6 |
| Notifications | 43 |
| Import jobs / export jobs | 0 / 0 |
| Recycle-bin rows | 6 (2 Accounts, 4 Leads) |
| Contact-Account relationships / relationship roles | 17 / 0 |
| Lead activity rows / Lead history rows | 17 / 56 |
| Company settings / Sales Regions | 1 / 4 |
| Offices table | Not present |

The 29 Opportunity count matches the November 23 historical report; the current stage/revenue distribution was not re-reconciled in this audit. For both Accounts and Contacts, 13 records are owned by ASM-role users and 4 by BDO-role users. This is consistent with the historical diagnostic ownership counts, but individual identities and specific diagnostic-record IDs were not inspected.

Counts above are table-row counts; where the application uses the recycle-bin archive, deleted records are represented separately in `crm_recycle_bin`. They should not be interpreted as proof that all rows are active or usable.

## Current verification results

| Check | Result | Limits |
|---|---|---|
| Web production build | PASS | `npm run build` completed |
| Web type-check | PASS | `npm --workspace web run typecheck` |
| Web lint | PASS | `npm --workspace web run lint` |
| Web tests | PASS: 181 tests, 39 files | Automated tests only |
| Shared-package tests | PASS: 71 tests, 7 files | Includes migration-text assertions, not a full database suite |
| MCP tests | PASS: 17 tests, 3 files | Includes Streamable HTTP session/authorization flow with mocked auth and Supabase; not a live-user test |
| Database package type-check | PASS | `npm --workspace packages/database run typecheck` |
| MCP TypeScript build | PASS | Sensitive-field masking uses a typed copy; regression tests cover masking and input immutability |
| MCP audit migration / RLS | PASS | `202611270003_create_mcp_audit_logs.sql` applied to the disposable development DB; pre- and post-deployment synthetic rollback validation passed; no receipt added |
| MCP Streamable HTTP | PASS | Authenticated initialize, user-bound session, tool call, and session close tested locally with mocked authentication; external client and multi-instance behavior remain unverified |
| Web health endpoint | PASS: HTTP 200 | `http://localhost:3002/api/health`, status `healthy` |
| MCP runtime health | NOT RUNNING | No listener on `localhost:3005` during the check |
| Authenticated browser | BLOCKED | `/leads` redirected to `/login`; login form rendered, no credentials entered |
| Mobile / viewport checks | NOT VERIFIED | No authenticated page layout inspected |
| Live CRM mutations / CRUD | NOT VERIFIED | No writes were performed |
| CRM v2 visual/functional parity | NOT VERIFIED | CRM v2 runtime and parity acceptance were not run |
| 100k-lead performance | NOT VERIFIED | Current database has 21 Leads; no load test was run |

Historical Phase 06 reports claim successful browser and mobile tests as of November 23. Treat those as historical evidence, not current acceptance for the worktree and database state inspected here.

## High-priority current findings

1. **P1 - Public report RPC authorization bypass.** The pre-fix `public.execute_custom_report` was `SECURITY DEFINER`, owned by `postgres`, and executable by `PUBLIC`/`anon`. Its anonymous branch did not reject a null `auth.uid()` when running with its definer role. The new forward migration is now applied to the confirmed disposable development database: the function is `SECURITY INVOKER`, and PUBLIC/anon/service_role execution is revoked. The postconditions and dedicated rollback-only security fixture passed; no receipt was inserted and the ambiguous historical ledger remains untouched. This does not constitute a production deployment.
2. **P1 - Public reminder RPC can write for other users.** The pre-fix `public.generate_sales_reminders` was `SECURITY DEFINER`, publicly executable, accepted a nullable target user, and could create notifications across users. The forward migration is now applied to the confirmed disposable development database. Anonymous execution is denied; authenticated calls are self-bound; service/Postgres scheduler execution is retained. The rollback-only security fixture passed, and the active Postgres-owned hourly scheduler was preserved. No ledger receipt was added; this is not a production deployment.
3. **P0 release gate - Historical privileged credential rotation is unresolved.** A service-role environment variable exists locally, and historical release documentation says the old key was active. Its current validity/revocation was not tested. Do not treat this gate as cleared.
4. **P1 - MCP audit persistence was absent in the initial audit.** `202611270003_create_mcp_audit_logs.sql` has since provisioned `public.audit_logs` on the confirmed disposable development DB with owner-scoped authenticated INSERT-only RLS. Synthetic rollback tests passed. No live MCP call or production deployment is implied; post-action audit failure remains non-atomic and write idempotency is still needed before claiming retry safety.
5. **P1 - Migration history is not deployment-safe.** Migration version `202611200004` is duplicated across two tracked files introduced together. Its sole receipt normalizes to the attachment guard, but Phase 05A-specific objects are live. All declared objects from the six untracked `202611260001`-`202611260006` files are present without receipts; their exact applied source revisions are unverified. Tracked `202611200010` differs from its receipt after normalization. Three new forward-only security migrations have now been applied to the confirmed disposable development database without changing the historical ledger. Do not replay or rename historical migrations.
6. **P1 - Export-job table grants allowed direct workflow mutation.** The confirmed pre-fix state had authenticated table-level SELECT/INSERT/UPDATE/DELETE, including direct `status` updates. The forward-only ACL migration is now applied; authenticated retains SELECT and INSERT on only the three input columns. Migration assertions, post-deployment rollback regression, and the final baseline passed. No receipt was fabricated; production is not implied.
7. **P1 - MCP is not running and is not client-accepted.** The MCP build, unit tests, and mocked Streamable HTTP integration test pass, but no local listener was found on port 3005; live role acceptance, external client compatibility, and horizontal session management remain unverified.
8. **P2 - Import matching has a concurrent duplicate race.** Separate resumable imports can independently find no match and insert duplicates; matching indexes are non-unique.
9. **P2 - Web-to-lead duplicate matching can miss mixed-case imported email.** Imports preserve email casing, while web submissions are lowercased before exact comparison.
10. **P2 - Export polling can continue after a worker marks the job failed.** The UI loop exits for `completed`, but not for `failed`.
11. **P2 - Scale/report boundaries need correction and validation.** MCP dashboard summary loads all Opportunities into the client and can be truncated by the API row cap; the report UI can navigate beyond its 1,000-page limit when result count exceeds 100,000. No 100k-scale benchmark has been run.

Additional confirmed findings, expected feature gaps, and detailed evidence are in [Current Gaps and Defects](./FINLONEXA_CRM_V3_CURRENT_GAPS_AND_DEFECTS.md).

## Status counts

Feature-matrix counts are counts of the 34 feature rows in the companion matrix, not a completion percentage:

| Status | Rows |
|---|---:|
| COMPLETE | 0 |
| PARTIAL | 25 |
| BROKEN | 4 |
| BLOCKED | 2 |
| NOT VERIFIED | 3 |
| MISSING | 0 confirmed |
| PLACEHOLDER | 0 confirmed |

Page-matrix counts: **1 PARTIAL** (`/login` rendered but sign-in was not submitted); **54 BLOCKED** for authenticated browser acceptance. All 55 page source files were found and the production build passed. "Blocked" here means authentication prevented runtime workflow verification, not that those routes are known to be broken.

## External blockers and release decisions

- **Supabase privileged key:** unresolved, do not release until an administrator confirms rotation/revocation through the approved secret-management process. No key value is included here.
- **Google/Microsoft OAuth:** no provider credentials were found among the configured environment variable names; live sync remains externally blocked.
- **MCP deployment:** current implementation is legacy SSE, not Streamable HTTP; missing `MCP_JWT_SECRET` prevents broker-token minting; MCP audit persistence table is missing; build fails.
- **CRM v2 runtime:** not tested; full parity cannot be claimed.
- **Historical ownership:** aggregate current owner counts remain 4 BDO-role and 13 ASM-role records for both Accounts and Contacts; stakeholder signoff is still required.
- **Current worktree:** numerous changes remain uncommitted. The report, reminder, and export ACL forward migrations are applied on the disposable development database without migration-ledger receipts. Two untracked password-related scripts were not opened or executed and require owner review before any commit.

### A. Engineering readiness: CONDITIONAL

The web application compiles and its test suite passes, but the security RPC findings, MCP build failure, migration-history ambiguity, and unverified authenticated flows must be resolved before a production candidate is considered stable.

### B. Production security readiness: BLOCKED

The live database exposes public `SECURITY DEFINER` RPC surfaces with insufficient authorization, and the historical privileged-key rotation has not been proven.

### C. Full feature parity: NOT VERIFIED

Source and historical documents show broad feature implementation, but authenticated current-state verification and a CRM v2 comparison were not performed.

## Recommended next phase

1. Keep the ambiguous historical migration ledger unchanged; separately plan reproducibility for fresh environments.
2. Continue MCP stabilization: fix the TypeScript build, provision audit persistence with idempotent behavior, implement Streamable HTTP, and run six-role/RLS acceptance.
3. Run authenticated browser acceptance and verify remaining CRM workflows.
4. Run controlled concurrency and 100k-lead performance tests on the disposable development database.
5. Keep production blocked until privileged-key rotation and production migration provenance are independently confirmed.

## Post-audit stabilization checkpoint (2026-11-27)

- **SEC-REPORT-001 — APPLIED TO DISPOSABLE DEVELOPMENT DB:** `supabase/migrations/20261126143718_secure_custom_report_rpc.sql` changes the function to invoker security, rejects anonymous/inactive users, checks report and module permissions, retains row/field scoping, limits Activities/Quota projections, and removes `PUBLIC`, `anon`, and `service_role` execution. The persistent transaction postconditions and rollback-only regression fixture passed. The migration ledger was not modified; this is not a production deployment.
- **SEC-REMINDER-001 — APPLIED TO DISPOSABLE DEVELOPMENT DB:** `supabase/migrations/202611270001_secure_sales_reminders_rpc.sql` binds authenticated calls to the caller, denies anonymous execution, reserves all-user runs for `service_role` or the Postgres-owned scheduler, skips inactive users, and respects module view permissions. Persistent postconditions, the rollback-only fixture and scheduler preservation checks passed.
- **EXPORT-SECURITY-001 — APPLIED TO DISPOSABLE DEVELOPMENT DB:** `supabase/migrations/202611270002_restrict_crm_export_job_grants.sql` removes direct workflow mutation privileges. Authenticated retains SELECT and only the intended input-column INSERT grants. Regression and ACL rollback-integrity checks passed.
- **Final baseline:** `node scripts/verify-schema-baseline.cjs bpwdxslrkgmcoewkwufu final` passed read-only structural/security checks. Performance and production readiness are not certified.
- Validation command: `node scripts/validate-custom-report-security.cjs <confirmed-disposable-project-ref>`. The validator checks the project target and required database role, applies the migration and synthetic fixture within one transaction, always rolls back, and verifies function ACL/security state and synthetic-user cleanup afterward.
- Reminder validation command: `node scripts/validate-sales-reminder-security.cjs <confirmed-disposable-project-ref>`. It applies the candidate migration and synthetic self/other-user, service-role, scheduler, and anonymous tests in a transaction, rolls back, and verifies the function state and synthetic records were not persisted.
- **Historical provenance remains BLOCKED / AMBIGUOUS:** duplicate and divergent historical migrations were not renamed, replayed, or repaired. New forward migrations changed only the authorized disposable development database; no migration receipts were fabricated. Production state is not established by this work.

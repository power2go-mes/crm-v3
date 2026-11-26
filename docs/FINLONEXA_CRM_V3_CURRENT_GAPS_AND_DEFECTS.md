# FINLONEXA CRM v3 - Current Gaps and Defects

**Audit date:** 2026-11-26  
**Mode:** Read-only; no defect was fixed during this audit.

## Confirmed defects

### P1 - Public custom-report RPC can bypass authentication

- **ID:** SEC-REPORT-001
- **Route/component:** Supabase RPC `public.execute_custom_report`; used by the report builder.
- **Expected:** Anonymous callers are denied; authenticated callers can only read data permitted by the caller's row and field scope.
- **Observed:** Live catalog shows a `SECURITY DEFINER` function owned by `postgres`, with PUBLIC/anon execute permission. Its code tests `auth.uid()` only when non-null; when it is null, `current_user` is the function definer, not `authenticated`, so the authentication rejection branch does not fire. It queries readable views and quota/activity data without an explicit row-scope predicate. The readable views inspected have no row filters and are not security-invoker views.
- **Root cause:** Definer execution plus a null-identity check that does not reject anonymous calls; queried objects also lack caller-bound row scoping.
- **Reproduction:** An unauthenticated caller can reach the public RPC surface; no call was made and no data was retrieved during this audit.
- **Impact:** Potential unauthenticated exposure of Accounts, Contacts, Opportunities, Campaigns, Activities, or quotas depending on the selected report module.
- **Suggested fix:** Revoke execution from PUBLIC/anon; require a non-null authenticated identity; enforce module permissions and row scope inside the function or use a correctly security-invoker query path; add anonymous and cross-region negative tests.
- **Status:** CONFIRMED CURRENT DATABASE CONFIGURATION; not exploited.
- **Evidence:** `supabase/migrations/202611230003_phase05d_operational_closure.sql` (`execute_custom_report`); live `pg_proc`/ACL/view metadata.
- **Follow-up (2026-11-26): DEVELOPMENT FIX APPLIED.** `20261126143718_secure_custom_report_rpc.sql` was applied to the confirmed disposable development project after the pre-deployment fingerprint matched. The function is now invoker-secured and denies PUBLIC/anon/service_role execution. Its dedicated rollback regression passed and confirmed the deployed function state and fixture data were unchanged by validation. No migration receipt was fabricated; production deployment is not implied.

### P1 - Public reminder RPC can generate notifications for other users

- **ID:** SEC-REMINDER-001
- **Route/component:** `public.generate_sales_reminders`; called by the hourly scheduler.
- **Expected:** Only a trusted scheduler or an authorized user may generate reminders within an allowed scope.
- **Observed:** Live catalog shows `SECURITY DEFINER` and PUBLIC/anon execute. The function accepts `p_target_user_id` defaulting to NULL; NULL iterates across all users. No `auth.uid()` or permission boundary binds the target. The scheduled job is active hourly.
- **Root cause:** The callable definer function has a public grant and no caller/target authorization boundary.
- **Reproduction:** Not invoked. A safe staging regression should verify anonymous and out-of-scope callers are denied without creating notifications.
- **Impact:** Anonymous or unauthorized callers may cause reminder writes across users, including notification spam.
- **Suggested fix:** Restrict execute to the scheduler/service role, reject anonymous callers, and enforce target-user/permission scope for any authenticated invocation.
- **Status:** CONFIRMED CURRENT DATABASE CONFIGURATION; not invoked.
- **Evidence:** `supabase/migrations/202611230003_phase05d_operational_closure.sql`; live function ACL and `cron.job`.
- **Follow-up (2026-11-26): DEVELOPMENT FIX APPLIED.** `202611270001_secure_sales_reminders_rpc.sql` was applied to the confirmed disposable development database after its exact pre-fix fingerprint and scheduler state matched. The function now denies PUBLIC/anon, binds authenticated calls to self, and retains trusted service/Postgres scheduler paths. The rollback-only synthetic security fixture passed and confirmed cleanup; the active scheduler remained unchanged. No ledger receipt was fabricated; production state is not implied.

### P0 release gate - Historical Supabase privileged credential not confirmed rotated

- **ID:** SEC-CREDENTIAL-001
- **Expected:** Historical service-role credential revoked and current deployments use rotated secrets.
- **Observed:** A service-role variable is present in the local environment. The November 23 release document says the historical key was active at that time. Current validity and revocation were not checked.
- **Reproduction:** No credential check was performed. An administrator must verify rotation/revocation through the provider's approved credential-management process without sharing the key.
- **Impact:** A privileged key that remains active can bypass row-level security and expose or modify data.
- **Suggested fix:** Supabase project administrator must rotate/revoke through the official dashboard/secret manager and verify the old credential is rejected. Do not paste the key into chat or source.
- **Status:** BLOCKED pending administrator evidence; current activity not asserted.
- **Evidence:** `docs/FINLONEXA_CRM_V3_PHASE_06_RELEASE_READINESS.md`; local environment variable-name check only.

### P1 - MCP audit persistence and outcome reporting

- **ID:** MCP-AUDIT-001
- **Route/component:** All MCP tool calls; `apps/mcp-server/src/index.ts`, `apps/mcp-server/src/guardrails.ts`.
- **Expected:** Tool execution and audit outcome are not conflated; audit failures are explicit, and retries do not silently repeat completed writes.
- **Observed (initial audit):** `public.audit_logs` was absent, and the handler could report DENIED after a tool had succeeded if the success audit write failed.
- **Root cause:** Runtime assumes an unprovisioned audit table and persists audit after executing the tool action.
- **Reproduction:** The new migration and synthetic owner/cross-user/anonymous/read/update/delete fixture passed in rollback-only mode both before and after deployment. No live MCP tool call was made because the MCP listener is unavailable.
- **Impact:** An audit outage after a successful write is inherently non-atomic with the business action and can still require manual verification before retry.
- **Suggested fix:** Add tool-level idempotency for retryable writes before treating this path as retry-safe; preserve the explicit completed-action warning when audit persistence fails.
- **Status:** **FIXED ON THE CONFIRMED DISPOSABLE DEVELOPMENT DATABASE.** `202611270003_create_mcp_audit_logs.sql` is applied with RLS and authenticated INSERT-only grants; the migration receipt was intentionally not added. The handler no longer records a completed action as DENIED when its success audit fails.
- **Evidence:** `apps/mcp-server/src/guardrails.ts`; `apps/mcp-server/src/index.ts`; live relation check.

### MCP TypeScript build

- **ID:** MCP-BUILD-001
- **Route/component:** MCP server build, `apps/mcp-server/src/guardrails.ts`.
- **Expected:** `npm --workspace apps/mcp-server run build` succeeds.
- **Observed (initial audit):** Build failed at generic assignments to `bank_account_number` and `tax_id` because the properties do not exist on generic type `T`.
- **Root cause:** Generic record fields are assigned without a type that declares those sensitive properties.
- **Reproduction:** `npm --workspace apps/mcp-server run build` now passes; the full MCP suite passes 15 tests in 2 files.
- **Impact:** The generic assignment failure is resolved; broader runtime and role acceptance remain unverified.
- **Suggested fix:** None for this compile defect; retain the focused masking regression tests.
- **Status:** **FIXED AND VERIFIED.**

### P1 - Export-job table grants allow broad direct mutation

- **ID:** EXPORT-SECURITY-001
- **Route/component:** `public.crm_export_jobs`; resumable export job APIs and `/settings/exports`.
- **Expected:** Authenticated users can read their authorized jobs and create queued jobs with only the intended input columns; server-side RPCs own state transitions and output metadata.
- **Observed:** Read-only catalog checks show effective table-level SELECT, INSERT, UPDATE and DELETE for `authenticated`. In particular, authenticated users can directly update `status` and other workflow fields. The migration has an owner-scoped UPDATE policy but does not constrain which columns or state transitions can change. Its `REVOKE` omits `authenticated`, so existing/default table grants remain.
- **Root cause:** `202611260004_lead_export_jobs.sql` revokes only PUBLIC/anon and then grants the narrower intended permissions without first revoking any existing authenticated table-level DML privileges.
- **Reproduction:** `has_table_privilege('authenticated', 'public.crm_export_jobs', 'UPDATE')` returns true; `has_column_privilege(..., 'status', 'UPDATE')` returns true. No write was performed.
- **Impact:** A user with export permission can tamper with their own job state and metadata outside the intended claim/complete/release workflow. RLS still scopes rows to the owning user; cross-user access was not demonstrated.
- **Suggested fix:** Use the new unique forward migration to revoke authenticated table- and column-level job mutation grants, then retain only SELECT and INSERT on `module`, `columns`, and `time_zone`. Do not edit or replay `202611260004`.
- **Status:** The pre-fix grant mismatch was confirmed; the forward-only ACL migration is now applied on the administrator-confirmed disposable development project. Migration assertions and the post-deployment rollback validator passed, with ACL state unchanged by the test. The final read-only baseline passed. No historical migration or ledger receipt was changed.
- **Evidence:** Read-only `has_table_privilege`/`has_column_privilege`; `supabase/migrations/202611260004_lead_export_jobs.sql`.

### P1 - Migration ledger is not reproducible from current worktree

- **ID:** DB-MIGRATION-001
- **Expected:** Each migration has a unique version and the database ledger matches deployed schema changes.
- **Observed:** Two tracked files share version `202611200004`. The current ledger has one receipt for that version and 71 rows total, with latest version `20261123224500`. Its recorded SQL mentions the lead-attachment guard but not the Phase 05A helpers. The live catalog contains both the attachment-guard objects and Phase 05A-specific objects, while the `is_opportunity_team_member` helper is also mentioned by later receipts `202611200009` and `202611200010`. Objects from `202611260001` through `202611260006` are present without receipts; those six SQL files are untracked in the current Git worktree.
- **Root cause:** Local migration files, recorded history, and live schema were not kept in a single reproducible release sequence.
- **Reproduction:** Read-only comparison of local migration prefixes, `supabase_migrations.schema_migrations`, and catalog objects; no migration command was run.
- **Impact:** Automated migration tooling may apply, skip, or order changes inconsistently; a deployment from Git may not reproduce the inspected schema.
- **Suggested fix:** Reconcile the intended history with the project administrator; give every migration a unique version and record a tested forward-only path. Do not blindly replay or push migrations.
- **Status:** CONFIRMED current mismatch; provenance remains ambiguous. The Phase 05A file cannot be safely renamed or replayed based only on the current ledger and catalog because the files are tracked history and the live objects may have been applied through different paths. Three new forward security migrations were applied to the disposable development database; historical receipts remain unchanged.
- **Follow-up (2026-11-26):** `20261126143718_secure_custom_report_rpc.sql`, `202611270001_secure_sales_reminders_rpc.sql`, and `202611270002_restrict_crm_export_job_grants.sql` are unique forward migrations applied to the confirmed disposable development database. Their absent receipts are intentionally preserved; no ambiguous historical receipt was repaired.
- **Source-only provenance check (2026-11-26):** The `202611200004` ledger receipt references the attachment guard, but does not exactly match either local file. Phase 05A-only catalog objects have no corresponding receipt identified in the inspected history. No migration file was renamed or edited; obtain the authoritative project migration history before choosing a forward-only reconciliation.
- **Expanded provenance check (2026-11-26):** The catalog contains objects associated with the six `202611260001`-`202611260006` files, but no receipts or authoritative exact-revision proof. Tracked `202611200010_phase05b_products_pricing_quotes.sql` also differs from its receipt after normalization. New forward security changes are documented separately; do not infer historical provenance from them.
- **Baseline phases:** `scripts/verify-schema-baseline.cjs` now supports `predeployment`, `after-rpc-security`, and `final` expectations. The post-RPC phase passed with the export ACL explicitly pending; the final phase passed after the forward ACL fix.
- **Forward-only grant fix:** `202611270002_restrict_crm_export_job_grants.sql` and `export-job-grants-rollback.sql` were applied/tested on the confirmed disposable project. The validator passed post-deployment; the original ACL state was restored after the rollback test. No migration-ledger write was performed.

### P2 - Activity custom reports use a permission name not present in the current permission catalogue

- **ID:** REPORT-ACTIVITY-001
- **Route/component:** `/reports/builder`, `execute_custom_report`.
- **Expected:** Users with task/call/meeting view permissions can run appropriately scoped activity reports.
- **Observed:** The function checks `activities.view`, while live activity RLS is keyed to `tasks.view`, `calls.view`, and `meetings.view`; current permission query found no `activities.view` entry. The SECURITY DEFINER query also lacks explicit hierarchy predicates.
- **Root cause:** Report permission naming and the activity permission model differ; the definer query does not enforce row hierarchy.
- **Reproduction:** Not run. In staging, attempt an Activities report as a role with the module-specific task/call/meeting permissions and compare against a cross-region synthetic fixture.
- **Impact:** Activity reports may be denied to intended users; granting the permission without adding row scope would create a cross-user data boundary risk.
- **Suggested fix:** Align the permission contract and implement row-level scoping in the report execution path, then test across roles/regions.
- **Status:** CONFIRMED schema/source mismatch; browser behavior not tested.
- **Follow-up (2026-11-27): PARTIAL.** The report-RPC source candidate now accepts the task/call/meeting permission family and relies on Activities RLS for per-type and hierarchy scope. The task path passed the rollback regression; call/meeting paths and persistent deployment remain unverified.

### P2 - Import matching can create duplicates under concurrent import jobs

- **ID:** IMPORT-DUPLICATE-001
- **Route/component:** `/settings/imports`; `run_lead_import`.
- **Expected:** Concurrent imports applying the same match criteria do not create duplicate Leads.
- **Observed:** Each import locks its own job, searches for a matching Lead, then inserts when no match is found. Separate jobs can race; match indexes are not unique constraints.
- **Root cause:** Job-level locks do not serialize matching across jobs, and match criteria are not protected by a unique constraint or equivalent transaction-safe mechanism.
- **Reproduction:** Not run. Use two isolated staging import jobs with the same synthetic match key and synchronize them at the match/insert boundary.
- **Impact:** Duplicate Leads under concurrent imports.
- **Suggested fix:** Add a transaction-safe deduplication/uniqueness strategy consistent with CRM matching semantics and test two concurrent jobs.
- **Status:** CONFIRMED source-level race; no concurrent test executed.
- **Evidence:** `supabase/migrations/202611260003_resumable_lead_imports.sql`.

### P2 - Web-to-lead deduplication misses mixed-case imported email values

- **ID:** WTL-EMAIL-001
- **Route/component:** `/api/web-to-lead`; `submit_web_to_lead`.
- **Expected:** The same email is deduplicated regardless of case.
- **Observed:** Import trims but preserves email case; web submission lowercases before exact comparison.
- **Root cause:** Import and public-form paths normalize email differently.
- **Reproduction:** Not run. Import a synthetic Lead with mixed-case email, then submit the same address in lowercase to a staging form and check deduplication.
- **Impact:** Duplicate Leads for case variants of the same email.
- **Suggested fix:** Normalize both sides consistently (including existing imports) and add a case-variant regression test.
- **Status:** CONFIRMED source-level mismatch; no data was changed.
- **Evidence:** `supabase/migrations/202611260003_resumable_lead_imports.sql`; `supabase/migrations/202611260005_web_to_lead_deduplicate.sql`.

### P2 - Export UI can poll continuously after an export job fails

- **ID:** EXPORT-POLL-001
- **Route/component:** `/settings/exports`; `processLeadExportBatch`.
- **Expected:** Polling stops and reports terminal `failed` status.
- **Observed:** The UI loop returns only when status is `completed`; a failed job can produce a successful HTTP response and continue the loop without delay.
- **Root cause:** Polling treats only `completed` as terminal and does not apply backoff to the failed state.
- **Reproduction:** Not run. In staging, force a synthetic export job to terminal `failed` and observe whether client polling stops.
- **Impact:** Stuck export action and excessive repeated requests.
- **Suggested fix:** Treat `failed` and other terminal statuses as terminal results/errors and apply bounded backoff.
- **Status:** CONFIRMED source-level defect; no failure injection run.
- **Evidence:** `apps/web/src/lib/exports/jobs.ts`; `apps/web/src/app/(dashboard)/settings/exports/page.tsx`.

### P2 - MCP dashboard summary can silently undercount at scale

- **ID:** MCP-SCALE-001
- **Route/component:** `crm_get_dashboard_summary`.
- **Expected:** Metrics are exact for the user's full authorized result scope.
- **Observed:** The tool loads all Opportunities with an unpaginated `.select('amount, stage')` and sums the returned JS array; Supabase/PostgREST row limits can truncate results (commonly 1,000 rows).
- **Root cause:** Aggregation is performed over a client-fetched result rather than an authorized server-side aggregate.
- **Reproduction:** Not run. Verify with a controlled staging dataset exceeding the API row cap and compare tool output with an authorized database aggregate.
- **Impact:** Pipeline total and active-opportunity count can be wrong once the result set exceeds the API row cap; large result materialization is also inefficient.
- **Suggested fix:** Use a server-side aggregate RPC with explicit authorization and count/amount semantics.
- **Status:** CONFIRMED source-level scale risk; current database has 29 Opportunities.
- **Evidence:** `apps/mcp-server/src/tools.ts`.

### P2 - Reports can fail when results exceed 100,000 rows

- **ID:** REPORT-PAGE-001
- **Route/component:** `/reports`.
- **Expected:** Pagination never exposes a page the hook rejects.
- **Observed:** Hook rejects page > 1,000 while Next control can navigate past page 1,000 when total rows exceed 100,000.
- **Root cause:** The UI navigation limit and hook validation limit are inconsistent.
- **Reproduction:** Not run. Supply a controlled report result count above 100,000 in a test environment and advance to the final permitted page.
- **Impact:** Report page can throw at the end of the supported page window.
- **Suggested fix:** Disable Next at the max page and make the UI/server limit policy consistent.
- **Status:** CONFIRMED source-level boundary; current database has 21 Leads and no stress test was run.
- **Evidence:** `apps/web/src/hooks/use-reports.ts`; `apps/web/src/app/(dashboard)/reports/page.tsx`.

### P2 - Quote reminders hard-code dollar currency

- **ID:** REMINDER-CURRENCY-001
- **Route/component:** Hourly quote-expiration reminders.
- **Expected:** Reminder currency label matches the quote's stored currency.
- **Observed:** Reminder text formats `grand_total` with `$`; quote schema stores a currency code and defaults to INR.
- **Root cause:** Reminder formatting uses a hard-coded currency symbol instead of the quote's stored currency.
- **Reproduction:** Not run. Create a synthetic non-USD quote expiring within three days in staging and inspect the generated reminder text.
- **Impact:** Reminder may misrepresent the currency without changing the amount.
- **Suggested fix:** Include quote currency and format with locale-aware currency formatting.
- **Status:** CONFIRMED source-level defect.
- **Evidence:** `supabase/migrations/202611230003_phase05d_operational_closure.sql`; `supabase/migrations/202611200010_phase05b_products_pricing_quotes.sql`.

## Verified external and operational gaps

- **OAuth:** Current local environment variable names do not include Google or Microsoft OAuth credentials. Live email/calendar synchronization is not verified.
- **MCP transport:** Current server implements legacy SSE (`GET /sse`, `POST /message`), not Streamable HTTP. It was not running on port 3005.
- **MCP token broker:** `MCP_JWT_SECRET` is required to mint broker tokens but was not present among configured variable names. Direct Supabase access-token authentication is a separate path.
- **Scheduler:** `pg_cron` is installed; `crm-sales-reminders-hourly` is active at `0 * * * *`; 75 successful runs were recorded, latest at 09:00 UTC. No failed run was present in the grouped status query. This does not resolve the public RPC authorization defect.
- **Scale:** Current Leads count is 21. No 100k load test, query-plan review, or concurrency benchmark was performed.
- **Offices:** Current database has one company-settings row and four sales regions; no `offices` table was found. This supports single-company/region-based structure, not an explicit ten-office entity model.
- **Untracked local files:** Six audit-time migration files, two stabilization migrations, and two password-related scripts are untracked in the current worktree. The password scripts were not opened or run; review them before committing.
- **Runtime logs:** Only the health response was checked; authenticated browser console/network logs and full API 4xx/5xx behavior are NOT VERIFIED.

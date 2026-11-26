# FINLONEXA CRM v3 — Migration Reconciliation

**Status: Historical provenance remains BLOCKED / AMBIGUOUS. Four unique forward security/persistence migrations are now applied and verified on the authorized disposable development database; no historical migration or ledger receipt was changed.**

Evidence below was collected read-only from the current `main` worktree and configured Supabase database on 2026-11-26. The baseline validator is a structural, read-only pre-deployment gate; a PASS does not certify report/reminder security or production readiness.

## Executive finding

The six `202611260001`–`202611260006` migration files have no ledger receipts, but the catalog contains the expected objects declared by those files. The user had previously confirmed importing all six SQL files. Together, this supports manual SQL-editor application, but does not prove which exact file revision was executed or whether every statement completed in the same way.

There are additional historical ambiguities:

- Two tracked files were introduced with the same version, `202611200004`, in the same initial commit. The sole ledger receipt for that version normalizes to the attachment-guard file, not the Phase 05A file.
- The Phase 05A-specific objects are present, but no inspected ledger statement identifies that migration as their source.
- Tracked `202611200010_phase05b_products_pricing_quotes.sql` differs from its version receipt after normalization. The receipt contains an older opportunity-team access expression and omits the local opportunity-readable view definition.
- The report, reminder, export-grant, and MCP audit forward migrations have no receipts. Their persistent changes are applied to the confirmed disposable development database; the historical ledger remains untouched.

These facts do not justify renaming historical migrations, repairing the live ledger, or deploying the security migrations. The current schema is not reproducible from the worktree and ledger alone.

The administrator confirmation for this reconciliation establishes that only the currently configured Supabase database and a separate rollback-only disposable project were checked. The configured database was not independently identified as production or staging; no Dashboard SQL Editor history, CI/CD deployment record, or other environment ledger was supplied. Phase 05A functionality and objects from the six `202611260001`–`202611260006` files are present, but none of their exact current source revisions is proven deployed. Keep provenance **BLOCKED / AMBIGUOUS**. The new forward-only migrations are additive and do not resolve or rewrite historical provenance.

## Ledger and receipt fingerprints

The database has 71 migration receipts; the latest recorded version is `20261123224500`. Receipt fingerprints below are SHA-256 over `JSON.stringify(statements)` from the corresponding ledger row. “Normalized match” compares source SQL with the receipt after stripping SQL comments, transaction wrappers, and whitespace.

| Version / file | Git state | Receipt / fingerprint | Expected objects and live catalog evidence | Later references / source evidence | Classification and safe action |
|---|---|---|---|---|---|
| `202611200004_lead_attachment_delete_guard.sql` | Tracked; SHA-256 `787212e1a3fbad8c739f23085df10ff197a0a7c08f56caa3fabe3a5fa62d7f6a` | One receipt; `2097e7666a7b604088f219515fe565f03db0219b48710370f55b33b811b44661`; normalized match | Trigger function and Lead delete trigger exist. Function ACL does not grant `anon` or `authenticated`. | Same-version collision with Phase 05A. Both files were introduced in `c53ec67`. | **A + E:** receipt matches this file, but version is duplicated. Preserve unchanged; do not replay. |
| `202611200004_phase05a_security_and_workflows.sql` | Tracked; SHA-256 `bfc1698f06e33d26e84abeba60c986cb0a53f6f33fc79233d31fb9bd1231a6a6` | Same single receipt as above; receipt does not match this file | Six functions, three Phase 05A policies, and the opportunity-owner trigger are present. | `is_opportunity_team_member` is mentioned by receipts `202611200009` and `202611200010`; assignment/web-lead functions are later replaced by `202611230006`, `202611250002`, `202611260005`, and `202611260006`. Both colliding files were introduced together; no rename/commit ordering evidence exists. | **B + E:** tracked objects are present without a matching receipt. Preserve; establish provenance across every target environment before any renumbering or repair. |
| `202611200005_lead_chart_inherited_fields.sql` | Tracked; SHA-256 `154ac90ba0b08f7044c70c2525c8fc1af542666c49f0da8b0590c3e69bf039d7` | `ebb66f1477816b820e33f7008782ffdf6f0a95a12630e4fa4b8bb11718a7e92e`; normalized match | Added Lead columns, update trigger/function and chart aggregate function are present. | No direct later migration dependency found in the scoped source search. | **A:** tracked and ledgered. Keep unchanged. |
| `202611200006_lead_notes.sql` | Tracked; SHA-256 `0b6e8557f47632ce89d12ad89768dcf27c82dd3d205c17dd83458f3a058a7bed` | `20b2ebd66e42d0faa25b071bc12106cfa9259a6c25183a06fdbff1d50a1f0b9d`; normalized match | `lead_notes`, its index, four RLS policies and table grants are present. | No direct later migration dependency found in the scoped source search. | **A:** tracked and ledgered. Keep unchanged. |
| `202611200007_lead_bulk_actions.sql` | Tracked; SHA-256 `c7aa34f5b020f83f12ff0eadd71ea558d3cc4215d299a39b769b866a3d7030fd` | `3ef31a1d5111700f5658156705ba07bbd9396964a4b19223cab222cf470724a2`; normalized match | `lead_bulk_change(uuid[],text)` is present. | No direct later migration dependency found in the scoped source search. | **A:** tracked and ledgered. Keep unchanged. |
| `202611200008_lead_recovery.sql` | Tracked; SHA-256 `c556ccfc1c66205dff8a4154fa936cff1d3342b454d8bf4dd5ef0be76cf58f54` | `36cead82ff648a5b292ffd752cf4aff6ee3f0b9187a4843a670351988140d470`; normalized match | `lead_archives`, four recovery functions and two Lead recovery policies are present. | Recovery relies on the earlier Lead/ownership security setup. | **A:** tracked and ledgered. Keep unchanged. |
| `202611200009_field_read_boundary.sql` | Tracked; SHA-256 `d02a7cb41b3f0ed9c57883ffb9f6e7f9092f66e2f3af515347d5eac946104a14` | `00c8e6a9314b74dad7047b829183fbb7ee67b0c010d8b55655282e3f52b18ec5`; exact match | `crm_masked_reader`, four readable views, module reader/dashboard functions and grants are present. | Grants execution on `is_opportunity_team_member`, confirming a dependency on Phase 05A’s helper. | **A:** tracked and ledgered. Keep unchanged. |
| `202611200010_phase05b_products_pricing_quotes.sql` | Tracked; SHA-256 `4d78b16ad94de30ddd97ea0e20063e26199c6645bf348e8057d79924fb1d70f3` | `f08c2a49d23b72fcbd0e812fc34e33cb2929ddaa366af99f4fe8d83bb1f06dd9`; **does not** normalize to local source | Seven product/quote tables, 14 indexes, 26 policies, five functions, quote sequence and opportunity-readable view are present. | The receipt uses `is_opportunity_team_member(..., 'read')`; local source uses `(..., NULL)` and adds `opportunities_readable`. Later report migration depends on readable views. | **A, with source/receipt divergence:** do not replay. Determine which source definition is authoritative in each environment before fresh deployment. |
| `202611260001_lead_report_summary.sql` | Untracked at current `main`; file appears in local commit object `fdbb259`, not reachable from visible branches | No receipt | `leads_report_summary(text)` exists. | Added with the other five files in `fdbb259`. User previously confirmed importing all six SQL files. | **C:** expected object present, no receipt. Likely manually applied, not proven. Preserve current file; verify exact live definition before ledger repair. |
| `202611260002_lead_list_indexes.sql` | Untracked at current `main`; source in local commit object `fdbb259` | No receipt | All four declared Lead list indexes are present and valid. | Same provenance as the six-file group. | **C:** likely manually applied, not proven. No replay. |
| `202611260003_resumable_lead_imports.sql` | Untracked at current `main`; initial source in `fdbb259`, two executor-role grant lines added in local commit object `2c82c71` | No receipt | Five matching indexes and the five-argument `run_lead_import` exist; owner is `crm_import_executor`, a NOLOGIN/NOBYPASSRLS role. | User reported an initial schema-permission error, followed by confirmation that all six SQL files were imported. The later source adds temporary `CREATE` privilege around ownership transfer. | **C:** expected objects present; the exact applied revision is unproven. Compare the live function definition/owner before deciding whether the two source grant lines were applied. Do not replay. |
| `202611260004_lead_export_jobs.sql` | Untracked at current `main`; source in local commit object `fdbb259` | No receipt | Export table, constraints, two indexes, three RPCs, seven policies, and private storage bucket/policies are present. However, `authenticated` has effective table-level SELECT/INSERT/UPDATE/DELETE on `crm_export_jobs`, including status-column updates. The migration revokes PUBLIC/anon but does not revoke authenticated defaults before its narrower grants. | Same six-file group. The live update policy is owner/permission-scoped but does not restrict mutable columns or job state transitions. | **C + P1 grant mismatch:** expected schema objects exist, but direct table mutation rights exceed the narrow grant contract. Do not repair by replay; require a new reviewed forward migration after provenance reconciliation. |
| `202611260005_web_to_lead_deduplicate.sql` | Untracked at current `main`; source in local commit object `fdbb259` | No receipt | Website/email index and `submit_web_to_lead(uuid,jsonb)` exist. | Function is later changed in `202611250002` and this file; assignment function is also used. | **C:** likely manually applied, not proven. No replay. |
| `202611260006_atomic_lead_round_robin.sql` | Untracked at current `main`; source in local commit object `fdbb259` | No receipt | `evaluate_and_assign_lead(uuid)` exists with `service_role` execution; function has later replacement history too. | Called by web-to-lead flow; earlier versions appear in `202611180010` and `202611230006`. | **C:** likely manually applied, not proven. No replay. |
| `20261126143718_secure_custom_report_rpc.sql` | Untracked; SHA-256 `288d553565add2da7a65ffbed7447faa1e08975e7c484a8013ce4c2c69892392` | No receipt; ledger intentionally untouched | Applied as a new forward migration to the confirmed disposable development database. The live function is now `SECURITY INVOKER`; PUBLIC, anon and service_role are denied, authenticated can execute. | Pre-deployment fingerprint matched; persistent transaction postconditions passed. The dedicated synthetic security fixture passed in a rollback transaction, with function state and fixture-data integrity verified. | **G:** applied and verified on disposable development DB; no ledger receipt was fabricated. |
| `202611270001_secure_sales_reminders_rpc.sql` | Untracked; SHA-256 `d56289a6f16c865e53d47d10c719b3a2b1135f132a3204679ad7389d845f0f13` | No receipt; ledger intentionally untouched | Applied as a new forward migration to the confirmed disposable development database. PUBLIC/anon execution is denied; authenticated self-service and trusted service/Postgres scheduler execution remain. | Pre-deployment fingerprint and active Postgres-owned hourly scheduler matched. Persistent postconditions passed; the rollback-only fixture passed self-target, cross-user denial, service-role, scheduler and anonymous assertions. Scheduler definition was unchanged. | **G:** applied and verified on disposable development DB; no ledger receipt was fabricated. |
| `202611270002_restrict_crm_export_job_grants.sql` | New forward-only migration | No receipt; ledger intentionally untouched | Applied to revoke table/column grants from PUBLIC, anon and authenticated, then restore authenticated SELECT and INSERT on only `module`, `columns`, and `time_zone`. | Persistent migration assertions passed. The post-deployment rollback validator passed, and the effective grants plus table/column ACL snapshot matched the pre-test state. | **G:** applied and verified on disposable development DB; no ledger receipt was fabricated. |
| `202611270003_create_mcp_audit_logs.sql` | New forward-only migration | No receipt; ledger intentionally untouched | Applied an empty `public.audit_logs` table with RLS; authenticated has owner-scoped INSERT only, and anon has no access. | Pre-deployment migration-plus-fixture rollback validation and post-deployment RLS/rollback validation passed. The table remained empty and its schema/ACL/policy state was unchanged by post-deployment testing. | **G:** applied and verified on disposable development DB; no ledger receipt was fabricated. |

### Object, grant, and policy checks

The scoped catalog comparison covered declared tables, views, sequences, functions, indexes, policies and triggers, plus relevant columns, constraints, RLS state, function owners/security modes/ACLs, table grants, executor roles, readable-view owners and export storage. Expected declared objects for `202611200005`–`202611200010` and `202611260001`–`202611260006` were found, and the relevant trigger targets/functions were independently verified through `pg_trigger`. `202611200010` has a source/receipt semantic discrepancy even though its declared objects exist.

The report/reminder ACL evidence is tracked separately: both forward migrations are applied and their postconditions and rollback-only security suites passed on the disposable development database. The reminder scheduler stayed active and Postgres-owned. No historical migration was renamed, replayed, or recorded in the ledger.

### Current RPC fingerprints for a pre-deployment comparison

These hashes are SHA-256 of `pg_get_functiondef(oid)` from the live catalog before the report migration. The reminder row still represents current state; the report row is retained as a pre-deployment fingerprint only. A mismatch is a stop condition, not a reason to overwrite a live definition.

| Function | Definition SHA-256 | Current execute state |
|---|---|---|
| `public.execute_custom_report(uuid,jsonb)` | `25b3cde5296797cae2c6caeec9478a98aa0c558ecf76544cb48a7d28e5249d9c` | PUBLIC, anon, authenticated and service_role can execute |
| `public.generate_sales_reminders(uuid)` | `93da889249da749df0a444d9e14afaecfe92ae253a70f15cda27920bda62ff3d` | PUBLIC, anon, authenticated and service_role can execute |

### Persistent forward-migration progress

On 2026-11-26, after both `.env` project references matched the administrator-confirmed disposable project, four new forward migrations were applied in guarded PostgreSQL transactions. The exact pre-fix report/reminder fingerprints and absent receipts were checked before those changes; the active Postgres-owned reminder scheduler was verified and preserved. Persistent postconditions were checked before commit.

- Report RPC fingerprint after apply: `460d61b6366bb473ceb1a46e08fafee10a4749b84d0638846823a100598405c2`.
- Reminder RPC fingerprint after apply: `40e0db48537fda99f16a2c53f0646965f117f23def3dfdebaef1f44c0b9b1fdb`.
- Report, reminder, and export-grant rollback validators passed after application; their fixtures were rolled back and integrity checks confirmed no test data or ACL/function changes persisted from validation.
- `validate-mcp-audit-persistence.cjs <project-ref> predeployment` passed before applying the audit migration; `postdeployment` passed after apply, including owner-only insert, cross-user/anonymous denial, no authenticated read/update/delete, empty fixture cleanup, and unchanged schema/ACL/policies.
- `verify-schema-baseline.cjs <project-ref> after-rpc-security` passed with the export ACL issue explicitly pending; `<project-ref> final` passed after the ACL migration.
- The migration ledger was not modified. These direct forward applications intentionally have no receipts; historical ambiguity remains visible.

### Additional P1 discovered in export grants

The pre-fix catalog showed authenticated table-level SELECT/INSERT/UPDATE/DELETE on `public.crm_export_jobs`, including `status` mutation. The new forward ACL migration now removes direct state mutation and retains only SELECT plus INSERT on the three requested columns. The persistent migration assertions, post-deployment rollback fixture, and final read-only baseline all passed. Historical migration `202611260004` remains untouched.

## Was the six-migration group manually applied?

Evidence supporting manual application:

1. The user previously reported a permission error during SQL file 3, then confirmed that all six SQL files were imported.
2. The catalog contains the declared objects from all six files, and no corresponding receipts exist.
3. The current six files are untracked in this worktree but appear in local commit object `fdbb259`; the 003 executor grant adjustment appears in `2c82c71`.
4. No specific runner for these six IDs was found in the scoped search of `scripts`, `apps`, or `packages`. Existing custom apply/verify scripts found in that search target other migration versions.

Conclusion: manual SQL-editor application is the best-supported explanation, but not a proven fact. No Supabase SQL-editor history or complete database deployment log was available. The reachable Git branches are only `main` and `origin/main`; the two source commits are not ancestors of current `HEAD` or contained by a visible branch. Do not treat their presence in the local object database as proof of deployment.

## Git provenance of the duplicate

`git log --follow`, `git blame`, and the initial commit show both `202611200004` files were added together in `c53ec67`; there is no evidence that one was renamed or committed first. The current receipt’s SQL normalizes to `202611200004_lead_attachment_delete_guard.sql`, not Phase 05A. Live Phase 05A objects and later references prove that some Phase 05A logic is present, but cannot establish whether the full Phase 05A file was run manually or whether later migrations created/replaced some of those definitions.

## Safe forward-only path

This sequence is gated; steps marked **admin confirmation required** are not performed by this change.

1. **Freeze historical IDs.** Do not edit, rename, delete, replay, or re-create any `202611200004`–`202611200010` migration. Do not alter live data or RLS.
2. **Preserve source.** Keep the six `202611260001`–`202611260006` files and their tests intact; bring them into the release branch only after review. Preserve the two security candidate migrations. Do not stage or commit unrelated worktree changes.
3. **Run the read-only baseline gate.** Use `node scripts/verify-schema-baseline.cjs <independently-verified-project-ref>`. A pass verifies structural prerequisites and the currently expected receipt state only; it explicitly does not certify production security.
4. **Reconcile the six already-present schema changes.** **Admin confirmation required:** compare current live function bodies, storage policies, index definitions and grants against the exact source revisions. Confirm the manual-import history. Only then may the project owner record versions `202611260001`–`202611260006` as already applied using the Supabase migration-repair workflow for the installed CLI version. This is a ledger-only operation, not a SQL replay. Do not manually insert ledger rows or execute the six files again.
5. **Resolve the duplicate and Phase 05B divergence across environments.** **Admin confirmation required:** obtain each deployed environment’s migration history and confirm which Phase 05A definition was deployed. The current evidence cannot prove that renaming either duplicate file is safe. If universal non-deployment of one file cannot be established, preserve both historical files and use a separately reviewed clean baseline/cutover strategy for fresh environments; do not pretend a new forward migration repairs the old duplicate.
6. **Create and verify a release manifest.** Record the exact source revision and expected receipt state for every environment. Do not proceed while the same release would discover duplicate IDs or a source/receipt mismatch.
7. **Deploy report RPC fix, then verify.** **Complete on disposable development DB:** checked target identity, exact pre-fix fingerprint, and absent receipt; applied the new migration transactionally; verified invoker mode/ACL; passed the report security fixture in rollback mode.
8. **Deploy reminder RPC fix second.** **Complete on disposable development DB:** checked target identity, exact pre-fix fingerprint, absent receipt and active scheduler; applied transactionally; verified self-target/anonymous/service-role/scheduler paths with the rollback fixture; scheduler remained active and unchanged.
9. **Fix and verify export-job grants.** **Complete on disposable development DB:** applied `202611270002_restrict_crm_export_job_grants.sql`, checked allowed SELECT/INSERT and denied workflow mutations, then passed the post-deployment rollback validator. Do not edit/replay `202611260004`.
10. **Continue MCP stabilization only after the migration path is accepted.** MCP build, audit storage/failure semantics, Streamable HTTP, field-scope tests, and six-role tests remain separate verified slices.

### Stop conditions

- Any mismatch between the live schema and expected migration definition.
- Missing/unexpected receipt, duplicate-version discovery, or an unverified target project.
- No administrator confirmation of the six SQL-editor imports or the conflicting Phase 05A deployment.
- Any need to modify business ownership data, disable RLS, or use service-role access as a user-scope shortcut.
- The historical privileged key rotation gate remains independently unresolved.

## Baseline verification

`scripts/verify-schema-baseline.cjs` performs catalog and migration-ledger `SELECT` queries only. It never prints connection material, writes to the database, or executes CRM RPCs. It supports `predeployment`, `after-rpc-security`, and `final` phases. The `after-rpc-security` phase requires the exact secured report/reminder function fingerprints and explicitly reports the known export grant gap as pending; `final` additionally requires the narrow export ACL. All phases check structural objects, roles, indexes, policies, triggers, readable views, storage, and the intentionally unchanged historical receipt state.

## Current release decision

- Migration status: **HISTORICAL PROVENANCE PARTIALLY RECONSTRUCTED / AMBIGUOUS; disposable development security state repaired with forward-only SQL**.
- Report RPC: forward migration applied and postconditions plus rollback regression verified on the disposable development database; **ledger intentionally unchanged**.
- Reminder RPC: forward migration applied; postconditions, rollback regression, and scheduler preservation verified on disposable development DB; **ledger intentionally unchanged**.
- Export-job grants: forward migration applied; grant regression and rollback integrity verified; **ledger intentionally unchanged**.
- MCP: build/runtime/transport/audit/role tests are not started in this slice.
- Active P0/P1 blockers: historical privileged-key rotation unconfirmed; migration provenance and source/receipt reproducibility remain unresolved; the MCP audit storage table is absent and MCP build failure remains outstanding. The three forward security fixes apply only to the confirmed disposable development database, not production.

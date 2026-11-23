# Field-read enforcement cutover — staged, not deployed

17 November 2026. **Live field-read security remains OPEN.** This is the exact implementation handoff; it does not claim browser-side omission protects raw REST.

## Implemented and executed

Candidate SQL: `docs/staged-sql/202611170003_field_read_boundary.sql`.
Rollback verifier: `scripts/verify-field-read-boundary.cjs`.
Executed assertions: `packages/crm-shared/tests/field-read-boundary-rollback.sql`.

The candidate removes direct SELECT privileges on the four protected classification columns while retaining explicit grants on other columns. A bounded, fixed-module `read_module_records` function runs under a dedicated NOLOGIN/NOBYPASSRLS role that does not own the business tables and inherits authenticated policies. JWT identity and feature checks remain caller-specific. The function removes registered hidden fields before returning JSON. No privileged key is sent to the browser or used to read around ownership rules.

Actual PostgreSQL rollback tests PASS:

- Permitted Account Type returned by the authorized reader.
- Raw authenticated-role SELECT of Account Type rejected by column privileges.
- Hidden Account Type omitted from the reader result while visible Name remains.
- Another owner receives no Account records through the definer reader (RLS retained).
- Explicit NULL page size rejected rather than enabling an unbounded read.

All role creation, grants/revocations, function DDL and fixtures were rolled back. The live role, function and privilege changes are NOT installed. Actual PostgREST HTTP, embedded REST reads, all four column-specific cases and browser cutover have not been accepted as PASS.

PostgreSQL documents that table-owner/BYPASSRLS execution can evade row policies; the dedicated function owner deliberately has neither property. See [row-security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) and [function security documentation](https://www.postgresql.org/docs/current/sql-createfunction.html). The candidate was tested against the configured development database, not accepted solely from this design reasoning.

## Required owner coordination before deployment

1. Current module hooks use direct `select('*')`: `hooks/use-accounts.ts`, `use-contacts.ts`, `use-opportunities.ts`; Campaign page reads likewise. Their list/detail/search/filter/sort/relationship shapes must move to the authorized reader without losing features. The candidate currently provides bounded ID-based reads only; it is not a drop-in search/filter/relationship replacement.
2. Direct column revocation would also break Dashboard's existing invoker aggregates. Dashboard owner must review its audited RPCs and provide an RLS-preserving reader-boundary cutover in its own migration. No Dashboard source/migration/function ownership was changed here.
3. Audit every exposed view/RPC for alternate unmasked reads, then execute raw REST/embedded-field negative tests after coordinated staging. DB-role privilege assertions alone do not complete HTTP acceptance.
4. Validate permitted/hidden reads for each classification and active role, metadata revocation, feature denial, pagination and cross-branch data scope.
5. Only then install the staged privilege boundary in a single coordinated cutover. Do not bulk-push this candidate or deploy it independently of consumers.

## Concurrent migration blocker

While Campaign member DDL was being prepared, another process installed `202611170004`. Receipt inspection returned `name=NULL`, `statements=NULL`; its live member table differs from the candidate and lacks the candidate actor/counter functions. Workspace now contains `202611170004_phase3_operational_modules.sql`, owned by that other process. It was not modified.

Our uninstalled member candidate was moved to `docs/staged-sql/campaign_members_candidate.sql`, outside the executable migration directory, to avoid duplicate-version replay. The field-read candidate was likewise moved outside executable migrations. No installed migration was moved or rewritten.

**Confirmed P0 in the installed member policy:** `scripts/verify-installed-campaign-scope.cjs` ran synthetic fixture operations and failed the expected denial assertion: an authenticated caller could insert a visible-Campaign membership referring to a Lead the caller could not SELECT. All synthetic writes rolled back. This is an executed failure, not a theoretical warning.

Candidate narrow correction: `docs/staged-sql/campaign_member_target_scope_guard.sql`. It adds a restrictive target-record policy rather than replacing the other owner's policies. It is UNAPPLIED/UNTESTED pending migration ownership clarification. No existing membership or business record was altered.

Next action: identify the active Campaigns/migration owner, reconcile the installed 004 receipt and source, then apply/test a uniquely versioned target-scope correction. Do not replay local candidate 004 against that receipt. The user ownership question remains pending; no further schema writes should run while unresolved.

## 17 November — reconciliation and protected Dashboard handoff (supersedes earlier pending-owner notes)

User confirmed Codex may reconcile installed Campaign schema, then explicitly chose **Keep Dashboard protected; retain staged handoff**. Dashboard source/migrations remain unchanged. Migration 202611170004 and its unknown original statement provenance are preserved. Forward migrations 202611170005–202611170009 are applied: target-record scope, member counters, source-compatible retention/actor handling, orphan-count semantics and Opportunity primary_campaign_source_id. The previously reproduced inaccessible-Lead membership P0 is corrected and rollback-tested. No old migration was replayed.

Campaign list/detail P046/P047 remain PARTIAL. Implemented detail, member add/status/remove, owner labels, parent/child navigation and corrected bounded Opportunity relationship query. Synthetic database fixtures verify foreign-target denial, duplicate rejection, counters, conversion and deletion retention, actor integrity and association rollback; fixtures rolled back. Nineteen focused tests, focused ESLint, full web TypeScript and webpack production build PASS. Latest full TypeScript recheck PASS.

Raw REST field masking remains OPEN; staged reader boundary must not deploy without coordinated Dashboard/module reader cutover. Browser and comparative visual acceptance remain BLOCKED by denied Chrome access. Owner assignment, full source tabs, advanced filters/bulk/export/recovery, metadata layouts and Opportunity-derived financial metrics remain unfinished. No page or Phase 03 completeness claimed. Next unfinished page: Campaigns P046/P047. Evidence and exact files: docs/CAMPAIGNS_RECONCILIATION_REPORT.md.

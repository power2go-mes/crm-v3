# Phase 03 module contracts for Dashboard owner

17 November 2026. **Persistence contracts delivered; full module/field-security parity remains PARTIAL.** Dashboard source files and migrations 006–008 were not modified.

## Installed contracts

| Module | Table.column | PostgreSQL type | Semantics |
| --- | --- | --- | --- |
| Accounts | `public.accounts.account_type` | nullable varchar(80) | V2 optional classification; existing unknown values remain NULL |
| Contacts | `public.contacts.contact_source` | nullable varchar(50) | V2 optional source choice, not a relationship |
| Opportunities | `public.opportunities.lead_source` | nullable varchar(50) | V2 optional source choice, not a Lead foreign key |
| Campaigns | `public.campaigns.campaign_type` | required varchar(20) | V2 campaign type; no default type invented |

Account types: prospect, customer_direct, customer_channel, channel_partner_reseller, installation_partner, technology_partner, other. Blank permitted, NULL preserves unknown history.

Contact sources: web, phone_inquiry, partner_referral, purchased_list, email, other. Blank/NULL permitted. Do not substitute Lead Source choices.

Opportunity sources: website, referral, event, campaign, phone, email, **social media**, partner, other. Blank/NULL permitted. The space in social media is source-correct; do not silently normalize it to social_media.

Campaign types: email, event, **social_media**, other, webinar, referral, advertisement. Statuses: new, planned, in_progress, completed, aborted; planned is the verified v2 creation default.

## Campaign schema and Dashboard integration

Actual source name column is **campaign_name**, not name. Owner column is **campaign_owner_id**, UUID FK to user_profiles, deletion restricted. Dashboard owner must map its Campaign table name field accordingly; no Dashboard query was edited in this task.

Campaign includes start/end dates, numeric(15,2) expected_revenue/budget_cost/actual_cost (nullable/nonnegative), expected_response 0–100, number_sent (source default zero), description, parent_campaign_id with scoped cycle prevention, source counter/value columns and timestamps. Counter defaults are verified source defaults; live member/counter recomputation is not implemented. No fake Campaign rows were persisted.

RLS requires active authenticated feature grants and campaign_owner_id within get_accessible_user_ids(auth.uid()). Creation derives the current owner in the action and RLS requires self ownership. Updates must remain within authorized scope. Catalog permissions campaigns.view/create/update/delete/export are editable; **no existing role was automatically granted them**, including SUPER_ADMIN. Configure intended grants through the approved Role Manager before expecting the Campaign widget to appear. Hard delete remains ungranted pending dependency-aware recovery.

Existing Account/Contact/Opportunity RLS is preserved. Their new columns have source choice constraints and remain NULL on all pre-existing records; no historical associations or converted records were inferred or rewritten. Opportunity stages unchanged.

## Field permissions — exact acceptance boundary

All four builtin definitions are registered with the existing metadata engine and fixed invoker module adapters. Source choice metadata and requiredness are installed: Campaign Type required/non-relaxable; other three optional. Role-specific hidden/readonly rules deny changed classification writes at database triggers, with active-role/deny precedence. Readonly write denial was exercised using synthetic fixtures.

**Raw REST column masking is NOT implemented.** Dashboard's existing metadata-aware aggregation can suppress hidden registered fields, but an entity-level SELECT privilege alone does not provide PostgreSQL column masking by application role. Module readers and any masked server interface must complete that read contract before hidden classification fields are security-accepted. Campaign page read masking and complete field-aware forms remain unfinished. This is a security acceptance gap, not a PASS implied by RLS row tests.

## Migrations and compatibility

- APPLIED `202611160009_module_data_contracts.sql`: additive fields, Campaign model, source constraints, RLS/indexes/permissions, metadata bindings and parent guard.
- APPLIED `202611160010_module_field_writes.sql`: classification field write guards.
- APPLIED `202611170001_module_choice_metadata.sql`: verified choices/requiredness on those new builtin definitions.
- Target verified against configured project `bpwdxslrkgmcoewkwufu`; migration history inspected first. No 00006 replay, resets, existing role-grant changes, or business-record updates.
- Historical 00006 schema/history discrepancy remains unresolved.
- Unapplied Accounts candidate 202611160003 includes account_type; it must be reconciled with the newly installed contract before any future execution. Do not bulk-push or replay it as-is. It was not modified or applied here.

Reproduction: `node scripts/verify-module-contracts.cjs bpwdxslrkgmcoewkwufu`. Installed statements are compared to the migration source; tests use synthetic identities/records inside rollback. `--inspect` prints schema/history metadata only. `--apply` installs only missing tested versions.

## Tests executed

PASS: Campaign INSERT/UPDATE and saved type; verified planned default; grouped counts scoped to caller; foreign-owner read exclusion and insert denial; invalid Campaign/Contact choices; Campaign self-parent rejection; Account/Contact/Opportunity source round-trips; read-feature denial; readonly classification write denial; exact Opportunity source spelling and Campaign requiredness metadata. All synthetic writes rolled back. These are focused assertions, not a full six-role/branch/field-security certification.

PASS: 12 unit tests (three Campaign validation, four authenticated action integration, five existing navigation tests); focused Campaign/navigation ESLint. Tests check actor-derived create owner, owner preservation on edit, feature denial and unauthenticated denial.

Full web TypeScript and production build: **FAIL outside this contract code**, `tasks/page.tsx:291` passes unsupported `searchPlaceholder` to ListToolbar. Build compiled before failing its type check. A prior full TypeScript run before concurrent Tasks changes passed after correcting Campaign type compatibility. No current whole-workspace PASS is claimed.

Browser: NOT EXECUTED. Prior Chrome computer-use denial remains unresolved; no visual or click-through workflow acceptance claimed.

## Continued Campaign implementation

Added `/campaigns`, typed Campaign record, source validation, authenticated create/edit action and native modal with name/type/status/parent/date/financial/response/sent/description fields. List uses shared DataGrid, authenticated query cache, bounded 20-record pages and name search. Added a permission-gated Campaigns destination to the existing Sales sidebar without changing Dashboard navigation or MES structure. Save invalidates only the current user's authenticated cache prefix, including dependent aggregates.

Still missing: complete owner picker/labels, source single-step/wizard/custom forms, field-aware read/rendering, detail/related tabs, CampaignMember workflows and counters, advanced filters/bulk/export/recovery, paginated parent selector and browser acceptance. The page is PARTIAL; database/validation tests do not certify its UI.

Next unfinished module work: Campaign detail/member workflows and read-field security; coordinate the Tasks toolbar regression with its active owner before full Phase 03 build acceptance. Activities, Reports, Settings, Automation, Communications and Booking remain in the existing queue; none was falsely marked implemented.

Additional source integrity closure: APPLIED 202611170002_campaign_counter_bounds.sql, matching v2 PositiveInteger counters. Negative counter fixture rejection PASS; all module-contract fixtures rolled back. No business counts were recomputed or invented. Four additive migrations were installed in this continuation (009,010,202611170001,202611170002). Dashboard source and all existing Dashboard migrations remain unchanged.

17 November continuation: Tasks owner has already added the toolbar props; no call-site/shared-toolbar edit was needed. Full web TypeScript and webpack production build PASS (21 static pages). Field-read candidate implemented and rollback-tested: raw Account Type SELECT denied, permitted/masked reads via a dedicated NOBYPASSRLS non-owner reader, cross-owner RLS retained and NULL pagination rejected. This is NOT deployed: direct column revocation requires coordinated module and Dashboard reader cutover; live raw REST field-read gap remains OPEN. Candidate moved outside executable migrations to docs/staged-sql/202611170003_field_read_boundary.sql.
Concurrent schema conflict: external 202611170004_phase3_operational_modules.sql appeared and installed a different Campaign member table, with history name/statements NULL. Our uninstalled member candidate moved to docs/staged-sql/campaign_members_candidate.sql, avoiding duplicate-version execution. Member candidate tests NOT EXECUTED against installed schema. Actual installed negative test FAILED/P0: visible Campaign accepted an inaccessible Lead membership. All fixtures rolled back. Read-only receipt evidence and exact cutover/owner handoff: docs/FIELD_READ_SECURITY_CUTOVER.md. Narrow restrictive policy correction is staged/UNAPPLIED/UNTESTED. Migration ownership question pending; schema writes paused. Dashboard files/migrations and installed 004 were not modified. No Phase03/module completeness claim.

## 17 November — reconciliation and protected Dashboard handoff (supersedes earlier pending-owner notes)

User confirmed Codex may reconcile installed Campaign schema, then explicitly chose **Keep Dashboard protected; retain staged handoff**. Dashboard source/migrations remain unchanged. Migration 202611170004 and its unknown original statement provenance are preserved. Forward migrations 202611170005–202611170009 are applied: target-record scope, member counters, source-compatible retention/actor handling, orphan-count semantics and Opportunity primary_campaign_source_id. The previously reproduced inaccessible-Lead membership P0 is corrected and rollback-tested. No old migration was replayed.

Campaign list/detail P046/P047 remain PARTIAL. Implemented detail, member add/status/remove, owner labels, parent/child navigation and corrected bounded Opportunity relationship query. Synthetic database fixtures verify foreign-target denial, duplicate rejection, counters, conversion and deletion retention, actor integrity and association rollback; fixtures rolled back. Nineteen focused tests, focused ESLint, full web TypeScript and webpack production build PASS. Latest full TypeScript recheck PASS.

Raw REST field masking remains OPEN; staged reader boundary must not deploy without coordinated Dashboard/module reader cutover. Browser and comparative visual acceptance remain BLOCKED by denied Chrome access. Owner assignment, full source tabs, advanced filters/bulk/export/recovery, metadata layouts and Opportunity-derived financial metrics remain unfinished. No page or Phase 03 completeness claimed. Next unfinished page: Campaigns P046/P047. Evidence and exact files: docs/CAMPAIGNS_RECONCILIATION_REPORT.md.

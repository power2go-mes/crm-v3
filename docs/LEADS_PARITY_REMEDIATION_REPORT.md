# Leads parity remediation checkpoint

16 November 2026. **PARTIAL — not accepted as complete.** This report supersedes the acceptance claims in `PHASE_3A_LEADS_IMPLEMENTATION_REPORT.md`; it preserves that report as historical evidence.

## Implemented changes

- Authenticated identity is included in Lead query keys. Authorization loading fails closed, stale auth requests cannot overwrite a newer identity, and identity changes/sign-out clear the query cache. Inactive roles no longer contribute feature grants.
- Lead search quotes PostgREST grammar and escapes wildcard literals. Pagination and sort fields are bounded/allowlisted; recently viewed reads the personal record history instead of returning the ordinary list.
- The list now uses the eight source columns: Title, First Name, Last Name, Email, Lead Status, Lead Source, Industry, Annual Revenue. `New` uses the actual create grant; edit/conversion use `leads.update`. Pinning and recent visits use persistent shared RPCs. Converted-list creation/layout controls are hidden. Source-style light table colors were restored; pixel equivalence is unverified.
- Selected-record exports use an authenticated server endpoint, explicit columns/IDs, RLS reads, feature/metadata checks and bounded CSV/XLSX/PDF generation. Formula injection is neutralized; PDF Unicode currently fails explicitly rather than corrupting text. The export dialog uses native dialog focus/keyboard behavior. This is selected-record export, not completed all-record/report export.
- Public Supabase configuration rejects service-role/secret credentials at environment parsing and before compilation. Current configured public values classified as publishable; no credential was printed or rotated. Historical privileged-key revocation remains unverified.
- Conversion now has scoped, bounded record lookups and an existing-opportunity choice. The unsupported skip-opportunity option is removed, inputs receive explicit validation, and the close-date default uses one calendar month. Existing-account dependent contact/opportunity filtering and the owner selector remain unfinished.

## Applied database migrations

`supabase/migrations/202611160001_codex_shared_engines.sql` introduces the independently tested shared metadata/preferences/custom-value/history contracts. PostgreSQL validation found and corrected a CASE-expression syntax error missed by structural tests.

`supabase/migrations/202611160002_leads_security.sql` removes the SUPER_ADMIN feature shortcut, derives Lead owner/creator from authentication, makes those identities immutable, restricts BDO assignment, replaces broad conversion-entity policies with feature/scope checks, scopes activity/history, and replaces the definer conversion RPC with an invoker transaction. It persists conversion IDs and contact roles. Direct conversion status writes must include a complete visible relationship graph; converted identities cannot be reversed or replaced.

Two pre-existing converted Leads lack saved conversion IDs. The installed trigger preserves their non-conversion edits without guessing relationship IDs. Their historical relationship reconciliation is not verified. No existing business rows were rewritten.

The verified target is project `bpwdxslrkgmcoewkwufu`. Migration history originally contained 00001–00005; 00006 schema objects exist without a matching history entry. Do not replay 00006 or blindly push migrations. After rollback validation and ownership confirmation, 202611160001/002 were applied and registered atomically, with API schema reload. Existing Lead counts remained three total/two converted, and no business rows were rewritten. Installed migration evidence matches local SQL. Metadata, pinned views and recent-record persistence passed synthetic SQL assertions after installation. The 00006 history mismatch remains unresolved.

## Executed evidence

| Check | Result | Limit |
| --- | --- | --- |
| Shared Vitest suite | 61 passed | Descriptor/export/structural tests, not browser parity |
| Web query/public-key tests | 4 passed | Focused contract cases |
| Web TypeScript | Passed | No runtime claims |
| Shared TypeScript | Passed | No runtime claims |
| Focused ESLint | Passed | Changed source files only |
| PostgreSQL compilation/install | Both passed rollback compilation, then applied | Only new versions registered; 00006 history unchanged |
| Synthetic owner/permission/conversion/metadata/preference fixtures | Passed against installed schema inside rollback | Selected denials and conversion graph only; not six-role certification |
| Comparable v2/v3 screenshots | BLOCKED | No equivalent authenticated runtime evidence obtained |
| Default production build | Failed | UTF-8 edits corrected; remaining Turbopack CSS worker panic reproduced outside sandbox |
| Webpack production build | Passed outside sandbox | Compilation, TypeScript, static generation and dynamic routes; not browser acceptance |

Rollback assertions cover: actor-derived owner/creator, owner immutability, foreign-user permission-query denial, incomplete direct conversion rejection, invalid conversion atomicity, successful account/contact/opportunity/contact-role links, zero amount, Prospecting initial stage, conversion reversal denial, cross-owner SELECT/UPDATE denial, and no SUPER_ADMIN grant for an unknown permission. Fixture exceptions are rolled back; the positive conversion proves that the earlier failure case was not merely a missing create grant. This is not proof of all seven stage transitions or all role combinations.

Reproduction: run `node scripts/validate-leads-migrations.cjs bpwdxslrkgmcoewkwufu --installed` from the repository root. It verifies the target, uses timeouts, checks the installed migration statements against local evidence, runs synthetic fixtures only inside an outer transaction, then rolls the fixtures back. Without --installed, it validates unapplied migrations in rollback mode against a clean baseline. It never commits migration history. Do not run the separate disposable-database fixture against this development database.

## Open P0 / security gates

1. Legacy conversion relationship provenance remains unresolved for two existing records. The applied correction prevents new incomplete conversions but cannot reconstruct historical IDs.
2. Historical privileged-key revocation is unverified; compile guards cannot revoke a previously exposed credential.
3. Full six-role/hierarchy/branch/direct API negative tests are outstanding. Canonical role rank/custom-role integrity and same-user permission-revocation/cache behavior need dedicated validation.
4. Built-in Lead field restrictions are not enforced end-to-end merely by shared custom-field metadata. Normal list/detail/mutations require their own verified field access contract.
5. Hard deletion remains in existing mutations. Recycle/restore and relationship preservation are unfinished; do not test deletion on real records.

## Open P1 / functional gates

- Single-step create as the source default; metadata/custom layout/wizard/edit/duplicate modes, exact field ordering/defaults, dependent geography and server-side dynamic validation.
- Account-dependent conversion selectors, scoped owner picker, field parity, native keyboard behavior and resulting navigation.
- Saved/column views, URL state restoration, bulk update, true whole-result selection, recycle/recovery, supported alternate layouts, exact toolbar placement and labels.
- Related lists, previous/next, notes/files, activity/history pagination and actual cross-module cache invalidation.
- Source enabled view layouts must be confirmed per module; three view buttons do not establish all supported layout behavior.
- Runtime error/success/empty/loading and 1440×900, 1366×768, 390×844 visual/functional acceptance.

No Lead page is marked VERIFIED. Remain on P039/P040 before expanding to unrelated modules.

## Evidence pointers

- V2 `finlo_crm/leads/views/core.py:104` (page configuration), `:899` (detail), and `finlo_crm/leads/templates/lead_convert.html:127` (existing opportunity), `:152` (owner), `:173` (Convert).
- V3 `apps/web/src/hooks/use-leads.ts`, `use-lead-preferences.ts`, `use-lead-conversion-options.ts`; `src/lib/leads/query-contract.ts` and `export-source.ts`.
- V3 `apps/web/src/components/providers/auth-provider.tsx`; `src/lib/supabase/public-key.ts`; `next.config.ts`.
- V3 `apps/web/src/app/(dashboard)/leads/page.tsx`, `leads/[id]/page.tsx`, `src/app/api/leads/export/route.ts`; Lead export/conversion dialogs and shared DataGrid/toolbar.
- SQL tests `packages/crm-shared/tests/leads-security-rollback.sql`; existing shared Vitest suites. Complete original source/file-line inventory remains in the independent Desktop evidence document.

Deployment note: SQL header comments and prior independent/shared reports describe their original unapplied state. The applied 202611160001/002 SQL files are preserved; this report records their subsequent installation. Unit tests are not deployment proofs. The saved validator verifies installed statements and rolls back fixture writes.

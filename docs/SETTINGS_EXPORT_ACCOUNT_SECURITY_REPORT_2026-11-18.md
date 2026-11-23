# Settings Export and account security implementation — 18 November 2026

**Status: IN PROGRESS / PARTIAL.** This is an implementation checkpoint, not a full CRM completion certificate. Antigravity is actively editing Sales modules; Campaigns and their schema are left to that owner. Dashboard source and migrations remain protected. Browser automation was not used, following the user's code-first instruction.

## Implemented functionality

### Central Export

`/settings/exports` now supports explicit module and column selection, Select/Unselect All, timezone selection, CSV/XLSX/PDF, real download/error feedback, and binary ZIP packaging for multiple modules. Supported scalar contracts are Leads, Accounts, Contacts, Opportunities and Campaigns; Campaign name uses `campaign_name`. No invented records or classification defaults are used.

`/api/exports` authenticates through the normal Supabase session and checks editable `exports.view`, module `.view`, and module `.export` permissions. Reads use the caller's JWT and existing record-scope RLS. There is no SUPER_ADMIN feature bypass or service-role access. Configured hidden, sensitive and archived fields are rejected server-side; readonly fields remain exportable. Unconfigured curated scalar fields use module permissions. Metadata errors fail closed. Only explicitly selected columns plus an internal paging ID are fetched; the paging ID is not added to the exported columns.

Records are fetched in 250-row keyset pages with fresh permission checks and a final field-authorization check. Limits are 5,000 rows / 50,000 cells per module, 100,000 total cells and 32 MB aggregate output, alongside encoder byte limits. Oversized requests fail rather than silently truncate. Requests have a 32 KB streamed-body bound, same-origin POST protection and private/no-store responses. This is bounded synchronous export, not a background large-data service or a transactionally consistent cross-page snapshot.

Shared export encoding was reused. Binary ZIP, real XLSX and PDF rendering are covered by tests. Empty datasets produce a real header-only document. Existing PDF restrictions remain explicit: ASCII text and at most 12 columns; Unicode is rejected with alternative-format guidance rather than silently damaged.

### Password Management

`/my-settings/password` provides Last Updated, current/new/confirm fields, visibility controls, Save Change, modal Escape/focus behavior, validation and provider error feedback. Inputs clear on close, attempt completion and authenticated-user changes. Passwords are not placed in query/mutation caches or logs.

Server actions verify the active authenticated identity and check the current password using the provider's normal password flow before updating that same identity. Confirmation mismatch, reuse, wrong current password and a mismatched provider identity are rejected. Supabase password policy and reauthentication challenges remain enforced; optional verification uses the normal provider flow. No real user's password was changed during testing, and no verification email was sent.

A trigger records only user ID and password-change time on a genuine `auth.users.encrypted_password` change. No hashes, plaintext, tokens or invented historical timestamps are stored. Authenticated callers can read only their own timestamp and cannot forge writes.

### Own and team Login History

`/my-settings/login-history` and `/settings/login-history` share paginated Browser, Login Time, Is Active, IP and Status columns. Own access requires `login_history.view_own` or `.view_team`; other-user access also requires `.view_team`, `users.view` and mandatory accessible-user scope. Team URLs support the source `pk` filter as well as `user`. Feature denial is enforced in database RLS, not just the menu.

Provider session insertion/deletion records Login/Logout events; expiry changes update activity state. Authenticated column grants exclude the internal session identifier. No access/refresh token is captured or read. Raw writes are denied. Auth-user deletion is handled safely. Capture starts after installation: existing sessions and historical logins were not backfilled. The inspected v2 package logs successful login/logout, not failed authentication attempts.

## Files and migrations

- Export: `apps/web/src/lib/exports/{contract,service}.ts`, `apps/web/src/app/api/exports/route.ts`, `apps/web/src/app/(dashboard)/settings/exports/page.tsx`, and export tests.
- Shared encoding: `packages/crm-shared/src/exports.ts`; new `central-export-rendering.test.ts` alongside existing export regression tests. The existing bounded import-body reader accepts an optional caller-specific error message; its default remains unchanged.
- Password: `apps/web/src/lib/settings/password.ts`, `apps/web/src/app/(dashboard)/my-settings/password/{actions,page}.tsx` (actions is `.ts`), password unit tests and rollback SQL.
- Login History: `apps/web/src/lib/settings/login-history.ts`, `apps/web/src/components/settings/login-history.tsx`, own/team route pages, unit tests and rollback SQL.
- Integration: Settings links/search, profile-menu links, navigation permission map and database type declarations. No Sales workflow or Dashboard implementation was rewritten.
- Verification scripts: `scripts/verify-central-exports.cjs`, `scripts/verify-password-timestamps.cjs`, `scripts/verify-login-history.cjs`.
- **Applied:** `202611180001_central_export_permissions.sql`, `202611180002_password_change_timestamp.sql`, `202611180003_login_history.sql`.

The scripts verified development project `bpwdxslrkgmcoewkwufu` before applying new migrations. Installed receipts were checked against the candidate SQL. Catalog permissions were added without automatic role grants. Existing business data, accounts, pipeline stages and previous migrations were preserved; `00006` was not replayed. Synthetic fixtures run inside rolled-back transactions, including synthetic auth rows. No credential values appear in this report.

## Executed verification

| Check | Actual result |
|---|---|
| Web Settings/Imports/Exports/permission tests | PASS: 64 tests in 15 files |
| Shared export regression/rendering tests | PASS: 16 tests in 2 files; XLSX/XML, PDF bytes and binary ZIP inspected by automated tests |
| Focused new Settings/Export ESLint | PASS, exit 0 |
| Installed export SQL rollback fixture | PASS: five-module scoped reads, foreign-owner denial, explicit/revoked export permissions, hidden/readonly metadata |
| Installed password SQL rollback fixture | PASS: genuine-change timestamp, no invented date, unchanged-hash/metadata stability, own/foreign reads, forged-write denial |
| Installed Login History SQL rollback fixture | PASS: Login/Logout, expiry, own/feature/hierarchy denial, permitted global scope with explicit grants, protected session IDs, immutable evidence and auth-delete lifecycle |
| Live unauthenticated four new page requests | PASS: each redirects 307 to `/login` |
| Live unauthenticated GET `/api/exports` | PASS: 401 |
| Full web TypeScript, latest run | FAIL: 13 diagnostics in concurrently edited Accounts, Campaigns and Contacts files; none reported in this batch's new Settings/Export files |
| Production build | NOT RUN: full TypeScript currently fails and user-owned development server PID 2008 owns port 3000/artifacts |
| Authenticated browser/provider acceptance | BLOCKED / NOT EXECUTED; user requested code-first work, no approved browser session used |
| Comparable v2/v3 visual acceptance | BLOCKED; no comparative runtime evidence |

Latest TypeScript diagnostics: Accounts list `phone` absent from `AccountWithRelations` (124/212/215); Campaign list/hook `is_active` absent from record types (page 122/206, hook 68/100); Contacts detail unexpected `updates` (355), list partial save input (389), hook `success`/`data` mismatch (147/148/163/164). These are ownership handoff observations, not permission to overwrite Antigravity's active files. Line numbers may move during its work. Earlier passing TypeScript does not describe the latest workspace.

Unit tests mock provider/API calls; SQL fixtures execute real database authorization and lifecycle operations. Neither proves a real authenticated browser download, successful real password change, full six-role UI matrix or pixel parity. No measured end-user performance timing is claimed.

## Re-audit: remaining P0/P1 and advanced parity

1. **OPEN security gate:** hidden-field raw REST read protection remains staged, not deployed. The export endpoint's field projection does not fix direct raw-table REST reads elsewhere. Preserve the explicit Dashboard cutover handoff.
2. **OPEN external security verification:** previously exposed privileged credential rotation/revocation remains unverified; no credential was printed or rotated here.
3. **P1 build gate:** resolve the concurrent Sales type/interface errors with Antigravity before a full build/release.
4. **P1 Export:** scheduled export modal, recurrence persistence, worker execution, schedule list/details/delete are still unimplemented. R0223–R0227 are not marked implemented. Additional source modules, related/custom fields, source formatting preferences and large jobs remain incomplete. Multi-module authorization failure currently rejects the entire request instead of skipping unauthorized modules; this is an explicit behavior difference requiring review.
5. **Password acceptance:** normal authenticated provider operation, reauthentication/email flow, effective policy comparison with Django validators, session behavior and browser modal interaction remain unexecuted. Supabase Auth is approved architecture; exact policy equivalence is not certified.
6. **Login History:** full source device-brand/model parsing and user timezone preference integration remain incomplete. Provider session expiry/revocation drives activity/events rather than v2's IP/UA session grouping; document and verify this adapter behavior. Historical events require authoritative input and must not be invented.
7. **UI acceptance:** exact v2 control placement, modal dimensions, responsive layout and keyboard interactions require real browser evidence. All affected queue entries remain PARTIAL, not VERIFIED.

## Source evidence and continuation

- v2 `finlo/contrib/core/views/export_data.py:155` `ExportView`; selection/download paths around 241–390; value formatting 403–455; encoders 470–519; schedules 676–1100.
- v2 `finlo/contrib/core/views/change_password.py:29,71` page/form handlers; `finlo/contrib/core/forms/base.py:713` onwards current/new/confirm validation.
- v2 `finlo/contrib/core/views/user_login_history.py:27,39,62,78`; admin history in `views/users.py` around 944; `finlo/contrib/core/login_history.py:48–103` source status/browser/date/icon presentation.
- v2 installed `dj-user-login-history==1.0.6`, `.venv/Lib/site-packages/login_history/models.py`: actual successful login/logout event semantics inspected read-only.

Resume the existing queue; do not recreate the inventory. Next independent Settings implementation: inspect scheduled Export persistence/worker contracts and existing v3 scheduling services, then implement a safe real schedule workflow without touching Campaign or Dashboard ownership. Keep provider/browser acceptance separately blocked until available. The entire CRM remains IN PROGRESS.

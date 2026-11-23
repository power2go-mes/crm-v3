# Settings fixes, Import implementation and post-build re-audit

Date:17 November2026. Status: **IN PROGRESS / PARTIAL — NOT CRM COMPLETE**.

## Implemented in this continuation

### Settings defects

- Removed the client/server lock on SUPER_ADMIN roles.manage. Feature grants are editable; canonical role identity/deletion protections remain. No stored grants were automatically changed.
- Found and removed the missing-session fall-through in four administrative actions (feature toggle, custom role create/delete, assignment). All now fail closed before database mutation. Existing RLS remains the independent final boundary; no prior exploit is claimed.
- Company editor opens only after authoritative company data is available; unavailable data cannot render a Save form. Removed invented FINLONEXA/USD/UTC fallback submissions and preserved NULL optional values. Stored currencies/timezones absent from fixed options, including PKR and Asia/Karachi, now render as selected options.
- Settings tabs use URL state for reload/Back/Forward restoration; added permission-filtered search over existing working settings destinations. This does not reproduce all source category accordions or register missing pages.
- Audit history: authenticated/permission-aware cache key, server-side50-row pages, stable ordering/count, error/Retry distinct from empty history.
- Post-build audit found Sales Regions had analogous error/zero-row feedback gaps. Added actor/permission-aware caching, bounded20-row server pages/count, explicit error/retry and update returning a required record. Full source region edit/delete remains unfinished.

### Actual Lead CSV import

New `/settings/imports` page and `/api/imports` handlers provide:

1. Module/name/file preparation (currently **Leads + UTF-8 CSV only**).
2. Suggested header mappings, editable target-field mappings and real input samples.
3. Create / Update / Create and Update; permitted match fields, required match selection for updates.
4. Review of rows, mapped fields/columns and unmapped columns; explicit Import execution.
5. Actual database-side scoped writes; valid-row/invalid-row counts, status, success rate and measured duration.
6. Owner-scoped, server-paginated Import History; original-file and error-CSV downloads; CSV template download.
7. Durable uploaded job, URL-driven step navigation, Back/Next without re-upload and user/job-scoped session draft restoration. Draft storage contains configuration, not uploaded rows. Incomplete update-mode drafts restore without becoming valid executable configurations.
8. Replay protection: completed job returns its prior result without duplicating writes. Concurrent execution is serialized by job lock.

CSV parser accepts quoted commas/newlines/escaped quotes, UTF-8 BOM and empty cells; rejects malformed/duplicate headers, inconsistent widths, NULs, invalid UTF-8 (HTTP upload path) and excessive cells/rows/bytes. Request streaming is byte bounded even without Content-Length. Cross-origin writes are rejected. Current limits:2MB,1000 rows,50 columns,4000 characters/cell. These are temporary first-pass limits, **not approved substitutes for full v2 parity**.

No dummy processing, static success totals or fake download artifacts. Missing error files return404. Original download preserves content and uses safely encoded source filename. File paths supplied by browsers are never opened.

## Database/security contract

APPLIED additive migrations:

- `supabase/migrations/202611170013_import_workflow.sql`
- `supabase/migrations/202611170014_import_create_field_access.sql`

Original170013 is preserved. Post-build synthetic acceptance caught its create-only permission defect;170014 forward-corrects field checks so create requires leads.create, while update/both separately require leads.update. Hidden/readonly checks still apply.

New `crm_import_jobs`: owner, input, configuration and system-computed results. Authenticated raw access is SELECT-only through owner/module/feature RLS. Result/status updates are not browser writable. Functions derive actor from JWT and target Lead triggers derive owner/creator. No owner/Assigned BDO/conversion/relationship provenance columns are import-mappable.

Technical `crm_import_executor` owns only the import RPCs, is NOLOGIN/NOBYPASSRLS, inherits authenticated and does not own Leads. Therefore Lead SELECT/INSERT/UPDATE retain existing RLS. It has job mutation rights under owner policy. Temporary schema CREATE for function-ownership transfer is revoked before commit and tested absent. Administrator membership permits schema deployment; API roles are not granted membership in this executor role. No privileged key was used in application code.

Permission catalog entries imports.view/imports.create are installed with **no automatic role grants**. Import also needs leads.view and leads.create, including update-only imports as source import entry requires target add permission. Updating additionally requires leads.update. An authorized Role Manager operator must explicitly assign new import features before navigation is exposed. BDO Lead creation defaults were not changed.

Builtin metadata requirement overrides are checked inside each row transaction. Required custom fields currently block execution until a supported custom mapping exists; they are not silently bypassed. Field hidden/readonly denials are checked server/database side. Converted Leads are excluded from updates; existing converted relationship provenance remains untouched. Status cannot be imported as convert. Verified source Title blank=True maps an omitted create Title to empty string, not a fabricated classification.

## Actual tests and deployment evidence

### PASS

- **42 distinct focused tests across11 files** in latest focused runs: original Settings10, new Settings/permission10, Import22. This is not a full repository or browser suite. Import tests include parser bounds, draft/execute distinction, authorization, real Request/FormData HTTP-handler execution, origin denial, missing/foreign download response and actual file contents.
- Full web TypeScript; focused ESLint on changed implementation/test files.
- Production webpack build passed with static/dynamic route generation including `/settings/imports` and `/api/imports`, before the final Sales Regions changes. Final TypeScript/lint passed after those changes. A requested final rebuild was **BLOCKED** because the user-owned Next server was running; it was not stopped.
- Installed database receipts matched local170013/014 SQL. Focused SQL tests ran against the verified v3 development project bpwdxslrkgmcoewkwufu and rolled back all fixture identities, grants, rows and metadata.
- SQL assertions: prepare/create/update/both; invalid-row subtransaction rollback and partial counts; unmapped fields retained; derived actor/owner; unknown/privileged mappings rejected; foreign-owner matching and foreign job execution denied; immutable result raw writes rejected; job replay cannot duplicate writes; create-only access; hidden/readonly field denial; target create revocation; executor has no LOGIN/BYPASSRLS/table ownership/schema CREATE.
- Live running-server unauthenticated requests: `/settings/imports`307→/login; template API403; import POST401. No business mutation attempted in these requests.

### Failed runs corrected or explicitly excluded

- Connection timeouts occurred and were not counted PASS.
- Candidate deployment initially lacked SET ROLE/schema ownership-transfer rights. Fixed administrator membership and transient schema CREATE, revoked after transfer; fixtures then passed before installation.
- An initial markup test failed because PKR/Asia-Karachi were absent from fixed dropdown options. Corrected the actual component and asserted selected source values.
- New create-only SQL test reproduced a real42501 Field write denied defect in170013; fixed by forward170014 and reran installed fixtures successfully.

### BLOCKED / NOT EXECUTED

Authenticated browser wizard/modal/Back/Forward/role-switch acceptance and comparative v2/v3 screenshots. Prior Chrome access denial persists; current computer-use namespace is unavailable. Live unauthenticated HTTP checks and mocked handler tests are not substitutes for authenticated browser acceptance. No browser interaction or exact visual parity is marked PASS.

No application server was stopped/restarted or extra server launched. No production data/reset/bulk migration push, historical migration replay, Contact relationship modification, canonical identity change or Opportunity-stage change. CRM v2/MES read-only. Dashboard source/migrations untouched. Only forward reviewed import DDL was committed; fixtures were rolled back.

## Post-build re-audit of the55 findings

| Prior finding | Current result | Remaining gate |
|---|---|---|
| F001–F005 Import entry/upload/headers/mapping | PARTIAL: actual Lead CSV path | XLS/XLSX, registered modules, exact controls and source limits |
| F006 Choice value mapping | MISSING | Source choice/label translation UI and validated persistence |
| F007 FK/related record mapping | MISSING | Scoped selectors, approved owner/BDO semantics, relationships |
| F008–F012 modes/matches/review/processor/results | PARTIAL: real Lead CSV behavior tested | Other modules, full source validation, failure-history semantics and browser acceptance |
| F013–F015 downloads/templates/navigation | PARTIAL: CSV files and draft/step support | Other formats, complete source error payload, server/cross-device draft scope and visuals |
| F016–F022 central/scheduled Export | STILL MISSING | Central multi-module formats/ZIP and actual scheduling execution |
| Settings search | Implemented for existing destinations | Full registered category/menu parity and no-match treatment |
| F047 SUPER_ADMIN feature editability | SOURCE/UI FIXED; action tests PASS | Full canonical-role live browser matrix |
| F048 installed automatic grants | HISTORICAL FINDING RETAINED | Do not mass-revoke guessed grants; reconcile intended grants with authorized owner |
| F049 raw REST field masking | OPEN/P0, staged handoff retained | Protected Dashboard/module reader cutover coordination |
| F050 all-form requirements | PARTIAL | Import honors supported builtin overrides; other existing forms still need metadata integration |
| F051 company fallback overwrite risk | Corrected; markup/data-gate tests PASS | Authenticated delayed-load/interaction acceptance |
| F052 Settings URL state | Source corrected | Actual browser Back/Forward/reload acceptance |
| F053 Settings cache context | Audit and Regions now actor/permission keyed | Account-switch/revocation/in-flight browser integration |
| F054 audit error masking | Corrected and paginated; tests PASS | Runtime interface/visual acceptance |
| F055 raw builtin metadata writer boundary | REVIEW REQUIRED | Independent actual raw REST invariant test; not silently declared fixed |

### Additional remaining gaps identified during implementation

- Import is **not universal**: Accounts/Contacts/Opportunities/Campaigns and other registered v2 models have no adapters here. Use module-owned atomic services and hierarchy checks; do not reproduce Contact writes with direct independent INSERTs.
- XLS/XLSX remain unsupported; CSV-only UI says so. No misleading format acceptance or renamed CSV download pretending to be Excel.
- Choice/FK/custom-value mapping, default/replace-value controls, saved mappings, full model-specific validators, complete source columns and export-style field permissions remain unfinished.
- Current Email check is basic; full Django-equivalent validation/normalization needs comparison. Import is not a declaration that every existing Lead form validation defect is fixed.
- Limits are lower than v2 upload UI; large jobs need proper bounded/background processing rather than arbitrary silent truncation.
- Import history currently has own-user scope; source visibility and full columns (creator/duration in list, complete per-field errors) require parity review. Results show measured duration, but no performance benchmark is claimed.
- Cancel leaves a prepared job available in History, and replacing a file creates another job. Exact v2 session-cleanup/cancel semantics remain pending.
- Complete inner Settings accordion, source forms/lists, currency/fiscal/business hour/personal/communications/booking/process editors and unified recycle workflows remain unfinished.
- Sales Region full edit/delete/dependencies and Department FK association/recovery parity remain pending.

## Exact next checkpoint

Next unfinished target: source importer remaining formats, module adapters and choice/FK/custom mapping, then central Export and scheduled execution. Existing import queue entries R0157–R0164/R0169–R0173 stay PARTIAL, not VERIFIED. Do not recreate importer persistence or replay170013/014. Keep protected Dashboard field security handoff staged. Original972-entry queue preserved.

## Changed implementation files

- `apps/web/src/app/(dashboard)/settings/imports/page.tsx`
- `apps/web/src/app/api/imports/route.ts`
- `apps/web/src/lib/imports/{csv,body,service}.ts` and `__tests__/*.test.ts`
- `apps/web/src/app/(dashboard)/settings/page.tsx`
- `apps/web/src/app/(dashboard)/settings/roles/role-matrix-client.tsx`
- `apps/web/src/lib/permissions/actions.ts` and `__tests__/editable-features.test.ts`
- `apps/web/src/components/settings/{company-settings-modal,system-audit-log-viewer,sales-regions-manager}.tsx`
- `apps/web/src/lib/settings/{audit-log,sales-regions}.ts` and focused tests
- `apps/web/src/lib/navigation/config.ts`; `packages/database/src/types.ts`
- `supabase/migrations/202611170013_import_workflow.sql`; `202611170014_import_create_field_access.sql`
- `packages/crm-shared/tests/imports-rollback.sql`; `scripts/verify-imports.cjs`

Source basis: existing deep audit evidence index E01–E49, v2 core/views/import_data/step1–4.py and aux_views.py, core/templates/import/*, core/registration and finlo_crm/leads/registration.py. V2 Lead fields verified in leads/models/base.py:257–305. Source v2 directories were only read.

# Deep Settings, Import/Export and functional parity audit

Date:17 November2026. Status: READ-ONLY SOURCE AUDIT; CRM remains IN PROGRESS.

## Executive findings

V3 still lacks the v2 central Import Data workflow and central/scheduled Export Data workflows. Settings contains real implementations (company editing, Regions, Role Manager, Departments, Field Requirements, Custom Fields, audit viewer), but exact source navigation and many configuration pages are missing. Recent Departments/metadata work is not rescinded or mislabeled absent.

New notable findings: SUPER_ADMIN roles.manage is non-revocable despite the approved editable-feature contract; installed170010 automatically regranted permissions; field requirements are not consumed by representative existing forms; company modal has a loading/fallback overwrite risk; Audit swallows errors; Settings tabs are not URL-restorable; Department string associations differ from source FKs.

## Scope, method and limitations

- Compared registered v2 Settings menus, core routes, importer/exporter controllers/templates, Department and metadata implementations, current v3 Settings components, feature actions and selected form consumers.
- Reused existing57-page canonical register; did not rescan unrelated v2 modules or recreate the queue. Broad non-Settings gaps are carried forward separately, not falsely fresh-verified.
- Read-only development SQL transaction: public Settings-related table names and recent migration receipts, followed by rollback. No business record contents, credentials or tokens printed. No fixture mutations or migration execution.
- Current relevant public tables observed: company_settings, crm_field_definitions, crm_field_requirements, crm_field_rules, departments, sales_regions, sales_teams, user_profiles. No names matching import/export schedules, booking, holiday/business/shift/currency/fiscal/recycle/workflow/notification tables in that query. This is schema-name evidence, not proof a differently named/JSON-based implementation cannot exist.
- Receipt confirmation:202611170010 campaign_role_permissions,170011 forecast_aggregation,170012 departments installed with statement history. No history or schema changed.
- MISSING means no equivalent application workflow found in the inspected App Router/Settings/service paths; an isolated helper/table does not establish UI or end-to-end parity.
- DIFFERENT/PARTIAL are source-confirmed implementation distinctions. UNVERIFIED and REVIEW REQUIRED identify a source-grounded risk without claiming a reproduced runtime failure.
- Browser/visual acceptance remains BLOCKED by earlier Chrome access denial. No screenshots or pixel measurements fabricated. No server touched or application file modified.
- Company switching/multi-tenancy and the old10-stage default are approved exceptions, not missing requirements. MES sidebar, six protected roles and approved7 stages remain authoritative. V2 Company-based Branches needs reconciliation, not blind reintroduction of multi-company tenancy.

## Detailed findings

Each row is a grouped requirement, not a unique page or rendered-control count. A missing workflow may span a page, modal and internal endpoints; never create browser pages for every endpoint.

### Import

| ID | Status / priority | Page, control or function | V2 requirement / approved contract | Current v3 evidence and difference | Evidence | Acceptance gate |
|---|---|---|---|---|---|---|
| F001 | MISSING / P1 | Import entry and history tabs | Registered ImportView/ImportTabView and history navigation. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04,E08 | Open Import Data and History as allowed/denied users. |
| F002 | MISSING / P1 | Upload/model/name controls | Select Module, Import Name, Upload File and wizard navigation. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04 | Upload an authorized synthetic file and retain name/module. |
| F003 | MISSING / P1 | CSV/XLS/XLSX inputs | Step1 accepts csv/xls/xlsx filenames; template advertises10MB. Parser runtime not exercised. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04 | Verify each format, invalid extension, encoding and independently enforced size limits. |
| F004 | MISSING / P1 | Column mapping and sample values | Step2 restores auto and saved field mappings and samples. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04,E05 | Map columns and preserve mappings when moving Back/Next. |
| F005 | MISSING / P1 | Automatic header matching | auto_map_fields derives model-field suggestions. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04 | Compare source suggestions on same headers. |
| F006 | MISSING / P1 | Choice value mapping | Choice values mapped to source model choice values. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04,E05 | Map nonmatching labels without inventing classifications. |
| F007 | MISSING / P1 | Related-record/FK mapping | Foreign-key choices and value mappings supported. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04,E05 | Only authorized related records selectable; invalid/cross-branch IDs denied. |
| F008 | MISSING / P1 | Create/update/both modes | Step3 accepts1=create,2=update,3=both. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E06 | Exercise three modes on isolated fixtures. |
| F009 | MISSING / P1 | Update matching fields | At least one match field required for update/both. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E06 | Reject missing matching fields; define duplicate-match handling from source. |
| F010 | MISSING / P1 | Review step | Step4 presents mapped/unmapped counts and import selection before processing. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E06,E07 | Review contains correct totals and current configuration. |
| F011 | MISSING / P1 | Actual import processor | Atomic block groups inserts/updates; per-row validation/errors can produce partial success. Not an all-or-nothing invalid-row promise. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E07 | Match partial-row semantics, enforce RLS/feature/field restrictions and roll back transaction-level failures. |
| F012 | MISSING / P1 | Result totals and statuses | Created, updated, error counts, success rate, duration and success/partial/failed history. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E07,E08 | Return measured counts; no fake progress/success. |
| F013 | MISSING / P1 | Error/original file downloads | Separate permission-gated download handlers exist. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E08,E10 | Authorized user can retrieve own permitted files; guessed paths/IDs denied. |
| F014 | MISSING / P1 | Import template downloads | Modal, model validation and generated template handler. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E09 | Download correct permitted columns and expected format. |
| F015 | MISSING / P1 | Wizard state and back navigation | Session retains uploaded file and mappings across navigation; clears import state after processing. | No corresponding v3 page/API/service found in inspected route tree and Settings/service directories. No import-named public table found by read-only schema inspection. | E04,E05,E07 | Back does not force unintended re-upload or lose mapping. |

### Export

| ID | Status / priority | Page, control or function | V2 requirement / approved contract | Current v3 evidence and difference | Evidence | Acceptance gate |
|---|---|---|---|---|---|---|
| F016 | MISSING / P1 | Central export screen | Select multiple allowed modules and columns. | V3 has Leads export API and report CSV paths, but no equivalent central/scheduled export UI or export-schedule public table found. Existing helpers do not prove this workflow. | E11,E14 | Export one or multiple explicitly permitted modules. |
| F017 | MISSING / P1 | Multi-module ZIP bundle | ExportView builds a ZIP when multiple module files are exported. | V3 has Leads export API and report CSV paths, but no equivalent central/scheduled export UI or export-schedule public table found. Existing helpers do not prove this workflow. | E11,E14 | ZIP contains expected scoped module files, no forbidden modules. |
| F018 | MISSING / P1 | Central CSV/XLSX/PDF selection | Source supports all three formats with per-model field selection. | V3 has Leads export API and report CSV paths, but no equivalent central/scheduled export UI or export-schedule public table found. Existing helpers do not prove this workflow. | E11,E14 | Compare output columns, formatting and row scope for each format. |
| F019 | MISSING / P1 | Scheduled export creation/edit | Schedule modal persists selected modules/fields/format. | V3 has Leads export API and report CSV paths, but no equivalent central/scheduled export UI or export-schedule public table found. Existing helpers do not prove this workflow. | E12,E13,E14 | Schedule create/edit stores exact inputs with owner scope. |
| F020 | MISSING / P1 | Schedule recurrence controls | Daily/weekly/monthly/yearly, dependent weekday/day/month, dates. | V3 has Leads export API and report CSV paths, but no equivalent central/scheduled export UI or export-schedule public table found. Existing helpers do not prove this workflow. | E13,E14 | Validate each recurrence and date rule. |
| F021 | MISSING / P1 | Schedule list/detail/delete | Separate routed list, detail and delete handlers. | V3 has Leads export API and report CSV paths, but no equivalent central/scheduled export UI or export-schedule public table found. Existing helpers do not prove this workflow. | E12,E14 | Only owner/authorized user sees and manages schedules. |
| F022 | MISSING / P1 | Export formatting preferences | Date/datetime and filenames respect user formatting/timezone. | V3 has Leads export API and report CSV paths, but no equivalent central/scheduled export UI or export-schedule public table found. Existing helpers do not prove this workflow. | E11,E14 | Same user settings yield equivalent output values. |

### Settings

| ID | Status / priority | Page, control or function | V2 requirement / approved contract | Current v3 evidence and difference | Evidence | Acceptance gate |
|---|---|---|---|---|---|---|
| F023 | MISSING / P1 | Settings search | V2 debounced Search settings... | Four tabs/links; no settings-wide search. | E01,E03 | Search by setting title with permitted-only results. |
| F024 | DIFFERENT / P1 | Settings grouped accordion/content panel | V2 grouped accordions and independently navigable settings content. | V3 banner, tabs and separate links replace the inner Settings layout; approved MES sidebar does not approve this redesign. | E02,E03 | Match source inner Settings navigation while retaining MES application sidebar. |
| F025 | PARTIAL / P1 | Company complete form fields | Icon, name,email,website,phone,fax,revenue,employee count,country/state/city/zip,language,timezone/currency and date/time formats. | V3 modal edits8 fields; country/state/city/zip, fax, revenue/count, icon, language and formatting controls absent. | E15,E16 | Preserve applicable single-company fields, dependent country/state and original ordering. |
| F026 | PARTIAL / P1 | Departments source list controls | Source generic list/column modal, empty-state add and dependency/delete-mode interactions. | V3 has basic list/form but only Description checkbox/local preference, native confirm, no generic bulk/delete-mode surface. | E17,E18 | Reproduce enabled source list controls and safe deletion choices. |
| F027 | DIFFERENT / P1 | Department user associations | V2 user.department is a real Department FK. | V3 legacy string labels remain; rename/deletion are conservatively blocked on exact label match. This is not FK parity. | E19,E48 | Add authoritative association/migration contract before permitting FK-equivalent rename/dependency behavior. |
| F028 | PARTIAL / P1 | Field Requirements list and permission granularity | Model/Field/Requirement list with separate source view/add/change/delete permissions. | V3 editor exists but uses settings.view/update and lacks source paginated/filter engine. | E20,E21 | Verify separate intended action grants and full list behavior; no fake missing-page claim. |
| F029 | PARTIAL / P1 | Custom Fields full source surface | V2 Name/Model/Type/Required/Order table plus modal. | V3 editable card registry inline form; seven types/choices/order/archive now present. Original labels, table/modal placement, pagination/search remain different. | E22,E23 | Match source table and modal with all installed safeguards retained. |
| F030 | PARTIAL / P1 | Departments in Users editor | V2 user association references department by ID. | No Department FK was added; newly created Department is not automatically a typed User selector. | E19,E48 | Create Department, assign User through authorized selector, rename and observe retained association. |
| F031 | PARTIAL / P1 | Sales region full edit/delete | V2 region administration includes update/delete and source fields. | Current v3 component offers create and active toggle, not full edit/delete workflow. | E25,E27 | Edit region data and perform dependency-safe deletion/recovery as source supports. |
| F032 | MISSING / P1 | Sales Teams and Sales Assignments | Separate registered settings catalogs/workflows. | sales_teams table exists, but no equivalent Settings management screen found. Do not call its persistence absent. | E27 | Implement source team/assignment controls without altering six-role reporting hierarchy. |
| F033 | MISSING / P1 | Team/Customer/Partner role catalogs | Three distinct source relationship-role catalogs, separate from canonical sales roles. | No corresponding Settings editors; Contact relationship role storage already exists and must be reused. | E28 | Edit authorized relationship roles without creating competing role services. |
| F034 | MISSING / P1 | Personal Profile/Regional/Password/Login History | My Settings registered pages and user preferences. | Current user menu primarily displays identity/role and Sign Out; no corresponding page family. | E26,E33 | Verify each personal page under normal auth and original permissions. |
| F035 | MISSING / P1 | Business hours/shifts/holidays | Business-hour types, weekdays/times, timezone, active state and holiday associations. | No corresponding v3 Settings page family found. | E35 | Create/edit schedule and holiday links; verify time/range validations. |
| F036 | MISSING / P1 | Fiscal year/calendar | Standard/custom fiscal configuration and preview routes. | Company fiscal_start column alone does not provide configuration/preview. | E16,E35 | Verify applicable fiscal configuration and report/forecast effects. |
| F037 | MISSING / P1 | Multiple currencies/rates | Currency administration, default currency and dated conversion rates. | Single company currency string input only; no rate/currency administration. | E36,E15 | Verify rate/date rules and financial presentation. |
| F038 | MISSING / P1 | Recycle Bin/retention/bulk recovery | V2 recovery administration is distinct from individual delete buttons. | Only new Department-local recovery exists; no unified bin/retention screen. | E27,E18 | Restore supported deleted entities and verify dependencies/permissions. |
| F039 | MISSING / P1 | Lead Status/Assignment/Email-to-Record/Web-to-Lead settings | Registered source-specific settings. | No equivalent configuration pages in current v3 route tree. | E37 | Each source editor must persist and affect its actual workflow. |
| F040 | MISSING / P1 | Opportunity teams/splits/stage settings/alerts | Team selling, split settings, stages and Big Deal Alerts. | Existing pipeline/list/detail do not replace administration pages. Seven approved stages stay unchanged. | E38 | Configure source-supported behavior without changing approved stage contract. |
| F041 | MISSING / P1 | Mail configuration/templates/Inbox/Outbox | Separate source mail destinations. | No equivalent Settings/communications page family. | E39 | Test authorized dev provider/configuration paths; do not send real external messages. |
| F042 | MISSING / P1 | Workflow rules and execution configuration | Source rule/conditions/actions/time-trigger settings. | No equivalent authoring settings page found. | E43 | Create rule and execute isolated authorized fixture with audit evidence. |
| F043 | MISSING / P1 | Matching and Duplicate Rules | Source matching-rule and duplicate-rule editors. | No corresponding Settings screens. | E42 | Define rule, reject/handle matching duplicates according to source. |
| F044 | MISSING / P1 | Booking Pages | Host/duration/availability/provider settings and public workflows. | Calendar and Meetings are not Booking Pages. No equivalent routes found. | E40 | Configure availability then test slot/booking/cancel/reschedule safely. |
| F045 | MISSING / P1 | Call provider integration | Integration and user provider configuration, test/status workflows. | Call logging CRUD does not supply this settings functionality. | E41 | Exercise isolated provider configuration and permission failure without real calls. |
| F046 | MISSING / P1 | Field visibility/edit permission editor | Role/user field permissions: hidden/readonly/readwrite, individual and bulk-save handlers. | Role Manager exposes feature actions, not equivalent field-rule controls. | E29 | Persist rules and enforce both trusted mutations and every supported/raw read path. |

### Security

| ID | Status / priority | Page, control or function | V2 requirement / approved contract | Current v3 evidence and difference | Evidence | Acceptance gate |
|---|---|---|---|---|---|---|
| F047 | DIFFERENT / P1 | SUPER_ADMIN roles.manage cannot be revoked | Approved v3 contract says feature permissions, including SUPER_ADMIN, remain editable. | Both client and server explicitly reject revoking roles.manage for SUPER_ADMIN. This is a confirmed source-level contract difference, not a universal permission bypass. | E30,E31 | Permit approved editable features while protecting only canonical identity/hierarchy; test direct action and matrix. |
| F048 | DIFFERENT / P1 | Applied migration automatically regrants permissions | Approved contract disallows automatic feature grants. | 202611170010 grants every permission present at installation time to SUPER_ADMIN and Campaign grants to other canonical roles. Read-only receipt confirms this migration installed. No grants were changed in this audit. | E32 | Review exact grants with owner; future migrations must not reset user-configured denials. No automatic corrective mass revoke. |
| F049 | OPEN / P0 | Hidden-field raw REST read masking | Prior source-backed field privacy requirement. | Staged field boundary remains undeployed by explicit Dashboard-protection decision; write guards and UI omission do not close raw reads. No new exploit test run. | E29 | Coordinate protected reader cutover and run permitted/denied actual API tests; retain current staged handoff until authorized. |
| F055 | REVIEW REQUIRED / P1 | Builtin metadata installer restriction exists only in RPC path | crm_shared_put_definition rejects builtin or archived field edits. | Installed raw table manage policy allows settings.update users to write definitions directly; helper restriction is not equivalently expressed in that policy. This read-only audit did not execute a bypass. | E46,E47 | Test raw authenticated UPDATE on builtin definitions against intended installer boundary; enforce invariant in DB if confirmed required. |

### Forms

| ID | Status / priority | Page, control or function | V2 requirement / approved contract | Current v3 evidence and difference | Evidence | Acceptance gate |
|---|---|---|---|---|---|---|
| F050 | PARTIAL / P1 | Requirement persistence is not complete form enforcement | V2 requirements apply to opted-in model forms. | Representative Lead creation uses hardcoded required checks/direct insert; inspected Campaign form/action also has no shared-metadata consumer. New override page does not establish application-wide enforcement. DB NOT NULL checks remain independent. | E20,E44,E45 | Make an optional source field required, then verify UI and direct request fail when missing; reset overrides after isolated test. |
| F051 | UNVERIFIED / P1 | Company modal can initialize fallback data during loading/error | V2 edits bound model instance. | Edit buttons are permission-gated but not disabled while company query is unavailable. Modal initializes FINLONEXA/USD/UTC/empty state without prop resync, then submits all8 fields. Source demonstrates a potential overwrite path if opened early; no actual data overwrite was executed. | E03,E15 | Delay/fail company load, open Edit and confirm Save is blocked until authoritative data loaded; preserve user edits on refetch. |

### State

| ID | Status / priority | Page, control or function | V2 requirement / approved contract | Current v3 evidence and difference | Evidence | Acceptance gate |
|---|---|---|---|---|---|---|
| F052 | DIFFERENT / P1 | Settings tab and record navigation persistence | V2 hx-push-url and settings content navigation. | V3 activeTab is local state; tabs do not update URL. Reload/Back/Forward cannot reconstruct selected tab from this component alone. | E01,E03 | Open Fields/Audit directly, reload, then use browser Back/Forward and retain intended section. |
| F053 | REVIEW REQUIRED / P1 | Sales region and audit cache context | Authenticated permission-scoped caching requirement. | These two keys omit user/effective permissions, unlike upgraded Custom Fields. AuthProvider clears cache on identity changes, so leakage is NOT established; same-user revocation/in-flight behavior needs tests. | E24,E25,E49 | Switch identities and revoke permissions with in-flight requests; no stale forbidden rows may remain. |

### Feedback

| ID | Status / priority | Page, control or function | V2 requirement / approved contract | Current v3 evidence and difference | Evidence | Acceptance gate |
|---|---|---|---|---|---|---|
| F054 | DIFFERENT / P1 | Audit errors masquerade as empty history | Loading/error/empty states must remain distinct. | SystemAuditLogViewer catches database errors and returns[]; no paginated history beyond50 records. | E24 | Induce authorized network/permission failure and show error/retry; paginate actual empty vs more-history states. |

## Original import sequence to preserve

Select Module + Import Name + CSV/XLS/XLSX → Step2 header/model-field mapping plus choice/FK values → Step3 create/update/both and match fields → Step4 mapped/unmapped review → explicit Import → actual processor → result/history with created/updated/errors/rate/duration → original/error downloads. Template downloads and Back/Next state are part of the workflow. The processing source catches row errors and can persist valid rows; do not describe it as universal all-or-nothing invalid-row import. Transaction-level failures still need rollback acceptance.

V2 template advertises10MB, but the inspected Step1 upload branch checks required inputs/extensions and stores the file without an explicit size check there. Do not label that server-side size enforcement proven. Download ownership, duplicate ambiguity, large uploads and per-row authorization need runtime/security testing before copying implementation mechanics.

## Other CRM areas — existing gaps carried forward

- Leads: complete metadata/custom layouts, saved/pinned views, column/bulk parity, dependency/recovery, conversion/browser acceptance. Some export and conversion controls already exist; not all are missing.
- Accounts/Contacts: preserve installed atomic/contact hierarchy/multi-Account services. Full related tabs, original form modes, history/attachments and advanced list acceptance remain incomplete.
- Campaigns: owner assignment, advanced filters/bulk/export/recovery/source layouts and Opportunity-derived financial metrics remain pending. Member workflows and applied scope/counter corrections exist.
- Opportunities: team selling/splits/alerts administration remains absent; keep approved7 stages.
- Reports: catalog/results/CSV exists; v2 custom report builder, folders/favourites/saved definitions and report-to-Dashboard workflow remain gaps.
- Activities: task/call/meeting pages exist. Event-specific, provider and booking behavior needs separate parity; do not call all Activities placeholders.
- Approvals/reviews/cadences, communications and scheduling settings: existing registered inventory still has unresolved destinations/workflows.
- Dashboard belongs to protected owner scope; no fresh Dashboard certification or changes in this audit.

Sources for carried-forward areas: docs/V2_V3_CURRENT_MISSING_FUNCTIONALITY_2026-11-17.md; docs/CAMPAIGNS_RECONCILIATION_REPORT.md; docs/CRM_V2_V3_MASTER_MIGRATION_PROGRESS.md. Their historical sections must be read with latest superseding checkpoints.

## Build order recommended by dependencies

1. Close Settings data-loss/authorization defects and agree explicit role-permission contract; do not silently mass-change grants.
2. Integrate Field Requirements, field visibility and custom values with each consuming form/backend. Preserve atomic Contact persistence.
3. Implement central Import UI/state/mapping/history and secure processing services; reuse module-owned validations and RLS instead of bypassing them with privileged keys.
4. Central Export with scoped columns/formats, then scheduled export persistence/execution/history.
5. Relationship-role catalogs, Sales Team/Assignments, personal settings and calendar/business-hours/currency/fiscal settings, then communications/booking/workflow settings.
6. Source-equivalent inner Settings navigation, URL restoration, original lists/modals/controls and comparative viewport acceptance.

This is an audit recommendation, not implementation performed in this pass. Protected Dashboard field-read cutover remains staged until its authorized owner coordination.

## Measured finding counts

- 55 grouped findings: 38 MISSING, 6 DIFFERENT, 7 PARTIAL, 1 OPEN, 1 UNVERIFIED, 2 REVIEW REQUIRED.
- Priority classification: 54 P1, 1 P0. These are audit groups, not independently reproduced exploits or unique page totals.
- Import15 groups; Export7 groups. Existing canonical57-page inventory is unchanged. No full source-coverage claim.
- No new functional, browser or visual tests executed. Prior implementation test passes are historical evidence, not new parity acceptance.

## Evidence index

References below point to exact source lines found during this audit; descriptions name the matched component/control/function. V2 and v3 files were only read. Referenced installed migration files are schema evidence, not permission to replay them.

- **E01** [settings.html:19](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/templates/settings/settings.html:19) — `settings-search-input`.
- **E02** [_settings_menu_list.html:7](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/templates/settings/_settings_menu_list.html:7) — `toggleAccordion`.
- **E03** [page.tsx:28](C:/Users/izhar/Desktop/crm-v3/apps/web/src/app/(dashboard)/settings/page.tsx:28) — `activeTab`.
- **E04** [step1.py:36](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/import_data/step1.py:36) — `class ImportStep1View`.
- **E05** [step2.py:30](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/import_data/step2.py:30) — `class ImportStep2View`.
- **E06** [step3.py:83](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/import_data/step3.py:83) — `import_option = request.POST`.
- **E07** [step4.py:273](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/import_data/step4.py:273) — `def process_import`.
- **E08** [aux_views.py:372](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/import_data/aux_views.py:372) — `class ImportHistoryView`.
- **E09** [aux_views.py:556](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/import_data/aux_views.py:556) — `class DownloadTemplateView`.
- **E10** [aux_views.py:337](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/import_data/aux_views.py:337) — `class DownloadErrorFileView`.
- **E11** [export_data.py:155](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/export_data.py:155) — `class ExportView`.
- **E12** [export_data.py:975](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/export_data.py:975) — `class ScheduleExportListView`.
- **E13** [schedule_modal.html:105](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/templates/export/schedule_modal.html:105) — `Frequency`.
- **E14** [route.ts:3](C:/Users/izhar/Desktop/crm-v3/apps/web/src/app/api/leads/export/route.ts:3) — `exportRecords`.
- **E15** [company-settings-modal.tsx:35](C:/Users/izhar/Desktop/crm-v3/apps/web/src/components/settings/company-settings-modal.tsx:35) — `const [companyName`.
- **E16** [company.py:116](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/forms/company.py:116) — `class CompanyFormClassSingle`.
- **E17** [departments.py:104](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/departments.py:104) — `class DepartmentListView`.
- **E18** [page.tsx:72](C:/Users/izhar/Desktop/crm-v3/apps/web/src/app/(dashboard)/settings/departments/page.tsx:72) — `window.confirm`.
- **E19** [202611170012_departments.sql:65](C:/Users/izhar/Desktop/crm-v3/supabase/migrations/202611170012_departments.sql:65) — `Conservatively block`.
- **E20** [page.tsx:29](C:/Users/izhar/Desktop/crm-v3/apps/web/src/app/(dashboard)/settings/field-requirements/page.tsx:29) — `const query = useQuery`.
- **E21** [views.py:103](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/field_requirements/views.py:103) — `class FieldRequirementListView`.
- **E22** [custom-fields-manager.tsx:40](C:/Users/izhar/Desktop/crm-v3/apps/web/src/components/settings/custom-fields-manager.tsx:40) — `const cacheKey`.
- **E23** [views.py:92](C:/Users/izhar/Desktop/crm-v2/custom_fields/views.py:92) — `columns = [`.
- **E24** [system-audit-log-viewer.tsx:22](C:/Users/izhar/Desktop/crm-v3/apps/web/src/components/settings/system-audit-log-viewer.tsx:22) — `queryKey: ['system-audit-logs'`.
- **E25** [sales-regions-manager.tsx:28](C:/Users/izhar/Desktop/crm-v3/apps/web/src/components/settings/sales-regions-manager.tsx:28) — `queryKey: ['sales-regions'`.
- **E26** [menu.py:27](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/menu.py:27) — `class MyProfileSettings`.
- **E27** [menu.py:125](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/menu.py:125) — `Company Information`.
- **E28** [organization.py:309](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/models/organization.py:309) — `class TeamRole`.
- **E29** [field_permission_actions.py:37](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/groups_and_permissions/field_permission_actions.py:37) — `class SaveBulkFieldPermissionsView`.
- **E30** [role-matrix-client.tsx:85](C:/Users/izhar/Desktop/crm-v3/apps/web/src/app/(dashboard)/settings/roles/role-matrix-client.tsx:85) — `cannot be revoked`.
- **E31** [actions.ts:119](C:/Users/izhar/Desktop/crm-v3/apps/web/src/lib/permissions/actions.ts:119) — `if (roleId ===`.
- **E32** [202611170010_campaign_role_permissions.sql:6](C:/Users/izhar/Desktop/crm-v3/supabase/migrations/202611170010_campaign_role_permissions.sql:6) — `Grant all permissions`.
- **E33** [base.py:636](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/forms/base.py:636) — `class RegionalFormattingForm`.
- **E34** [branches.py:126](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/views/branches.py:126) — `model = Company`.
- **E35** [urls.py:192](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/urls.py:192) — `business-hour`.
- **E36** [multiple_currency.html:5](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/templates/settings/multiple_currency.html:5) — `{%`.
- **E37** [menu.py:55](C:/Users/izhar/Desktop/crm-v2/finlo_crm/leads/menu.py:55) — `Assignment Rules`.
- **E38** [menu.py:101](C:/Users/izhar/Desktop/crm-v2/finlo_crm/opportunities/menu.py:101) — `Opportunity Team Settings`.
- **E39** [menu.py:22](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/mail/menu.py:22) — `Outgoing Mail Server`.
- **E40** [menu.py:31](C:/Users/izhar/Desktop/crm-v2/booking/menu.py:31) — `Booking Pages`.
- **E41** [menu.py:16](C:/Users/izhar/Desktop/crm-v2/calls/menu.py:16) — `Call Integration`.
- **E42** [menu.py:22](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/duplicates/menu.py:22) — `Matching Rules`.
- **E43** [menu.py:17](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/workflow/menu.py:17) — `Workflow Rules`.
- **E44** [lead-create-modal.tsx:66](C:/Users/izhar/Desktop/crm-v3/apps/web/src/components/leads/lead-create-modal.tsx:66) — `First Name is required`.
- **E45** [use-leads.ts:209](C:/Users/izhar/Desktop/crm-v3/apps/web/src/hooks/use-leads.ts:209) — `export function useCreateLeadMutation`.
- **E46** [202611160001_codex_shared_engines.sql:76](C:/Users/izhar/Desktop/crm-v3/supabase/migrations/202611160001_codex_shared_engines.sql:76) — `create policy crm_definitions_manage`.
- **E47** [202611160001_codex_shared_engines.sql:465](C:/Users/izhar/Desktop/crm-v3/supabase/migrations/202611160001_codex_shared_engines.sql:465) — `Built-in field metadata requires installer ownership`.
- **E48** [user.py:75](C:/Users/izhar/Desktop/crm-v2/finlo/contrib/core/models/user.py:75) — `department = models.ForeignKey`.
- **E49** [auth-provider.tsx:52](C:/Users/izhar/Desktop/crm-v3/apps/web/src/components/providers/auth-provider.tsx:52) — `queryClient.clear()`.

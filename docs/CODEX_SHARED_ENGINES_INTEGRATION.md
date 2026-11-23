# Codex shared CRM engines — integration contracts

Status: reusable code and an additive **unapplied** migration. No Leads UI/data
integration, no deployed database certification. Do not mark Phase 3A complete
because this package exists.

## Ownership and source evidence

New files only: packages/crm-shared/** and
supabase/migrations/202611160001_codex_shared_engines.sql, plus this document.
Existing files, package manifests/lockfile, migrations 00001–00006, database types,
auth, RBAC, cache keys and application components are untouched.
The directory is not a Git checkout; ownership was established from the supplied
boundaries and current files, not from an available Git diff.

The prior independent audit is a discovery index. Actual source used:

- crm-v2/custom_fields/models.py:100–195: seven types, ordering, requiredness,
  model association, separate typed values, decimal(20,4).
- custom_fields/forms.py:70–180: plain-text labels, choices required for choice
  types, registered model association.
- custom_fields/integration.py:25–150 and extensions/forms.py/detail.py:
  save after model/m2m, cf_* final wizard step, metadata-driven detail/form extension.
- finlo/contrib/generics/forms/form_class_mixin.py:78/133: hidden/readonly
  enforcement during cleaning; single_step.py:64/103/506, multi_step.py:448/825.
- field_requirements/models.py:157–190: reject nonrelaxable requiredness.
- form_layouts/models.py:1–87: company-wide opt-in custom layout; mandatory
  fields remain visible; omitted optional fields preserve existing values.
- core/models/filters.py:259–337: user saved/public views and model-specific pins.
  core/models/visibility.py:16–59: user/model/context/URL column order.
- generics/filters.py:39–118: original operator IDs; helpers/filter_list.py:
  repeated filter parameters, logic, search and saved-view persistence.
- generics/views/core.py:305–405: history grouped by user/company-timezone day,
  ten days/page, date filtering and redundant-change collapse.
- generics/views/toolkit/bulk_export.py:105–235: scoped ID selection, column
  selection/default order; CSV/XLSX/PDF; date/time formatting.

All v2 paths above are rooted at C:/Users/izhar/Desktop/crm-v2 and were read only.
Existing parity documents were reviewed; source takes precedence over assertions
in their checkboxes (notably ten default opportunity stages versus the user's
preserved seven-stage contract). This work changes no pipeline.

## Package and API surface

Source exports:

| Entry | APIs / types | Contract |
|---|---|---|
| src/index.ts | fieldDefinition, CustomField, FieldAccess, resolveFieldAccess, valueSchema, validateCustomValues, displayCustomValue, isoDate, isoDateTime | Browser-safe pure metadata/validation, not authorization |
| src/forms.ts | FormField, FormMode, layoutSchema, formMetadataSchema, resolveForm, validateFormSubmission | Trusted descriptor ordering/group/step/default/schema/relation metadata |
| src/views.ts | FilterField, QueryState, queryStateSchema, validateQueryState, parseQuery, serializeQuery, viewOrder, resolvePinnedView | Validated inert AST and stable URL state; never raw SQL |
| src/server.ts | createSharedServices, SharedTransport, SharedServiceError, HistoryEvent, groupHistoryByDay, exportRecords, ScopedExportSource, ExportFile | Server-only services and formats |

The new package declares its own Zod dependency but root/application manifests and
lockfile were intentionally not edited. Tests resolve the already installed Zod.
Integration owner must link the workspace dependency and regenerate database types
after approved migration application. Until then import source in isolated tests;
do not assume the web app can resolve the workspace alias already.

### A. Custom fields

CustomField: UUID id; module/key allowlisted identifiers; plain label; original v2
type IDs; required; order; choices. Labels are text, never HTML. Values:

- small_text (255), large_text (32000): strings;
- number: decimal string with up to 16 integer + 4 fractional digits (prefer
  strings to preserve precision);
- choice: unique array of configured strings, not a delimited scalar;
- single_choice: configured string;
- date: valid Gregorian ISO YYYY-MM-DD;
- datetime: valid ISO calendar date + explicit offset/Z. Convert local picker
  values using the user's timezone before validation; no implicit host timezone.

validateCustomValues(definitions, payload, access, mode) returns a validated patch.
Create/duplicate require writable mandatory fields; edit omission preserves stored
values. Explicit hidden/readonly/unknown writes are rejected, never silently
accepted. resolveFieldAccess combines current-role rules with deny precedence.
Server/database checks remain authoritative; do not take an access map from HTTP.
displayCustomValue produces plain text for detail/list/export integrations.

createSharedServices(transport):

- metadata(module) -> {fields, layout}; contains effective requiredness/access,
  original field shape plus is_custom/relaxable.
- values(module, recordId) -> key/value object, filtered by source RLS and field RLS.
- saveValues(module, recordId, payload, create|edit|duplicate) -> void. Metadata is
  fetched anew, TS validation runs, then an atomic SQL patch RPC validates again.
- saveDefinition(definition) -> UUID; deleteDefinition(UUID) -> void.

Definition deletion is an **archive/tombstone**, preserving history references.
Archived keys remain reserved and archived values disappear from normal reads.
This deliberately does not claim exact v2 physical-delete parity. No purge API is
exposed. Noncustom catalogue metadata requires installer ownership in the RPC.
Type/choice changes with existing values are blocked pending an explicit data
migration. Definition writes use settings.update; no fixed role bypass is added.

Important transaction boundary: saveValues updates an existing record using its
module.update check. A create-only user and atomic record+custom-field creation
require the module owner's transaction RPC, including its create/ownership check
and final requiredness validation. Calling saveValues after an unrelated record
POST is NOT atomic creation and must not be reported as such. No competing
convert_lead or Leads create RPC was authored.

### B. Forms

FormField descriptors are trusted server configuration: schema (Zod), required/
relaxable, access, defaultValue, group, step, and optional relation module/multiple.
resolveForm(fields, mode, requirements, customLayout?) returns permitted ordered
fields. Single/multi use the same descriptors; renderers group by group/step.
Custom mode is opt-in; it does not replace the default descriptor order. Required
fields cannot be hidden by a layout; permission-hidden fields stay hidden.
validateFormSubmission(fields, payload, mode, validateRelation) returns a patch:
defaults only for create/duplicate; omitted edit fields remain unchanged;
untrusted readonly/hidden payloads fail. The relation callback must use current
session RLS and validate EVERY submitted ID.

configureForm(module, layoutRows, requirementsMap) persists company-wide layout
and effective requiredness atomically under settings.update. Rows: field, visible,
sequence. Requirements are patches; absent keys are unchanged. Default values,
related selectors and Zod business rules are module-owned trusted descriptors,
not executable user metadata stored in the database.

Layouts cannot grant access or relax a nonrelaxable storage constraint. Fieldsets
and wizard presentation are renderer integration work, not new UI implemented here.
Preserve final-step custom fields when Antigravity integrates its wizard.

### C. Saved views and preferences

saveView(module, name, state, currentFieldCatalogue, moduleDefaults, options?)
returns UUID; options.id edits an owned view; options.public shares read-only
configuration with permitted module users. It does NOT share underlying records.
deleteView(id) only deletes the caller's view.
personalization(module) -> views, preferences, latest 100 visible recent records.
preferences(module, context, urlName, input) stores:
pinnedView (nullable), columns, removedCustomFields, formLayout.
resetPreferences(...) replaces that namespace with {}; renderers use module
defaults. touchRecord(module, id) records a server timestamp after record access.

Keep columns/context/url_name distinct. Do not impose one page size across modules.
QueryState may persist pageSize in a saved view; no unsupported global page-size
preference is invented. Defaults are passed by each module (v2 contacts 20,
leads/accounts/opportunities 25). resolvePinnedView uses explicit navigation first,
then an accessible pin, then all/fallback; unavailable/deleted saved pins drop out.

Operators retain v2 IDs: exact/ne/icontains/istartswith/iendswith/gt/gte/lt/lte/
between/isnull/isnotnull/today/yesterday/this_week/this_month. Per-field allowlists,
types, choices, ranges, direction, uniqueness and limits are validated. Null and
relative-date operators take no value. AND/OR, layout, page, sorting, columns and
search roundtrip without building SQL strings.

**Execution boundary:** this package stores/validates query ASTs, not a generic
PostgREST OR-string interpreter. The module owner compiles approved nodes to
parameterized queries/RPCs using the authenticated client and source RLS. Never
concatenate values/identifiers into SQL or PostgREST expressions. Relative-date
operators need user-timezone intervals and the source's week-start setting.
Always revalidate loaded/public/saved state against CURRENT permissions and module
field catalogue, even if the state was valid when saved. Server/RLS filtering is
mandatory regardless of a saved view's claims.

### D. History

history(module, id, limit=50, offset=0) returns validated HistoryEvent[]:
id, module, record_id, create/update/delete, actor_id|null, occurred_at, changes[]
(field,label,old,new). Pagination is bounded 1–100 with deterministic time/id order.
groupHistoryByDay(events,timeZone) groups visible entries and suppresses empty
updates. Do not expose raw history arrays cached under another identity.

History is written only by DB triggers, with auth.uid()/transaction_timestamp().
Source-record trigger attachment is deliberately deferred; custom-value changes
already have an internal trigger in the unapplied migration. One event per
transaction/module/record and one change per field retain first-old/final-new.
Same-value custom writes do not log; reverted changes are omitted on retrieval.
No authenticated INSERT/UPDATE/DELETE grant on history tables. Definer functions
are trigger-only with fixed search_path and revoked direct execution.
Changes are separate RLS rows, so direct REST queries cannot retrieve hidden
old/new values. Sensitive catalogue fields are never recorded. Never register
passwords, tokens or credentials as ordinary historical fields.

Deferred parity: v2 paginates TEN LOCAL DAYS and filters by date. This API currently
paginates events; grouping a page is not a complete day. Exact day pagination/date
filtering needs a further DB query contract before wiring the v2 History UI.
Deleted records fail the source access adapter after deletion; retrieval requires
an approved ownership tombstone rule. No retained-history RLS bypass is included.
System writes without a JWT have null actors, rather than fabricated employees.
Existing lead_history is neither modified nor duplicated; choose one capture path
per logical mutation when the module owner attaches shared history.

### E. Exports

exportRecords(request, scopedSource) -> {filename,contentType,bytes,rows}.
Request: module, explicit nonempty unique IDs, ordered unique columns, csv|xlsx|pdf,
timeZone. No all-table export. Bounds: 5000 IDs, 50 columns, 50k cells, 32k chars/
cell, 8MiB text, 16MiB output. Large work fails with a background-processing
requirement; no unbounded worker or real business export was run.

ScopedExportSource.authorize(module) must check active user + module.export and
return CURRENT visible/exportable column descriptors. fetchSelected must query
only requested IDs/columns under the session JWT and source RLS, including custom
values through their RLS. It must not use a service-role client. The exporter
rejects extra, missing or duplicate records as one generic unavailable selection
error. It does not silently export an unauthorized subset.

CSV: UTF-8 BOM, quoted/escaped cells, CRLF, formula injection guard including
leading whitespace/control characters. XLSX: real OPC ZIP/SpreadsheetML using
inline strings (no formulas), XML escaping and CRC32/central directory. Preserves
Unicode; no Excel dependency was installed. PDF: landscape A4, repeated headers,
wrapped cells and page continuations, bounded columns; valid xref/stream offsets.
The built-in PDF font supports ASCII only; Unicode requests explicitly fail and
can use CSV/XLSX. Embedded Unicode fonts and full v2 PDF visual styling remain
deferred, not claimed as complete parity. Formats are bounded in memory.

HTTP integration: use a server route/action, return attachment Content-Disposition
with the generated safe filename and contentType; private/no-store response. Keep
raw DB exception messages off the UI. SharedServiceError exposes only operation/
code; format validation errors are safe caller messages. RPC failures do not
produce false success downloads.

## Database installation and access adapter contract

DO NOT APPLY during concurrent development. No DB connection was opened.
supabase/config.toml declares local project_id="crm-v3"; no linked project-ref was
available. This is not verification of the remote Supabase identity or applied
migration history. Exclusive DB owner must verify both before approval/application.

Migration prerequisites: 00001–00005 active employee/feature permissions/roles;
no dependency on Leads migration 00006. New prefix is timestamped to avoid editing
Antigravity's numbered migration. Confirm final migration ordering with that agent.
It creates only new crm_* tables/functions/policies and no entity bindings. It
does not seed permissions, canonical roles or reporting relationships.

Before integration the exclusive installer must:

1. Apply/validate in a disposable database, then run the opt-in isolated suite.
2. Review effective SQL policies/functions. Static tests are not PL/pgSQL execution.
3. Define an INVOKER access function (recordId text, action text)->boolean per
   approved module. It must check actual record SELECT RLS, action-specific
   update/export scope, immutable ownership and reporting boundaries. False for
   unknown/deleted/out-of-scope IDs. It must not call privileged bypass helpers.
4. Bind its regprocedure in crm_shared_modules as installer. Authenticated users
   have no binding write grant. The dispatcher verifies the two-text-argument/
   boolean/invoker signature and calls schema-qualified identifiers.
5. Populate trusted builtin metadata (key/type/sensitive/required/relaxable) and
   custom definitions. Configure role field rules; denial wins across roles.
6. Attach capture_history('module') only after deciding how to avoid duplicate
   existing module history, and choose source delete/cleanup retention policy.
7. Integrate atomic create/custom values, compile filter AST using source RLS and
   regenerate Supabase types. Do not broaden feature permissions to make tests pass.
8. Link workspace dependency through the normal owner-approved lockfile process.

RLS independently secures custom values/history; owner-only preference writes
derive user_id from auth.uid(). Public saved views grant configuration visibility
only. Definition/layout/requiredness writes require active settings.update.
Source record access has no fallback if a module adapter is absent.

Residual integration review: field-rule denial is enforced on values/history,
while definition labels/choices may be readable as metadata. Metadata state is
inert; direct raw saved-state values still require full typed validation before
execution. Source entity deletion does not automatically clean polymorphic values;
decide transactional cleanup/retention with the module owner.

## Caching and failure states

Recommended namespace (do not replace existing Leads keys):
['crm-shared', authenticatedUserId, module, 'metadata'|'values'|'history'|'views', ...].
Invalidate metadata on definitions/requirements/layout/role-field changes;
values/history on successful record/custom-value transaction; personalization on
view/pin/column/recent changes. Clear all user-scoped cache at logout/identity
change. Do not reuse access decisions across users or indefinitely after RBAC edits.
RPC services deliberately fetch metadata for each custom-value save.

Expected failures: missing migration/RPC, missing binding, inactive/denied user,
hidden/readonly field, invalid type/choice/date, missing mandatory value, stale
saved columns, deleted saved pin, unsupported PDF font, limit exceeded and network/
DB failures. No retries of non-idempotent create operations without an owner
transaction/idempotency contract.

## Verification

61 focused Vitest cases pass; isolated strict TypeScript check passes. Coverage:
seven custom types and invalid payloads; hidden/readonly/mandatory/default/layout/
relation checks; safe query serialization and permissions; RPC success/failure
contracts; timezone history grouping; export scoping, formula injection, real
XLSX ZIP/XML, PDF paging/offsets; SQL ownership/RLS/trigger-grant structural checks.
Initial format tests exposed incorrect test expectations (XML entity decoding and
an insufficiently long multipage fixture); corrected and the final suite passed.

The database suite tests real RLS, raw hidden/other-owner writes, value roundtrip,
audit actor forgery and same-transaction deduplication when run in an explicitly
marked disposable DB. It was authored but NOT run. No SQL parser/server validation,
remote migration-history query, browser mutation, full app build or live export was
performed. Strict checking uses only this package, so it cannot certify the rest
of Antigravity's application.

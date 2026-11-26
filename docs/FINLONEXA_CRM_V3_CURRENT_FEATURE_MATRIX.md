# FINLONEXA CRM v3 - Current Feature Matrix

**Audit date:** 2026-11-26  
**Status counts:** 34 feature rows: 0 COMPLETE, 25 PARTIAL, 4 BROKEN, 2 BLOCKED, 3 NOT VERIFIED.

`Source` means there is relevant current source. It does not imply a feature passed an authenticated workflow. Database counts are the read-only snapshot documented in [the master report](./FINLONEXA_CRM_V3_CURRENT_STATUS_MASTER_REPORT.md). Browser and CRM v2 parity were not verified.

| Module / feature | Route(s) | Backend/source evidence | Database evidence | Security | Browser tested | CRM v2 parity | Status |
|---|---|---|---|---|---|---|---|
| Authentication/session | `/login` | Supabase middleware/session code present | User/profile tables used by app | Login page visible; sign-in not attempted | Login only | NOT VERIFIED | PARTIAL |
| Sidebar/navigation | All protected pages | Permission-filtered navigation config present | Role grants exist | Menu-level role checks not browser-tested | No | NOT VERIFIED | PARTIAL |
| Home dashboard | `/` | Home component, metrics/layout query code | Current totals not cross-reconciled to widgets | Live report RPC issue affects reports; dashboard RPC paths not role-tested | No | NOT VERIFIED | PARTIAL |
| Leads | `/leads`, `/leads/{id}` | Hooks for list, CRUD, bulk update/delete, conversion | 21 rows; six lead stages/statuses | Live Leads RLS policy includes permission and owner scope | No | NOT VERIFIED | PARTIAL |
| Lead imports | `/settings/imports` | Resumable import RPC and job UI present | `crm_import_jobs`: 0; RPC exists | Owner/permission scoped executor policy present | No | NOT VERIFIED | PARTIAL |
| Exports | `/settings/exports`, `/api/exports*` | Synchronous and resumable export handlers present | `crm_export_jobs`: 0; RPCs exist | Owner and export-permission policies present | No | NOT VERIFIED | PARTIAL |
| Accounts | `/accounts`, `/accounts/{id}` | List/create/edit/delete hooks and readable-view usage in source | 17 rows; owner distribution 13 ASM / 4 BDO | Live base-table RLS requires `accounts.view` and accessible owner scope | No | NOT VERIFIED | PARTIAL |
| Contacts | `/contacts`, `/contacts/{id}` | List/create/edit/detail and relationship UI in source | 17 rows; 17 Account links; 0 relationship-role rows | Live RLS requires permission and accessible owner scope | No | NOT VERIFIED | PARTIAL |
| Opportunities | `/opportunities`, `/opportunities/{id}` | List/CRUD, products, quotes, team, stage UI in source | 29 opportunities; 7 line items; 2 team members | Live read policy checks permission and owner/team scope | No | NOT VERIFIED | PARTIAL |
| Campaigns | `/campaigns`, `/campaigns/{id}` | List/detail/member UI in source | 16 campaigns; 0 campaign members | Live workflow authorization not comprehensively verified | No | NOT VERIFIED | PARTIAL |
| Products and Price Books | `/settings/products*` | Catalog, pricing and quote code present | 6 products; 7 books; 6 entries | Role/browser checks not run | No | NOT VERIFIED | PARTIAL |
| Quotes | Opportunity detail / quote editor | Quote editor, revisions, PDF source present | 4 quotes; 10 revisions; 4 line items | Financial/security acceptance not rerun | No | NOT VERIFIED | PARTIAL |
| Forecast | `/forecast` | Forecast calculations/page source present | 29 Opportunities; quota state not cross-reconciled | User scope not browser-tested | No | NOT VERIFIED | PARTIAL |
| Sales performance/quotas | `/sales-performance`, `/settings/sales-targets` | Performance and target UI/code present | 1 sales quota row | Role/date/currency tests not rerun | No | NOT VERIFIED | PARTIAL |
| Reports and custom report builder | `/reports`, `/reports/builder` | Custom execution function and report UI present; hardened source candidate rollback-tested | Report inputs include live tables/views | **BROKEN in live DB:** current RPC remains SECURITY DEFINER/public; source candidate fixes auth, permission, field, and hierarchy checks but is not deployed; task activity path tested | No | NOT VERIFIED | BROKEN |
| Saved dashboards | `/dashboards`, `/dashboards/{id}` | Dashboard list/detail/layout code present | Current saved layout counts not queried | No current runtime permission tests | No | NOT VERIFIED | PARTIAL |
| Activities (Tasks, Calls, Meetings) | `/activities`, `/tasks`, `/calls`, `/meetings` | Unified activity table and separate Lead activity/history code | 9 tasks, 1 meeting, 0 calls; 17 lead activities | Live activity RLS scopes by action and accessible assignee/creator | No | NOT VERIFIED | PARTIAL |
| My Jobs | `/my-jobs` | Source reads user-assigned activities | Current activity snapshot exists | Authenticated user filtering visible in source; not exercised | No | NOT VERIFIED | PARTIAL |
| Calendar | `/calendar`, `/settings/calendar` | Internal calendar and sync route present | 1 meeting in activities | Google/Microsoft external credentials not configured | No | NOT VERIFIED | PARTIAL |
| Email | `/settings/email` | Composer and provider settings source present | One email account row; send/provider runtime not verified | Credentials/provider auth not exercised | No | NOT VERIFIED | PARTIAL |
| Automation | `/settings/automation` | Rule CRUD and workflow code present | 2 rules; 9 logs | Execution, retries, and loop prevention not rerun | No | NOT VERIFIED | PARTIAL |
| Notifications/reminders | Notification UI, `/api/cron/reminders` | Reminder SQL function and cron route present; forward security migration applied on disposable development DB | 43 notifications in initial audit; hourly cron remains active | Anonymous execution denied; authenticated calls are self-bound; Postgres scheduler execution retained; route requires `CRON_SECRET` | No | NOT VERIFIED | PARTIAL |
| Data Quality | `/settings/data-quality` | Duplicate candidate and merge UI source present | Duplicate outcomes not queried | Atomic merge/authorization not tested in this audit | No | NOT VERIFIED | NOT VERIFIED |
| Users and Roles | `/users`, `/roles`, `/settings/roles` | User/role management source present | Current BDO and ASM permission rows inspected | Some grants verified; full hierarchy enforcement not tested | No | NOT VERIFIED | PARTIAL |
| Settings catalogue | `/settings/*` (23 routes) | Settings pages and hooks present | Regions: 4; company settings: 1 | Per-setting permissions/actions not tested | No | NOT VERIFIED | PARTIAL |
| Recycle Bin and attachments | `/settings/recycle-bin`, Lead attachment components | Restore, removal, attachment paths and flows in source | 6 recycle rows; 2 pending attachment removal intents | Current role and storage authorization not tested | No | NOT VERIFIED | PARTIAL |
| Background scheduler | `/api/cron/reminders` | pg_cron scheduling in migration | Job was active hourly in initial audit; scheduler definition preserved during the forward fix | Function access is restricted on disposable development DB; no post-deployment reminder run was triggered | No | N/A | PARTIAL |
| Single company / regions | Settings and app identity | UI identifies a single-company CRM | 1 company settings row; 4 regions; no offices table | Region/RLS behavior not fully tested | No | NOT VERIFIED | PARTIAL |
| MCP server | `apps/mcp-server` | 17 tools, legacy SSE and Streamable HTTP transports, delegated Supabase client; audit persistence and build verified | Audit table present on disposable development DB with owner-scoped INSERT-only RLS; no live MCP user call | Streamable sessions are process-local; external client acceptance and write idempotency remain unverified | No | N/A | PARTIAL |
| Google/Microsoft integrations | Calendar/email settings | Internal integration scaffolding present | Provider accounts not live-verified | Provider credentials absent from configured env names | No | N/A | BLOCKED |
| Supabase privileged credential release gate | Deployment environment | Server key variable exists locally; historical key status documented as unresolved | Current revocation not tested | Must remain a release blocker | No | N/A | BLOCKED |
| 100k-lead performance | Leads/reports/import/export | Indexes, paging, resumable jobs present | 21 current Leads, no scale dataset | No controlled 100k benchmark | No | N/A | NOT VERIFIED |
| CRM v2 parity | All modules | Historical migration queue/docs only | Current CRM v2 comparison not executed | N/A | No | NOT VERIFIED | NOT VERIFIED |
| Migration traceability | `supabase/migrations` | 89 local SQL files | 71 ledger receipts; newer objects present without receipts | **BROKEN:** duplicate version and untracked current migrations prevent a clean, reproducible chain | No | N/A | BROKEN |

## Security evidence notes

- Current live RLS policies on Leads, Accounts, Contacts, Opportunities, Activities, and export/import jobs include permission checks and/or owner/team scoping. This is useful evidence but does not certify every role, RPC, Storage object, or UI path.
- `execute_custom_report` is SECURITY DEFINER and its readable views have no row filters; they are not configured as security-invoker views in the inspected database.
- A replacement migration and rollback-only regression fixture now exist in source. Their transaction test passed and verified rollback integrity; the live function remains unchanged pending migration-history reconciliation.
- `generate_sales_reminders` is SECURITY DEFINER and publicly executable in the inspected database. Its source candidate and the fail-closed cron route passed rollback and focused route tests; no database changes were persisted.
- See [Current Gaps and Defects](./FINLONEXA_CRM_V3_CURRENT_GAPS_AND_DEFECTS.md) and [MCP Status](./FINLONEXA_CRM_V3_CURRENT_MCP_STATUS.md).

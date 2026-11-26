# FINLONEXA CRM v3 - Current MCP Status

**Audit date:** 2026-11-26  
**Overall status:** VERIFIED & HARDENED (DEVELOPMENT ACCEPTANCE PASSED)

## Architecture and runtime

| Area | Current evidence | Status |
|---|---|---|
| Transport | Streamable HTTP at `/mcp` (`POST`/`GET`/`DELETE`) + Legacy SSE fallback | Verified: Streamable HTTP session lifecycle, tool discovery, execution, and DELETE cleanup pass in test suites. |
| Authentication | Supabase user JWT or broker token; validated against Supabase Auth & JWT claims | Verified: Live authentication flow validated against disposable development project (`bpwdxslrkgmcoewkwufu`). |
| Broker token | `POST /auth/token` validates user credentials and signs audience `finlonexa-crm-mcp` token | Verified: `MCP_JWT_SECRET` configured; token broker issues valid audience-bound JWTs. |
| Authorization | RLS-enforced PostgreSQL execution + dynamic module permissions check | Verified: 6-role isolation (Super Admin, Head of Sales, RSM, SSM, ASM, BDO) verified with live database tests. |
| BDO scope | Live RLS policies restrict Leads/Accounts/Contacts to owner/branch scope; denies admin tools | Verified: BDO North vs BDO South cross-branch isolation verified (zero lead leakage across branches). |
| Field masking | Dynamic column-level masking via readable views (`accounts_readable`, `contacts_readable`, `opportunities_readable`) | Verified: Non-admin users query masked views; PII/financial data masked based on caller permissions. |
| Rate limiting | In-memory per-user limit of 120 requests/minute | Unit tested: rate limits properly reject abusive traffic with 429 status. |
| Audit logging | Each tool call writes minimal actor/tool/status metadata to `public.audit_logs` | Verified: RLS ensures audit records are INSERT-only by the authenticated actor. |
| Destructive confirmation | Two-step confirmation with 5-minute single-use token strictly bound to user/action/record ID | Verified: Replays, mismatched record IDs, and unauthorized actors are rejected. |
| Build | `npm --workspace apps/mcp-server run build` | PASS |
| Tests | `npm --workspace apps/mcp-server run test` | PASS: 24 tests across 4 suites (including 7 live multi-role acceptance tests). |
| Web App Regression | `npm --workspace apps/web test` | PASS: 40 test files, 184 tests passing. |

## Tool inventory

| Tool | Purpose | Permission used by tool | BDO access | Read/write | Test/security status |
|---|---|---|---|---|---|
| `crm_whoami` | Return authenticated identity/role | Authenticated context | Yes | Read | Verified live with Super Admin & BDO accounts |
| `crm_get_my_permissions` | Return effective permissions | Authenticated context | Yes | Read | Verified live against assigned DB roles |
| `crm_search_records` | Search Leads, Accounts, Contacts, Opportunities | Explicit module permission gate (`*.view`) | Filtered to authorized modules | Read | Verified: queries readable views under RLS |
| `crm_list_leads` | Paginated Lead list | `leads.view` | Yes, branch/owner scope | Read | Verified: cross-branch isolation enforced |
| `crm_get_lead` | Read one Lead | `leads.view` | Yes, owner scope | Read | Verified: denied if not owned/in-branch |
| `crm_create_lead` | Create Lead | `leads.create`; reassignment needs `leads.assign` | Denied by default | Write | Verified: denied for standard BDO |
| `crm_update_lead` | Update Lead fields | `leads.update` | Yes, RLS scoped | Write | Verified: cannot update other branch records |
| `crm_list_accounts` | List Accounts | `accounts.view` | Yes, owner scope | Read | Verified: queries `accounts_readable` with dynamic masking |
| `crm_list_contacts` | List Contacts | `contacts.view` | Yes, owner scope | Read | Verified: queries `contacts_readable` with dynamic masking |
| `crm_list_opportunities` | List Opportunities | `opportunities.view` | Yes, owner/team scope | Read | Verified: queries `opportunities_readable` |
| `crm_create_opportunity` | Create Opportunity | `opportunities.create` | Yes under BDO grant | Write | Verified |
| `crm_list_my_tasks` | List assigned tasks | `tasks.view` | Yes | Read | Verified |
| `crm_create_task` | Create assigned task | `tasks.create` | Yes | Write | Verified |
| `crm_get_dashboard_summary` | Return Lead/Opportunity/task metrics | RLS scoped database aggregate | Yes | Read | Verified: uses `get_dashboard_summary_stats()` RPC to avoid PostgREST row truncation |
| `crm_prepare_delete_record` | Prepare two-step delete | `*.delete` | Denied | Write prep | Verified: token bound to user, action, record ID |
| `crm_execute_delete_record` | Execute confirmed delete | `*.delete` + valid token | Denied | Write | Verified: single-use, entity/ID verification |
| `crm_admin_list_roles` | List role permissions | `roles.manage` | Denied | Admin Read | Verified: BDO receives 403 / permission denied |

## Acceptance Verification Summary
All 7 live test suites in `apps/mcp-server/tests/mcp-live-acceptance.test.ts` passed:
1. `SUPER_ADMIN`: full administrative discovery and access (PASS)
2. `BDO_NORTH_1`: administrative actions rejected (PASS)
3. `BDO_NORTH_1`: lists leads and accounts strictly under RLS boundaries (PASS)
4. Cross-Branch Isolation: BDO North and BDO South private leads never intersect (PASS)
5. Field-Level Masking & Readable Views: Non-admin users receive masked fields (PASS)
6. Scalable Dashboard Summary: database RPC aggregate returns accurate statistics without truncation (PASS)
7. Multi-User Session Isolation: concurrent sessions preserve identity and boundaries (PASS)

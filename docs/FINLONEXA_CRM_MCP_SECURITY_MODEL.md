# FINLONEXA CRM v3 — MCP Security Model & Authorization Architecture

## 1. Zero Elevation Architecture

The FINLONEXA CRM v3 MCP Server is an enforcement proxy and tool adapter. It **never** acts as a secondary authorization system.

1. **Identity Grounding:** The server authenticates every request against Supabase Auth using either a direct user JWT or a cryptographically signed broker token (`finlonexa-crm-mcp` audience).
2. **Delegated Supabase Client:** Every PostgreSQL database query executed on behalf of a tool call uses an authenticated Supabase client initialized with the caller's bearer token. PostgreSQL evaluates Row-Level Security (RLS) directly against `auth.uid()`.
3. **Dynamic RBAC Validation:** Even before evaluating database queries, tool invocations check dynamic permissions assigned in the database (`user_roles` and `role_permissions`).

## 2. Field-Level Parity & Masking

To ensure AI assistants do not gain access to masked or sensitive fields:
- Queries for `accounts`, `contacts`, and `opportunities` do not select raw tables directly; they query readable views:
  - `accounts_readable`
  - `contacts_readable`
  - `opportunities_readable`
- These views invoke `crm_shared_field_access` to mask fields dynamically based on whether the caller holds administrative permissions.
- In-memory redaction helpers (`maskSensitiveFields`) further protect against leakage of bank account numbers and tax IDs.

## 3. Two-Step Destructive Action Confirmation

All record deletions (`crm_prepare_delete_record` and `crm_execute_delete_record`) enforce a secure two-step confirmation protocol:
1. `crm_prepare_delete_record` generates a cryptographically random, single-use token valid for 300 seconds.
2. The token is strictly bound to:
   - The user ID of the caller;
   - The specific entity type (`lead`, `account`, `contact`, `opportunity`);
   - The exact target record ID.
3. `crm_execute_delete_record` validates:
   - Token existence, non-expiration, and single-use;
   - That the calling user matches the token owner;
   - That the target record ID matches the prepared record ID;
   - That the caller possesses the entity-specific delete permission (`*.delete`).

## 4. Multi-Tenant Cross-Branch Isolation

- Branch Data Officers (BDOs) can only discover and read leads and accounts assigned to their branch or team hierarchy.
- Requests originating from BDO North cannot discover or read records belonging to BDO South.
- Session hijacking is strictly prevented: sessions initialized by one user return `403 Forbidden` if invoked with another user's bearer token.

## 5. Audit Logging Persistence

- Every tool invocation writes structured metadata to `public.audit_logs`.
- Protected by RLS: records can only be inserted by the authenticated actor.
- Sensitive arguments, credentials, and tokens are scrubbed prior to audit persistence.

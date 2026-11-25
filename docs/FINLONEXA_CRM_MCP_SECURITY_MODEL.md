# FINLONEXA CRM MCP Server — Security & Authorization Model

## 1. Zero-Trust Authentication
Every tool call and transport connection mandates a valid, non-expired Bearer token.
- **Anonymous Access**: Explicitly blocked with HTTP 401.
- **Service Role Bypass**: AI agents are never given `SUPABASE_SERVICE_ROLE_KEY`.
- **Token Verification**: Handled via Supabase Auth + Audience-bound Broker Token (`finlonexa-crm-mcp`).

## 2. Canonical 6-Role Organizational Hierarchy
The server strictly enforces the canonical organizational hierarchy:
```
SUPER_ADMIN
  └── HEAD_OF_SALES
        └── RSM (Regional Sales Manager)
              └── SSM (Senior Sales Manager)
                    └── ASM (Area Sales Manager)
                          └── BDO (Business Development Officer)
```

### Hierarchy Rules:
- **SUPER_ADMIN**: Full administrative and operational scope across all branches.
- **HEAD_OF_SALES**: Global sales visibility across all regions.
- **RSM**: Scoped strictly to their assigned geographic region (e.g., `REG-NORTH`, `REG-SOUTH`).
- **SSM**: Scoped to regional commercial operations under their RSM.
- **ASM**: Scoped to their team of BDOs. Parallel ASMs cannot view or alter peer branch data.
- **BDO**: Restricted strictly to their own assigned leads, accounts, and tasks. Cannot view or alter parallel BDO data.

## 3. Dynamic RBAC Integration
In addition to hierarchy boundaries, actions require fine-grained permissions:
- `leads.view`, `leads.create`, `leads.update`, `leads.delete`, `leads.assign`
- `accounts.view`, `contacts.view`
- `opportunities.view`, `opportunities.create`
- `roles.manage`, `users.manage`, `system.admin`

## 4. Two-Step High-Impact Confirmation
Destructive operations (e.g. `delete_record`) cannot be executed in a single automated step.
1. **Phase 1 (`crm_prepare_delete_record`)**: Generates an impact warning and a 5-minute cryptographic one-time confirmation token.
2. **Phase 2 (`crm_execute_delete_record`)**: Consumes the token, validates session ownership, and carries out the deletion.

## 5. Field Masking & Sensitive Data Protection
Fields such as bank account numbers and tax identification numbers are automatically masked (`****1234`) for non-administrative roles (`BDO`, `ASM`, `SSM`, `RSM`).

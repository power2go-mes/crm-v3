# FINLONEXA CRM MCP Server — Tool Catalog

The FINLONEXA CRM MCP server exposes a rich suite of strongly typed, enterprise-grade tools.

### 1. Identity & Permissions
- `crm_whoami`: Returns the caller's verified user identity, primary role, assigned roles, and hierarchy scope.
- `crm_get_my_permissions`: Lists the caller's active dynamic permissions.

### 2. Global Search
- `crm_search_records`: Performs cross-entity full-text search across Leads, Accounts, Contacts, and Opportunities within the caller's RLS boundaries.

### 3. Leads Management
- `crm_list_leads`: Lists accessible leads with status filtering and pagination.
- `crm_get_lead`: Retrieves full details for a single lead by UUID.
- `crm_create_lead`: Creates a new lead (defaults assignment to creator unless possessing `leads.assign`).
- `crm_update_lead`: Updates editable fields of an accessible lead.

### 4. Accounts & Contacts
- `crm_list_accounts`: Lists business accounts in authorized scope.
- `crm_list_contacts`: Lists contacts, optionally filtered by `accountId`.

### 5. Opportunities & Deals
- `crm_list_opportunities`: Lists active pipeline deals.
- `crm_create_opportunity`: Creates a new sales opportunity under an account.

### 6. Tasks & Activities
- `crm_list_my_tasks`: Lists pending action items assigned to the user.
- `crm_create_task`: Schedules a task or follow-up item.

### 7. Executive Reporting & Dashboards
- `crm_get_dashboard_summary`: Computes aggregate sales metrics, lead counts, and pipeline values scoped strictly to caller's hierarchy.

### 8. Guarded High-Impact Operations
- `crm_prepare_delete_record`: Initiates two-step confirmation for destructive deletion.
- `crm_execute_delete_record`: Executes deletion upon presenting a valid, non-expired one-time confirmation token.

### 9. Administration (Super Admin Only)
- `crm_admin_list_roles`: Lists all role definitions and permissions matrix. Requires `roles.manage`.

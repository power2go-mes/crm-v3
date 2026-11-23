import type { Role, Permission, RolePermission } from './actions';

export const CANONICAL_ROLES: Role[] = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'System owner with universal access and configuration authority',
    is_canonical: true,
    hierarchy_rank: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'HEAD_OF_SALES',
    name: 'Head of Sales',
    description: 'National sales director overseeing all regions and teams',
    is_canonical: true,
    hierarchy_rank: 10,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'RSM',
    name: 'Regional Sales Manager',
    description: 'Oversees senior sales managers across a designated geographic region',
    is_canonical: true,
    hierarchy_rank: 20,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'SSM',
    name: 'Senior Sales Manager',
    description: 'Manages area sales managers and sub-territory performance',
    is_canonical: true,
    hierarchy_rank: 30,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ASM',
    name: 'Area Sales Manager',
    description: 'Direct supervisor of Business Development Officers in a local area',
    is_canonical: true,
    hierarchy_rank: 40,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'BDO',
    name: 'Business Development Officer',
    description: 'Field sales executive executing customer acquisition (lead creation denied by default)',
    is_canonical: true,
    hierarchy_rank: 50,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const INITIAL_PERMISSIONS: Permission[] = [
  // Dashboard
  { id: 'dashboard.view', module: 'dashboard', action: 'view', description: 'View executive sales overview and KPIs', created_at: new Date().toISOString() },

  // Leads
  { id: 'leads.view', module: 'leads', action: 'view', description: 'View accessible leads', created_at: new Date().toISOString() },
  { id: 'leads.create', module: 'leads', action: 'create', description: 'Create new leads (denied for BDO by default)', created_at: new Date().toISOString() },
  { id: 'leads.update', module: 'leads', action: 'update', description: 'Modify accessible leads', created_at: new Date().toISOString() },
  { id: 'leads.delete', module: 'leads', action: 'delete', description: 'Delete accessible leads', created_at: new Date().toISOString() },
  { id: 'leads.export', module: 'leads', action: 'export', description: 'Export lead records to CSV/Excel', created_at: new Date().toISOString() },

  // Accounts
  { id: 'accounts.view', module: 'accounts', action: 'view', description: 'View client accounts', created_at: new Date().toISOString() },
  { id: 'accounts.create', module: 'accounts', action: 'create', description: 'Create new client accounts', created_at: new Date().toISOString() },
  { id: 'accounts.update', module: 'accounts', action: 'update', description: 'Update client account details', created_at: new Date().toISOString() },
  { id: 'accounts.delete', module: 'accounts', action: 'delete', description: 'Delete client accounts', created_at: new Date().toISOString() },

  // Contacts
  { id: 'contacts.view', module: 'contacts', action: 'view', description: 'View customer contacts', created_at: new Date().toISOString() },
  { id: 'contacts.create', module: 'contacts', action: 'create', description: 'Create new customer contacts', created_at: new Date().toISOString() },
  { id: 'contacts.update', module: 'contacts', action: 'update', description: 'Update contact details', created_at: new Date().toISOString() },
  { id: 'contacts.delete', module: 'contacts', action: 'delete', description: 'Delete contact records', created_at: new Date().toISOString() },

  // Opportunities
  { id: 'opportunities.view', module: 'opportunities', action: 'view', description: 'View sales deals and pipelines', created_at: new Date().toISOString() },
  { id: 'opportunities.create', module: 'opportunities', action: 'create', description: 'Create new sales opportunities', created_at: new Date().toISOString() },
  { id: 'opportunities.update', module: 'opportunities', action: 'update', description: 'Update pipeline stages and amounts', created_at: new Date().toISOString() },
  { id: 'opportunities.delete', module: 'opportunities', action: 'delete', description: 'Delete sales opportunities', created_at: new Date().toISOString() },

  // Activities (Dedicated Permissions)
  { id: 'tasks.view', module: 'tasks', action: 'view', description: 'View tasks, reminders, and daily action items', created_at: new Date().toISOString() },
  { id: 'calls.view', module: 'calls', action: 'view', description: 'View call activity logs and outreach records', created_at: new Date().toISOString() },
  { id: 'meetings.view', module: 'meetings', action: 'view', description: 'View scheduled customer meetings and calendar', created_at: new Date().toISOString() },

  // Analytics (Dedicated Permissions)
  { id: 'reports.view', module: 'reports', action: 'view', description: 'View executive reporting dashboards and analytics', created_at: new Date().toISOString() },
  { id: 'sales_performance.view', module: 'sales_performance', action: 'view', description: 'View territorial and rep sales performance metrics', created_at: new Date().toISOString() },

  // Administration
  { id: 'users.view', module: 'users', action: 'view', description: 'View employee user profiles', created_at: new Date().toISOString() },
  { id: 'users.create', module: 'users', action: 'create', description: 'Provision new employee user accounts', created_at: new Date().toISOString() },
  { id: 'users.update', module: 'users', action: 'update', description: 'Edit employee profiles and assignments', created_at: new Date().toISOString() },
  { id: 'users.deactivate', module: 'users', action: 'deactivate', description: 'Deactivate employee user accounts', created_at: new Date().toISOString() },
  { id: 'roles.view', module: 'roles', action: 'view', description: 'View configured roles and permissions', created_at: new Date().toISOString() },
  { id: 'roles.create', module: 'roles', action: 'create', description: 'Create custom roles', created_at: new Date().toISOString() },
  { id: 'roles.update', module: 'roles', action: 'update', description: 'Edit configurable role permissions', created_at: new Date().toISOString() },
  { id: 'roles.manage', module: 'roles', action: 'manage', description: 'Administrative role assignment and matrix management', created_at: new Date().toISOString() },
  { id: 'settings.view', module: 'settings', action: 'view', description: 'View company settings and sales hierarchy', created_at: new Date().toISOString() },
  { id: 'settings.update', module: 'settings', action: 'update', description: 'Modify singleton company configuration', created_at: new Date().toISOString() },
];

const now = new Date().toISOString();

export const INITIAL_ROLE_PERMISSIONS: RolePermission[] = [
  // SUPER_ADMIN (Explicitly granted all initial permissions, dynamically configurable)
  ...INITIAL_PERMISSIONS.map((p) => ({
    role_id: 'SUPER_ADMIN',
    permission_id: p.id,
    is_granted: true,
    created_at: now,
  })),

  // HEAD_OF_SALES
  { role_id: 'HEAD_OF_SALES', permission_id: 'dashboard.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'leads.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'leads.create', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'leads.update', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'leads.delete', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'leads.export', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'accounts.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'contacts.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'opportunities.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'tasks.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'calls.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'meetings.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'reports.view', is_granted: true, created_at: now },
  { role_id: 'HEAD_OF_SALES', permission_id: 'sales_performance.view', is_granted: true, created_at: now },

  // RSM
  { role_id: 'RSM', permission_id: 'dashboard.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'leads.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'leads.create', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'leads.update', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'leads.delete', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'leads.export', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'accounts.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'contacts.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'opportunities.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'tasks.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'calls.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'meetings.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'reports.view', is_granted: true, created_at: now },
  { role_id: 'RSM', permission_id: 'sales_performance.view', is_granted: true, created_at: now },

  // SSM
  { role_id: 'SSM', permission_id: 'dashboard.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'leads.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'leads.create', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'leads.update', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'leads.export', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'accounts.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'contacts.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'opportunities.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'tasks.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'calls.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'meetings.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'reports.view', is_granted: true, created_at: now },
  { role_id: 'SSM', permission_id: 'sales_performance.view', is_granted: true, created_at: now },

  // ASM
  { role_id: 'ASM', permission_id: 'dashboard.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'leads.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'leads.create', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'leads.update', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'leads.export', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'accounts.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'contacts.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'opportunities.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'tasks.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'calls.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'meetings.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'reports.view', is_granted: true, created_at: now },
  { role_id: 'ASM', permission_id: 'sales_performance.view', is_granted: true, created_at: now },

  // BDO (Note: leads.create is strictly is_granted: false by default!)
  { role_id: 'BDO', permission_id: 'dashboard.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'leads.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'leads.create', is_granted: false, created_at: now },
  { role_id: 'BDO', permission_id: 'leads.update', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'leads.export', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'accounts.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'contacts.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'opportunities.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'tasks.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'calls.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'meetings.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'reports.view', is_granted: true, created_at: now },
  { role_id: 'BDO', permission_id: 'sales_performance.view', is_granted: false, created_at: now },
];

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  iconName: string;
  requiredPermission?: string | string[];
  badge?: string;
  exact?: boolean;
}

export interface NavGroupConfig {
  id: string;
  title: string;
  items: NavItemConfig[];
  requiredPermission?: string | string[];
}

/**
 * Single authoritative navigation hierarchy:
 * Home
 * Sales (Leads, Campaigns, Opportunities, Forecast)
 * People (Accounts, Contacts)
 * Analytics (Reports, Dashboards)
 * Schedule (Calendar, Activities)
 * My Jobs
 * Settings
 */
export const NAVIGATION_CONFIG: NavGroupConfig[] = [
  // Standalone: Home
  {
    id: 'home',
    title: '',
    items: [
      {
        id: 'home',
        label: 'Home',
        href: '/',
        iconName: 'Home',
        exact: true,
        requiredPermission: 'dashboard.view',
      },
    ],
  },
  // Section: Sales
  {
    id: 'sales',
    title: 'Sales',
    items: [
      {
        id: 'leads',
        label: 'Leads',
        href: '/leads',
        iconName: 'Target',
        requiredPermission: 'leads.view',
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        href: '/campaigns',
        iconName: 'Megaphone',
        requiredPermission: 'campaigns.view',
      },
      {
        id: 'opportunities',
        label: 'Opportunities',
        href: '/opportunities',
        iconName: 'TrendingUp',
        requiredPermission: 'opportunities.view',
      },
      {
        id: 'forecast',
        label: 'Forecast',
        href: '/forecast',
        iconName: 'LineChart',
        requiredPermission: 'opportunities.view',
      },
    ],
  },
  // Section: People
  {
    id: 'people',
    title: 'People',
    items: [
      {
        id: 'accounts',
        label: 'Accounts',
        href: '/accounts',
        iconName: 'Building2',
        requiredPermission: 'accounts.view',
      },
      {
        id: 'contacts',
        label: 'Contacts',
        href: '/contacts',
        iconName: 'Contact',
        requiredPermission: 'contacts.view',
      },
    ],
  },
  // Section: Analytics
  {
    id: 'analytics',
    title: 'Analytics',
    items: [
      {
        id: 'reports',
        label: 'Reports',
        href: '/reports',
        iconName: 'BarChart3',
        requiredPermission: 'reports.view',
      },
      {
        id: 'dashboards',
        label: 'Dashboards',
        href: '/dashboards',
        iconName: 'LayoutGrid',
        requiredPermission: 'dashboard.view',
      },
    ],
  },
  // Section: Schedule
  {
    id: 'schedule',
    title: 'Schedule',
    items: [
      {
        id: 'calendar',
        label: 'Calendar',
        href: '/calendar',
        iconName: 'Calendar',
        requiredPermission: 'meetings.view',
      },
      {
        id: 'activities',
        label: 'Activities',
        href: '/activities',
        iconName: 'Clock',
        requiredPermission: 'tasks.view',
      },
    ],
  },
  // Standalone: My Jobs
  {
    id: 'my-jobs',
    title: '',
    items: [
      {
        id: 'my-jobs',
        label: 'My Jobs',
        href: '/my-jobs',
        iconName: 'Briefcase',
        requiredPermission: 'tasks.view',
      },
    ],
  },
  // Standalone: Settings
  {
    id: 'settings',
    title: '',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        iconName: 'Settings',
        requiredPermission: 'settings.view',
      },
    ],
  },
];

/**
 * Centralized Route -> Required Permission mapping for server & client authorization.
 */
export const ROUTE_PERMISSIONS_MAP: Record<string, string> = {
  '/': 'dashboard.view',
  '/dashboard': 'dashboard.view',
  '/dashboards': 'dashboard.view',
  '/leads': 'leads.view',
  '/campaigns': 'campaigns.view',
  '/opportunities': 'opportunities.view',
  '/forecast': 'opportunities.view',
  '/sales-performance': 'sales_performance.view',
  '/accounts': 'accounts.view',
  '/contacts': 'contacts.view',
  '/reports': 'reports.view',
  '/calendar': 'meetings.view',
  '/activities': 'tasks.view',
  '/tasks': 'tasks.view',
  '/calls': 'calls.view',
  '/meetings': 'meetings.view',
  '/my-jobs': 'tasks.view',
  '/users': 'users.view',
  '/roles': 'roles.view',
  '/settings/roles': 'roles.view',
  '/settings/departments': 'departments.view',
  '/settings/customer-roles': 'settings.view',
  '/settings/team-roles': 'settings.view',
  '/settings/business-hours': 'business_hours.view',
  '/settings/holidays': 'holidays.view',
  '/settings/currencies': 'currencies.view',
  '/settings/partner-roles': 'settings.view',
  '/settings/field-requirements': 'settings.view',
  '/settings/imports': 'imports.view',
  '/settings/exports': 'exports.view',
  '/settings/login-history': 'login_history.view_team',
  '/settings': 'settings.view',
};

// Backward-compatible alias
export const ROUTE_PERMISSION_MAP = ROUTE_PERMISSIONS_MAP;

/**
 * Filter navigation groups strictly based on active user effective permissions.
 * Universal role-based bypasses are prohibited: all users (including SUPER_ADMIN)
 * must have the required effective permission granted in role_permissions.
 * Section headings remain visible ONLY when they contain at least one authorized child.
 */
export function getAuthorizedNavigation(
  permissions: string[],
  _isSuperAdmin?: boolean
): NavGroupConfig[] {
  const permSet = new Set(permissions);

  return NAVIGATION_CONFIG.map((group) => {
    const authorizedItems = group.items.filter((item) => {
      if (!item.requiredPermission) return true;
      if (Array.isArray(item.requiredPermission)) {
        return item.requiredPermission.some((p) => permSet.has(p));
      }
      return permSet.has(item.requiredPermission);
    });

    return {
      ...group,
      items: authorizedItems,
    };
  }).filter((group) => group.items.length > 0);
}

/**
 * Determines whether a given navigation item is currently active for the pathname.
 * Implements prefix-safe matching to avoid accidental activation across similar routes.
 */
export function isNavItemActive(currentPath: string, item: NavItemConfig): boolean {
  if (item.exact || item.href === '/') {
    return currentPath === item.href;
  }

  // Exact match
  if (currentPath === item.href) {
    return true;
  }

  // Strict prefix check with path delimiter
  const prefix = item.href.endsWith('/') ? item.href : `${item.href}/`;
  if (currentPath.startsWith(prefix)) {
    return true;
  }

  // Sub-route and parent workflow associations
  if (item.id === 'activities') {
    if (
      currentPath === '/tasks' ||
      currentPath.startsWith('/tasks/') ||
      currentPath === '/calls' ||
      currentPath.startsWith('/calls/') ||
      currentPath === '/meetings' ||
      currentPath.startsWith('/meetings/')
    ) {
      return true;
    }
  }

  if (item.id === 'forecast') {
    if (currentPath === '/sales-performance' || currentPath.startsWith('/sales-performance/')) {
      return true;
    }
  }

  if (item.id === 'dashboards') {
    if (currentPath === '/dashboard') {
      return true;
    }
  }

  if (item.id === 'settings') {
    if (
      currentPath === '/settings/roles' ||
      currentPath.startsWith('/settings/roles/') ||
      currentPath === '/roles' ||
      currentPath.startsWith('/roles/') ||
      currentPath === '/users' ||
      currentPath.startsWith('/users/')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Generates breadcrumb trails dynamically based on URL pathname.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (!pathname || pathname === '/' || pathname === '/dashboard') {
    return [{ label: 'Home' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];

  let accumulatedPath = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    accumulatedPath += `/${segment}`;

    const isLast = i === segments.length - 1;

    let label = segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    if (segment.toLowerCase() === 'roles') {
      label = 'Roles';
    } else if (segment.toLowerCase() === 'my-jobs') {
      label = 'My Jobs';
    } else if (segment.toLowerCase() === 'dashboards') {
      label = 'Dashboards';
    }

    crumbs.push({
      label,
      href: isLast ? undefined : accumulatedPath,
    });
  }

  return crumbs;
}

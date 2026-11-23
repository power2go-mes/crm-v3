import { describe, it, expect } from 'vitest';
import {
  NAVIGATION_CONFIG,
  ROUTE_PERMISSIONS_MAP,
  getAuthorizedNavigation,
  isNavItemActive,
  getBreadcrumbs,
} from '../config';

describe('FINLONEXA CRM v3 — Navigation & Sidebar Structure Upgrade Tests', () => {
  it('1. Verifies exact required navigation hierarchy, ordering, and labels', () => {
    // Top-level structure verification
    expect(NAVIGATION_CONFIG.length).toBe(7);

    // 1. Home (standalone)
    expect(NAVIGATION_CONFIG[0].id).toBe('home');
    expect(NAVIGATION_CONFIG[0].title).toBe('');
    expect(NAVIGATION_CONFIG[0].items).toHaveLength(1);
    expect(NAVIGATION_CONFIG[0].items[0].label).toBe('Home');
    expect(NAVIGATION_CONFIG[0].items[0].href).toBe('/');

    // 2. Sales (Section: Leads, Campaigns, Opportunities, Forecast)
    expect(NAVIGATION_CONFIG[1].id).toBe('sales');
    expect(NAVIGATION_CONFIG[1].title).toBe('Sales');
    expect(NAVIGATION_CONFIG[1].items.map((i) => i.label)).toEqual([
      'Leads',
      'Campaigns',
      'Opportunities',
      'Forecast',
    ]);
    expect(NAVIGATION_CONFIG[1].items.map((i) => i.href)).toEqual([
      '/leads',
      '/campaigns',
      '/opportunities',
      '/forecast',
    ]);

    // 3. People (Section: Accounts, Contacts)
    expect(NAVIGATION_CONFIG[2].id).toBe('people');
    expect(NAVIGATION_CONFIG[2].title).toBe('People');
    expect(NAVIGATION_CONFIG[2].items.map((i) => i.label)).toEqual([
      'Accounts',
      'Contacts',
    ]);
    expect(NAVIGATION_CONFIG[2].items.map((i) => i.href)).toEqual([
      '/accounts',
      '/contacts',
    ]);

    // 4. Analytics (Section: Reports, Dashboards)
    expect(NAVIGATION_CONFIG[3].id).toBe('analytics');
    expect(NAVIGATION_CONFIG[3].title).toBe('Analytics');
    expect(NAVIGATION_CONFIG[3].items.map((i) => i.label)).toEqual([
      'Reports',
      'Dashboards',
    ]);
    expect(NAVIGATION_CONFIG[3].items.map((i) => i.href)).toEqual([
      '/reports',
      '/dashboards',
    ]);

    // 5. Schedule (Section: Calendar, Activities)
    expect(NAVIGATION_CONFIG[4].id).toBe('schedule');
    expect(NAVIGATION_CONFIG[4].title).toBe('Schedule');
    expect(NAVIGATION_CONFIG[4].items.map((i) => i.label)).toEqual([
      'Calendar',
      'Activities',
    ]);
    expect(NAVIGATION_CONFIG[4].items.map((i) => i.href)).toEqual([
      '/calendar',
      '/activities',
    ]);

    // 6. My Jobs (standalone)
    expect(NAVIGATION_CONFIG[5].id).toBe('my-jobs');
    expect(NAVIGATION_CONFIG[5].title).toBe('');
    expect(NAVIGATION_CONFIG[5].items).toHaveLength(1);
    expect(NAVIGATION_CONFIG[5].items[0].label).toBe('My Jobs');
    expect(NAVIGATION_CONFIG[5].items[0].href).toBe('/my-jobs');

    // 7. Settings (standalone)
    expect(NAVIGATION_CONFIG[6].id).toBe('settings');
    expect(NAVIGATION_CONFIG[6].title).toBe('');
    expect(NAVIGATION_CONFIG[6].items).toHaveLength(1);
    expect(NAVIGATION_CONFIG[6].items[0].label).toBe('Settings');
    expect(NAVIGATION_CONFIG[6].items[0].href).toBe('/settings');

    // Confirm Tasks, Calls, Meetings, Users are NOT top-level navigation items
    const allTopLabels = NAVIGATION_CONFIG.flatMap((g) => g.items.map((i) => i.label));
    expect(allTopLabels).not.toContain('Tasks');
    expect(allTopLabels).not.toContain('Calls');
    expect(allTopLabels).not.toContain('Meetings');
    expect(allTopLabels).not.toContain('Users');
    expect(allTopLabels).not.toContain('Notifications');
  });

  it('2. Enforces centralized route permissions mapping for all core and sub-routes', () => {
    expect(ROUTE_PERMISSIONS_MAP['/']).toBe('dashboard.view');
    expect(ROUTE_PERMISSIONS_MAP['/leads']).toBe('leads.view');
    expect(ROUTE_PERMISSIONS_MAP['/campaigns']).toBe('campaigns.view');
    expect(ROUTE_PERMISSIONS_MAP['/opportunities']).toBe('opportunities.view');
    expect(ROUTE_PERMISSIONS_MAP['/forecast']).toBe('opportunities.view');
    expect(ROUTE_PERMISSIONS_MAP['/accounts']).toBe('accounts.view');
    expect(ROUTE_PERMISSIONS_MAP['/contacts']).toBe('contacts.view');
    expect(ROUTE_PERMISSIONS_MAP['/reports']).toBe('reports.view');
    expect(ROUTE_PERMISSIONS_MAP['/dashboards']).toBe('dashboard.view');
    expect(ROUTE_PERMISSIONS_MAP['/calendar']).toBe('meetings.view');
    expect(ROUTE_PERMISSIONS_MAP['/activities']).toBe('tasks.view');
    expect(ROUTE_PERMISSIONS_MAP['/my-jobs']).toBe('tasks.view');
    expect(ROUTE_PERMISSIONS_MAP['/settings']).toBe('settings.view');

    // Sub-routes retain permission mapping
    expect(ROUTE_PERMISSIONS_MAP['/tasks']).toBe('tasks.view');
    expect(ROUTE_PERMISSIONS_MAP['/calls']).toBe('calls.view');
    expect(ROUTE_PERMISSIONS_MAP['/meetings']).toBe('meetings.view');
    expect(ROUTE_PERMISSIONS_MAP['/users']).toBe('users.view');
    expect(ROUTE_PERMISSIONS_MAP['/settings/roles']).toBe('roles.view');
  });

  it('3. Filters navigation items dynamically based on effective permissions', () => {
    // 1. User with no permissions sees empty navigation
    const emptyNav = getAuthorizedNavigation([], true);
    expect(emptyNav.length).toBe(0);

    // 2. User with all permissions sees all 7 groups and 13 items
    const allPermissions = [
      'dashboard.view',
      'leads.view',
      'campaigns.view',
      'opportunities.view',
      'accounts.view',
      'contacts.view',
      'reports.view',
      'meetings.view',
      'tasks.view',
      'calls.view',
      'settings.view',
    ];
    const fullNav = getAuthorizedNavigation(allPermissions, true);
    expect(fullNav.length).toBe(7);
    const fullRoutes = fullNav.flatMap((g) => g.items.map((i) => i.href));
    expect(fullRoutes).toEqual([
      '/',
      '/leads',
      '/campaigns',
      '/opportunities',
      '/forecast',
      '/accounts',
      '/contacts',
      '/reports',
      '/dashboards',
      '/calendar',
      '/activities',
      '/my-jobs',
      '/settings',
    ]);

    // 3. User with only leads.view and accounts.view sees only Sales (with Leads) and People (with Accounts)
    const limitedNav = getAuthorizedNavigation(['leads.view', 'accounts.view'], false);
    expect(limitedNav.length).toBe(2);
    expect(limitedNav[0].title).toBe('Sales');
    expect(limitedNav[0].items.map((i) => i.href)).toEqual(['/leads']);
    expect(limitedNav[1].title).toBe('People');
    expect(limitedNav[1].items.map((i) => i.href)).toEqual(['/accounts']);

    // Sections with no authorized items are completely hidden
    const sectionTitles = limitedNav.map((g) => g.title);
    expect(sectionTitles).not.toContain('Analytics');
    expect(sectionTitles).not.toContain('Schedule');
  });

  it('4. Correctly matches active routes including nested records and sub-workflows', () => {
    const homeItem = NAVIGATION_CONFIG[0].items[0];
    const leadsItem = NAVIGATION_CONFIG[1].items[0];
    const campaignsItem = NAVIGATION_CONFIG[1].items[1];
    const oppsItem = NAVIGATION_CONFIG[1].items[2];
    const forecastItem = NAVIGATION_CONFIG[1].items[3];
    const accountsItem = NAVIGATION_CONFIG[2].items[0];
    const contactsItem = NAVIGATION_CONFIG[2].items[1];
    const reportsItem = NAVIGATION_CONFIG[3].items[0];
    const dashboardsItem = NAVIGATION_CONFIG[3].items[1];
    const calendarItem = NAVIGATION_CONFIG[4].items[0];
    const activitiesItem = NAVIGATION_CONFIG[4].items[1];
    const myJobsItem = NAVIGATION_CONFIG[5].items[0];
    const settingsItem = NAVIGATION_CONFIG[6].items[0];

    // Home active only on '/'
    expect(isNavItemActive('/', homeItem)).toBe(true);
    expect(isNavItemActive('/leads', homeItem)).toBe(false);
    expect(isNavItemActive('/dashboards', homeItem)).toBe(false);

    // Leads active on /leads and /leads/123
    expect(isNavItemActive('/leads', leadsItem)).toBe(true);
    expect(isNavItemActive('/leads/123', leadsItem)).toBe(true);
    expect(isNavItemActive('/leads-archive', leadsItem)).toBe(false);

    // Campaigns active on /campaigns/123
    expect(isNavItemActive('/campaigns/123', campaignsItem)).toBe(true);

    // Accounts & Contacts active on detail views
    expect(isNavItemActive('/accounts/123', accountsItem)).toBe(true);
    expect(isNavItemActive('/contacts/123', contactsItem)).toBe(true);

    // Opportunities active on /opportunities/123
    expect(isNavItemActive('/opportunities/123', oppsItem)).toBe(true);

    // Reports active on /reports/123
    expect(isNavItemActive('/reports/123', reportsItem)).toBe(true);

    // Dashboards active on /dashboards and /dashboard
    expect(isNavItemActive('/dashboards', dashboardsItem)).toBe(true);
    expect(isNavItemActive('/dashboard', dashboardsItem)).toBe(true);
    expect(isNavItemActive('/dashboards/456', dashboardsItem)).toBe(true);

    // Calendar active on /calendar
    expect(isNavItemActive('/calendar', calendarItem)).toBe(true);

    // Activities active on /activities, /tasks, /calls, /meetings and detail views
    expect(isNavItemActive('/activities', activitiesItem)).toBe(true);
    expect(isNavItemActive('/tasks', activitiesItem)).toBe(true);
    expect(isNavItemActive('/tasks/123', activitiesItem)).toBe(true);
    expect(isNavItemActive('/calls/456', activitiesItem)).toBe(true);
    expect(isNavItemActive('/meetings/789', activitiesItem)).toBe(true);

    // My Jobs active on /my-jobs
    expect(isNavItemActive('/my-jobs', myJobsItem)).toBe(true);

    // Settings active on /settings, /settings/roles, /roles, /users
    expect(isNavItemActive('/settings', settingsItem)).toBe(true);
    expect(isNavItemActive('/settings/roles', settingsItem)).toBe(true);
    expect(isNavItemActive('/roles', settingsItem)).toBe(true);
    expect(isNavItemActive('/users', settingsItem)).toBe(true);

    // Forecast active on /forecast and /sales-performance
    expect(isNavItemActive('/forecast', forecastItem)).toBe(true);
    expect(isNavItemActive('/sales-performance', forecastItem)).toBe(true);
  });

  it('5. Generates consistent breadcrumb trails for new and existing CRM paths', () => {
    expect(getBreadcrumbs('/')).toEqual([{ label: 'Home' }]);
    expect(getBreadcrumbs('/leads')).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Leads', href: undefined },
    ]);
    expect(getBreadcrumbs('/forecast')).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Forecast', href: undefined },
    ]);
    expect(getBreadcrumbs('/dashboards')).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Dashboards', href: undefined },
    ]);
    expect(getBreadcrumbs('/my-jobs')).toEqual([
      { label: 'Home', href: '/' },
      { label: 'My Jobs', href: undefined },
    ]);
  });
});

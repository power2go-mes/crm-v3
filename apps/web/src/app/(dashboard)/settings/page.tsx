'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  Building2,
  ArrowRight,
  CheckCircle2,
  Settings,
  MapPin,
  Database,
  History,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { CompanySettingsModal } from '@/components/settings/company-settings-modal';
import { SalesRegionsManager } from '@/components/settings/sales-regions-manager';
import { CustomFieldsManager } from '@/components/settings/custom-fields-manager';
import { SystemAuditLogViewer } from '@/components/settings/system-audit-log-viewer';

function SettingsContent() {
  const { user, profile, hasPermission, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const selectedTab = params.get('tab');
  const activeTab = ['company', 'regions', 'fields', 'audit'].includes(selectedTab ?? '') ? selectedTab : 'company';
  function setActiveTab(tab: string) { const query = new URLSearchParams(params.toString()); if (tab === 'company') query.delete('tab'); else query.set('tab', tab); router.push(`/settings${query.size ? '?' + query.toString() : ''}`, { scroll: false }); }
  const [settingsSearch, setSettingsSearch] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const company = useQuery({
    queryKey: ['crm', user?.id, 'company-settings'],
    enabled: !isLoading && !!user && !!profile?.is_active && hasPermission('settings.view'),
    queryFn: async () => {
      const result = await createClient()
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (result.error) throw new Error('Company settings could not be loaded.');
      return result.data;
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Settings & System Administration"
        subtitle="Manage singleton company parameters, sales regions, custom metadata schemas, and system security policies."
        actions={
          hasPermission('settings.update') && activeTab === 'company' ? (
            <button
              disabled={company.isPending || company.isError || !company.data}
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#4361ee]"
            >
              <Settings className="h-4 w-4" />
              <span>Edit Company Settings</span>
            </button>
          ) : undefined
        }
      />

      <PermissionGate action="settings.view" showAccessDenied>
        <div className="space-y-6">
          {/* Quick Nav to Role Manager Banner */}
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#3a5bf0] to-[#4361ee] p-6 text-white shadow-sm sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Active System Manager
              </div>
              <h3 className="text-lg font-bold">Dynamic Role & Permission Manager</h3>
              <p className="mt-1 max-w-xl text-xs text-indigo-100">
                Configure module action permissions across canonical and custom roles. Enforce sales hierarchy and BDO restrictions in real time.
              </p>
            </div>
            {hasPermission('roles.view') && <Link
              href="/settings/roles"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-xs transition hover:bg-slate-100"
            >
              <span>Manage Roles</span>
              <ArrowRight className="h-4 w-4" />
            </Link>}
          </div>

          {/* Navigation Tabs */}
          <label className="block text-sm"><span className="sr-only">Search settings</span><input type="search" placeholder="Search settings..." value={settingsSearch} onChange={event => setSettingsSearch(event.target.value)} className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
          {settingsSearch.trim() && <ul className="rounded-lg border bg-white p-3 text-sm">{[
            { label: 'Company Information', href: '/settings', permission: 'settings.view' },
            { label: 'Sales Regions', href: '/settings?tab=regions', permission: 'settings.view' },
            { label: 'Custom Fields', href: '/settings?tab=fields', permission: 'settings.view' },
            { label: 'System Audit Logs', href: '/settings?tab=audit', permission: 'settings.view' },
            { label: 'Roles and Permissions', href: '/settings/roles', permission: 'roles.view' },
            { label: 'Departments', href: '/settings/departments', permission: 'departments.view' },
            { label: 'Customer Roles', href: '/settings/customer-roles', permission: 'settings.view' },
            { label: 'Team Roles', href: '/settings/team-roles', permission: 'settings.view' },
            { label: 'Partner Roles', href: '/settings/partner-roles', permission: 'settings.view' },
            { label: 'Business hours', href: '/settings/business-hours', permission: 'business_hours.view' },
            { label: 'Holidays', href: '/settings/holidays', permission: 'holidays.view' },
            { label: 'Shift hours', href: '/settings/business-hours?tab=shifts', permission: 'business_hours.view' },
            { label: 'Currency Management', href: '/settings/currencies', permission: 'currencies.view' },
            { label: 'Field Requirements', href: '/settings/field-requirements', permission: 'settings.view' },
            { label: 'Import Data', href: '/settings/imports', permission: 'imports.view' },
            { label: 'Export Data', href: '/settings/exports', permission: 'exports.view' },
            { label: 'Login History', href: '/settings/login-history', permission: 'login_history.view_team' },
            { label: 'Recycle Bin', href: '/settings/recycle-bin', permission: 'recycle_bin.view' },
            { label: 'Lead Pipeline Stages', href: '/settings/lead-stages', permission: 'leads.view' },
            { label: 'Lead Assignment Rules', href: '/settings/lead-assignment', permission: 'leads.view' },
            { label: 'Product Catalog', href: '/settings/products', permission: 'products.view' },
            { label: 'Price Books', href: '/settings/products/price-books', permission: 'price_books.view' },
            { label: 'Data Quality & Deduplication', href: '/settings/data-quality', permission: 'settings.view' },
            { label: 'Sales Targets & Quotas', href: '/settings/sales-targets', permission: 'settings.view' },
            { label: 'Email Integration & Templates', href: '/settings/email', permission: 'settings.view' },
            { label: 'Sales Workflow Automation', href: '/settings/automation', permission: 'settings.view' },
            { label: 'Calendar Synchronization', href: '/settings/calendar', permission: 'settings.view' },
          ].filter(item => hasPermission(item.permission) && (item.href !== '/settings/login-history' || hasPermission('users.view')) && item.label.toLowerCase().includes(settingsSearch.trim().toLowerCase())).map(item => <li className="p-1" key={item.href}><Link href={item.href} onClick={() => setSettingsSearch('')}>{item.label}</Link></li>)}</ul>}
          {hasPermission('products.view') && <Link href="/settings/products" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Products &amp; Catalog</Link>}
          {hasPermission('price_books.view') && <Link href="/settings/products/price-books" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Price Books</Link>}
          <Link href="/settings/email" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Email &amp; Templates</Link>
          <Link href="/settings/automation" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Workflow Automation</Link>
          <Link href="/settings/calendar" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Calendar Sync</Link>
          <Link href="/settings/data-quality" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Data Quality &amp; Deduplication</Link>
          <Link href="/settings/sales-targets" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Sales Targets &amp; Quotas</Link>
          {hasPermission('departments.view') && <Link href="/settings/departments" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Departments</Link>}
          {hasPermission('business_hours.view') && <Link href="/settings/business-hours" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Business hours</Link>}
          {hasPermission('holidays.view') && <Link href="/settings/holidays" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Holidays</Link>}
          {hasPermission('currencies.view') && <Link href="/settings/currencies" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Currency Management</Link>}
          {(['customer', 'team', 'partner'] as const).map(kind => <Link key={kind} href={`/settings/${kind}-roles`} className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">{kind === 'customer' ? 'Customer' : kind === 'team' ? 'Team' : 'Partner'} Roles</Link>)}
          <Link href="/settings/field-requirements" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Field Requirements</Link>
          {hasPermission('imports.view') && <Link href="/settings/imports" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Import Data</Link>}
          {hasPermission('exports.view') && <Link href="/settings/exports" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Export Data</Link>}
          {hasPermission('login_history.view_team') && hasPermission('users.view') && <Link href="/settings/login-history" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Login History</Link>}
          {hasPermission('recycle_bin.view') && <Link href="/settings/recycle-bin" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Recycle Bin</Link>}
          {hasPermission('leads.view') && <Link href="/settings/lead-stages" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Lead Stages</Link>}
          {hasPermission('leads.view') && <Link href="/settings/lead-assignment" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">Lead Assignment</Link>}
          <div className="flex border-b border-slate-800 space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('company')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
                activeTab === 'company'
                  ? 'border-indigo-100 text-[#4361ee]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Company Parameters</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('regions')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
                activeTab === 'regions'
                  ? 'border-indigo-100 text-[#4361ee]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Sales Regions & Territories</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fields')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
                activeTab === 'fields'
                  ? 'border-indigo-100 text-[#4361ee]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Custom Fields Registry</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
                activeTab === 'audit'
                  ? 'border-indigo-100 text-[#4361ee]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>System Audit Logs</span>
            </button>
          </div>

          {/* Tab 1: Company Parameters */}
          {activeTab === 'company' && (
            <div className="max-w-4xl space-y-6">
              {company.isLoading && <p role="status">Loading settings...</p>}
              {company.isError && (
                <p role="alert">
                  Company settings could not be loaded.{' '}
                  <button onClick={() => void company.refetch()}>Retry</button>
                </p>
              )}

              {/* Singleton Company Configuration Card */}
              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#eef2ff] p-2.5 text-[#4361ee] dark:bg-indigo-950/40 dark:text-[#4361ee]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Organization Parameters
                      </h3>
                      <p className="text-xs text-slate-500">
                        Strict Single-Company Singleton (FINLONEXA, ID = 1)
                      </p>
                    </div>
                  </div>

                  {hasPermission('settings.update') && (
                    <button
                      disabled={company.isPending || company.isError || !company.data}
                      onClick={() => setIsEditModalOpen(true)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Edit Parameters
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2">
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Company Name</span>
                    <p className="text-sm font-bold text-slate-800">
                      {company.data?.company_name ?? 'Unavailable'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Multi-Tenancy Mode</span>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-[#4361ee] dark:text-[#4361ee]">
                      <CheckCircle2 className="h-4 w-4" /> Single-Company Architecture
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Operational Currency</span>
                    <p className="font-mono text-sm font-bold text-slate-800">
                      {company.data?.currency ?? 'Unavailable'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Time Zone</span>
                    <p className="font-mono text-sm font-bold text-slate-800">
                      {company.data?.time_zone ?? 'Unavailable'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Legal Name</span>
                    <p className="text-sm font-medium text-slate-800">
                      {company.data?.legal_name || 'Not configured'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Corporate Domain</span>
                    <p className="text-sm font-medium text-slate-800">
                      {company.data?.domain || 'Not configured'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Support Email</span>
                    <p className="text-sm font-medium text-slate-800">
                      {company.data?.support_email || 'Not configured'}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:bg-slate-800/50">
                    <span className="font-medium text-slate-400">Phone Number</span>
                    <p className="text-sm font-medium text-slate-800">
                      {company.data?.phone_number || 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Sales Regions */}
          {activeTab === 'regions' && <SalesRegionsManager />}

          {/* Tab 3: Custom Fields */}
          {activeTab === 'fields' && <CustomFieldsManager />}

          {/* Tab 4: System Audit Logs */}
          {activeTab === 'audit' && <SystemAuditLogViewer />}
        </div>

        {/* Modal */}
        {isEditModalOpen && company.data && !company.isError && (
          <CompanySettingsModal
            settings={company.data ?? null}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            userId={user?.id}
          />
        )}
      </PermissionGate>
    </PageContainer>
  );
}

export default function SettingsPage() { return <Suspense fallback={<p role="status">Loading Settings…</p>}><SettingsContent /></Suspense>; }

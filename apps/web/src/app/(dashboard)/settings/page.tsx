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
  Search,
  Users,
  Layers,
  Sparkles,
  Lock,
  Mail,
  Zap,
  Calendar,
  Globe,
  Sliders,
  DollarSign,
  Briefcase,
  BookOpen,
  FileSpreadsheet,
  Clock,
  Trash2,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { CompanySettingsModal } from '@/components/settings/company-settings-modal';
import { SalesRegionsManager } from '@/components/settings/sales-regions-manager';
import { CustomFieldsManager } from '@/components/settings/custom-fields-manager';
import { SystemAuditLogViewer } from '@/components/settings/system-audit-log-viewer';

const SETTINGS_CATEGORIES = [
  {
    category: 'System & Security',
    items: [
      { label: 'Roles & Permissions', desc: 'Granular RBAC, hierarchies, & BDO access', href: '/settings/roles', icon: Shield, permission: 'roles.view' },
      { label: 'Departments', desc: 'Business units & divisional hierarchy', href: '/settings/departments', icon: Users, permission: 'departments.view' },
      { label: 'Login History', desc: 'Active sessions & authentication events', href: '/settings/login-history', icon: History, permission: 'login_history.view_team' },
      { label: 'Recycle Bin', desc: 'Soft-deleted records recovery hub', href: '/settings/recycle-bin', icon: Trash2, permission: 'recycle_bin.view' },
    ],
  },
  {
    category: 'Sales & Pipeline Automation',
    items: [
      { label: 'Lead Pipeline Stages', desc: 'Stages, conversion rates, & color badges', href: '/settings/lead-stages', icon: Layers, permission: 'leads.view' },
      { label: 'Lead Assignment Rules', desc: 'Automated round-robin & rule assignment', href: '/settings/lead-assignment', icon: UserCheck, permission: 'leads.view' },
      { label: 'Sales Targets & Quotas', desc: 'Revenue targets, rep goals, & progress tracking', href: '/settings/sales-targets', icon: DollarSign, permission: 'settings.view' },
      { label: 'Workflow Automation', desc: 'Event-triggered automations & webhooks', href: '/settings/automation', icon: Zap, permission: 'settings.view' },
    ],
  },
  {
    category: 'Products & Catalogs',
    items: [
      { label: 'Products Catalog', desc: 'SKUs, pricing tiers, & inventory items', href: '/settings/products', icon: BookOpen, permission: 'products.view' },
      { label: 'Price Books', desc: 'Curated price schedules & currency variants', href: '/settings/products/price-books', icon: FileSpreadsheet, permission: 'price_books.view' },
      { label: 'Currency Management', desc: 'Multi-currency conversion rates & ISO codes', href: '/settings/currencies', icon: DollarSign, permission: 'currencies.view' },
    ],
  },
  {
    category: 'Data & Integrations',
    items: [
      { label: 'Data Quality & Deduplication', desc: 'Duplicate detection rules & auto-merge', href: '/settings/data-quality', icon: Sparkles, permission: 'settings.view' },
      { label: 'Field Requirements', desc: 'Required fields and layout schemas', href: '/settings/field-requirements', icon: Sliders, permission: 'settings.view' },
      { label: 'Email Integration', desc: 'SMTP, IMAP, & synchronized outbound mail', href: '/settings/email', icon: Mail, permission: 'settings.view' },
      { label: 'Calendar Synchronization', desc: 'Google & Outlook bidirectional sync', href: '/settings/calendar', icon: Calendar, permission: 'settings.view' },
      { label: 'Import Data', desc: 'Bulk CSV / Excel record ingestion wizard', href: '/settings/imports', icon: Globe, permission: 'imports.view' },
      { label: 'Export Data', desc: 'Audited enterprise data backups & dumps', href: '/settings/exports', icon: FileSpreadsheet, permission: 'exports.view' },
    ],
  },
  {
    category: 'Workforce & Schedule',
    items: [
      { label: 'Business Hours', desc: 'Company operating hours & SLA clocks', href: '/settings/business-hours', icon: Clock, permission: 'business_hours.view' },
      { label: 'Public Holidays', desc: 'Statutory non-working days & closures', href: '/settings/holidays', icon: Calendar, permission: 'holidays.view' },
      { label: 'Customer Roles', desc: 'Client account relationship matrix', href: '/settings/customer-roles', icon: Users, permission: 'settings.view' },
      { label: 'Team Roles', desc: 'Internal cross-functional team roles', href: '/settings/team-roles', icon: Users, permission: 'settings.view' },
      { label: 'Partner Roles', desc: 'Affiliate & external channel stakeholder roles', href: '/settings/partner-roles', icon: Users, permission: 'settings.view' },
    ],
  },
];

function SettingsContent() {
  const { user, profile, hasPermission, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const selectedTab = params.get('tab');
  const activeTab = ['company', 'regions', 'fields', 'audit', 'modules'].includes(selectedTab ?? '') ? selectedTab : 'company';

  function setActiveTab(tab: string) {
    const query = new URLSearchParams(params.toString());
    if (tab === 'company') query.delete('tab');
    else query.set('tab', tab);
    router.push(`/settings${query.size ? '?' + query.toString() : ''}`, { scroll: false });
  }

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
    <PageContainer maxWidth="full">
      <PermissionGate action="settings.view" showAccessDenied>
        <div className="space-y-6">
          {/* Hero Banner with CRMHUB Cobalt Gradient & Rounded-3xl */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-[#3a5bf0] via-[#4361ee] to-[#4895ef] p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold uppercase tracking-wider text-white mb-3">
                  <Shield className="h-3.5 w-3.5" />
                  System Governance & Administration
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Organization & Security Center
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-indigo-100 font-medium leading-relaxed">
                  Configure singleton corporate parameters, custom entity schemas, dynamic role matrix, and automated data governance policies.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {hasPermission('roles.view') && (
                  <Link
                    href="/settings/roles"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-800 rounded-2xl text-xs font-bold shadow-md hover:bg-slate-50 transition active:scale-95"
                  >
                    <span>Manage Roles</span>
                    <ArrowRight className="h-4 w-4 text-[#4361ee]" />
                  </Link>
                )}
                {hasPermission('settings.update') && activeTab === 'company' && (
                  <button
                    disabled={company.isPending || company.isError || !company.data}
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white rounded-2xl text-xs font-bold transition"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Edit Company</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pill Navigation Tabs Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('company')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'company'
                    ? 'bg-[#4361ee] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Company Parameters</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('modules')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'modules'
                    ? 'bg-[#4361ee] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Modules Directory</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('regions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'regions'
                    ? 'bg-[#4361ee] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Sales Regions</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fields')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'fields'
                    ? 'bg-[#4361ee] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Custom Fields</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'audit'
                    ? 'bg-[#4361ee] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>System Audit Logs</span>
              </button>
            </div>

            {/* Quick Filter Search */}
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="search"
                placeholder="Search settings..."
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#f8faff] border border-slate-200/80 rounded-xl text-xs text-slate-700 placeholder-slate-400 outline-none focus:bg-white focus:ring-1 focus:ring-[#4361ee] transition"
              />
            </div>
          </div>

          {/* Quick Search Autocomplete Results */}
          {settingsSearch.trim() && (
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-2xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Matching Settings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SETTINGS_CATEGORIES.flatMap((c) => c.items)
                  .filter((item) => hasPermission(item.permission) && item.label.toLowerCase().includes(settingsSearch.trim().toLowerCase()))
                  .map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSettingsSearch('')}
                        className="group flex items-start gap-3 p-3.5 rounded-2xl border border-slate-100 bg-[#f8faff] hover:bg-white hover:border-indigo-100 hover:shadow-md transition"
                      >
                        <div className="p-2 rounded-xl bg-white group-hover:bg-[#eef2ff] text-[#4361ee] shadow-2xs transition">
                          <ItemIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 group-hover:text-[#4361ee] transition">{item.label}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Tab 1: Company Parameters */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              {company.isLoading && <p role="status" className="text-xs text-slate-400 py-4">Loading organization parameters...</p>}
              {company.isError && (
                <p role="alert" className="text-xs text-rose-500 py-4">
                  Company settings could not be loaded.{' '}
                  <button onClick={() => void company.refetch()} className="underline ml-1">Retry</button>
                </p>
              )}

              {/* Singleton Company Configuration Card */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-[#eef2ff] text-[#4361ee] flex items-center justify-center font-bold shadow-2xs">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {company.data?.company_name ?? 'FINLONEXA CRM'}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Singleton Organization Identity (System ID = 1)
                      </p>
                    </div>
                  </div>

                  {hasPermission('settings.update') && (
                    <button
                      disabled={company.isPending || company.isError || !company.data}
                      onClick={() => setIsEditModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4361ee] hover:bg-[#3a5bf0] text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-500/20 active:scale-95"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Edit Parameters</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Multi-Tenancy</span>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#4361ee]">
                      <CheckCircle2 className="h-4 w-4" /> Single-Tenant Instance
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Base Currency</span>
                    <p className="text-sm font-bold text-slate-800">
                      {company.data?.currency ?? 'USD ($)'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Default Time Zone</span>
                    <p className="text-sm font-bold text-slate-800">
                      {company.data?.time_zone ?? 'UTC'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Corporate Domain</span>
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {company.data?.domain || 'crm.finlonexa.com'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Legal Entity</span>
                    <p className="text-xs font-semibold text-slate-700">
                      {company.data?.legal_name || 'Finlonexa Technologies Inc.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Support Channel</span>
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {company.data?.support_email || 'support@finlonexa.com'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact Phone</span>
                    <p className="text-xs font-semibold text-slate-700">
                      {company.data?.phone_number || '+1 (555) 019-2834'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f8faff] border border-slate-100/90 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Instance Status</span>
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#4361ee]">
                      <span className="h-2 w-2 rounded-full bg-[#4361ee] animate-pulse" /> Production Ready
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Modules Directory Grid */}
          {activeTab === 'modules' && (
            <div className="space-y-6">
              {SETTINGS_CATEGORIES.map((cat) => (
                <div key={cat.category} className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">{cat.category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {cat.items
                      .filter((item) => hasPermission(item.permission) && (item.href !== '/settings/login-history' || hasPermission('users.view')))
                      .map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="group flex flex-col justify-between p-5 rounded-3xl bg-white border border-slate-100 hover:border-indigo-100 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition duration-150"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="h-10 w-10 rounded-2xl bg-[#f8faff] group-hover:bg-[#eef2ff] text-slate-600 group-hover:text-[#4361ee] flex items-center justify-center transition">
                                <ItemIcon className="h-5 w-5" />
                              </div>
                              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#4361ee] group-hover:translate-x-0.5 transition" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 group-hover:text-[#4361ee] transition">
                                {item.label}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Sales Regions */}
          {activeTab === 'regions' && <SalesRegionsManager />}

          {/* Tab 4: Custom Fields */}
          {activeTab === 'fields' && <CustomFieldsManager />}

          {/* Tab 5: System Audit Logs */}
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

export default function SettingsPage() {
  return (
    <Suspense fallback={<p role="status" className="text-xs text-slate-400 p-6">Loading Settings…</p>}>
      <SettingsContent />
    </Suspense>
  );
}

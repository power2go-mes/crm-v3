'use client';

import React, { useState } from 'react';
import type { AccountWithRelations } from '@/types/accounts';
import Link from 'next/link';
import {
  Building2,
  DollarSign,
  Globe,
  Phone,
  ArrowRight,
  Layers,
  Inbox,
  Briefcase,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

interface AccountKanbanBoardProps {
  accounts: AccountWithRelations[];
  isLoading?: boolean;
  onAccountClick?: (account: AccountWithRelations) => void;
}

// Canonical account categories for Kanban grouping
const ACCOUNT_TIERS = [
  { id: 'enterprise', name: 'Enterprise', color: '#6366f1', minRev: 500000 },
  { id: 'mid_market', name: 'Mid-Market', color: '#0ea5e9', minRev: 100000 },
  { id: 'commercial', name: 'Commercial', color: '#10b981', minRev: 25000 },
  { id: 'growth', name: 'Growth', color: '#f59e0b', minRev: 0 },
  { id: 'prospect', name: 'Prospect / Unclassified', color: '#94a3b8', minRev: -1 },
] as const;

function categorizeAccount(acc: AccountWithRelations): string {
  const rev = Number(acc.annual_revenue) || 0;
  const type = (acc.account_type || '').toLowerCase();
  if (type.includes('enterprise') || rev >= 500000) return 'enterprise';
  if (type.includes('mid') || rev >= 100000) return 'mid_market';
  if (type.includes('commercial') || rev >= 25000) return 'commercial';
  if (rev > 0) return 'growth';
  return 'prospect';
}

function formatRevenue(val: number | string | null | undefined): string | null {
  if (val == null || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num) || num <= 0) return null;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}k`;
  return `$${num.toLocaleString()}`;
}

function getAvatarProps(name: string) {
  const clean = name.trim().toUpperCase();
  const initials = clean ? clean.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'U';
  const hues = [
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-purple-100 text-purple-800 border-purple-200',
  ];
  let sum = 0;
  for (let i = 0; i < clean.length; i++) sum += clean.charCodeAt(i);
  return { initials, colorClass: hues[sum % hues.length] };
}

export function AccountKanbanBoard({
  accounts,
  isLoading = false,
  onAccountClick,
}: AccountKanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Group accounts by Tier
  const grouped = ACCOUNT_TIERS.reduce<Record<string, AccountWithRelations[]>>((acc, tier) => {
    acc[tier.id] = accounts.filter((a) => categorizeAccount(a) === tier.id);
    return acc;
  }, {});

  const totalRevenue = accounts.reduce((sum, a) => sum + (Number(a.annual_revenue) || 0), 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 min-h-[640px]">
        {ACCOUNT_TIERS.map((s) => (
          <div key={s.id} className="flex flex-col bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-20 mb-3.5" />
            <div className="space-y-3 flex-1">
              <div className="h-28 bg-white rounded-xl border border-slate-200/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Board Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Accounts Portfolio
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {accounts.length} active account{accounts.length === 1 ? '' : 's'} across {ACCOUNT_TIERS.length} business tiers
              </span>
            </div>
          </div>
        </div>

        {totalRevenue > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200/80 shadow-2xs text-xs font-semibold text-slate-700">
            <span className="text-slate-400 uppercase text-[10px] tracking-wide font-bold">Total Portfolio Revenue:</span>
            <span className="text-emerald-600 font-bold">
              ${(totalRevenue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k
            </span>
          </div>
        )}
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 min-h-[640px] overflow-x-auto pb-4 scroll-smooth">
        {ACCOUNT_TIERS.map((tier) => {
          const tierAccounts = grouped[tier.id] || [];
          const tierRevenue = tierAccounts.reduce((sum, a) => sum + (Number(a.annual_revenue) || 0), 0);

          return (
            <div
              key={tier.id}
              className="flex flex-col bg-slate-50/80 border border-slate-200/70 rounded-2xl overflow-hidden shadow-xs hover:shadow-sm transition-all duration-200 flex-1 min-w-[260px] max-w-full"
            >
              {/* Header */}
              <div className="p-3.5 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: tier.color }}
                />

                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-md flex items-center justify-center text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-800 truncate">
                        {tier.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/60">
                        {tierAccounts.length}
                      </span>
                    </div>
                  </div>

                  {tierRevenue > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 shrink-0">
                      ${(tierRevenue / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-270px)]">
                {tierAccounts.length === 0 ? (
                  <div className="h-36 border border-dashed border-slate-200/90 rounded-xl bg-white/40 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100/80 flex items-center justify-center text-slate-400">
                      <Inbox className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      No {tier.name.toLowerCase()} accounts
                    </span>
                  </div>
                ) : (
                  tierAccounts.map((acc) => {
                    const formattedRev = formatRevenue(acc.annual_revenue);
                    const isSelected = activeCardId === acc.id;
                    const ownerName = acc.account_owner
                      ? `${acc.account_owner.first_name || ''} ${acc.account_owner.last_name || ''}`.trim() ||
                        acc.account_owner.email.split('@')[0]
                      : null;
                    const avatar = ownerName ? getAvatarProps(ownerName) : null;

                    return (
                      <div
                        key={acc.id}
                        onClick={() => {
                          setActiveCardId(acc.id);
                          onAccountClick?.(acc);
                        }}
                        className={`group relative p-3.5 bg-white hover:bg-slate-50/50 border rounded-xl shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                            : 'border-slate-200/80 hover:border-emerald-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <Link
                            href={`/accounts/${acc.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition line-clamp-1 flex items-center gap-1.5 flex-1 min-w-0"
                            title={acc.name}
                          >
                            <span className="truncate">{acc.name}</span>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-emerald-600" />
                          </Link>

                          {acc.industry && (
                            <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 border border-slate-200/50">
                              {acc.industry}
                            </span>
                          )}
                        </div>

                        {/* Contact Channels */}
                        {(acc.website || acc.contact_number) && (
                          <div className="space-y-1 text-xs text-slate-500 bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                            {acc.website && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{acc.website.replace(/^https?:\/\//, '')}</span>
                              </div>
                            )}
                            {acc.contact_number && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{acc.contact_number}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                          {formattedRev ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 text-[11px]">
                              <DollarSign className="h-3 w-3 -mr-0.5 text-emerald-600" />
                              {formattedRev}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No revenue recorded</span>
                          )}

                          {ownerName && avatar ? (
                            <div className="flex items-center gap-1.5 shrink-0 max-w-[130px]" title={`Owner: ${ownerName}`}>
                              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${avatar.colorClass} shrink-0`}>
                                {avatar.initials}
                              </div>
                              <span className="text-[11px] text-slate-600 font-medium truncate">{ownerName}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

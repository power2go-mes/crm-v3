'use client';

import React, { useState } from 'react';
import type { ContactWithRelations } from '@/types/contacts';
import Link from 'next/link';
import {
  Users,
  Building2,
  Mail,
  Phone,
  ArrowRight,
  ShieldCheck,
  Star,
  Inbox,
  UserCheck,
} from 'lucide-react';

interface ContactKanbanBoardProps {
  contacts: ContactWithRelations[];
  isLoading?: boolean;
  onContactClick?: (contact: ContactWithRelations) => void;
}

// Canonical contact stages/categories for Kanban grouping
const CONTACT_COLUMNS = [
  { id: 'primary', name: 'Primary Contacts', color: '#10b981', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'direct', name: 'Direct / Decision Makers', color: '#6366f1', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'associated', name: 'Account Associated', color: '#0ea5e9', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'general', name: 'General Inquiries', color: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'unassigned', name: 'Unassigned Contacts', color: '#94a3b8', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
] as const;

function categorizeContact(c: ContactWithRelations): string {
  if (c.is_primary) return 'primary';
  const title = (c.title || '').toLowerCase();
  if (
    title.includes('director') ||
    title.includes('vp') ||
    title.includes('chief') ||
    title.includes('head') ||
    title.includes('manager') ||
    title.includes('owner') ||
    title.includes('founder')
  ) {
    return 'direct';
  }
  if (c.account?.name) return 'associated';
  if (c.contact_owner) return 'general';
  return 'unassigned';
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

export function ContactKanbanBoard({
  contacts,
  isLoading = false,
  onContactClick,
}: ContactKanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Group contacts
  const grouped = CONTACT_COLUMNS.reduce<Record<string, ContactWithRelations[]>>((acc, col) => {
    acc[col.id] = contacts.filter((c) => categorizeContact(c) === col.id);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-medium text-slate-400">Loading contacts pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Kanban Pipeline Subheader Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs text-xs text-slate-600">
        <div className="flex items-center gap-2 font-medium">
          <Users className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold text-slate-900">Contact Network</span>
          <span className="text-slate-400">•</span>
          <span>{contacts.length} total contacts across {CONTACT_COLUMNS.length} segments</span>
        </div>
      </div>

      {/* Kanban Columns Horizontal Canvas */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start snap-x select-none">
        {CONTACT_COLUMNS.map((col) => {
          const colItems = grouped[col.id] || [];

          return (
            <div
              key={col.id}
              className="flex flex-col shrink-0 w-[290px] sm:w-[310px] bg-slate-50/80 rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden snap-start max-h-[calc(100vh-210px)]"
            >
              {/* Column Header */}
              <div className="px-3.5 py-3 border-b border-slate-200/80 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-2xs"
                    style={{ backgroundColor: col.color }}
                  />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    {col.name}
                  </h3>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {colItems.length}
                </span>
              </div>

              {/* Column Card Stream */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[140px]">
                {colItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-200/80 rounded-xl my-1 bg-white/40">
                    <Inbox className="h-6 w-6 text-slate-300 mb-1" />
                    <p className="text-xs font-medium text-slate-400">No contacts</p>
                  </div>
                ) : (
                  colItems.map((c) => {
                    const fullName = `${c.first_name} ${c.last_name}`.trim();
                    const avatar = getAvatarProps(fullName);
                    const ownerName = c.contact_owner
                      ? `${c.contact_owner.first_name} ${c.contact_owner.last_name}`.trim()
                      : null;
                    const ownerInitials = ownerName
                      ? ownerName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                      : 'NA';

                    return (
                      <div
                        key={c.id}
                        onClick={() => onContactClick?.(c)}
                        onMouseEnter={() => setActiveCardId(c.id)}
                        onMouseLeave={() => setActiveCardId(null)}
                        className={`group relative bg-white rounded-xl border p-3.5 shadow-2xs hover:shadow-md transition-all duration-150 cursor-pointer ${
                          activeCardId === c.id
                            ? 'border-emerald-400 ring-2 ring-emerald-500/10'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Top: Name & Primary Badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold shadow-2xs ${avatar.colorClass}`}
                            >
                              {avatar.initials}
                            </span>
                            <div className="min-w-0">
                              <Link
                                href={`/contacts/${c.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="block font-semibold text-xs text-slate-900 group-hover:text-emerald-600 transition truncate"
                              >
                                {fullName}
                              </Link>
                              {c.title && (
                                <p className="text-[11px] text-slate-500 truncate">{c.title}</p>
                              )}
                            </div>
                          </div>

                          {c.is_primary && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              Primary
                            </span>
                          )}
                        </div>

                        {/* Middle: Associated Account */}
                        {c.account && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate font-medium">{c.account.name}</span>
                          </div>
                        )}

                        {/* Contacts Details: Email & Phone */}
                        <div className="space-y-1 mb-2.5 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                          {c.email && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          )}
                          {c.contact_number && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{c.contact_number}</span>
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Rep Owner & Details Link */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          {ownerName ? (
                            <div className="flex items-center gap-1.5 min-w-0" title={`Owner: ${ownerName}`}>
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600">
                                {ownerInitials}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate max-w-[120px]">
                                {ownerName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Unassigned</span>
                          )}

                          <Link
                            href={`/contacts/${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 group-hover:translate-x-0.5 transition"
                          >
                            <span>View</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
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

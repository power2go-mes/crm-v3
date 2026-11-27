'use client';

import React from 'react';

interface LeadStatusBadgeProps {
  status: string;
  className?: string;
}

export function LeadStatusBadge({ status, className = '' }: LeadStatusBadgeProps) {
  const norm = status?.toLowerCase() || 'new';

  let style = 'bg-[#eef2ff] text-[#4361ee] border-indigo-100';
  let label = 'New';

  switch (norm) {
    case 'new':
      style = 'bg-[#eef2ff] text-[#4361ee] border-indigo-100/70 font-semibold';
      label = 'New';
      break;
    case 'contacted':
      style = 'bg-purple-50 text-purple-600 border-purple-100 font-semibold';
      label = 'Contacted';
      break;
    case 'qualified':
      style = 'bg-emerald-50 text-emerald-600 border-emerald-100 font-semibold';
      label = 'Qualified';
      break;
    case 'proposal':
      style = 'bg-amber-50 text-amber-600 border-amber-100 font-semibold';
      label = 'Proposal';
      break;
    case 'lost':
      style = 'bg-rose-50 text-rose-600 border-rose-100 font-semibold';
      label = 'Lost';
      break;
    case 'convert':
    case 'converted':
      style = 'bg-[#4361ee] text-white border-transparent font-bold shadow-2xs';
      label = 'Converted';
      break;
    default:
      style = 'bg-slate-50 text-slate-700 border-slate-200/80 font-medium';
      label = status;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border ${style} ${className}`}
    >
      {label}
    </span>
  );
}

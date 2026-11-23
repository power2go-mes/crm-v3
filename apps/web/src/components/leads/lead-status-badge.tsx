'use client';

import React from 'react';

interface LeadStatusBadgeProps {
  status: string;
  className?: string;
}

export function LeadStatusBadge({ status, className = '' }: LeadStatusBadgeProps) {
  const norm = status?.toLowerCase() || 'new';

  let style = 'bg-blue-50 text-blue-700 border-blue-200';
  let label = 'New';

  switch (norm) {
    case 'new':
      style = 'bg-blue-50 text-blue-700 border-blue-200';
      label = 'New';
      break;
    case 'contacted':
      style = 'bg-purple-50 text-purple-700 border-purple-200';
      label = 'Contacted';
      break;
    case 'qualified':
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      label = 'Qualified';
      break;
    case 'proposal':
      style = 'bg-amber-50 text-amber-700 border-amber-200';
      label = 'Proposal';
      break;
    case 'lost':
      style = 'bg-red-50 text-red-700 border-red-200';
      label = 'Lost';
      break;
    case 'convert':
    case 'converted':
      style = 'bg-teal-50 text-teal-700 border-teal-200';
      label = 'Converted';
      break;
    default:
      style = 'bg-slate-100 text-slate-700 border-slate-200';
      label = status;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style} ${className}`}
    >
      {label}
    </span>
  );
}

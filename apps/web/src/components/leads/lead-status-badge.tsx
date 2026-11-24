'use client';

import React from 'react';

interface LeadStatusBadgeProps {
  status: string;
  className?: string;
}

export function LeadStatusBadge({ status, className = '' }: LeadStatusBadgeProps) {
  const norm = status?.toLowerCase() || 'new';

  let style = 'bg-white text-emerald-700 border-emerald-200';
  let label = 'New';

  switch (norm) {
    case 'new':
      style = 'bg-white text-slate-800 border-slate-300';
      label = 'New';
      break;
    case 'contacted':
      style = 'bg-orange-50 text-orange-800 border-orange-300';
      label = 'Contacted';
      break;
    case 'qualified':
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      label = 'Qualified';
      break;
    case 'proposal':
      style = 'bg-orange-100 text-orange-900 border-orange-400 font-medium';
      label = 'Proposal';
      break;
    case 'lost':
      style = 'bg-white text-orange-900 border-orange-300';
      label = 'Lost';
      break;
    case 'convert':
    case 'converted':
      style = 'bg-emerald-600 text-white border-emerald-600 font-bold';
      label = 'Converted';
      break;
    default:
      style = 'bg-white text-slate-700 border-slate-200';
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

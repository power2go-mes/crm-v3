'use client';

import React from 'react';
import { APPROVED_OPPORTUNITY_STAGES } from '@/types/opportunities';

interface OpportunityStageBadgeProps {
  stage: string;
  className?: string;
}

export function OpportunityStageBadge({ stage, className = '' }: OpportunityStageBadgeProps) {
  const norm = stage?.toLowerCase() || 'prospecting';
  const config = APPROVED_OPPORTUNITY_STAGES.find((s) => s.id === norm);

  const label = config?.name || stage;
  const isWon = norm === 'closed_won';
  const isLost = norm === 'closed_lost';

  // CRMHUB Blue Color System
  let style = 'bg-[#f8faff] text-[#4361ee] border-indigo-100';
  if (isWon) {
    style = 'bg-[#4361ee] text-white border-[#4361ee] font-bold shadow-2xs';
  } else if (isLost) {
    style = 'bg-rose-50 text-rose-600 border-rose-100 font-semibold';
  } else if (norm === 'qualification') {
    style = 'bg-[#eef2ff] text-[#4361ee] border-indigo-200/80 font-semibold';
  } else if (norm === 'needs_analysis') {
    style = 'bg-purple-50 text-purple-600 border-purple-100 font-semibold';
  } else if (norm === 'proposal_quote') {
    style = 'bg-sky-50 text-sky-600 border-sky-100 font-semibold';
  } else if (norm === 'negotiation') {
    style = 'bg-amber-50 text-amber-600 border-amber-100 font-semibold';
  } else if (norm === 'prospecting') {
    style = 'bg-[#eef2ff] text-[#4361ee] border-indigo-100 font-semibold';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style} ${className}`}
    >
      {label}
    </span>
  );
}

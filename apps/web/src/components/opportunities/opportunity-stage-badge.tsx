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

  // Strict Tri-Color Design: White base (60%) + Green (30%) + Orange (10%)
  // Text remains dark slate/black for high contrast readability
  let style = 'bg-white text-emerald-800 border-emerald-300';
  if (isWon) {
    style = 'bg-emerald-600 text-white border-emerald-600 font-bold';
  } else if (isLost) {
    style = 'bg-white text-orange-900 border-orange-400 font-medium';
  } else if (norm === 'qualification') {
    style = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  } else if (norm === 'needs_analysis') {
    style = 'bg-white text-slate-800 border-slate-300';
  } else if (norm === 'proposal_quote') {
    style = 'bg-orange-50 text-orange-800 border-orange-300';
  } else if (norm === 'negotiation') {
    style = 'bg-orange-500 text-white border-orange-500 font-bold';
  } else if (norm === 'prospecting') {
    style = 'bg-white text-emerald-700 border-emerald-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style} ${className}`}
    >
      {label}
    </span>
  );
}

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

  let style = 'bg-blue-950/40 text-blue-300 border-blue-500/30';
  if (isWon) {
    style = 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30';
  } else if (isLost) {
    style = 'bg-red-950/40 text-red-300 border-red-500/30';
  } else if (norm === 'qualification') {
    style = 'bg-purple-950/40 text-purple-300 border-purple-500/30';
  } else if (norm === 'needs_analysis') {
    style = 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30';
  } else if (norm === 'proposal_quote') {
    style = 'bg-amber-950/40 text-amber-300 border-amber-500/30';
  } else if (norm === 'negotiation') {
    style = 'bg-pink-950/40 text-pink-300 border-pink-500/30';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style} ${className}`}
    >
      {label}
    </span>
  );
}

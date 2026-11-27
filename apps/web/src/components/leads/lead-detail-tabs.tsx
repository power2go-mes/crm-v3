'use client';

import React, { useState } from 'react';
import type { LeadWithRelations } from '@/types/leads';
import { LeadActivityTimeline } from './lead-activity-timeline';
import { LeadHistoryAudit } from './lead-history-audit';
import { LeadNotesTab } from './lead-notes-tab';
import { LeadConvertedRecords } from './lead-converted-records';
import { LeadDetailFields } from './lead-detail-fields';

interface LeadDetailTabsProps {
  lead: LeadWithRelations;
  onEdit: () => void;
}

type TabType = 'details' | 'activity' | 'history' | 'related' | 'notes';

export function LeadDetailTabs({ lead, onEdit }: LeadDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');

  return (
    <div className="space-y-6">
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-3" aria-label="Lead sections">
        {([
          ['details', 'Details'], ['activity', 'Activity'], ['related', 'Related Lists'],
          ['notes', 'Notes & Attachments'], ['history', 'History'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${activeTab === id ? 'border-indigo-100 text-[#4361ee]' : 'border-transparent text-slate-700 hover:text-[#4361ee]'}`}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'details' && <LeadDetailFields lead={lead} onEdit={onEdit} />}

      {/* Tab Content: Activity */}
      {activeTab === 'activity' && <LeadActivityTimeline leadId={lead.id} />}

      {/* Tab Content: History */}
      {activeTab === 'history' && <LeadHistoryAudit leadId={lead.id} />}
      {activeTab === 'notes' && <LeadNotesTab leadId={lead.id} />}

      {activeTab === 'related' && <LeadConvertedRecords lead={lead} />}
    </div>
  );
}

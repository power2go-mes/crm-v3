'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

export const CAMPAIGN_STAGES = [
  { id: 'new', name: 'New' },
  { id: 'planned', name: 'Planned' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'completed', name: 'Completed' },
  { id: 'aborted', name: 'Aborted' },
] as const;

interface CampaignPipelineBarProps {
  currentStatus: string;
  canUpdate: boolean;
  onStatusChange: (newStatus: string) => Promise<void>;
}

export function CampaignPipelineBar({
  currentStatus,
  canUpdate,
  onStatusChange,
}: CampaignPipelineBarProps) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const normCurrent = currentStatus?.toLowerCase() || 'planned';
  const currentIdx = CAMPAIGN_STAGES.findIndex((s) => s.id === normCurrent);

  const handleStageClick = (stageId: string) => {
    if (!canUpdate || isUpdating) return;
    if (stageId === normCurrent) return;
    setPendingStatus(stageId);
  };

  const handleConfirmStatus = async () => {
    if (!pendingStatus) return;
    try {
      setIsUpdating(true);
      await onStatusChange(pendingStatus);
    } finally {
      setIsUpdating(false);
      setPendingStatus(null);
    }
  };

  const pendingStageObj = CAMPAIGN_STAGES.find((s) => s.id === pendingStatus);

  return (
    <div className="bg-white px-5 py-5 rounded-xl shadow-sm overflow-x-auto">
      <div className="flex items-center min-w-[700px] gap-0">
        {CAMPAIGN_STAGES.map((stage, idx) => {
          const isCurrent = stage.id === normCurrent;
          const isCompleted = currentIdx > -1 && idx < currentIdx && normCurrent !== 'aborted';
          const isAborted = normCurrent === 'aborted' && stage.id === 'aborted';

          let stageStyle = 'bg-[#f0f0f0] text-slate-600 hover:bg-slate-200';
          if (isCurrent) {
            stageStyle = isAborted
              ? 'bg-rose-100 text-rose-700 font-medium'
              : 'bg-[#d5e4fa] text-[#3777ee] font-medium';
          } else if (isCompleted) {
            stageStyle = 'bg-[#def5df] text-[#22c55e] font-medium hover:bg-emerald-100';
          }

          return (
            <button
              key={stage.id}
              type="button"
              disabled={!canUpdate || isUpdating}
              onClick={() => handleStageClick(stage.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-3 text-base transition cursor-pointer disabled:cursor-not-allowed [clip-path:polygon(0_0,calc(100%_-_24px)_0,100%_50%,calc(100%_-_24px)_100%,0_100%,24px_50%)] first:[clip-path:polygon(0_0,calc(100%_-_24px)_0,100%_50%,calc(100%_-_24px)_100%,0_100%)] ${stageStyle}`}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
              <span>{stage.name}</span>
            </button>
          );
        })}
      </div>

      <ConfirmationDialog
        isOpen={Boolean(pendingStatus)}
        title="Confirm Stage Transition"
        message={`Are you sure you want to change campaign status to "${pendingStageObj?.name}"?`}
        confirmLabel={isUpdating ? 'Updating...' : 'Confirm Transition'}
        cancelLabel="Cancel"
        variant="primary"
        isLoading={isUpdating}
        onConfirm={handleConfirmStatus}
        onCancel={() => setPendingStatus(null)}
      />
    </div>
  );
}

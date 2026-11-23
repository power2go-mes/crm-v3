'use client';

import React, { useState } from 'react';
import { APPROVED_OPPORTUNITY_STAGES } from '@/types/opportunities';
import { Check } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface OpportunityPipelineBarProps {
  currentStage: string;
  onSelectStage?: (stageId: string) => Promise<void>;
  disabled?: boolean;
}

export function OpportunityPipelineBar({
  currentStage,
  onSelectStage,
  disabled = false,
}: OpportunityPipelineBarProps) {
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const normCurrent = currentStage?.toLowerCase() || 'prospecting';
  const currentIdx = APPROVED_OPPORTUNITY_STAGES.findIndex((s) => s.id === normCurrent);

  const handleStageClick = (stageId: string) => {
    if (disabled || isUpdating) return;
    if (stageId === normCurrent) return;
    setPendingStage(stageId);
  };

  const handleConfirmStage = async () => {
    if (!pendingStage) return;
    try {
      setIsUpdating(true);
      await onSelectStage?.(pendingStage);
    } finally {
      setIsUpdating(false);
      setPendingStage(null);
    }
  };

  const pendingStageObj = APPROVED_OPPORTUNITY_STAGES.find((s) => s.id === pendingStage);

  return (
    <div className="bg-white px-5 py-5 rounded-xl shadow-sm overflow-x-auto">
      <div className="flex items-center min-w-[750px] gap-0">
        {APPROVED_OPPORTUNITY_STAGES.map((stage, idx) => {
          const isPassed = currentIdx > -1 && idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isWon = stage.id === 'closed_won';
          const isLost = stage.id === 'closed_lost';

          let stageStyle = 'bg-[#f0f0f0] text-slate-600 hover:bg-slate-200';
          if (isCurrent) {
            if (isWon) {
              stageStyle = 'bg-emerald-100 text-emerald-700 font-semibold';
            } else if (isLost) {
              stageStyle = 'bg-rose-100 text-rose-700 font-semibold';
            } else {
              stageStyle = 'bg-[#d5e4fa] text-[#3777ee] font-medium';
            }
          } else if (isPassed) {
            stageStyle = 'bg-[#def5df] text-[#22c55e] font-medium hover:bg-emerald-100';
          }

          return (
            <button
              key={stage.id}
              type="button"
              disabled={disabled || isUpdating}
              onClick={() => handleStageClick(stage.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 px-2 text-xs transition cursor-pointer disabled:cursor-not-allowed [clip-path:polygon(0_0,calc(100%_-_20px)_0,100%_50%,calc(100%_-_20px)_100%,0_100%,20px_50%)] first:[clip-path:polygon(0_0,calc(100%_-_20px)_0,100%_50%,calc(100%_-_20px)_100%,0_100%)] ${stageStyle}`}
            >
              <div className="flex items-center gap-1 font-medium truncate">
                {isPassed && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
                <span className="truncate">{stage.name}</span>
              </div>
              <span className="text-[10px] opacity-75 font-mono">{stage.probability}%</span>
            </button>
          );
        })}
      </div>

      <ConfirmationDialog
        isOpen={Boolean(pendingStage)}
        title="Confirm Opportunity Stage Change"
        message={`Are you sure you want to change this opportunity's stage to "${pendingStageObj?.name}"?`}
        confirmLabel={isUpdating ? 'Updating...' : 'Confirm Stage Change'}
        cancelLabel="Cancel"
        variant="primary"
        isLoading={isUpdating}
        onConfirm={handleConfirmStage}
        onCancel={() => setPendingStage(null)}
      />
    </div>
  );
}

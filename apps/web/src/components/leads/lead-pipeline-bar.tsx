'use client';

import React, { useState } from 'react';
import { CANONICAL_LEAD_STAGES } from '@/types/leads';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface LeadPipelineBarProps {
  currentStatus: string;
  isConverted: boolean;
  canUpdate: boolean;
  onStatusChange: (newStatus: string) => Promise<void>;
  onConvertClick: () => void;
}

export function LeadPipelineBar({
  currentStatus,
  isConverted,
  canUpdate,
  onStatusChange,
  onConvertClick,
}: LeadPipelineBarProps) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentIdx = CANONICAL_LEAD_STAGES.findIndex(
    (s) => s.id === currentStatus?.toLowerCase()
  );

  const handleStageClick = (stageId: string) => {
    if (!canUpdate || isConverted) return;
    if (stageId === currentStatus?.toLowerCase()) return;

    if (stageId === 'convert') {
      onConvertClick();
      return;
    }

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

  const pendingStageObj = CANONICAL_LEAD_STAGES.find((s) => s.id === pendingStatus);

  return (
    <div className="bg-white px-5 py-5 rounded-xl shadow-sm overflow-x-auto">
      <div className="flex items-center min-w-[700px] gap-0">
        {CANONICAL_LEAD_STAGES.map((stage, idx) => {
          const isCurrent = stage.id === currentStatus?.toLowerCase() || (isConverted && stage.id === 'convert');
          const isCompleted = currentIdx > -1 && idx < currentIdx;
          const isConvertStage = stage.id === 'convert';

          let stageStyle = 'bg-[#f0f0f0] text-slate-600 hover:bg-slate-200';
          if (isCurrent) {
            stageStyle = 'bg-[#d5e4fa] text-[#3777ee] font-medium';
          } else if (isCompleted) {
            stageStyle = 'bg-[#def5df] text-[#22c55e] font-medium hover:bg-[#eef2ff]';
          } else if (stage.id === 'lost') {
            stageStyle = 'bg-[#f0f0f0] text-slate-600 hover:bg-red-50';
          } else if (isConvertStage) {
            stageStyle = 'bg-[#b7bce8] text-[#727dce] hover:bg-[#eef2ff]';
          }

          return (
            <button
              key={stage.id}
              type="button"
              disabled={!canUpdate || isConverted || isUpdating}
              onClick={() => handleStageClick(stage.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-3 text-base transition cursor-pointer disabled:cursor-not-allowed [clip-path:polygon(0_0,calc(100%_-_24px)_0,100%_50%,calc(100%_-_24px)_100%,0_100%,24px_50%)] first:[clip-path:polygon(0_0,calc(100%_-_24px)_0,100%_50%,calc(100%_-_24px)_100%,0_100%)] ${stageStyle}`}
            >
              <span>{stage.name}</span>
            </button>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(pendingStatus)}
        title="Confirm Stage Transition"
        message={`Are you sure you want to transition this lead's status to "${pendingStageObj?.name}"?`}
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

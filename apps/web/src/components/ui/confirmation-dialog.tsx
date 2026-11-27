'use client';

import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const confirmBtnStyles =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-[#4361ee] hover:bg-[#3a5bf0] text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="min-w-0 break-words text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition ${confirmBtnStyles}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

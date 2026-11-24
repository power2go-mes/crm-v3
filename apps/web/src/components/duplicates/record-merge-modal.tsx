'use client';

import React, { useState } from 'react';
import { X, GitMerge, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useMergeAccountsMutation, useMergeContactsMutation } from '@/hooks/use-duplicates';

interface RecordMergeModalProps {
  isOpen: boolean;
  entityType: 'accounts' | 'contacts';
  masterRecord: any;
  victimRecord: any;
  onClose: () => void;
  onMergeSuccess?: () => void;
}

export function RecordMergeModal({
  isOpen,
  entityType,
  masterRecord,
  victimRecord,
  onClose,
  onMergeSuccess,
}: RecordMergeModalProps) {
  const mergeAccountsMutation = useMergeAccountsMutation();
  const mergeContactsMutation = useMergeContactsMutation();

  const [isReversed, setIsReversed] = useState(false);
  const [selectedOverrides, setSelectedOverrides] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !masterRecord || !victimRecord) return null;

  const currentMaster = isReversed ? victimRecord : masterRecord;
  const currentVictim = isReversed ? masterRecord : victimRecord;

  // Define fields to compare based on entity type
  const fields =
    entityType === 'accounts'
      ? [
          { key: 'name', label: 'Account Name' },
          { key: 'website', label: 'Website / Domain' },
          { key: 'contact_number', label: 'Phone Number' },
          { key: 'industry', label: 'Industry' },
          { key: 'annual_revenue', label: 'Annual Revenue' },
          { key: 'billing_address', label: 'Billing Address' },
          { key: 'shipping_address', label: 'Shipping Address' },
          { key: 'account_source', label: 'Account Source' },
        ]
      : [
          { key: 'first_name', label: 'First Name' },
          { key: 'last_name', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'contact_number', label: 'Phone Number' },
          { key: 'secondary_contact_number', label: 'Secondary Phone' },
          { key: 'title', label: 'Job Title' },
          { key: 'contact_source', label: 'Contact Source' },
        ];

  const handleSelectFieldSource = (key: string, sourceRecord: any) => {
    setSelectedOverrides((prev) => ({
      ...prev,
      [key]: sourceRecord[key],
    }));
  };

  const handleExecuteMerge = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      // Collect overrides that differ from currentMaster
      const overridesToApply: Record<string, any> = {};
      for (const field of fields) {
        if (selectedOverrides[field.key] !== undefined) {
          overridesToApply[field.key] = selectedOverrides[field.key];
        }
      }

      if (entityType === 'accounts') {
        await mergeAccountsMutation.mutateAsync({
          masterId: currentMaster.id,
          victimId: currentVictim.id,
          fieldOverrides: overridesToApply,
        });
      } else {
        await mergeContactsMutation.mutateAsync({
          masterId: currentMaster.id,
          victimId: currentVictim.id,
          fieldOverrides: overridesToApply,
        });
      }

      onMergeSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to merge records.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl dark:bg-emerald-600/40 dark:text-emerald-600">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Merge Duplicate {entityType === 'accounts' ? 'Accounts' : 'Contacts'}
              </h2>
              <p className="text-xs text-slate-500">
                Choose surviving master record and pick attribute values to retain.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              All associated opportunities, child records, quotes, and activity timeline events will be repointed to the Surviving Master. The merged duplicate record will be archived to the Recycle Bin.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsReversed((prev) => !prev)}
            className="shrink-0 px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 rounded text-xs font-semibold text-amber-800 dark:bg-slate-800 dark:border-amber-700 dark:text-amber-200"
          >
            Switch Master / Victim
          </button>
        </div>

        {errorMsg && (
          <div className="m-6 mb-0 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Comparison Table */}
        <div className="p-6 flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                <th className="pb-3 text-left w-1/4 font-semibold">Field Name</th>
                <th className="pb-3 text-left w-3/8 font-bold text-emerald-600 dark:text-emerald-400">
                  Surviving Master (Keep Record)
                </th>
                <th className="pb-3 text-left w-3/8 font-semibold text-rose-500 dark:text-rose-400">
                  Duplicate to Merge &amp; Archive
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fields.map((field) => {
                const masterVal = currentMaster[field.key];
                const victimVal = currentVictim[field.key];
                const activeValue =
                  selectedOverrides[field.key] !== undefined
                    ? selectedOverrides[field.key]
                    : masterVal;

                return (
                  <tr key={field.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-medium text-slate-700 dark:text-slate-300">
                      {field.label}
                    </td>

                    {/* Master Field Choice */}
                    <td className="py-3 pr-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`field_${field.key}`}
                          checked={activeValue === masterVal}
                          onChange={() => handleSelectFieldSource(field.key, currentMaster)}
                          className="mt-0.5 text-emerald-800 focus:ring-emerald-500"
                        />
                        <span
                          className={`text-slate-900 dark:text-slate-100 break-all ${
                            activeValue === masterVal ? 'font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {masterVal ? String(masterVal) : <span className="text-slate-400 italic">Empty</span>}
                        </span>
                      </label>
                    </td>

                    {/* Victim Field Choice */}
                    <td className="py-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`field_${field.key}`}
                          checked={activeValue === victimVal}
                          onChange={() => handleSelectFieldSource(field.key, currentVictim)}
                          className="mt-0.5 text-emerald-800 focus:ring-emerald-500"
                        />
                        <span
                          className={`text-slate-900 dark:text-slate-100 break-all ${
                            activeValue === victimVal ? 'font-semibold text-emerald-800' : 'text-slate-500'
                          }`}
                        >
                          {victimVal ? String(victimVal) : <span className="text-slate-400 italic">Empty</span>}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Surviving Record ID: <code className="font-mono text-slate-700 dark:text-slate-300">{currentMaster.id}</code>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              <GitMerge className="h-4 w-4" />
              <span>{isSubmitting ? 'Merging Records...' : 'Execute Merge'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

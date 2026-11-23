'use client';

import React, { useState } from 'react';
import { X, PhoneCall } from 'lucide-react';
import type { ActivityInsert } from '@/types/calls';
import { CALL_TYPES, CALL_STATUSES } from '@/types/calls';
import { useAuth } from '@/components/providers/auth-provider';
import { useUsers } from '@/hooks/use-users';

interface CallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (call: Omit<ActivityInsert, 'activity_type'>) => Promise<void>;
  defaultRelatedType?: 'lead' | 'contact' | 'account' | 'opportunity';
  defaultRelatedId?: string;
}

export function CallLogModal({
  isOpen,
  onClose,
  onSubmit,
  defaultRelatedType,
  defaultRelatedId,
}: CallLogModalProps) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    subject: '',
    call_type: 'outbound',
    status: 'completed',
    call_duration_minutes: 5,
    description: '',
    assigned_to_id: user?.id || '',
    related_to_type: defaultRelatedType || '',
    related_to_id: defaultRelatedId || '',
    start_time: new Date().toISOString().slice(0, 16),
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      setErrorMsg('Call subject is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        subject: formData.subject.trim(),
        call_type: formData.call_type as any,
        status: formData.status as any,
        call_duration_minutes: Number(formData.call_duration_minutes) || 0,
        description: formData.description.trim() || null,
        assigned_to_id: formData.assigned_to_id || user?.id || null,
        created_by_id: user?.id || null,
        related_to_type: (formData.related_to_type as any) || null,
        related_to_id: formData.related_to_id ? formData.related_to_id.trim() : null,
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to log call.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Log Telephone Call</h3>
              <p className="text-xs text-slate-400">Record customer interaction details and notes.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-red-200">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g. Discovery Call with Operations Director"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Call Direction
              </label>
              <select
                value={formData.call_type}
                onChange={(e) => setFormData({ ...formData, call_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CALL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Outcome / Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CALL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="0"
                value={formData.call_duration_minutes}
                onChange={(e) => setFormData({ ...formData, call_duration_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Caller (Logged By)
              </label>
              <select
                value={formData.assigned_to_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Related Entity Type
              </label>
              <select
                value={formData.related_to_type}
                onChange={(e) => setFormData({ ...formData, related_to_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">None (Independent Call)</option>
                <option value="lead">Lead</option>
                <option value="contact">Contact</option>
                <option value="account">Account</option>
                <option value="opportunity">Opportunity</option>
              </select>
            </div>

            {formData.related_to_type && (
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Related Entity ID
                </label>
                <input
                  type="text"
                  value={formData.related_to_id}
                  onChange={(e) => setFormData({ ...formData, related_to_id: e.target.value })}
                  placeholder={`UUID of the related ${formData.related_to_type}`}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Call Notes & Key Discussion Points
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Summary of conversation, objections raised, agreed next steps..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Logging...' : 'Save Call Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

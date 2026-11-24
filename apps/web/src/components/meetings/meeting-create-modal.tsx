'use client';

import React, { useState } from 'react';
import { X, Calendar, Video, MapPin, Users } from 'lucide-react';
import type { ActivityInsert } from '@/types/meetings';
import { MEETING_PROVIDERS, MEETING_STATUSES } from '@/types/meetings';
import { useAuth } from '@/components/providers/auth-provider';
import { useUsers } from '@/hooks/use-users';

interface MeetingCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (meeting: Omit<ActivityInsert, 'activity_type'>) => Promise<void>;
  defaultRelatedType?: 'lead' | 'contact' | 'account' | 'opportunity';
  defaultRelatedId?: string;
}

export function MeetingCreateModal({
  isOpen,
  onClose,
  onSubmit,
  defaultRelatedType,
  defaultRelatedId,
}: MeetingCreateModalProps) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaultStart = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16);
  const defaultEnd = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16);

  const [formData, setFormData] = useState({
    subject: '',
    status: 'not_started',
    start_time: defaultStart,
    end_time: defaultEnd,
    provider: 'google_meet',
    meeting_url: '',
    location: '',
    external_participants: '',
    description: '',
    assigned_to_id: user?.id || '',
    related_to_type: defaultRelatedType || '',
    related_to_id: defaultRelatedId || '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      setErrorMsg('Meeting subject is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      // Append external participants to description notes if present
      let combinedDescription = formData.description.trim();
      if (formData.external_participants.trim()) {
        combinedDescription += `\n\nExternal Participants: ${formData.external_participants.trim()}`;
      }

      await onSubmit({
        subject: formData.subject.trim(),
        status: formData.status as any,
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : null,
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null,
        location: formData.location.trim() || formData.provider,
        meeting_url: formData.meeting_url.trim() || null,
        description: combinedDescription || null,
        assigned_to_id: formData.assigned_to_id || user?.id || null,
        created_by_id: user?.id || null,
        related_to_type: (formData.related_to_type as any) || null,
        related_to_id: formData.related_to_id ? formData.related_to_id.trim() : null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to schedule meeting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/10 text-emerald-600 rounded-lg">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Schedule Meeting</h3>
              <p className="text-xs text-slate-400">Plan client demonstrations, discovery sessions, or reviews.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Meeting Title / Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="e.g. Solution Architecture Review & Demo"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Start Date & Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                End Date & Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Meeting Host / Organizer
              </label>
              <select
                value={formData.assigned_to_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {MEETING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Platform / Provider
              </label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {MEETING_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Join URL / Link
              </label>
              <input
                type="url"
                value={formData.meeting_url}
                onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                placeholder="https://meet.google.com/... or zoom.us/j/..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Physical Location (if In-Person)
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Conference Room A, HQ Floor 4"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Related Entity Type
              </label>
              <select
                value={formData.related_to_type}
                onChange={(e) => setFormData({ ...formData, related_to_type: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">None (Internal Meeting)</option>
                <option value="lead">Lead</option>
                <option value="contact">Contact</option>
                <option value="account">Account</option>
                <option value="opportunity">Opportunity</option>
              </select>
            </div>

            {formData.related_to_type && (
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Related Entity ID
                </label>
                <input
                  type="text"
                  value={formData.related_to_id}
                  onChange={(e) => setFormData({ ...formData, related_to_id: e.target.value })}
                  placeholder={`UUID of the related ${formData.related_to_type}`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                External Participants (Emails)
              </label>
              <input
                type="text"
                value={formData.external_participants}
                onChange={(e) => setFormData({ ...formData, external_participants: e.target.value })}
                placeholder="client.lead@enterprise.com, partner@tech.co (comma-separated)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Agenda & Meeting Notes
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Key objectives, agenda topics, materials to prepare..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

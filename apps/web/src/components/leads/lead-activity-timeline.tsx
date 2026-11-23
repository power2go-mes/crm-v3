'use client';

import React, { useState } from 'react';
import {
  useLeadActivities,
  useAddLeadActivityMutation,
} from '@/hooks/use-leads';
import { Phone, CheckSquare, Calendar, Plus, Clock, User, AlertCircle } from 'lucide-react';

interface LeadActivityTimelineProps {
  leadId: string;
}

export function LeadActivityTimeline({ leadId }: LeadActivityTimelineProps) {
  const { data: activities = [], isLoading } = useLeadActivities(leadId);
  const addActivityMutation = useAddLeadActivityMutation();

  const [activeForm, setActiveForm] = useState<'call' | 'task' | 'meeting' | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !subject.trim()) return;

    await addActivityMutation.mutateAsync({
      leadId,
      activityType: activeForm,
      subject: subject.trim(),
      description: description.trim() || undefined,
    });

    setSubject('');
    setDescription('');
    setDueDate('');
    setActiveForm(null);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4 text-emerald-400" />;
      case 'meeting':
        return <Calendar className="h-4 w-4 text-purple-400" />;
      case 'task':
      default:
        return <CheckSquare className="h-4 w-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Action Logging Buttons */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">
          Log Activity:
        </span>
        <button
          type="button"
          onClick={() => setActiveForm(activeForm === 'call' ? null : 'call')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1.5 ${
            activeForm === 'call'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <Phone className="h-3.5 w-3.5" />
          <span>Log Call</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveForm(activeForm === 'task' ? null : 'task')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1.5 ${
            activeForm === 'task'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>New Task</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveForm(activeForm === 'meeting' ? null : 'meeting')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center gap-1.5 ${
            activeForm === 'meeting'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Schedule Meeting</span>
        </button>
      </div>

      {/* Activity Creation Form */}
      {activeForm && (
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-slate-900/80 border border-slate-700 rounded-xl space-y-3 shadow-md animate-fadeIn"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <span>
              Log New {activeForm === 'call' ? 'Call' : activeForm === 'task' ? 'Task' : 'Meeting'}
            </span>
            <button
              type="button"
              onClick={() => setActiveForm(null)}
              className="text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject or summary..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed notes or discussion points..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addActivityMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              {addActivityMutation.isPending ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </form>
      )}

      {/* Activity Timeline List */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Activity History ({activities.length})
        </h4>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-16 bg-slate-800/60 rounded-xl" />
            <div className="h-16 bg-slate-800/60 rounded-xl" />
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            No activities logged for this lead yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {activities.map((act) => (
              <div key={act.id} className="relative group">
                <div className="absolute -left-6 top-1.5 h-5 w-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                  {getActivityIcon(act.activity_type)}
                </div>

                <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-100">{act.subject}</span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(act.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {act.description && (
                    <p className="mt-1 text-xs text-slate-400 whitespace-pre-line">{act.description}</p>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="capitalize">{act.activity_type}</span>
                    {act.due_date && <span>Due: {new Date(act.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

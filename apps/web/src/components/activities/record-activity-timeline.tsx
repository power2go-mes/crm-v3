'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { Activity } from '@/types/tasks';
import {
  Phone,
  CheckSquare,
  Calendar,
  Clock,
  User,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface RecordActivityTimelineProps {
  relatedToType: 'account' | 'contact' | 'opportunity' | 'lead';
  relatedToId: string;
  recordTitle?: string;
}

type ActivityWithProfile = Activity & {
  assigned_to?: { id: string; first_name: string; last_name: string; email: string } | null;
  created_by?: { id: string; first_name: string; last_name: string; email: string } | null;
};

export function RecordActivityTimeline({
  relatedToType,
  relatedToId,
  recordTitle,
}: RecordActivityTimelineProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [activeForm, setActiveForm] = useState<'call' | 'task' | 'meeting' | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [callType, setCallType] = useState<'inbound' | 'outbound'>('outbound');
  const [callDuration, setCallDuration] = useState<number>(5);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryKey = ['record-activities', relatedToType, relatedToId];

  const { data: activities = [], isLoading } = useQuery<ActivityWithProfile[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(
          `
          *,
          assigned_to:user_profiles!assigned_to_id(id, first_name, last_name, email),
          created_by:user_profiles!created_by_id(id, first_name, last_name, email)
        `
        )
        .eq('related_to_type', relatedToType)
        .eq('related_to_id', relatedToId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as any as ActivityWithProfile[];
    },
    enabled: Boolean(relatedToId),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['activities-hub'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['calls'] });
    queryClient.invalidateQueries({ queryKey: ['meetings'] });
  };

  const createActivityMutation = useMutation({
    mutationFn: async (payload: Partial<Activity>) => {
      const { data, error } = await supabase.from('activities').insert(payload as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const nextStatus = currentStatus === 'completed' ? 'not_started' : 'completed';
      const { error } = await supabase.from('activities').update({ status: nextStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !subject.trim()) return;

    setIsSubmitting(true);
    try {
      if (activeForm === 'call') {
        await createActivityMutation.mutateAsync({
          activity_type: 'log_call',
          subject: subject.trim(),
          description: description.trim() || null,
          status: 'completed',
          priority: 'medium',
          call_type: callType,
          call_duration_minutes: callDuration || 0,
          related_to_type: relatedToType,
          related_to_id: relatedToId,
          assigned_to_id: user?.id,
          created_by_id: user?.id,
        });
      } else if (activeForm === 'task') {
        await createActivityMutation.mutateAsync({
          activity_type: 'task',
          subject: subject.trim(),
          description: description.trim() || null,
          status: 'not_started',
          priority,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          related_to_type: relatedToType,
          related_to_id: relatedToId,
          assigned_to_id: user?.id,
          created_by_id: user?.id,
        });
      } else if (activeForm === 'meeting') {
        await createActivityMutation.mutateAsync({
          activity_type: 'meeting',
          subject: subject.trim(),
          description: description.trim() || null,
          status: 'scheduled',
          priority: 'medium',
          start_time: startTime ? new Date(startTime).toISOString() : null,
          end_time: endTime ? new Date(endTime).toISOString() : null,
          location: location.trim() || null,
          meeting_url: meetingUrl.trim() || null,
          related_to_type: relatedToType,
          related_to_id: relatedToId,
          assigned_to_id: user?.id,
          created_by_id: user?.id,
        });
      }

      // Reset form
      setSubject('');
      setDescription('');
      setDueDate('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setMeetingUrl('');
      setActiveForm(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'log_call':
      case 'call':
        return <Phone className="h-4 w-4 text-emerald-400" />;
      case 'meeting':
        return <Calendar className="h-4 w-4 text-emerald-600" />;
      case 'task':
      default:
        return <CheckSquare className="h-4 w-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Activity Timeline & Actions
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveForm(activeForm === 'call' ? null : 'call')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              activeForm === 'call'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Log Call</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveForm(activeForm === 'task' ? null : 'task')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              activeForm === 'task'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>New Task</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveForm(activeForm === 'meeting' ? null : 'meeting')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              activeForm === 'meeting'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {/* Creation Subform */}
      {activeForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              {activeForm === 'call' && <Phone className="h-4 w-4 text-emerald-400" />}
              {activeForm === 'task' && <CheckSquare className="h-4 w-4 text-emerald-600" />}
              {activeForm === 'meeting' && <Calendar className="h-4 w-4 text-emerald-600" />}
              <span>
                {activeForm === 'call' && 'Log Completed Phone Call'}
                {activeForm === 'task' && 'Create Follow-Up Task'}
                {activeForm === 'meeting' && 'Schedule Customer Meeting'}
              </span>
            </h4>
            <button
              type="button"
              onClick={() => setActiveForm(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Subject / Objective *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  activeForm === 'call'
                    ? 'e.g. Discovery call regarding Q4 expansion'
                    : activeForm === 'task'
                      ? 'e.g. Send revised contract draft'
                      : 'e.g. Executive solution walkthrough'
                }
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-200"
              />
            </div>

            {/* Task specific fields */}
            {activeForm === 'task' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Due Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </>
            )}

            {/* Call specific fields */}
            {activeForm === 'call' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Direction
                  </label>
                  <select
                    value={callType}
                    onChange={(e) => setCallType(e.target.value as 'inbound' | 'outbound')}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  >
                    <option value="outbound">Outbound Call</option>
                    <option value="inbound">Inbound Call</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={callDuration}
                    onChange={(e) => setCallDuration(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  />
                </div>
              </>
            )}

            {/* Meeting specific fields */}
            {activeForm === 'meeting' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Location / Room
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Conference Room A or Online"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Meeting URL
                  </label>
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white focus:outline-hidden focus:border-emerald-200"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Notes & Discussion Summary
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Log key discussion points, outcomes, or next steps..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveForm(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shadow-xs"
            >
              {isSubmitting ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </form>
      )}

      {/* Activities Timeline List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
            Loading activity timeline...
          </div>
        )}

        {!isLoading && activities.length === 0 && (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-xl space-y-2">
            <Clock className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Activities Recorded</h3>
            <p className="text-xs text-slate-500">
              There are no tasks, calls, or meetings logged for this record. Use the action buttons above to log one.
            </p>
          </div>
        )}

        {activities.map((act) => {
          const isDone = act.status === 'completed';
          const isTask = act.activity_type === 'task';

          return (
            <div
              key={act.id}
              className={`p-4 rounded-xl border transition flex items-start gap-3.5 ${
                isDone
                  ? 'bg-slate-50 border-slate-200/60 opacity-80'
                  : 'bg-slate-900/70 border-slate-200 hover:border-slate-700'
              }`}
            >
              {/* Checkbox for tasks, or icon for calls/meetings */}
              <div className="mt-0.5 shrink-0">
                {isTask ? (
                  <button
                    type="button"
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        id: act.id,
                        currentStatus: act.status,
                      })
                    }
                    className="text-slate-400 hover:text-emerald-400 transition"
                    title={isDone ? 'Mark Incomplete' : 'Mark Completed'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <div className="h-5 w-5 rounded border border-slate-600 hover:border-slate-400" />
                    )}
                  </button>
                ) : (
                  <div className="p-2 rounded-lg bg-slate-800/80">
                    {getActivityIcon(act.activity_type)}
                  </div>
                )}
              </div>

              {/* Activity Body */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        isDone ? 'line-through text-slate-400' : 'text-white'
                      }`}
                    >
                      {act.subject}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {act.activity_type === 'log_call' ? 'Call' : act.activity_type}
                    </span>
                    {act.priority && act.priority !== 'medium' && (
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          act.priority === 'high'
                            ? 'bg-red-950/60 text-red-300 border border-red-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {act.priority}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {act.due_date && (
                      <span>Due {new Date(act.due_date).toLocaleDateString()}</span>
                    )}
                    {act.start_time && (
                      <span>
                        {new Date(act.start_time).toLocaleDateString()}{' '}
                        {new Date(act.start_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    {act.call_duration_minutes != null && act.call_duration_minutes > 0 && (
                      <span>{act.call_duration_minutes}m</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this activity entry?')) {
                          deleteActivityMutation.mutate(act.id);
                        }
                      }}
                      className="text-slate-500 hover:text-slate-800 transition"
                      title="Delete activity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {act.description && (
                  <p className="mt-1 text-xs text-slate-400 whitespace-pre-wrap">
                    {act.description}
                  </p>
                )}

                {act.meeting_url && (
                  <a
                    href={act.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Join Meeting: {act.meeting_url}</span>
                  </a>
                )}

                <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-500">
                  {act.assigned_to && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Assigned to {act.assigned_to.first_name} {act.assigned_to.last_name}
                    </span>
                  )}
                  <span>
                    Logged {new Date(act.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

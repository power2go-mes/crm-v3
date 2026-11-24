'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  ChevronLeft,
  ChevronRight,
  Video,
  CheckSquare,
  PhoneCall,
  Plus,
  Calendar as CalendarIcon,
} from 'lucide-react';
import type { Activity } from '@/types/tasks';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [filterType, setFilterType] = useState<'all' | 'task' | 'meeting' | 'log_call'>('all');

  const supabase = createClient();

  // Query activities for the visible month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const startOfMonth = new Date(year, month, 1).toISOString();
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['calendar-activities', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .or(`and(start_time.gte.${startOfMonth},start_time.lte.${endOfMonth}),and(due_date.gte.${startOfMonth},due_date.lte.${endOfMonth})`);

      if (error) throw error;
      return (data || []) as Activity[];
    },
  });

  const filteredActivities = useMemo(() => {
    if (filterType === 'all') return activities;
    return activities.filter((a) => a.activity_type === filterType);
  }, [activities, filterType]);

  // Calendar matrix calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const setToday = () => setCurrentDate(new Date());

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map activities to date string YYYY-MM-DD
  const activitiesByDate = useMemo(() => {
    const map: Record<number, Activity[]> = {};
    for (const act of filteredActivities) {
      const dateStr = act.start_time || act.due_date;
      if (dateStr) {
        const d = new Date(dateStr);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const dayNum = d.getDate();
          if (!map[dayNum]) map[dayNum] = [];
          map[dayNum].push(act);
        }
      }
    }
    return map;
  }, [filteredActivities, year, month]);

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blankDays = Array.from({ length: firstDayIndex }, (_, i) => i);

  return (
    <PageContainer>
      <PermissionGate action="meetings.view" showAccessDenied>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schedule & Calendar</h1>
              <p className="text-sm text-slate-500 mt-1">
                Visual timeline of scheduled customer meetings, task deadlines, and outbound call commitments
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/settings/calendar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-800" />
                Sync Settings
              </Link>
              <Link
                href="/meetings"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-slate-50 transition"
              >
                <Video className="w-3.5 h-3.5 text-emerald-800" />
                Schedule Meeting
              </Link>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </Link>
            </div>
          </div>

          {/* Calendar Toolbar & Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 min-w-44">{monthName}</h2>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Previous Month"
                  className="p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={setToday}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-md transition"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next Month"
                  className="p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterType === 'all'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('meeting')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                  filterType === 'meeting'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <Video className="w-3 h-3" />
                Meetings
              </button>
              <button
                type="button"
                onClick={() => setFilterType('task')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                  filterType === 'task'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <CheckSquare className="w-3 h-3" />
                Tasks
              </button>
              <button
                type="button"
                onClick={() => setFilterType('log_call')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
                  filterType === 'log_call'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <PhoneCall className="w-3 h-3" />
                Calls
              </button>
            </div>
          </div>

          {/* Monthly Calendar Grid */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/75 text-center text-xs font-bold text-slate-600 uppercase py-2.5">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
              {/* Blank days from previous month */}
              {blankDays.map((_, i) => (
                <div key={`blank-${i}`} className="min-h-28 p-2 bg-slate-50/30" />
              ))}

              {/* Month days */}
              {daysArray.map((day) => {
                const dayActs = activitiesByDate[day] || [];
                const isCurrentToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === month &&
                  new Date().getFullYear() === year;

                return (
                  <div
                    key={`day-${day}`}
                    className={`min-h-28 p-2 flex flex-col justify-between transition hover:bg-slate-50/60 ${
                      isCurrentToday ? 'bg-emerald-50/40 ring-1 ring-inset ring-emerald-400' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          isCurrentToday
                            ? 'h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        {day}
                      </span>
                      {dayActs.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-medium">{dayActs.length} item(s)</span>
                      )}
                    </div>

                    {/* Activity Pills in Day Cell */}
                    <div className="space-y-1 mt-1 overflow-y-auto max-h-24">
                      {dayActs.slice(0, 3).map((act) => {
                        let pillClass = 'bg-slate-100 text-slate-700';
                        let linkHref = `/tasks/${act.id}`;
                        if (act.activity_type === 'meeting') {
                          pillClass = 'bg-emerald-50 text-emerald-800 hover:bg-emerald-600';
                          linkHref = `/meetings/${act.id}`;
                        } else if (act.activity_type === 'task') {
                          pillClass = 'bg-amber-100 text-amber-800 hover:bg-amber-200';
                          linkHref = `/tasks/${act.id}`;
                        } else if (act.activity_type === 'log_call') {
                          pillClass = 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200';
                          linkHref = `/calls/${act.id}`;
                        }

                        return (
                          <Link
                            key={act.id}
                            href={linkHref}
                            className={`block truncate px-1.5 py-0.5 rounded text-[10px] font-semibold transition ${pillClass}`}
                            title={act.subject}
                          >
                            {act.subject}
                          </Link>
                        );
                      })}
                      {dayActs.length > 3 && (
                        <span className="text-[9px] text-slate-500 font-medium pl-1">
                          +{dayActs.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PermissionGate>
    </PageContainer>
  );
}

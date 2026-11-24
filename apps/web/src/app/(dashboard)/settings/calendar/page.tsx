'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { useCalendarConnections } from '@/hooks/use-calendar-sync';
import type { CalendarProvider, CalendarSyncDirection } from '@/types/calendar';
import {
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ArrowLeft,
  Trash2,
  Settings2,
  Link2,
  X,
  KeyRound,
} from 'lucide-react';

export default function CalendarSettingsPage() {
  const { connections, isLoading, saveConnection, isSaving, deleteConnection } =
    useCalendarConnections();

  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider | null>(null);
  const [syncDirection, setSyncDirection] = useState<CalendarSyncDirection>('both');
  const [calendarName, setCalendarName] = useState('Sales Primary Calendar');
  const [calendarIdOrUrl, setCalendarIdOrUrl] = useState('');
  const [syncApiKey, setSyncApiKey] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);

  const googleConn = connections.find((c) => c.provider === 'google_calendar');
  const msConn = connections.find((c) => c.provider === 'microsoft_outlook');

  const handleOpenConnect = (provider: CalendarProvider) => {
    setSelectedProvider(provider);
    const existing = connections.find((c) => c.provider === provider);
    if (existing) {
      setCalendarName(existing.calendar_name || (provider === 'google_calendar' ? 'Google Primary Calendar' : 'Outlook Primary Calendar'));
      setSyncDirection(existing.sync_direction || 'both');
      setCalendarIdOrUrl(existing.calendar_id || '');
    } else {
      setCalendarName(provider === 'google_calendar' ? 'Google Primary Calendar' : 'Outlook Primary Calendar');
      setSyncDirection('both');
      setCalendarIdOrUrl('');
    }
    setSyncApiKey('');
    setShowConfigModal(true);
  };

  const handleSaveConnection = async (status: 'unconfigured' | 'connected' | 'disabled') => {
    if (!selectedProvider) return;
    try {
      const existing = connections.find((c) => c.provider === selectedProvider);
      const isConnected = Boolean(calendarIdOrUrl.trim() || status === 'connected');
      await saveConnection({
        ...(existing?.id ? { id: existing.id } : {}),
        provider: selectedProvider,
        calendar_name: calendarName.trim() || (selectedProvider === 'google_calendar' ? 'Google Calendar' : 'Outlook Calendar'),
        calendar_id: calendarIdOrUrl.trim() || null,
        sync_direction: syncDirection,
        sync_status: isConnected ? 'connected' : 'unconfigured',
        error_message: isConnected ? null : 'Calendar ID / Sync URL pending.',
      });
      setShowConfigModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to save calendar connection:', message);
      alert(`Failed to update calendar configuration: ${message}`);
    }
  };

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/calendar"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calendar
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Calendar Integration Settings
            </h1>
            <p className="text-xs text-slate-500">
              Direct calendar sync with Google Calendar, Microsoft Outlook, or CalDAV / iCal schedule URLs.
            </p>
          </div>
        </div>
      </div>

      <PermissionGate action="calendar.sync" showAccessDenied>
        <div className="space-y-6">
          {/* Active Status Notice */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-900">
                  Direct Calendar Sync Engine Active
                </h3>
                <p className="mt-1 text-xs text-emerald-800">
                  Connect your calendar directly using your Calendar ID, iCal URL, or Google/Microsoft Sync credentials. Meetings scheduled in the CRM automatically synchronize with your external calendar.
                </p>
              </div>
            </div>
          </div>

          {/* Sync Provider Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Google Calendar Card */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 border border-emerald-200">
                      <CalendarIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Google Calendar</h3>
                      <p className="text-xs text-slate-500">Google Workspace & Personal</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      googleConn?.sync_status === 'connected'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-orange-50 text-orange-700 border-orange-200'
                    }`}
                  >
                    {googleConn?.sync_status === 'connected' ? 'Connected' : 'Setup Required'}
                  </span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Bi-directional sync for Customer Meetings and Calls.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Auto-maps Google Meet video links into CRM Activity records.
                  </li>
                </ul>

                {googleConn && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs">
                    <div className="font-semibold text-slate-700">Calendar: {googleConn.calendar_name}</div>
                    <div className="text-slate-500">Direction: {googleConn.sync_direction}</div>
                    {googleConn.calendar_id && (
                      <div className="text-slate-500 font-mono text-[11px] truncate">ID: {googleConn.calendar_id}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => handleOpenConnect('google_calendar')}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
                >
                  {googleConn ? 'Configure Google Sync' : 'Connect Google Calendar'}
                </button>
                {googleConn && (
                  <button
                    type="button"
                    onClick={() => deleteConnection(googleConn.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Microsoft Outlook Card */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-slate-50 p-2.5 text-slate-700 border border-slate-200">
                      <CalendarIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Microsoft Outlook</h3>
                      <p className="text-xs text-slate-500">Office 365 & Exchange</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      msConn?.sync_status === 'connected'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-orange-50 text-orange-700 border-orange-200'
                    }`}
                  >
                    {msConn?.sync_status === 'connected' ? 'Connected' : 'Setup Required'}
                  </span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Sync Outlook events with CRM sales meetings.
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Auto-maps Microsoft Teams video conference links.
                  </li>
                </ul>

                {msConn && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs">
                    <div className="font-semibold text-slate-700">Calendar: {msConn.calendar_name}</div>
                    <div className="text-slate-500">Direction: {msConn.sync_direction}</div>
                    {msConn.calendar_id && (
                      <div className="text-slate-500 font-mono text-[11px] truncate">ID: {msConn.calendar_id}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => handleOpenConnect('microsoft_outlook')}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                >
                  {msConn ? 'Configure Outlook Sync' : 'Connect Outlook Calendar'}
                </button>
                {msConn && (
                  <button
                    type="button"
                    onClick={() => deleteConnection(msConn.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sync Behavior Rules */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Calendar Synchronization Rules</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-xs font-bold text-slate-900">Two-Way Conflict Resolution</h4>
                <p className="mt-1 text-xs text-slate-500">
                  If an event is modified in both the CRM and external calendar simultaneously, the latest timestamp takes precedence.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-xs font-bold text-slate-900">Privacy Safeguards</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Events marked &quot;Private&quot; on external calendars are blocked as &quot;Busy&quot; without importing confidential personal descriptions.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-xs font-bold text-slate-900">Activity Linking</h4>
                <p className="mt-1 text-xs text-slate-500">
                  Meeting attendees are automatically cross-referenced against CRM Contacts and Accounts using email domain matching.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PermissionGate>

      {/* Connection Modal */}
      {showConfigModal && selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Connect {selectedProvider === 'google_calendar' ? 'Google Calendar' : 'Outlook Calendar'}
                  </h3>
                  <p className="text-xs text-slate-500">Connect using Calendar ID or iCal / CalDAV URL</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Calendar Account / Email ID *
                </label>
                <input
                  type="text"
                  required
                  value={calendarIdOrUrl}
                  onChange={(e) => setCalendarIdOrUrl(e.target.value)}
                  placeholder="e.g. yourname@gmail.com or primary"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Enter your Google or Outlook account email, or calendar ID from Calendar Settings.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Target Calendar Label
                </label>
                <input
                  type="text"
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.target.value)}
                  placeholder="e.g. Sales Primary Calendar"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Sync Direction
                </label>
                <select
                  value={syncDirection}
                  onChange={(e) => setSyncDirection(e.target.value as CalendarSyncDirection)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="both">Both Ways (CRM ↔ External Calendar)</option>
                  <option value="crm_to_external">CRM to External Calendar Only</option>
                  <option value="external_to_crm">External Calendar to CRM Only</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveConnection('connected')}
                disabled={isSaving}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs transition disabled:opacity-50"
              >
                {isSaving ? 'Connecting...' : 'Connect Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

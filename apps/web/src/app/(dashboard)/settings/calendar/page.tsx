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
  ShieldAlert,
  ArrowLeft,
  Trash2,
  Settings2,
} from 'lucide-react';

export default function CalendarSettingsPage() {
  const { connections, isLoading, saveConnection, isSaving, deleteConnection } =
    useCalendarConnections();

  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider | null>(null);
  const [syncDirection, setSyncDirection] = useState<CalendarSyncDirection>('both');
  const [calendarName, setCalendarName] = useState('Sales Primary Calendar');
  const [showConfigModal, setShowConfigModal] = useState(false);

  const googleConn = connections.find((c) => c.provider === 'google_calendar');
  const msConn = connections.find((c) => c.provider === 'microsoft_outlook');

  const handleOpenConnect = (provider: CalendarProvider) => {
    setSelectedProvider(provider);
    const existing = connections.find((c) => c.provider === provider);
    if (existing) {
      setCalendarName(existing.calendar_name || (provider === 'google_calendar' ? 'Google Primary Calendar' : 'Outlook Primary Calendar'));
      setSyncDirection(existing.sync_direction || 'both');
    } else {
      setCalendarName(provider === 'google_calendar' ? 'Google Primary Calendar' : 'Outlook Primary Calendar');
      setSyncDirection('both');
    }
    setShowConfigModal(true);
  };

  const handleSaveConnection = async (status: 'unconfigured' | 'connected' | 'disabled') => {
    if (!selectedProvider) return;
    try {
      const existing = connections.find((c) => c.provider === selectedProvider);
      await saveConnection({
        ...(existing?.id ? { id: existing.id } : {}),
        provider: selectedProvider,
        calendar_name: calendarName,
        sync_direction: syncDirection,
        sync_status: status,
        error_message:
          status === 'unconfigured'
            ? 'Provider OAuth credentials not yet verified in environment.'
            : null,
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
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calendar
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Calendar Integration Settings
            </h1>
            <p className="text-xs text-slate-500">
              Bi-directional meeting and task schedule synchronization with Google Calendar and Microsoft Outlook.
            </p>
          </div>
        </div>
      </div>

      <PermissionGate action="calendar.sync" showAccessDenied>
        <div className="space-y-6">
          {/* Honest Status Notice Banner */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Status: BLOCKED (Requires Provider OAuth Configuration)
                </h3>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Database synchronization schemas and connection foundations are active. However, real-time external event synchronization requires OAuth 2.0 Client credentials (Google Cloud Console / Microsoft Entra ID) to be configured in your environment.
                </p>
              </div>
            </div>
          </div>

          {/* Providers Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Google Calendar Card */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-600/40">
                      <CalendarIcon className="h-5 w-5 text-emerald-800 dark:text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Google Calendar
                      </h3>
                      <p className="text-xs text-slate-500">Google Workspace & Personal</p>
                    </div>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                      googleConn?.sync_status === 'connected'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : googleConn?.sync_status === 'disabled'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 '
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}
                  >
                    {googleConn ? googleConn.sync_status : 'Not Configured'}
                  </span>
                </div>

                <div className="mt-5 space-y-2 text-xs text-slate-600">
                  <p>
                    • Bi-directional sync for Customer Meetings and Calls.
                  </p>
                  <p>
                    • Auto-maps Google Meet video links into CRM Activity records.
                  </p>
                  {googleConn && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        Calendar: {googleConn.calendar_name || 'Primary'}
                      </p>
                      <p className="text-slate-500">Direction: {googleConn.sync_direction}</p>
                      {googleConn.error_message && (
                        <p className="mt-1 text-amber-600 dark:text-amber-400">
                          {googleConn.error_message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <button
                  onClick={() => handleOpenConnect('google_calendar')}
                  className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  {googleConn ? 'Manage Google Sync' : 'Connect Google Calendar'}
                </button>

                {googleConn && (
                  <button
                    onClick={async () => {
                      if (confirm('Disconnect Google Calendar?')) {
                        await deleteConnection(googleConn.id);
                      }
                    }}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Microsoft Outlook Calendar Card */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-600/40">
                      <CalendarIcon className="h-5 w-5 text-emerald-800 dark:text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Microsoft Outlook
                      </h3>
                      <p className="text-xs text-slate-500">Office 365 & Exchange</p>
                    </div>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                      msConn?.sync_status === 'connected'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : msConn?.sync_status === 'disabled'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 '
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}
                  >
                    {msConn ? msConn.sync_status : 'Not Configured'}
                  </span>
                </div>

                <div className="mt-5 space-y-2 text-xs text-slate-600">
                  <p>
                    • Sync Outlook events with CRM sales meetings.
                  </p>
                  <p>
                    • Auto-maps Microsoft Teams video conference links.
                  </p>
                  {msConn && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        Calendar: {msConn.calendar_name || 'Primary'}
                      </p>
                      <p className="text-slate-500">Direction: {msConn.sync_direction}</p>
                      {msConn.error_message && (
                        <p className="mt-1 text-amber-600 dark:text-amber-400">
                          {msConn.error_message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <button
                  onClick={() => handleOpenConnect('microsoft_outlook')}
                  className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  {msConn ? 'Manage Outlook Sync' : 'Connect Outlook Calendar'}
                </button>

                {msConn && (
                  <button
                    onClick={async () => {
                      if (confirm('Disconnect Outlook Calendar?')) {
                        await deleteConnection(msConn.id);
                      }
                    }}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sync Preferences & Guidelines */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Calendar Integration Specifications
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-xs font-bold text-slate-900">
                  Conflict Avoidance
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  External calendars verify CRM meetings and prevent double-booking sales reps during client demonstrations.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-xs font-bold text-slate-900">
                  Private Event Shield
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Events marked &quot;Private&quot; on external calendars are blocked as &quot;Busy&quot; without importing confidential personal descriptions.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-xs font-bold text-slate-900">
                  Activity Linking
                </h4>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Configure {selectedProvider === 'google_calendar' ? 'Google Calendar' : 'Outlook Calendar'}
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <strong>OAuth Notice:</strong> In this environment, live external OAuth handshakes require client tokens. Saving creates a local sync profile in state &quot;unconfigured&quot;.
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Target Calendar Name
                </label>
                <input
                  type="text"
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Sync Direction
                </label>
                <select
                  value={syncDirection}
                  onChange={(e) => setSyncDirection(e.target.value as CalendarSyncDirection)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-emerald-200 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="both">Both Ways (CRM ↔ External Calendar)</option>
                  <option value="crm_to_external">CRM to External Calendar Only</option>
                  <option value="external_to_crm">External Calendar to CRM Only</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveConnection('unconfigured')}
                disabled={isSaving}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Connection Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAddCampaignMember } from '@/hooks/use-campaigns';
import type { CampaignMemberStatus, CampaignMemberType } from '@/types/campaigns';

interface AddMemberModalProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
  existingMemberLeadIds?: string[];
  existingMemberContactIds?: string[];
}

export function AddMemberModal({
  campaignId,
  isOpen,
  onClose,
  existingMemberLeadIds = [],
  existingMemberContactIds = [],
}: AddMemberModalProps) {
  const [memberType, setMemberType] = useState<CampaignMemberType>('lead');
  const [selectedId, setSelectedId] = useState<string>('');
  const [status, setStatus] = useState<CampaignMemberStatus>('planned');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const addMemberMutation = useAddCampaignMember();

  const leadsQuery = useQuery({
    queryKey: ['picker-leads', searchTerm],
    enabled: isOpen && memberType === 'lead',
    queryFn: async () => {
      let q = supabase
        .from('leads')
        .select('id, first_name, last_name, company_name, email')
        .order('first_name', { ascending: true })
        .limit(50);

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const contactsQuery = useQuery({
    queryKey: ['picker-contacts', searchTerm],
    enabled: isOpen && memberType === 'contact',
    queryFn: async () => {
      let q = supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .order('first_name', { ascending: true })
        .limit(50);

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError(`Please select a ${memberType}.`);
      return;
    }

    setError(null);
    try {
      await addMemberMutation.mutateAsync({
        campaign_id: campaignId,
        member_type: memberType,
        lead_id: memberType === 'lead' ? selectedId : null,
        contact_id: memberType === 'contact' ? selectedId : null,
        member_status: status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add campaign member');
    }
  };

  const isPending = addMemberMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Add Campaign Member
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Member Type
            </label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="memberType"
                  value="lead"
                  checked={memberType === 'lead'}
                  onChange={() => {
                    setMemberType('lead');
                    setSelectedId('');
                    setSearchTerm('');
                  }}
                  className="text-emerald-800 focus:ring-emerald-500"
                />
                Lead
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="memberType"
                  value="contact"
                  checked={memberType === 'contact'}
                  onChange={() => {
                    setMemberType('contact');
                    setSelectedId('');
                    setSearchTerm('');
                  }}
                  className="text-emerald-800 focus:ring-emerald-500"
                />
                Contact
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Search {memberType === 'lead' ? 'Leads' : 'Contacts'}
            </label>
            <input
              type="text"
              placeholder={`Search by name or email...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Select {memberType === 'lead' ? 'Lead' : 'Contact'} *
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">-- Choose {memberType} --</option>
              {memberType === 'lead' &&
                (leadsQuery.data || []).map((lead: any) => {
                  const alreadyMember = existingMemberLeadIds.includes(lead.id);
                  return (
                    <option key={lead.id} value={lead.id} disabled={alreadyMember}>
                      {lead.first_name} {lead.last_name} {lead.company_name ? `(${lead.company_name})` : ''}{' '}
                      {alreadyMember ? '— Already in Campaign' : ''}
                    </option>
                  );
                })}
              {memberType === 'contact' &&
                (contactsQuery.data || []).map((contact: any) => {
                  const alreadyMember = existingMemberContactIds.includes(contact.id);
                  return (
                    <option key={contact.id} value={contact.id} disabled={alreadyMember}>
                      {contact.first_name} {contact.last_name} {contact.email ? `(${contact.email})` : ''}{' '}
                      {alreadyMember ? '— Already in Campaign' : ''}
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Initial Member Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CampaignMemberStatus)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="planned">Planned</option>
              <option value="sent">Sent</option>
              <option value="recieved">Recieved</option>
              <option value="responded">Responded</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedId}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {isPending ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

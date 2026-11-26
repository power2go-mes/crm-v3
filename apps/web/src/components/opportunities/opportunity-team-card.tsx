'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Users,
  UserPlus,
  Trash2,
  DollarSign,
  Percent,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
} from 'lucide-react';

export interface OpportunityTeamMember {
  id: string;
  opportunity_id: string;
  user_id: string;
  team_role: 'Sales Rep' | 'Solutions Architect' | 'Account Executive' | 'Product Specialist' | 'Deal Support' | 'Executive Sponsor';
  access_level: 'read' | 'edit';
  split_percentage: number;
  created_at: string;
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

interface OpportunityTeamCardProps {
  opportunityId: string;
  opportunityAmount: number;
  dealName?: string;
}

const TEAM_ROLES = [
  'Sales Rep',
  'Solutions Architect',
  'Account Executive',
  'Product Specialist',
  'Deal Support',
  'Executive Sponsor',
] as const;

export function OpportunityTeamCard({
  opportunityId,
  opportunityAmount,
  dealName = 'Deal',
}: OpportunityTeamCardProps) {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('Sales Rep');
  const [accessLevel, setAccessLevel] = useState<'read' | 'edit'>('read');
  const [splitPercent, setSplitPercent] = useState<number>(0);

  // 1. Query team members
  const { data: members = [], isLoading } = useQuery<OpportunityTeamMember[]>({
    queryKey: ['opportunity-team-members', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunity_team_members')
        .select(`
          *,
          user:user_profiles!user_id(id, first_name, last_name, email)
        `)
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as OpportunityTeamMember[]) ?? [];
    },
  });

  // 2. Query available users
  const usersQuery = useQuery({
    queryKey: ['team-selling-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email')
        .eq('is_active', true);
      return data ?? [];
    },
  });

  // 3. Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('add_opportunity_team_member', {
        p_opportunity_id: opportunityId,
        p_user_id: selectedUserId,
        p_team_role: selectedRole,
        p_access_level: accessLevel,
        p_split_percentage: Number(splitPercent) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-team-members', opportunityId] });
      setIsAddModalOpen(false);
      setSelectedUserId('');
      setSplitPercent(0);
    },
  });

  // 4. Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('opportunity_team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-team-members', opportunityId] });
    },
  });

  const totalSplitPercent = members.reduce(
    (sum, m) => sum + (Number(m.split_percentage) || 0),
    0
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Deal Team & Revenue Splits ({members.length})
          </h3>
        </div>

        {hasPermission('opportunities.manage_team') && (
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-2xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {/* Split Allocation Progress Bar */}
      <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Split Allocation:</span>
          <span
            className={`font-bold ${
              totalSplitPercent === 100
                ? 'text-emerald-600'
                : totalSplitPercent > 100
                ? 'text-red-600'
                : 'text-amber-600'
            }`}
          >
            {totalSplitPercent}% of 100%
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          Deal Value: ${opportunityAmount.toLocaleString()}
        </span>
      </div>

      {/* Member List */}
      <div className="divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-slate-400">Loading deal collaborators...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-700">No Co-sellers or Team Members Assigned</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Add technical architects, deal specialists, or overlay reps to allocate revenue credit.
            </p>
          </div>
        ) : (
          members.map((m) => {
            const splitDollar = (Number(m.split_percentage) / 100) * opportunityAmount;
            return (
              <div
                key={m.id}
                className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {m.user
                        ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.trim() || m.user.email
                        : 'Unknown User'}
                    </h4>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                      {m.team_role}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        m.access_level === 'edit'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      {m.access_level === 'edit' ? 'Can Edit Deal' : 'Read Only'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{m.user?.email}</p>
                </div>

                {/* Split Credit */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800">
                      {m.split_percentage}% Split
                    </span>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      ${splitDollar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  {hasPermission('opportunities.manage_team') && (
                    <button
                      type="button"
                      onClick={() => removeMemberMutation.mutate(m.id)}
                      title="Remove member"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-900">Add Deal Collaborator</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Team Member <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Select a user...</option>
                  {(usersQuery.data || []).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Team Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {TEAM_ROLES.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Access Level
                  </label>
                  <select
                    value={accessLevel}
                    onChange={e => setAccessLevel(e.target.value as 'read' | 'edit')}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="read">Read Only</option>
                    <option value="edit">Can Edit Deal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Revenue Split Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="e.g. 25"
                    value={splitPercent}
                    onChange={e => setSplitPercent(Number(e.target.value))}
                    className="w-full text-xs p-2 pr-8 border border-slate-300 rounded-lg"
                  />
                  <Percent className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Credit amount: ${(((splitPercent || 0) / 100) * opportunityAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addMemberMutation.mutate()}
                disabled={addMemberMutation.isPending || !selectedUserId}
                className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-xs transition disabled:opacity-50"
              >
                {addMemberMutation.isPending ? 'Adding...' : 'Add to Deal Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

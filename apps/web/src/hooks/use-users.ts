'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface UserProfileOption {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export interface UserProfileDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  department: string | null;
  designation: string | null;
  is_active: boolean;
  created_at: string;
  roleId: string;
  roleName: string;
  hierarchyRank: number;
  managerName: string | null;
  managerId: string | null;
}

export function useUsers() {
  const supabase = createClient();

  return useQuery<UserProfileOption[]>({
    queryKey: ['user-profiles-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, is_active')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

export function useUsersList() {
  const supabase = createClient();

  return useQuery<UserProfileDetail[]>({
    queryKey: ['users-list-management'],
    queryFn: async () => {
      // 1. Fetch user profiles with explicit user_roles join
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          department,
          designation,
          is_active,
          created_at,
          user_roles:user_roles!user_roles_user_id_fkey(
            role_id,
            role:roles(name, hierarchy_rank)
          )
        `)
        .order('first_name', { ascending: true });

      if (profilesError) throw profilesError;

      // 2. Fetch reporting managers
      const { data: relationships } = await supabase
        .from('sales_reporting_relationships')
        .select(`
          user_id,
          manager_id,
          manager:user_profiles!sales_reporting_relationships_manager_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `);

      const managerMap = new Map<string, { id: string; name: string }>();
      for (const rel of (relationships as any[]) || []) {
        if (rel.manager) {
          managerMap.set(rel.user_id, {
            id: rel.manager.id,
            name: `${rel.manager.first_name || ''} ${rel.manager.last_name || ''}`.trim() || rel.manager.email,
          });
        }
      }

      return (profiles || []).map((u: any) => {
        const primaryRole = u.user_roles?.[0]?.role;
        const roleId = u.user_roles?.[0]?.role_id || 'BDO';
        const roleName = primaryRole?.name || roleId;
        const hierarchyRank = primaryRole?.hierarchy_rank ?? 5;
        const mgr = managerMap.get(u.id);

        return {
          id: u.id,
          email: u.email,
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          phone: u.phone,
          avatar_url: u.avatar_url,
          department: u.department,
          designation: u.designation,
          is_active: u.is_active,
          created_at: u.created_at,
          roleId,
          roleName,
          hierarchyRank,
          managerName: mgr?.name || null,
          managerId: mgr?.id || null,
        };
      });
    },
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list-management'] });
      queryClient.invalidateQueries({ queryKey: ['user-profiles-options'] });
      queryClient.invalidateQueries({ queryKey: ['sales-performance'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      first_name: string;
      last_name: string;
      phone?: string | null;
      department?: string | null;
      designation?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone: payload.phone || null,
          department: payload.department || null,
          designation: payload.designation || null,
        })
        .eq('id', payload.userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-list-management'] });
      queryClient.invalidateQueries({ queryKey: ['user-profiles-options'] });
      queryClient.invalidateQueries({ queryKey: ['sales-performance'] });
    },
  });
}

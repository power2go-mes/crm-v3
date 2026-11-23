'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CrmNotification } from '@/types/notifications';

export function useNotifications(filter: 'all' | 'unread' = 'all') {
  const supabase = createClient() as any;
  const queryClient = useQueryClient();

  // 1. Fetch unread count
  const unreadCountQuery = useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('crm_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // 2. Fetch notification list and check sales reminders
  const notificationsQuery = useQuery<CrmNotification[]>({
    queryKey: ['notifications', 'list', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Check for sales reminders
      try {
        await supabase.rpc('generate_sales_reminders', { p_target_user_id: user.id });
      } catch {
        // Silently continue if reminders check fails
      }

      let query = supabase
        .from('crm_notifications')
        .select(`
          *,
          sender:user_profiles!sender_id(id, first_name, last_name, email)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'unread') {
        query = query.eq('read', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as CrmNotification[]) ?? [];
    },
    refetchInterval: 30000,
  });

  // 3. Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('crm_notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 4. Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { error } = await supabase.rpc('mark_all_notifications_read');
        if (error) throw error;
      } catch {
        // Fallback to direct update if RPC is restricted
        await supabase
          .from('crm_notifications')
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('read', false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 5. Delete / dismiss notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('crm_notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    unreadCount: unreadCountQuery.data ?? 0,
    notifications: notificationsQuery.data ?? [],
    isLoading: notificationsQuery.isLoading,
    isError: notificationsQuery.isError,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    isMarkingAllRead: markAllAsReadMutation.isPending,
    deleteNotification: deleteNotificationMutation.mutate,
    refetch: () => {
      unreadCountQuery.refetch();
      notificationsQuery.refetch();
    },
  };
}

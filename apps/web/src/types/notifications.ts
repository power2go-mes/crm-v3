export type NotificationCategory =
  | 'general'
  | 'lead'
  | 'task'
  | 'call'
  | 'meeting'
  | 'deal'
  | 'system'
  | 'campaign'
  | 'account'
  | 'contact';

export interface CrmNotification {
  id: string;
  user_id: string;
  sender_id: string | null;
  title: string;
  message: string;
  url: string | null;
  category: NotificationCategory;
  read: boolean;
  read_at: string | null;
  created_at: string;
  sender?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export type EmailProvider = 'google' | 'microsoft' | 'smtp';
export type EmailAuthStatus = 'connected' | 'disconnected' | 'expired' | 'error' | 'unconfigured';
export type EmailTemplateCategory = 'general' | 'sales_pitch' | 'follow_up' | 'quotation' | 'meeting' | 'renewal';
export type EmailStatus = 'draft' | 'queued' | 'sent' | 'provider_accepted' | 'delivered' | 'failed' | 'received';

export interface CrmEmailAccount {
  id: string;
  user_id: string;
  provider: EmailProvider;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  is_default: boolean;
  auth_status: EmailAuthStatus;
  status_message: string | null;
  encrypted_tokens?: any;
  created_at: string;
  updated_at: string;
}

export interface CrmEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: EmailTemplateCategory;
  is_shared: boolean;
  is_active: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  creator?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export interface CrmEmail {
  id: string;
  user_id: string;
  related_to_type: 'account' | 'contact' | 'opportunity' | 'lead';
  related_to_id: string;
  recipient_email: string;
  recipient_name: string | null;
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_html: string;
  template_id: string | null;
  status: EmailStatus;
  error_message: string | null;
  provider: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export const EMAIL_TEMPLATE_CATEGORIES: { id: EmailTemplateCategory; label: string }[] = [
  { id: 'general', label: 'General Announcement' },
  { id: 'sales_pitch', label: 'Initial Sales Pitch' },
  { id: 'follow_up', label: 'Follow Up / Inactivity' },
  { id: 'quotation', label: 'Quotation & Proposal Delivery' },
  { id: 'meeting', label: 'Meeting Confirmation' },
  { id: 'renewal', label: 'Contract Renewal' },
];

export const EMAIL_MERGE_FIELDS = [
  { tag: '{{contact.first_name}}', description: "Recipient's First Name" },
  { tag: '{{contact.last_name}}', description: "Recipient's Last Name" },
  { tag: '{{contact.email}}', description: "Recipient's Email" },
  { tag: '{{account.name}}', description: "Company / Account Name" },
  { tag: '{{user.name}}', description: "Your Full Name" },
  { tag: '{{user.email}}', description: "Your Email Address" },
];

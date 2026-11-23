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
  { id: 'general', label: 'General Communication' },
  { id: 'sales_pitch', label: 'Sales Pitch & Intro' },
  { id: 'follow_up', label: 'Deal Follow-Up' },
  { id: 'quotation', label: 'Quotation & Pricing' },
  { id: 'meeting', label: 'Meeting Invitation' },
  { id: 'renewal', label: 'Contract & Renewal' },
];

export const EMAIL_MERGE_FIELDS = [
  { token: '{{recipient.name}}', label: 'Recipient Name' },
  { token: '{{recipient.email}}', label: 'Recipient Email' },
  { token: '{{account.name}}', label: 'Account Name' },
  { token: '{{opportunity.name}}', label: 'Opportunity Name' },
  { token: '{{opportunity.amount}}', label: 'Opportunity Amount' },
  { token: '{{opportunity.stage}}', label: 'Opportunity Stage' },
  { token: '{{sender.name}}', label: 'Your Name' },
  { token: '{{sender.email}}', label: 'Your Email' },
];

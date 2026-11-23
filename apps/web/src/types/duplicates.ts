export interface DuplicateCandidate<T = any> {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  contact_number?: string;
  website?: string;
  industry?: string;
  annual_revenue?: number;
  account_id?: string;
  account_owner_id?: string;
  created_at: string;
  match_reasons: string[];
  confidence_score: number;
  data?: T;
}

export interface DuplicateRule {
  id: string;
  entity_type: 'accounts' | 'contacts' | 'opportunities';
  rule_name: string;
  match_fields: string[];
  threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface MergeLog {
  id: string;
  entity_type: 'accounts' | 'contacts' | 'opportunities';
  master_id: string;
  victim_id: string;
  merge_details: {
    master_name?: string;
    victim_name?: string;
    repointed_contacts?: number;
    repointed_opportunities?: number;
    repointed_quotes?: number;
    repointed_campaign_members?: number;
    repointed_activities?: number;
    overrides?: Record<string, any>;
  };
  merged_by_id?: string | null;
  merged_at: string;
}

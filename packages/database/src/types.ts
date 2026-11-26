export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CanonicalRole =
  | "SUPER_ADMIN"
  | "HEAD_OF_SALES"
  | "RSM"
  | "SSM"
  | "ASM"
  | "BDO";

export interface Database {
  public: {
    Tables: {
      dashboard_folders: {
        Row: { id:string;folder_owner_id:string;name:string;description:string|null;parent_folder_id:string|null;created_at:string;updated_at:string };
        Insert: { id?:string;folder_owner_id?:string;name:string;description?:string|null;parent_folder_id?:string|null };
        Update: { name?:string;description?:string|null;parent_folder_id?:string|null };
        Relationships: [];
      };
      saved_dashboards: {
        Row: { id:string;dashboard_owner_id:string;name:string;description:string|null;folder_id:string|null;is_default:boolean;is_favorite:boolean;is_active:boolean;created_at:string;updated_at:string };
        Insert: { id?:string;dashboard_owner_id?:string;name:string;description?:string|null;folder_id?:string|null;is_default?:boolean;is_favorite?:boolean;is_active?:boolean };
        Update: { name?:string;description?:string|null;folder_id?:string|null;is_favorite?:boolean;is_active?:boolean };
        Relationships: [];
      };
      saved_dashboard_components: {
        Row: { id:string;dashboard_id:string;component_owner_id:string;name:string;component_type:'chart'|'table_data'|'kpi';source_id:string;chart_type:string|null;grouping_field:string|null;secondary_grouping:string|null;metric_type:string|null;y_axis_metric_type:string|null;columns:Json;sequence:number;created_at:string;updated_at:string };
        Insert: { id?:string;dashboard_id:string;component_owner_id?:string;name:string;component_type:'chart'|'table_data'|'kpi';source_id:string;chart_type?:string|null;grouping_field?:string|null;secondary_grouping?:string|null;metric_type?:string|null;y_axis_metric_type?:string|null;columns?:Json;sequence?:number };
        Update: { name?:string;component_type?:'chart'|'table_data'|'kpi';source_id?:string;chart_type?:string|null;grouping_field?:string|null;secondary_grouping?:string|null;metric_type?:string|null;y_axis_metric_type?:string|null;columns?:Json;sequence?:number };
        Relationships: [];
      };
      crm_holidays: {
        Row: { id: string; definition: Json; name: string; is_recurring: boolean; all_users: boolean; start_date: string; end_date: string; created_by_id: string | null; updated_by_id: string | null; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      crm_holiday_users: { Row: { holiday_id: string; user_id: string }; Insert: never; Update: never; Relationships: [] };
      business_hour_holidays: { Row: { business_hour_id: number; holiday_id: string }; Insert: never; Update: never; Relationships: [] };
      business_hours: {
        Row: { id: number; definition: Json; updated_by_id: string | null; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      crm_login_history: {
        Row: { id: string; auth_session_id: string; event_type: 'login' | 'logout'; user_id: string; login_at: string; user_agent: string | null; ip: string | null; expires_at: string | null; ended_at: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_password_changes: {
        Row: { user_id: string; changed_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      crm_import_jobs: {
        Row: { id: string; user_id: string; module: string; import_name: string; filename: string; source_csv: string; headers: Json; rows: Json; configuration: Json | null; status: string; result: Json | null; created_at: string; completed_at: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      crm_export_jobs: {
        Row: { id: string; user_id: string; module: string; columns: Json; time_zone: string; status: string; cursor_id: string | null; processed_rows: number; part_count: number; output_bytes: number; storage_path: string | null; error_message: string | null; claim_token: string | null; lease_expires_at: string | null; created_at: string; updated_at: string; completed_at: string | null };
        Insert: { module: string; columns: Json; time_zone?: string; id?: string; user_id?: string; status?: string; cursor_id?: string | null; processed_rows?: number; part_count?: number; output_bytes?: number; storage_path?: string | null; error_message?: string | null; claim_token?: string | null; lease_expires_at?: string | null; created_at?: string; updated_at?: string; completed_at?: string | null };
        Update: never;
        Relationships: [];
      };
      crm_field_requirements: {
        Row: { definition_id: string; required: boolean };
        Insert: { definition_id: string; required: boolean };
        Update: { required?: boolean };
        Relationships: [];
      };
      departments: {
        Row: { id: string; department_name: string; description: string | null; created_by_id: string | null; created_at: string; updated_at: string; deleted_at: string | null };
        Insert: { department_name: string; description?: string | null };
        Update: { department_name?: string; description?: string | null };
        Relationships: [];
      };
      campaigns: {
        Row: CampaignRecord;
        Insert: Pick<CampaignRecord,'campaign_name'|'campaign_owner_id'|'campaign_type'> & Partial<Omit<CampaignRecord,'campaign_name'|'campaign_owner_id'|'campaign_type'>>;
        Update: Partial<CampaignRecord>;
        Relationships: [];
      };

      company_settings: {
        Row: {
          id: number;
          company_name: string;
          legal_name: string | null;
          domain: string | null;
          support_email: string | null;
          phone_number: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          postal_code: string | null;
          currency: string | null;
          time_zone: string | null;
          fiscal_year_start_month: number | null;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          company_name: string;
          legal_name?: string | null;
          domain?: string | null;
          support_email?: string | null;
          phone_number?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          postal_code?: string | null;
          currency?: string | null;
          time_zone?: string | null;
          fiscal_year_start_month?: number | null;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          company_name?: string;
          legal_name?: string | null;
          domain?: string | null;
          support_email?: string | null;
          phone_number?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          postal_code?: string | null;
          currency?: string | null;
          time_zone?: string | null;
          fiscal_year_start_month?: number | null;
          logo_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
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
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          department?: string | null;
          designation?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          department?: string | null;
          designation?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_canonical: boolean;
          hierarchy_rank: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          is_canonical?: boolean;
          hierarchy_rank?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_canonical?: boolean;
          hierarchy_rank?: number | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          module: string;
          action: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id: string;
          module: string;
          action: string;
          description: string;
          created_at?: string;
        };
        Update: {
          module?: string;
          action?: string;
          description?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          is_granted: boolean;
          created_at: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
          is_granted?: boolean;
          created_at?: string;
        };
        Update: {
          is_granted?: boolean;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          role_id?: string;
          assigned_by?: string | null;
        };
        Relationships: [];
      };
      sales_regions: {
        Row: {
          id: string;
          name: string;
          code: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          code?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      sales_teams: {
        Row: {
          id: string;
          name: string;
          region_id: string;
          team_lead_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          region_id: string;
          team_lead_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          region_id?: string;
          team_lead_id?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      sales_reporting_relationships: {
        Row: {
          id: string;
          user_id: string;
          manager_id: string | null;
          region_id: string | null;
          team_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          manager_id?: string | null;
          region_id?: string | null;
          team_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          manager_id?: string | null;
          region_id?: string | null;
          team_id?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_notes: {
        Row: { id: string; lead_id: string; title: string; body: string; created_by_id: string | null; created_at: string };
        Insert: { id?: string; lead_id: string; title: string; body?: string };
        Update: { title?: string; body?: string };
        Relationships: [];
      };
      crm_calendar_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          calendar_id: string | null;
          calendar_name: string | null;
          sync_status: string;
          sync_direction: string;
          last_synced_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          calendar_id?: string | null;
          calendar_name?: string | null;
          sync_status?: string;
          sync_direction?: string;
          last_synced_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          calendar_id?: string | null;
          calendar_name?: string | null;
          sync_status?: string;
          sync_direction?: string;
          last_synced_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          title: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          company_name: string | null;
          status: string;
          lead_owner_id: string | null;
          sub_owner_id: string | null;
          lead_source: string | null;
          industry: string | null;
          no_of_employees: number | null;
          annual_revenue: number | null;
          country: string | null;
          state: string | null;
          city: string | null;
          zip_code: string | null;
          fax: string | null;
          requirements: string | null;
          is_convert: boolean;
          lead_score: number;
          created_by_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          company_name?: string | null;
          status?: string;
          lead_owner_id?: string | null;
          sub_owner_id?: string | null;
          lead_source?: string | null;
          industry?: string | null;
          no_of_employees?: number | null;
          annual_revenue?: number | null;
          country?: string | null;
          state?: string | null;
          city?: string | null;
          zip_code?: string | null;
          fax?: string | null;
          requirements?: string | null;
          is_convert?: boolean;
          lead_score?: number;
          created_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          company_name?: string | null;
          status?: string;
          lead_owner_id?: string | null;
          sub_owner_id?: string | null;
          lead_source?: string | null;
          industry?: string | null;
          no_of_employees?: number | null;
          annual_revenue?: number | null;
          country?: string | null;
          state?: string | null;
          city?: string | null;
          zip_code?: string | null;
          fax?: string | null;
          requirements?: string | null;
          is_convert?: boolean;
          lead_score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_statuses: {
        Row: {
          id: string;
          name: string;
          order_index: number;
          color: string;
          probability: number;
          is_final: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          order_index: number;
          color?: string;
          probability?: number;
          is_final?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          order_index?: number;
          color?: string;
          probability?: number;
          is_final?: boolean;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          account_type: string | null;
          id: string;
          name: string;
          account_owner_id: string | null;
          contact_number: string | null;
          annual_revenue: number | null;
          industry: string | null;
          no_of_employees: number | null;
          fax: string | null;
          account_source: string | null;
          website: string | null;
          billing_address: string | null;
          shipping_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          account_type?: string | null;
          id?: string;
          name: string;
          account_owner_id?: string | null;
          contact_number?: string | null;
          annual_revenue?: number | null;
          industry?: string | null;
          no_of_employees?: number | null;
          fax?: string | null;
          account_source?: string | null;
          website?: string | null;
          billing_address?: string | null;
          shipping_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_type?: string | null;
          name?: string;
          account_owner_id?: string | null;
          contact_number?: string | null;
          annual_revenue?: number | null;
          industry?: string | null;
          no_of_employees?: number | null;
          fax?: string | null;
          account_source?: string | null;
          website?: string | null;
          billing_address?: string | null;
          shipping_address?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          contact_source: string | null;
          parent_contact_id: string | null;
          is_primary: boolean;
          id: string;
          account_id: string | null;
          first_name: string;
          last_name: string;
          title: string | null;
          email: string | null;
          contact_number: string | null;
          secondary_contact_number: string | null;
          contact_owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          contact_source?: string | null;
          parent_contact_id?: string | null;
          is_primary?: boolean;
          id?: string;
          account_id?: string | null;
          first_name: string;
          last_name: string;
          title?: string | null;
          email?: string | null;
          contact_number?: string | null;
          secondary_contact_number?: string | null;
          contact_owner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          contact_source?: string | null;
          account_id?: string | null;
          first_name?: string;
          last_name?: string;
          title?: string | null;
          email?: string | null;
          contact_number?: string | null;
          secondary_contact_number?: string | null;
          contact_owner_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          primary_campaign_source_id: string | null;
          lead_source: string | null;
          id: string;
          name: string;
          account_id: string;
          owner_id: string | null;
          stage: string;
          amount: number | null;
          close_date: string;
          probability: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          primary_campaign_source_id?: string | null;
          lead_source?: string | null;
          id?: string;
          name: string;
          account_id: string;
          owner_id?: string | null;
          stage?: string;
          amount?: number | null;
          close_date: string;
          probability?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          primary_campaign_source_id?: string | null;
          lead_source?: string | null;
          name?: string;
          account_id?: string;
          owner_id?: string | null;
          stage?: string;
          amount?: number | null;
          close_date?: string;
          probability?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          activity_type: 'task' | 'log_call' | 'meeting' | 'event';
          subject: string;
          description: string | null;
          status: string;
          priority: string;
          due_date: string | null;
          start_time: string | null;
          end_time: string | null;
          location: string | null;
          meeting_url: string | null;
          call_type: 'inbound' | 'outbound' | null;
          call_duration_minutes: number | null;
          related_to_type: 'lead' | 'contact' | 'account' | 'opportunity' | null;
          related_to_id: string | null;
          assigned_to_id: string | null;
          created_by_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          activity_type: 'task' | 'log_call' | 'meeting' | 'event';
          subject: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          meeting_url?: string | null;
          call_type?: 'inbound' | 'outbound' | null;
          call_duration_minutes?: number | null;
          related_to_type?: 'lead' | 'contact' | 'account' | 'opportunity' | null;
          related_to_id?: string | null;
          assigned_to_id?: string | null;
          created_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          activity_type?: 'task' | 'log_call' | 'meeting' | 'event';
          subject?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          due_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          location?: string | null;
          meeting_url?: string | null;
          call_type?: 'inbound' | 'outbound' | null;
          call_duration_minutes?: number | null;
          related_to_type?: 'lead' | 'contact' | 'account' | 'opportunity' | null;
          related_to_id?: string | null;
          assigned_to_id?: string | null;
          created_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_members: {
        Row: {
          created_by_id: string | null;
          id: string;
          campaign_id: string;
          member_type: 'lead' | 'contact';
          lead_id: string | null;
          contact_id: string | null;
          member_status: string;
          created_at: string | null;
        };
        Insert: {
          created_by_id?: string | null;
          id?: string;
          campaign_id: string;
          member_type?: 'lead' | 'contact';
          lead_id?: string | null;
          contact_id?: string | null;
          member_status: string;
          created_at?: string;
        };
        Update: {
          created_by_id?: string | null;
          id?: string;
          campaign_id?: string;
          member_type?: 'lead' | 'contact';
          lead_id?: string | null;
          contact_id?: string | null;
          member_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          activity_type: string;
          subject: string;
          description: string | null;
          status: string;
          priority: string | null;
          due_date: string | null;
          duration_minutes: number | null;
          created_by_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          activity_type: string;
          subject: string;
          description?: string | null;
          status?: string;
          priority?: string | null;
          due_date?: string | null;
          duration_minutes?: number | null;
          created_by_id?: string | null;
          created_at?: string;
        };
        Update: {
          activity_type?: string;
          subject?: string;
          description?: string | null;
          status?: string;
          priority?: string | null;
          due_date?: string | null;
          duration_minutes?: number | null;
        };
        Relationships: [];
      };
      lead_history: {
        Row: {
          id: string;
          lead_id: string;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          field_name: string;
          old_value?: string | null;
          new_value?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          field_name?: string;
          old_value?: string | null;
          new_value?: string | null;
        };
        Relationships: [];
      };
      crm_field_definitions: {
        Row: {
          id: string;
          module: string;
          key: string;
          label: string;
          type: string;
          required: boolean;
          relaxable: boolean;
          is_custom: boolean;
          sensitive: boolean;
          archived: boolean;
          position: number;
          choices: Json;
        };
        Insert: {
          id?: string;
          module: string;
          key: string;
          label: string;
          type: string;
          required?: boolean;
          relaxable?: boolean;
          is_custom?: boolean;
          sensitive?: boolean;
          archived?: boolean;
          position?: number;
          choices?: Json;
        };
        Update: {
          module?: string;
          key?: string;
          label?: string;
          type?: string;
          required?: boolean;
          relaxable?: boolean;
          is_custom?: boolean;
          sensitive?: boolean;
          archived?: boolean;
          position?: number;
          choices?: Json;
        };
        Relationships: [];
      };
      crm_history_events: {
        Row: {
          id: string;
          module: string;
          record_id: string;
          transaction_id: number;
          action: 'create' | 'update' | 'delete';
          actor_id: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          module: string;
          record_id: string;
          transaction_id?: number;
          action: 'create' | 'update' | 'delete';
          actor_id?: string | null;
          occurred_at?: string;
        };
        Update: {
          module?: string;
          record_id?: string;
          action?: 'create' | 'update' | 'delete';
          actor_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_sales_reminders: { Args: { p_target_user_id: string | null }; Returns: Json };
      company_currency_page: { Args: { p_page: number; p_date: string | null }; Returns: Json };
      set_multiple_currency_enabled: { Args: { p_enabled: boolean }; Returns: undefined };
      save_company_currency: { Args: { p_id: string | null; p_currency: string; p_rate: string; p_decimal_places: number }; Returns: string };
      delete_company_currency: { Args: { p_id: string }; Returns: undefined };
      save_company_exchange_rates: { Args: { p_rates: Json; p_start_date: string | null }; Returns: undefined };
      change_company_default_currency: { Args: { p_id: string }; Returns: undefined };
      company_currency_catalog: { Args: { p_date: string | null }; Returns: Json };
      company_currency_rate: { Args: { p_id: string; p_on_date: string | null }; Returns: number };
      save_shift_hours: { Args: { p_id: string | null; p_definition: Json; p_users: string[] }; Returns: string };
      delete_shift_hours: { Args: { p_id: string }; Returns: undefined };
      shift_hours_catalog: { Args: { p_page: number; p_search: string }; Returns: Json };
      business_holiday_catalog: { Args: { p_linked: boolean; p_search: string; p_page: number }; Returns: Json };
      save_holiday: { Args: { p_id: string | null; p_definition: Json; p_users: string[] }; Returns: string };
      delete_holiday: { Args: { p_id: string }; Returns: undefined };
      set_business_hour_holidays: { Args: { p_ids: string[]; p_remove: boolean }; Returns: undefined };
      save_business_hours: { Args: { p_definition: Json; p_create: boolean }; Returns: undefined };
      settings_role_catalog: { Args: { p_kind: string; p_search: string; p_page: number; p_sort: string; p_ascending: boolean }; Returns: Json };
      save_settings_role: { Args: { p_kind: string; p_id: string | null; p_name: string; p_description: string | null }; Returns: string };
      delete_settings_role: { Args: { p_kind: string; p_id: string; p_confirm_relationships: boolean }; Returns: undefined };
      create_lead_import: { Args: { p_name: string; p_filename: string; p_csv: string; p_headers: Json; p_rows: Json }; Returns: string };
      run_lead_import: { Args: { p_job: string; p_mapping: Json; p_mode: string; p_match?: string[]; p_limit?: number }; Returns: Json };
      claim_crm_export_job: { Args: { p_job: string }; Returns: Json };
      complete_crm_export_batch: { Args: { p_job: string; p_claim_token: string; p_cursor_id: string | null; p_batch_rows: number; p_part_bytes: number; p_finished: boolean }; Returns: boolean };
      release_crm_export_job: { Args: { p_job: string; p_claim_token: string; p_error: string; p_terminal?: boolean }; Returns: boolean };
      crm_shared_put_definition: { Args: { payload: Json }; Returns: string };
      crm_shared_delete_definition: { Args: { fid: string }; Returns: undefined };
      save_department: { Args: { p_id: string | null; p_name: string; p_description: string | null }; Returns: string };
      set_department_deleted: { Args: { p_id: string; p_deleted: boolean }; Returns: undefined };
      forecast_pipeline_metrics: {
        Args: { date_from?: string | null; date_to?: string | null };
        Returns: Json;
      };
      dashboard_home_table: {Args:{widget:string;page_number?:number;date_from?:string|null;date_to?:string|null};Returns:Json};
      dashboard_home_table_page: {Args:{widget:string;page_number?:number;date_from?:string|null;date_to?:string|null;search_query?:string;sort_field?:string;sort_direction?:string};Returns:Json};
      dashboard_home_metrics: { Args: {date_from?: string | null;date_to?: string | null}; Returns: Json };
      leads_chart_aggregate: { Args: {p_group?: string;p_value?: string;p_filters?: Json;p_converted?: boolean};Returns: Json };
      leads_report_summary: { Args: { p_report: string }; Returns: Json };
      lead_bulk_change: { Args: { p_ids: string[]; p_status?: string }; Returns: number };
      lead_bulk_edit: { Args: { p_ids: string[]; p_field: string; p_value: string }; Returns: number };
      begin_lead_pending_attachment: { Args: { p_submission_id: string; p_lead_id: string; p_name: string }; Returns: undefined };
      confirm_expired_lead_attachment_cleanup: { Args: { p_submission_id: string; p_confirmed: boolean }; Returns: { lead_id: string; object_name: string }[] };
      prepare_lead_attachment_removal: { Args: { p_lead_id: string; p_name: string }; Returns: undefined };
      lead_save_form: { Args: { p_id: string | null; p_standard: Json; p_custom: Json }; Returns: string };
      lead_archive_selected: { Args: { p_ids: string[] }; Returns: number };
      lead_archived_list: { Args: { p_offset?: number }; Returns: { id: string; title: string; archived_at: string }[] };
      lead_restore: { Args: { p_id: string }; Returns: undefined };
      dashboard_home_layout: { Args: {order_ids?: Json | null;reset_layout?: boolean}; Returns: Json };
      saved_dashboard_set_default: { Args: {target?:string|null}; Returns: undefined };
      save_contact_atomic: { Args: { cid: string | null; fields: Json; relationships?: Json | null }; Returns: string };
      contact_accounts: { Args: { cid: string }; Returns: Json };
      contact_account_roles: { Args: Record<string, never>; Returns: Json };
      set_contact_account: { Args: { cid: string; aid: string; rid?: string | null; remove_link?: boolean }; Returns: undefined };

      crm_shared_personalization: { Args: { m: string }; Returns: Json };
      crm_shared_history: {
        Args: { m: string; rid: string; lim?: number; off?: number };
        Returns: Json;
      };
      crm_shared_preferences: {
        Args: { m: string; ctx: string; url: string; s: Json };
        Returns: undefined;
      };
      crm_shared_touch_record: { Args: { m: string; rid: string }; Returns: undefined };
      crm_shared_metadata: {
        Args: { m: string };
        Returns: Json;
      };
      crm_shared_values: { Args: { m: string; rid: string }; Returns: Json };
      get_subordinates: {
        Args: { p_user_id: string };
        Returns: { subordinate_id: string; depth: number }[];
      };
      get_accessible_user_ids: {
        Args: { p_acting_user_id: string };
        Returns: { accessible_user_id: string }[];
      };
      has_effective_permission: {
        Args: { p_user_id: string; p_permission_id: string };
        Returns: boolean;
      };
      is_active_employee: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      convert_lead: {
        Args: {
          p_lead_id: string;
          p_account_action: string;
          p_account_id?: string | null;
          p_account_name?: string | null;
          p_contact_action?: string;
          p_contact_id?: string | null;
          p_contact_first_name?: string | null;
          p_contact_last_name?: string | null;
          p_opportunity_action?: string;
          p_opportunity_id?: string | null;
          p_opportunity_name?: string | null;
          p_opportunity_amount?: number | null;
          p_opportunity_close_date?: string | null;
          p_owner_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type CampaignRecord = {
 id:string; campaign_name:string;campaign_owner_id:string;campaign_type:string;status:string;
 parent_campaign_id:string|null;start_date:string|null;end_date:string|null;
 expected_revenue:number|null;budget_cost:number|null;actual_cost:number|null;expected_response:number|null;
 number_sent:number;description:string|null;leads_in_campaign:number;converted_leads_in_campaign:number;contacts_in_campaign:number;opportunities_in_campaign:number;won_opportunities_in_campaign:number;value_opportunities:number;value_won_opportunities:number;responses_in_campaign:number;created_at:string;updated_at:string;
}

export type CampaignMemberRecord={id:string;campaign_id:string;member_type:'lead'|'contact';lead_id:string|null;contact_id:string|null;member_status:string;created_by_id:string|null;created_at:string|null};

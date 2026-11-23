-- FINLONEXA CRM v3 — Phase 3 Operational Modules Migration
-- Adds Campaign Members and Activities (Tasks, Calls, Meetings, Events).
-- Campaigns and classification fields are preserved under 202611160009_module_data_contracts.sql.

BEGIN;

-- 1. Campaign Members table
CREATE TABLE IF NOT EXISTS public.campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  member_type text NOT NULL CHECK (member_type IN ('lead', 'contact')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  member_status text NOT NULL DEFAULT 'planned' CHECK (member_status IN ('planned', 'sent', 'recieved', 'responded')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_member_target CHECK (
    (member_type = 'lead' AND lead_id IS NOT NULL AND contact_id IS NULL)
    OR (member_type = 'contact' AND contact_id IS NOT NULL AND lead_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS campaign_members_campaign_idx ON public.campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_members_lead_idx ON public.campaign_members(lead_id);
CREATE INDEX IF NOT EXISTS campaign_members_contact_idx ON public.campaign_members(contact_id);

ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_members_select ON public.campaign_members;
CREATE POLICY campaign_members_select ON public.campaign_members FOR SELECT TO authenticated
USING (
  public.has_effective_permission(auth.uid(), 'campaigns.view')
  AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id)
);

DROP POLICY IF EXISTS campaign_members_manage ON public.campaign_members;
CREATE POLICY campaign_members_manage ON public.campaign_members FOR ALL TO authenticated
USING (
  public.has_effective_permission(auth.uid(), 'campaigns.update')
  AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id)
)
WITH CHECK (
  public.has_effective_permission(auth.uid(), 'campaigns.update')
  AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_members TO authenticated;

-- 2. Unified Activities table (Tasks, Calls, Meetings, Events)
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL CHECK (activity_type IN ('task', 'log_call', 'meeting', 'event')),
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamptz,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  meeting_url text,
  call_type text CHECK (call_type IN ('inbound', 'outbound')),
  call_duration_minutes integer,
  related_to_type text CHECK (related_to_type IN ('lead', 'contact', 'account', 'opportunity')),
  related_to_id uuid,
  assigned_to_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_type_idx ON public.activities(activity_type);
CREATE INDEX IF NOT EXISTS activities_assigned_idx ON public.activities(assigned_to_id);
CREATE INDEX IF NOT EXISTS activities_status_idx ON public.activities(status);
CREATE INDEX IF NOT EXISTS activities_due_idx ON public.activities(due_date);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- 3. Additional Permissions for granular activity actions
INSERT INTO public.permissions (id, module, action, description)
VALUES 
  ('tasks.create', 'tasks', 'create', 'Create sales tasks'),
  ('tasks.update', 'tasks', 'update', 'Update sales tasks'),
  ('tasks.delete', 'tasks', 'delete', 'Delete sales tasks'),
  ('calls.create', 'calls', 'create', 'Log telephone calls'),
  ('calls.update', 'calls', 'update', 'Update call logs'),
  ('calls.delete', 'calls', 'delete', 'Delete call logs'),
  ('meetings.create', 'meetings', 'create', 'Schedule meetings'),
  ('meetings.update', 'meetings', 'update', 'Update meetings'),
  ('meetings.delete', 'meetings', 'delete', 'Delete meetings')
ON CONFLICT (id) DO NOTHING;

-- Grant to canonical roles
INSERT INTO public.role_permissions (role_id, permission_id, is_granted)
SELECT r.id, p.id, true
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.id IN (
  'tasks.create', 'tasks.update', 'tasks.delete',
  'calls.create', 'calls.update', 'calls.delete',
  'meetings.create', 'meetings.update', 'meetings.delete'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Activities RLS Policies
DROP POLICY IF EXISTS activities_select ON public.activities;
CREATE POLICY activities_select ON public.activities FOR SELECT TO authenticated
USING (
  (
    (activity_type = 'task' AND public.has_effective_permission(auth.uid(), 'tasks.view'))
    OR (activity_type = 'log_call' AND public.has_effective_permission(auth.uid(), 'calls.view'))
    OR (activity_type IN ('meeting', 'event') AND public.has_effective_permission(auth.uid(), 'meetings.view'))
  )
  AND (
    assigned_to_id IS NULL
    OR assigned_to_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
    OR created_by_id = auth.uid()
  )
);

DROP POLICY IF EXISTS activities_insert ON public.activities;
CREATE POLICY activities_insert ON public.activities FOR INSERT TO authenticated
WITH CHECK (
  (
    (activity_type = 'task' AND public.has_effective_permission(auth.uid(), 'tasks.create'))
    OR (activity_type = 'log_call' AND public.has_effective_permission(auth.uid(), 'calls.create'))
    OR (activity_type IN ('meeting', 'event') AND public.has_effective_permission(auth.uid(), 'meetings.create'))
  )
  AND (created_by_id IS NULL OR created_by_id = auth.uid())
);

DROP POLICY IF EXISTS activities_update ON public.activities;
CREATE POLICY activities_update ON public.activities FOR UPDATE TO authenticated
USING (
  (
    (activity_type = 'task' AND public.has_effective_permission(auth.uid(), 'tasks.update'))
    OR (activity_type = 'log_call' AND public.has_effective_permission(auth.uid(), 'calls.update'))
    OR (activity_type IN ('meeting', 'event') AND public.has_effective_permission(auth.uid(), 'meetings.update'))
  )
  AND (
    assigned_to_id IS NULL
    OR assigned_to_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
    OR created_by_id = auth.uid()
  )
)
WITH CHECK (
  (activity_type = 'task' AND public.has_effective_permission(auth.uid(), 'tasks.update'))
  OR (activity_type = 'log_call' AND public.has_effective_permission(auth.uid(), 'calls.update'))
  OR (activity_type IN ('meeting', 'event') AND public.has_effective_permission(auth.uid(), 'meetings.update'))
);

DROP POLICY IF EXISTS activities_delete ON public.activities;
CREATE POLICY activities_delete ON public.activities FOR DELETE TO authenticated
USING (
  (
    (activity_type = 'task' AND public.has_effective_permission(auth.uid(), 'tasks.delete'))
    OR (activity_type = 'log_call' AND public.has_effective_permission(auth.uid(), 'calls.delete'))
    OR (activity_type IN ('meeting', 'event') AND public.has_effective_permission(auth.uid(), 'meetings.delete'))
  )
  AND (
    assigned_to_id IS NULL
    OR assigned_to_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
    OR created_by_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;

COMMIT;

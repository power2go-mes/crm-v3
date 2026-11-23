export type WorkflowTriggerEvent =
  | 'opportunity_created'
  | 'opportunity_stage_changed'
  | 'opportunity_closed_won'
  | 'opportunity_closed_lost'
  | 'task_overdue'
  | 'meeting_scheduled'
  | 'quotation_status_changed'
  | 'record_assigned';

export type WorkflowConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';

export interface WorkflowCondition {
  field: string;
  operator: WorkflowConditionOperator;
  value: string;
}

export type WorkflowActionType = 'create_task' | 'create_notification' | 'send_email';

export interface WorkflowAction {
  type: WorkflowActionType;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee_id?: string;
  user_id?: string;
  message?: string;
  category?: string;
}

export interface CrmWorkflowRule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: WorkflowTriggerEvent;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  is_active: boolean;
  priority: number;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmWorkflowLog {
  id: string;
  rule_id: string;
  record_id: string;
  record_type: string;
  trigger_event: string;
  status: 'success' | 'failed' | 'skipped';
  actions_executed: any[];
  error_message: string | null;
  executed_at: string;
  rule?: {
    name: string;
  };
}

export const WORKFLOW_TRIGGERS: { id: WorkflowTriggerEvent; label: string; description: string }[] = [
  { id: 'opportunity_created', label: 'Opportunity Created', description: 'Runs immediately when a new opportunity is created' },
  { id: 'opportunity_stage_changed', label: 'Opportunity Stage Changed', description: 'Runs whenever deal progression changes stage' },
  { id: 'opportunity_closed_won', label: 'Opportunity Closed Won', description: 'Triggered when deal status is marked Closed Won' },
  { id: 'opportunity_closed_lost', label: 'Opportunity Closed Lost', description: 'Triggered when deal status is marked Closed Lost' },
  { id: 'task_overdue', label: 'Task Overdue', description: 'Triggered when a task crosses its due date without completion' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled', description: 'Triggered when a new sales meeting is added to calendar' },
  { id: 'quotation_status_changed', label: 'Quotation Status Changed', description: 'Triggered when a quotation is accepted or rejected' },
  { id: 'record_assigned', label: 'Record Assigned', description: 'Triggered when ownership of an account or deal changes' },
];

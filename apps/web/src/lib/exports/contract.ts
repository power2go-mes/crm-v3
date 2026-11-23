import { z } from 'zod';

export const exportModule = z.enum(['leads', 'accounts', 'contacts', 'opportunities', 'campaigns']);
export type ExportModule = z.infer<typeof exportModule>;
export interface CentralExportColumn { key: string; label: string; kind: 'text' | 'number' | 'date' | 'datetime' }
const column = (key: string, label: string, kind: CentralExportColumn['kind'] = 'text'): CentralExportColumn => ({ key, label, kind });
const timestamps = [column('created_at', 'Created At', 'datetime'), column('updated_at', 'Updated At', 'datetime')];
/** Source-backed scalar fields only; relationships need independently authorized display adapters. */
export const centralExportModules: Record<ExportModule, { label: string; columns: CentralExportColumn[] }> = {
  leads: { label: 'Leads', columns: [column('title','Title'), column('first_name','First Name'), column('last_name','Last Name'), column('email','Email'), column('phone','Contact Number'), column('company_name','Company Name'), column('status','Lead Status'), column('lead_source','Lead Source'), column('industry','Industry'), column('annual_revenue','Annual Revenue','number'), column('no_of_employees','Number of Employees','number'), column('country','Country'), column('state','State'), column('city','City'), column('zip_code','Postal Code'), column('fax','Fax'), ...timestamps] },
  accounts: { label: 'Accounts', columns: [column('name','Account Name'), column('account_type','Account Type'), column('contact_number','Contact Number'), column('annual_revenue','Annual Revenue','number'), column('industry','Industry'), column('no_of_employees','Number of Employees','number'), column('fax','Fax'), column('account_source','Account Source'), column('website','Website'), column('billing_address','Billing Address'), column('shipping_address','Shipping Address'), ...timestamps] },
  contacts: { label: 'Contacts', columns: [column('title','Title'), column('first_name','First Name'), column('last_name','Last Name'), column('email','Email'), column('contact_number','Contact Number'), column('secondary_contact_number','Secondary Contact Number'), column('contact_source','Contact Source'), column('is_primary','Is Primary'), ...timestamps] },
  opportunities: { label: 'Opportunities', columns: [column('name','Opportunity Name'), column('stage','Stage'), column('amount','Amount','number'), column('probability','Probability','number'), column('close_date','Close Date','date'), column('lead_source','Lead Source'), ...timestamps] },
  campaigns: { label: 'Campaigns', columns: [column('campaign_name','Campaign Name'), column('status','Status'), column('campaign_type','Type'), column('start_date','Start Date','date'), column('end_date','End Date','date'), column('expected_revenue','Expected Revenue','number'), column('budget_cost','Budget Cost','number'), column('actual_cost','Actual Cost','number'), column('expected_response','Expected Response','number'), column('number_sent','Number Sent','number'), column('description','Description'), ...timestamps] },
};
export const centralExportRequest = z.object({
  modules: z.array(z.object({ module: exportModule, columns: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1).max(50) }).strict()).min(1).max(5),
  format: z.enum(['csv','xlsx','pdf']), timeZone: z.string().max(100).default('UTC'),
}).strict().superRefine((request, ctx) => {
  if (new Set(request.modules.map(item => item.module)).size !== request.modules.length) ctx.addIssue({ code: 'custom', message: 'Modules must be unique.' });
  for (const item of request.modules) {
    if (new Set(item.columns).size !== item.columns.length || item.columns.some(key => !centralExportModules[item.module].columns.some(column => column.key === key))) ctx.addIssue({ code: 'custom', message: 'Invalid export columns.' });
  }
});

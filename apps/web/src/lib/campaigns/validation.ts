import {z} from 'zod';
export const campaignTypes=['email','event','social_media','other','webinar','referral','advertisement'] as const;
export const campaignStatuses=['new','planned','in_progress','completed','aborted'] as const;
const amount=z.union([z.literal(''),z.string().regex(/^\d{1,13}(?:\.\d{1,2})?$/)]).transform(v=>v===''?null:Number(v));
const date=z.union([z.literal(''),z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform(v=>v||null);
export const campaignInput=z.object({id:z.string().uuid().optional(),campaign_name:z.string().trim().min(1).max(255),campaign_type:z.enum(campaignTypes),status:z.enum(campaignStatuses),parent_campaign_id:z.union([z.string().uuid(),z.literal('')]).transform(v=>v||null),start_date:date,end_date:date,expected_revenue:amount,budget_cost:amount,actual_cost:amount,expected_response:z.union([z.literal(''),z.coerce.number().min(0).max(100)]).transform(v=>v===''?null:v),number_sent:z.coerce.number().int().min(0).max(2147483647),description:z.string().max(32000)}).strict();

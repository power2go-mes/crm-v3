import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import {dayLabels,weekDays} from './business-hours';
export const months=['january','february','march','april','may','june','july','august','september','october','november','december'] as const;
const day=z.enum(weekDays).nullable();
const positive=z.number().int().min(1).max(2147483647).nullable();
const repeat=z.enum(['day_of_month','weekday_of_month']).nullable();
const instant=z.string().datetime({offset:true}).refine(value=>{const date=new Date(value.slice(0,10)+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value.slice(0,10);},'Invalid calendar date');
export const holidayDefinition=z.object({
 name:z.string().trim().min(1).max(255),start_date:instant,end_date:instant,all_users:z.boolean(),is_recurring:z.boolean(),frequency:z.enum(['weekly','monthly','yearly']).nullable(),
 recurs_every_weeks:positive,weekly_days:z.array(z.enum(weekDays)).max(7).refine(value=>new Set(value).size===value.length),
 monthly_repeat_type:repeat,monthly_day_of_month:positive,monthly_interval:z.number().int().min(0).max(2147483647).nullable(),monthly_day_of_week:day,monthly_week_of_month:positive,
 yearly_repeat_type:repeat,yearly_week_of_month:positive,yearly_day_of_month:positive,yearly_day_of_week:day,yearly_month:z.enum(months).nullable(),
}).strict().superRefine((value,ctx)=>{
 if(new Date(value.start_date)>new Date(value.end_date))ctx.addIssue({code:'custom',path:['end_date'],message:'Start date cannot be after end date'});
 if(!value.is_recurring)return;
 const issue=(path:string,message:string)=>ctx.addIssue({code:'custom',path:[path],message});
 if(!value.frequency)issue('frequency','Frequency is required for recurring holidays');
 if(value.frequency==='weekly'&&(!value.weekly_days.length||!value.recurs_every_weeks))issue('weekly_days','Weekly days and Recurs Every (weeks) are required');
 if(value.frequency==='monthly'){
  if(!value.monthly_repeat_type)issue('monthly_repeat_type','Select a valid monthly repeat type');
  else if(value.monthly_repeat_type==='day_of_month'&&!value.monthly_day_of_month)issue('monthly_day_of_month','Day of month is required for monthly recurrence');
  else if(value.monthly_repeat_type==='weekday_of_month'&&(!value.monthly_day_of_week||!value.monthly_week_of_month))issue('monthly_week_of_month','Both day of week and week of month are required');
 }
 if(value.frequency==='yearly'){
  if(!value.yearly_month)issue('yearly_month','Month is required for yearly recurrence');
  if(!value.yearly_repeat_type)issue('yearly_repeat_type','Select a valid yearly repeat type');
  else if(value.yearly_repeat_type==='day_of_month'&&!value.yearly_day_of_month)issue('yearly_day_of_month','Day of month is required for yearly recurrence');
  else if(value.yearly_repeat_type==='weekday_of_month'&&(!value.yearly_day_of_week||!value.yearly_week_of_month))issue('yearly_week_of_month','Both week of month and day of week are required');
 }
});
export type HolidayDefinition=z.infer<typeof holidayDefinition>;
export const holidayRow=z.object({id:z.string().uuid(),definition:holidayDefinition,start_date:instant,end_date:instant});
export type Holiday=z.infer<typeof holidayRow>;
export function initialHoliday():HolidayDefinition{return {name:'',start_date:'',end_date:'',all_users:false,is_recurring:false,frequency:null,recurs_every_weeks:1,weekly_days:[],monthly_repeat_type:null,monthly_day_of_month:null,monthly_interval:1,monthly_day_of_week:null,monthly_week_of_month:null,yearly_repeat_type:null,yearly_week_of_month:null,yearly_day_of_month:null,yearly_day_of_week:null,yearly_month:null};}
export async function saveHoliday(client:SupabaseClient<Database>,input:{id:string|null;definition:HolidayDefinition;specific_users:string[]}){
 const value=z.object({id:z.string().uuid().nullable(),definition:holidayDefinition,specific_users:z.array(z.string().uuid()).max(200).refine(values=>new Set(values).size===values.length)}).strict().parse(input);
 if(!value.definition.all_users&&!value.specific_users.length)throw new Error('Specific Users is required');
 const {data,error}=await client.rpc('save_holiday',{p_id:value.id,p_definition:value.definition,p_users:value.definition.all_users?[]:value.specific_users});
 if(error)throw new Error(error.message);return data;
}
export async function deleteHoliday(client:SupabaseClient<Database>,id:string){
 const {error}=await client.rpc('delete_holiday',{p_id:z.string().uuid().parse(id)});if(error)throw new Error(error.message);
}
export async function setBusinessHolidays(client:SupabaseClient<Database>,ids:string[],remove=false){
 const selected=z.array(z.string().uuid()).min(1).max(200).refine(values=>new Set(values).size===values.length).parse(ids);
 const {error}=await client.rpc('set_business_hour_holidays',{p_ids:selected,p_remove:z.boolean().parse(remove)});if(error)throw new Error(error.message);
}
export function holidayRecurrence(value:HolidayDefinition){
 if(!value.is_recurring)return 'Not a recurring holiday';
 if(value.frequency==='weekly')return `Recur every ${value.recurs_every_weeks??1} week on ${value.weekly_days.map(day=>dayLabels[day]).join(', ')}`;
 if(value.frequency==='monthly')return value.monthly_repeat_type==='day_of_month'?`Recur on day ${value.monthly_day_of_month} of every ${value.monthly_interval||1} month`:`Recur on week ${value.monthly_week_of_month} ${value.monthly_day_of_week?dayLabels[value.monthly_day_of_week]:''} of every month`;
 return value.yearly_repeat_type==='day_of_month'?`Recur on every ${value.yearly_month} ${value.yearly_day_of_month}`:`Recur on week ${value.yearly_week_of_month} ${value.yearly_day_of_week?dayLabels[value.yearly_day_of_week]:''} of ${value.yearly_month}`;
}
export function localDateTime(value:string){if(!value)return '';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;}

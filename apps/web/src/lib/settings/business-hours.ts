import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
export const weekDays = ['mon','tue','wed','thu','fri','sat','sun'] as const;
export const dayLabels = {mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'};
const day = z.enum(weekDays);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable();
const pair = z.object({start:time,end:time}).strict();
export const businessHoursInput = z.object({
  name:z.string().trim().min(1).max(255),time_zone:z.string().min(1).max(100).refine(value => {try {new Intl.DateTimeFormat('en',{timeZone:value}).format();return true;} catch{return false;}},'Invalid Time Zone'),
  week_start_day:day,business_hour_type:z.enum(['24_7','24_5','custom']),timing_type:z.enum(['same','different']).nullable(),
  week_days:z.array(day).max(7).refine(values => new Set(values).size===values.length),default_start_time:time,default_end_time:time,
  day_hours:z.object({mon:pair,tue:pair,wed:pair,thu:pair,fri:pair,sat:pair,sun:pair}).strict(),is_active:z.boolean(),
}).strict().superRefine((value,ctx) => {
  if(value.business_hour_type==='24_5' && value.week_days.length>5)ctx.addIssue({code:'custom',path:['week_days'],message:'You can select a maximum of 5 days for 24x5 business hours.'});
  if(value.business_hour_type==='custom' && !value.timing_type)ctx.addIssue({code:'custom',path:['timing_type'],message:'Select Timing Type.'});
});
export type BusinessHours = z.infer<typeof businessHoursInput>;
export function initialBusinessHours(): BusinessHours { return {name:'',time_zone:'UTC',week_start_day:'mon',business_hour_type:'24_7',timing_type:null,week_days:[],default_start_time:null,default_end_time:null,day_hours:{mon:{start:null,end:null},tue:{start:null,end:null},wed:{start:null,end:null},thu:{start:null,end:null},fri:{start:null,end:null},sat:{start:null,end:null},sun:{start:null,end:null}},is_active:true}; }
export async function saveBusinessHours(client:SupabaseClient<Database>, definition:BusinessHours, create:boolean) {
  const {error}=await client.rpc('save_business_hours',{p_definition:businessHoursInput.parse(definition),p_create:z.boolean().parse(create)});
  if(error)throw new Error(error.message);
}
export function businessHourRows(value:BusinessHours) {
  const active=value.business_hour_type==='24_7'? [...weekDays]:value.business_hour_type==='24_5' && !value.week_days.length ? weekDays.slice(0,5):value.week_days;
  const midnight = (time: string | null) => time === '00:00' || time === '00:00:00';
  return weekDays.map(day => ({day:dayLabels[day],hours: !active.includes(day) ? 'Closed' : value.business_hour_type!=='custom' ? '24 hours' : value.day_hours[day].start && value.day_hours[day].end && !(midnight(value.day_hours[day].start) && midnight(value.day_hours[day].end)) ? `${value.day_hours[day].start} – ${value.day_hours[day].end}` : 'Closed'}));
}

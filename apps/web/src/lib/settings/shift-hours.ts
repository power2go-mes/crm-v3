import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import {weekDays} from './business-hours';
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable();
const pair=z.object({start:time,end:time}).strict();
const block=z.object({mode:z.enum(['none','same','different']),days:z.array(z.enum(weekDays)).max(7).refine(values=>new Set(values).size===values.length),start:time,end:time,per_day:z.object({mon:pair,tue:pair,wed:pair,thu:pair,fri:pair,sat:pair,sun:pair}).strict()}).strict();
export type ShiftBlock=z.infer<typeof block>;
function seconds(value:string){const [h,m,s='0']=value.split(':');return Number(h)*3600+Number(m)*60+Number(s);}
export function normalizeShiftBlock(value:ShiftBlock,isBreak=false):ShiftBlock{
 const b=structuredClone(block.parse(value));
 if(b.mode==='none'){if(!isBreak)throw new Error('Select Shift Hours');b.days=[];b.start=null;b.end=null;}
 else if(b.mode==='same'){
  if(!b.days.length||!b.start||!b.end)throw new Error('Select weekdays and enter start and end times');
  if(seconds(b.start)>=seconds(b.end))throw new Error('End time must be after start on the same day. Use 24-hour time.');
 }else{
  b.days=weekDays.filter(day=>!!b.per_day[day].start&&!!b.per_day[day].end);
  if(!b.days.length)throw new Error('Enter start and end for at least one weekday');
  for(const day of b.days)if(seconds(b.per_day[day].start!)>=seconds(b.per_day[day].end!))throw new Error('End time must be after start on the same day. Use 24-hour time.');
  b.start=null;b.end=null;
 }
 for(const day of weekDays){if(!b.days.includes(day))b.per_day[day]={start:null,end:null};else if(b.mode==='same')b.per_day[day]={start:b.start,end:b.end};}
 return b;
}
export const shiftDefinition=z.object({name:z.string().trim().min(1).max(255),time_zone:z.string().min(1).max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Invalid Time Zone'),is_active:z.boolean(),main:block,break1:block,break2:block}).strict().superRefine((value,ctx)=>{
 try{
  const main=normalizeShiftBlock(value.main);
  for(const br of [normalizeShiftBlock(value.break1,true),normalizeShiftBlock(value.break2,true)])for(const day of br.days){
   if(!main.days.includes(day)||seconds(br.per_day[day].start!)<seconds(main.per_day[day].start!)||seconds(br.per_day[day].end!)>seconds(main.per_day[day].end!))throw new Error('Break must fall within the shift working days and hours');
  }
 }catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid shift hours'});}
});
export type ShiftDefinition=z.infer<typeof shiftDefinition>;
export const shiftRow=z.object({id:z.string().uuid(),definition:shiftDefinition,users:z.array(z.string().uuid()).max(200)});
export type Shift=z.infer<typeof shiftRow>;
export function initialShiftBlock(mode:ShiftBlock['mode']='same'):ShiftBlock{return {mode,days:[],start:null,end:null,per_day:{mon:{start:null,end:null},tue:{start:null,end:null},wed:{start:null,end:null},thu:{start:null,end:null},fri:{start:null,end:null},sat:{start:null,end:null},sun:{start:null,end:null}}};}
export function initialShift():ShiftDefinition{return {name:'',time_zone:'UTC',is_active:true,main:initialShiftBlock(),break1:initialShiftBlock('none'),break2:initialShiftBlock('none')};}
export async function saveShift(client:SupabaseClient<Database>,input:{id:string|null;definition:ShiftDefinition;users:string[]}){
 const value=z.object({id:z.string().uuid().nullable(),definition:shiftDefinition,users:z.array(z.string().uuid()).max(200).refine(values=>new Set(values).size===values.length)}).strict().parse(input);
 const {data,error}=await client.rpc('save_shift_hours',{p_id:value.id,p_definition:value.definition,p_users:value.users});if(error)throw new Error(error.message);return data;
}
export async function deleteShift(client:SupabaseClient<Database>,id:string){const {error}=await client.rpc('delete_shift_hours',{p_id:z.string().uuid().parse(id)});if(error)throw new Error(error.message);}

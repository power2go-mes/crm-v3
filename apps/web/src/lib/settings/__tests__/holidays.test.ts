import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import {deleteHoliday,holidayDefinition,holidayRecurrence,initialHoliday,saveHoliday,setBusinessHolidays} from '../holidays';
const id='c0de0000-0000-4000-8000-000000001301';
function valid(){return {...initialHoliday(),name:'Holiday',start_date:'2026-12-01T09:00:00Z',end_date:'2026-12-01T18:00:00Z',all_users:true};}
describe('Holiday settings contract',()=>{
 it('enforces real date ranges, source field shape and names',()=>{
  expect(holidayDefinition.safeParse(valid()).success).toBe(true);
  for(const patch of [{name:' '},{name:'x'.repeat(256)},{end_date:'2026-11-01T00:00:00Z'},{start_date:'2026-02-30T00:00:00Z'},{created_by:'forged'}])expect(holidayDefinition.safeParse({...valid(),...patch}).success).toBe(false);
 });
 it('requires weekly days/interval and valid frequency',()=>{
  const d={...valid(),is_recurring:true,frequency:'weekly' as const};expect(holidayDefinition.safeParse(d).success).toBe(false);
  expect(holidayDefinition.safeParse({...d,weekly_days:['mon','fri']}).success).toBe(true);
  expect(holidayDefinition.safeParse({...d,weekly_days:['mon','mon']}).success).toBe(false);
  expect(holidayDefinition.safeParse({...d,weekly_days:['mon'],recurs_every_weeks:0}).success).toBe(false);
 });
 it('supports both monthly types and nullable source interval',()=>{
  const d={...valid(),is_recurring:true,frequency:'monthly' as const,monthly_repeat_type:'day_of_month' as const,monthly_day_of_month:10,monthly_interval:null};expect(holidayDefinition.safeParse(d).success).toBe(true);
  expect(holidayDefinition.safeParse({...d,monthly_repeat_type:'weekday_of_month'}).success).toBe(false);
  expect(holidayDefinition.safeParse({...d,monthly_repeat_type:'weekday_of_month',monthly_week_of_month:2,monthly_day_of_week:'tue'}).success).toBe(true);
 });
 it('requires yearly month and matching repeat fields',()=>{
  const d={...valid(),is_recurring:true,frequency:'yearly' as const,yearly_repeat_type:'weekday_of_month' as const,yearly_week_of_month:2,yearly_day_of_week:'mon' as const};expect(holidayDefinition.safeParse(d).success).toBe(false);
  expect(holidayDefinition.safeParse({...d,yearly_month:'july'}).success).toBe(true);
 });
 it('requires selected users for personal holidays and clears them for company holidays',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:id,error:null});const client={rpc} as unknown as SupabaseClient<Database>;
  await expect(saveHoliday(client,{id:null,definition:{...valid(),all_users:false},specific_users:[]})).rejects.toThrow('Specific Users');
  await saveHoliday(client,{id:null,definition:valid(),specific_users:[id]});expect(rpc).toHaveBeenCalledWith('save_holiday',{p_id:null,p_definition:valid(),p_users:[]});
 });
 it('uses atomic relationship RPC and propagates authorization/deletion failures',async()=>{
  const rpc=vi.fn().mockResolvedValue({error:{message:'Permission denied'}});const client={rpc} as unknown as SupabaseClient<Database>;
  await expect(setBusinessHolidays(client,[id],true)).rejects.toThrow('Permission denied');expect(rpc).toHaveBeenCalledWith('set_business_hour_holidays',{p_ids:[id],p_remove:true});
  await expect(deleteHoliday(client,id)).rejects.toThrow('Permission denied');await expect(setBusinessHolidays(client,[id,id])).rejects.toThrow();
 });
 it('renders source-grounded recurrence descriptions without generating fake occurrences',()=>{
  expect(holidayRecurrence(valid())).toBe('Not a recurring holiday');expect(holidayRecurrence({...valid(),is_recurring:true,frequency:'weekly',weekly_days:['mon','fri'],recurs_every_weeks:2})).toContain('Monday, Friday');
 });
});

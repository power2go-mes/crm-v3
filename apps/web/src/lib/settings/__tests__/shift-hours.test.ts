import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import {deleteShift,initialShift,normalizeShiftBlock,saveShift,shiftDefinition} from '../shift-hours';
function valid(){const d=initialShift();d.name='Main shift';d.main.days=['mon'];d.main.start='09:00';d.main.end='17:00';return d;}
describe('Shift hours source rules',()=>{
 it('requires working days and ordered same-day hours unlike Business Hours',()=>{
  expect(shiftDefinition.safeParse(valid()).success).toBe(true);const d=valid();d.main.end='08:00';expect(shiftDefinition.safeParse(d).success).toBe(false);d.main.end='09:00';expect(shiftDefinition.safeParse(d).success).toBe(false);d.main.end='17:00';d.main.days=[];expect(shiftDefinition.safeParse(d).success).toBe(false);
 });
 it('derives different-hour days and validates seconds accurately',()=>{
  const d=valid();d.main.mode='different';d.main.per_day.wed={start:'09:00',end:'09:00:01'};expect(normalizeShiftBlock(d.main).days).toEqual(['wed']);
  d.main.per_day.wed.end='09:00:00';expect(()=>normalizeShiftBlock(d.main)).toThrow('after start');
 });
 it('keeps both breaks inside the shift and permits overlapping breaks as source does',()=>{
  const d=valid();d.break1={...structuredClone(d.main),start:'12:00',end:'13:00'};d.break2=structuredClone(d.break1);expect(shiftDefinition.safeParse(d).success).toBe(true);d.break2.end='18:00';expect(shiftDefinition.safeParse(d).success).toBe(false);d.break2.end='13:00';d.break2.days=['tue'];expect(shiftDefinition.safeParse(d).success).toBe(false);
 });
 it('normalizes disabled breaks and rejects actor/shape/zone forgery',()=>{
  expect(normalizeShiftBlock(valid().break1,true).days).toEqual([]);for(const patch of [{updated_by:'forged'},{time_zone:'Fake/Zone'},{name:'x'.repeat(256)}])expect(shiftDefinition.safeParse({...valid(),...patch}).success).toBe(false);
 });
 it('uses atomic save and validates target users without raw table writes',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:'saved',error:null});const client={rpc} as unknown as SupabaseClient<Database>;
  await expect(saveShift(client,{id:null,definition:valid(),users:[]})).resolves.toBe('saved');expect(rpc).toHaveBeenCalledWith('save_shift_hours',{p_id:null,p_definition:valid(),p_users:[]});
 });
 it('propagates authorization failures for saves/deletes',async()=>{
  const client={rpc:vi.fn().mockResolvedValue({error:{message:'Permission denied'}})} as unknown as SupabaseClient<Database>;
  await expect(saveShift(client,{id:null,definition:valid(),users:[]})).rejects.toThrow('Permission denied');await expect(deleteShift(client,'c0de0000-0000-4000-8000-000000001401')).rejects.toThrow('Permission denied');
 });
});

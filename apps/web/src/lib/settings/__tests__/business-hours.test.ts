import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import {businessHourRows,businessHoursInput,initialBusinessHours,saveBusinessHours} from '../business-hours';
function valid(){return {...initialBusinessHours(),name:'Company hours'};}
describe('Business hours source contract',()=>{
  it('validates exact source choices, timezone and source name limit',()=>{
    expect(businessHoursInput.safeParse(valid()).success).toBe(true);
    for(const patch of [{name:'x'.repeat(256)},{time_zone:'Fake/Zone'},{business_hour_type:'office'},{week_start_day:'monday'},{updated_by_id:'forged'}]) expect(businessHoursInput.safeParse({...valid(),...patch}).success).toBe(false);
  });
  it('limits 24x5 days and rejects duplicate days and missing custom timing type',()=>{
    for(const patch of [{business_hour_type:'24_5',week_days:['mon','tue','wed','thu','fri','sat']},{week_days:['mon','mon']},{business_hour_type:'custom',timing_type:null}]) expect(businessHoursInput.safeParse({...valid(),...patch}).success).toBe(false);
  });
  it('allows overnight hours and valid per-day seconds without inventing a same-day rule',()=>{
    const d=valid();d.business_hour_type='custom';d.timing_type='different';d.day_hours.mon={start:'22:00:00',end:'06:00:00'};
    expect(businessHoursInput.safeParse(d).success).toBe(true);
    d.day_hours.mon.start='25:00';expect(businessHoursInput.safeParse(d).success).toBe(false);
  });
  it('uses source 24x5 default days and exact midnight-pair closed semantics',()=>{
    const d=valid();d.business_hour_type='24_5';expect(businessHourRows(d).filter(row=>row.hours==='24 hours')).toHaveLength(5);
    d.business_hour_type='custom';d.timing_type='different';d.week_days=['mon'];d.day_hours.mon={start:'00:00',end:'00:00:00'};
    expect(businessHourRows(d)[0].hours).toBe('Closed');d.day_hours.mon.start='00:00:59';expect(businessHourRows(d)[0].hours).toContain('00:00:59');
  });
  it('saves only validated definition and create intent through trusted RPC',async()=>{
    const rpc=vi.fn().mockResolvedValue({error:null});await saveBusinessHours({rpc} as unknown as SupabaseClient<Database>,valid(),true);
    expect(rpc).toHaveBeenCalledWith('save_business_hours',{p_definition:valid(),p_create:true});
  });
  it('surfaces database failure instead of reporting a saved schedule',async()=>{
    const rpc=vi.fn().mockResolvedValue({error:{message:'Permission denied'}});await expect(saveBusinessHours({rpc} as unknown as SupabaseClient<Database>,valid(),false)).rejects.toThrow('Permission denied');
  });
});

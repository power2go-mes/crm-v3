import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import {batchCurrencyRate,changeDefaultCurrency,currencyChoices,currencyDate,currencyInput,currencyRate,deleteCurrency,enableMultipleCurrency,loadCurrencyPage,saveCurrency,saveExchangeRates} from '../currencies';
const id='c0de0000-0000-4000-8000-000000001501';
describe('Source-backed Currency Management contracts',()=>{
 it('retains source choices and rejects unsupported codes/forged fields',()=>{
  expect(currencyChoices).toHaveLength(307);expect(new Set(currencyChoices.map(choice=>choice.code)).size).toBe(307);expect(currencyChoices.some(choice=>choice.code==='XXX')).toBe(false);
  const valid={id:null,currency:'USD',conversion_rate:'1.0000',decimal_places:2};expect(currencyInput.safeParse(valid).success).toBe(true);for(const change of [{currency:'NOT_A_CURRENCY'},{created_by_id:id},{decimal_places:2.5}])expect(currencyInput.safeParse({...valid,...change}).success).toBe(false);
 });
 it('matches distinct source model and batch-form decimal bounds without coercing through floats',()=>{
  expect(currencyRate.parse(' -12.3456 ')).toBe('-12.3456');expect(currencyRate.safeParse('999999.9999').success).toBe(true);expect(currencyRate.safeParse('1.00001').success).toBe(false);
  expect(batchCurrencyRate.safeParse('9999.999999').success).toBe(true);expect(batchCurrencyRate.safeParse('12345.1').success).toBe(false);
 });
 it('rejects invalid calendar dates',()=>{expect(currencyDate.safeParse('2026-02-30').success).toBe(false);expect(currencyDate.safeParse('2028-02-29').success).toBe(true);});
 it('uses authenticated save/activation services without forged actors',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:id,error:null});const client={rpc} as unknown as SupabaseClient<Database>;
  await saveCurrency(client,{id:null,currency:'USD',conversion_rate:'1.0000',decimal_places:2});expect(rpc).toHaveBeenCalledWith('save_company_currency',{p_id:null,p_currency:'USD',p_rate:'1.0000',p_decimal_places:2});
  await enableMultipleCurrency(client,false);expect(rpc).toHaveBeenLastCalledWith('set_multiple_currency_enabled',{p_enabled:false});
 });
 it('sends dated batch in one trusted operation and preserves strings',async()=>{
  const rpc=vi.fn().mockResolvedValue({error:null});await saveExchangeRates({rpc} as unknown as SupabaseClient<Database>,{[id]:'1.234567'},'2026-01-01');expect(rpc).toHaveBeenCalledWith('save_company_exchange_rates',{p_rates:{[id]:'1.234567'},p_start_date:'2026-01-01'});
 });
 it('propagates rebase and delete authorization/integrity failures',async()=>{
  const client={rpc:vi.fn().mockResolvedValue({error:{message:'No rates changed.'}})} as unknown as SupabaseClient<Database>;
  await expect(changeDefaultCurrency(client,id)).rejects.toThrow('No rates changed');await expect(deleteCurrency(client,id)).rejects.toThrow('No rates changed');
 });
 it('reports duplicate dated batches rather than partial success',async()=>{
  const client={rpc:vi.fn().mockResolvedValue({error:{code:'23505'}})} as unknown as SupabaseClient<Database>;
  await expect(saveExchangeRates(client,{[id]:'1'},'2026-01-01')).rejects.toThrow('No rates were saved');
 });
 it('requests bounded server pages and rejects invalid page input before network access',async()=>{
  const row={id,currency:'USD',name:'US Dollar',conversion_rate:'1.0000',decimal_places:2,is_default:true,is_active:true};const data={enabled:true,company_currency:'USD',has_history:false,selected_date:null,date_ranges:[],more_date_ranges:false,dated_rows:[],rows:[row],default_currency:row,configured_codes:['USD'],row_count:1,dated_count:0,other_count:0};const rpc=vi.fn().mockResolvedValue({data,error:null});const client={rpc} as unknown as SupabaseClient<Database>;
  expect((await loadCurrencyPage(client,1)).rows).toHaveLength(1);expect(rpc).toHaveBeenCalledWith('company_currency_page',{p_page:1,p_date:null});await expect(loadCurrencyPage(client,0)).rejects.toThrow();expect(rpc).toHaveBeenCalledTimes(1);
 });
});

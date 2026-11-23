import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import choices from './currency-choices.json';
export const currencyChoices=z.array(z.object({code:z.string().regex(/^[A-Z]{3}$/),name:z.string()})).max(500).parse(choices);
export const currencyCode=z.string().refine(code=>currencyChoices.some(value=>value.code===code),'Select a supported Currency');
export const currencyRate=z.string().trim().regex(/^-?\d{1,6}(\.\d{1,4})?$/,'Conversion Rate must fit decimal(10,4)');
export const batchCurrencyRate=z.string().trim().regex(/^-?\d{1,4}(\.\d{1,6})?$/,'Conversion Rate must fit the source form decimal(10,6)');
export const currencyDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;},'Invalid Start Date');
export const currencyInput=z.object({id:z.string().uuid().nullable(),currency:currencyCode,conversion_rate:currencyRate,decimal_places:z.number().int().min(-2147483648).max(2147483647)}).strict();
export const configuredCurrency=z.object({id:z.string().uuid(),currency:currencyCode,name:z.string(),conversion_rate:currencyRate,decimal_places:z.number().int(),is_default:z.boolean(),is_active:z.boolean()});
export type ConfiguredCurrency=z.infer<typeof configuredCurrency>;
export const currencyCatalog=z.object({enabled:z.boolean(),company_currency:z.string().nullable(),has_history:z.boolean(),selected_date:currencyDate.nullable(),date_ranges:z.array(z.object({start_date:currencyDate,end_date:currencyDate.nullable()})).max(100),more_date_ranges:z.boolean(),dated_rows:z.array(z.object({id:z.string().uuid(),currency_id:z.string().uuid(),currency:currencyCode,name:z.string(),conversion_rate:currencyRate,start_date:currencyDate})).max(500),rows:z.array(configuredCurrency).max(500)});
export const currencyPage=currencyCatalog.extend({rows:z.array(configuredCurrency).max(20),dated_rows:currencyCatalog.shape.dated_rows.max(20),default_currency:configuredCurrency.nullable(),configured_codes:z.array(currencyCode).max(500),row_count:z.number().int().nonnegative(),dated_count:z.number().int().nonnegative(),other_count:z.number().int().nonnegative()});
export async function loadCurrencyPage(client:SupabaseClient<Database>,page=1,date:string|null=null){const {data,error}=await client.rpc('company_currency_page',{p_page:z.number().int().min(1).max(100000).parse(page),p_date:date===null?null:currencyDate.parse(date)});if(error)throw new Error(error.message);return currencyPage.parse(data);}
export async function loadCurrencyCatalog(client:SupabaseClient<Database>,date:string|null=null){
 const {data,error}=await client.rpc('company_currency_catalog',{p_date:date===null?null:currencyDate.parse(date)});if(error)throw new Error(error.message);return currencyCatalog.parse(data);
}
export async function saveCurrency(client:SupabaseClient<Database>,input:z.input<typeof currencyInput>){
 const value=currencyInput.parse(input);const {data,error}=await client.rpc('save_company_currency',{p_id:value.id,p_currency:value.currency,p_rate:value.conversion_rate,p_decimal_places:value.decimal_places});if(error)throw new Error(error.code==='23505'?'This Currency is already configured.':error.message);return data;
}
export async function enableMultipleCurrency(client:SupabaseClient<Database>,enabled:boolean){const {error}=await client.rpc('set_multiple_currency_enabled',{p_enabled:z.boolean().parse(enabled)});if(error)throw new Error(error.message);}
export async function changeDefaultCurrency(client:SupabaseClient<Database>,id:string){const {error}=await client.rpc('change_company_default_currency',{p_id:z.string().uuid().parse(id)});if(error)throw new Error(error.message);}
export async function deleteCurrency(client:SupabaseClient<Database>,id:string){const {error}=await client.rpc('delete_company_currency',{p_id:z.string().uuid().parse(id)});if(error)throw new Error(error.message);}
export async function saveExchangeRates(client:SupabaseClient<Database>,rates:Record<string,string>,startDate:string|null=null){
 const value=z.record(z.string().uuid(),batchCurrencyRate).refine(rows=>Object.keys(rows).length>0&&Object.keys(rows).length<=500).parse(rates);
 const {error}=await client.rpc('save_company_exchange_rates',{p_rates:value,p_start_date:startDate===null?null:currencyDate.parse(startDate)});if(error)throw new Error(error.code==='23505'?'Exchange rates already exist for this Start Date. No rates were saved.':error.message);
}

import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@finlonexa/database';
import {currencyCode,loadCurrencyPage} from './currencies';

/** Source Decimal(str(rate)).quantize(Decimal('0.0001')) uses ties-to-even. */
export function quoteToFourDecimals(value:unknown):string{
 if(typeof value!=='number'&&typeof value!=='string')throw new Error('Exchange rate unavailable.');
 const text=String(value);const match=/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text);
 if(!match||text.length>100)throw new Error('Exchange rate unavailable.');
 const fraction=match[2]??'';const shift=4+Number(match[3]??0)-fraction.length;
 if(!Number.isInteger(shift)||Math.abs(shift)>100)throw new Error('Exchange rate is outside the supported range.');
 let scaled=BigInt(match[1]+fraction);const ten=BigInt(10);
 if(shift>=0)scaled*=ten**BigInt(shift);else{const divisor=ten**BigInt(-shift);const whole=scaled/divisor;const remainder=scaled%divisor;scaled=whole+(remainder*BigInt(2)>divisor||remainder*BigInt(2)===divisor&&whole%BigInt(2)!==BigInt(0)?BigInt(1):BigInt(0));}
 if(scaled<=BigInt(0)||scaled>=BigInt('10000000000'))throw new Error('Exchange rate is outside the supported range.');
 return `${scaled/BigInt(10000)}.${String(scaled%BigInt(10000)).padStart(4,'0')}`;
}
async function boundedProviderJson(response:Response){
 if(!response.ok)throw new Error('Provider unavailable.');
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty provider response.');let size=0;let text='';const decoder=new TextDecoder();
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512*1024){await reader.cancel();throw new Error('Provider response too large.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();return JSON.parse(text);}finally{reader.releaseLock();}
}
export async function fetchExchangeQuote(client:SupabaseClient<Database>,target:unknown,fetcher:typeof fetch=fetch){
 const code=currencyCode.parse(target);const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new Error('Authentication required.');
 const grants=await Promise.all(['currencies.create','currencies.update'].map(async permission=>{const result=await client.rpc('has_effective_permission',{p_user_id:user.id,p_permission_id:permission});if(result.error)throw new Error('Authorization unavailable.');return result.data===true;}));
 if(!grants.some(Boolean))throw new Error('Permission denied.');
 const catalog=await loadCurrencyPage(client);const base=currencyCode.parse(catalog.default_currency?.currency??catalog.company_currency);
 if(base===code)return {currency:code,base,rate:'1.0000'};
 try{const data=await boundedProviderJson(await fetcher(`https://api.frankfurter.app/latest?from=${base}&to=${code}`,{cache:'no-store',signal:AbortSignal.timeout(10000)}));return {currency:code,base,rate:quoteToFourDecimals(data.rates?.[code])};}catch{/* Source falls back to open.er-api.com, never a fabricated rate. */}
 try{const data=await boundedProviderJson(await fetcher(`https://open.er-api.com/v6/latest/${base}`,{cache:'no-store',signal:AbortSignal.timeout(10000)}));if(data.result!=='success')throw new Error('Provider unavailable.');return {currency:code,base,rate:quoteToFourDecimals(data.rates?.[code])};}catch{throw new Error('Exchange rate could not be fetched. Enter the conversion rate manually.');}
}

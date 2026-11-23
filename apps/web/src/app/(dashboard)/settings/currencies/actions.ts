'use server';
import {createClient} from '@/lib/supabase/server';
import {fetchExchangeQuote} from '@/lib/settings/exchange-quotes';
export async function getExchangeQuote(code:string){return fetchExchangeQuote(await createClient(),code);}

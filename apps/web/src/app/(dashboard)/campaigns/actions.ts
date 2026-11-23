'use server';
import {createClient} from '@/lib/supabase/server';
import {campaignInput} from '@/lib/campaigns/validation';
export async function saveCampaign(raw:unknown):Promise<{id?:string;error?:string}>{
 const parsed=campaignInput.safeParse(raw);if(!parsed.success)return {error:'Check campaign fields and numeric ranges.'};
 const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return {error:'Authentication required.'};
 const {id,...fields}=parsed.data;const grant=await client.rpc('has_effective_permission',{p_user_id:user.id,p_permission_id:id?'campaigns.update':'campaigns.create'});
 if(grant.error||grant.data!==true)return {error:'Permission denied.'};
 const result=id?await client.from('campaigns').update(fields).eq('id',id).select('id').single():await client.from('campaigns').insert({...fields,campaign_owner_id:user.id}).select('id').single();
 if(result.error)return {error:'Campaign could not be saved. Check record access and selected parent.'};return {id:result.data.id};
}

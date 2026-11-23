import {beforeEach,describe,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),from:vi.fn(),insert:vi.fn(),update:vi.fn(),eq:vi.fn(),select:vi.fn(),single:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:mock.auth},rpc:mock.rpc,from:mock.from})}));
import {saveCampaign} from '@/app/(dashboard)/campaigns/actions';
const payload={campaign_name:'Synthetic',campaign_type:'email',status:'planned',parent_campaign_id:'',start_date:'',end_date:'',expected_revenue:'',budget_cost:'',actual_cost:'',expected_response:'',number_sent:'0',description:''};
beforeEach(()=>{vi.clearAllMocks();mock.auth.mockResolvedValue({data:{user:{id:'actor'}},error:null});mock.rpc.mockResolvedValue({data:true,error:null});mock.from.mockReturnValue({insert:mock.insert,update:mock.update});mock.insert.mockReturnValue({select:mock.select});mock.update.mockReturnValue({eq:mock.eq});mock.eq.mockReturnValue({select:mock.select});mock.select.mockReturnValue({single:mock.single});mock.single.mockResolvedValue({data:{id:'saved'},error:null});});
describe('Campaign authenticated persistence integration',()=>{
 it('derives owner on create and uses the authenticated client',async()=>{expect(await saveCampaign(payload)).toEqual({id:'saved'});expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({campaign_owner_id:'actor',campaign_type:'email'}));});
 it('checks update permission and preserves owner on edit',async()=>{await saveCampaign({...payload,id:'c0de0000-0000-4000-8000-000000000001'});expect(mock.rpc).toHaveBeenCalledWith('has_effective_permission',expect.objectContaining({p_permission_id:'campaigns.update'}));expect(mock.update.mock.calls[0][0]).not.toHaveProperty('campaign_owner_id');});
 it('denies before database write without a feature grant',async()=>{mock.rpc.mockResolvedValue({data:false,error:null});expect(await saveCampaign(payload)).toEqual({error:'Permission denied.'});expect(mock.from).not.toHaveBeenCalled();});
 it('denies unauthenticated saves',async()=>{mock.auth.mockResolvedValue({data:{user:null},error:null});expect(await saveCampaign(payload)).toEqual({error:'Authentication required.'});expect(mock.from).not.toHaveBeenCalled();});
});

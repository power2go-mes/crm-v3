import {beforeEach,describe,it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';import type {Database} from '@finlonexa/database';
import {addCampaignMember,updateCampaignMember,removeCampaignMember} from '../members';
const cid='c0de0000-0000-4000-8000-000000000001',mid='c0de0000-0000-4000-8000-000000000002';
const mocks={getUser:vi.fn(),rpc:vi.fn(),from:vi.fn(),insert:vi.fn(),update:vi.fn(),delete:vi.fn(),eq:vi.fn(),select:vi.fn(),single:vi.fn()};
const chain={insert:mocks.insert,update:mocks.update,delete:mocks.delete,eq:mocks.eq,select:mocks.select,single:mocks.single};
const client={auth:{getUser:mocks.getUser},rpc:mocks.rpc,from:mocks.from} as unknown as SupabaseClient<Database>;
beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:cid}},error:null});mocks.rpc.mockResolvedValue({data:true,error:null});mocks.from.mockReturnValue(chain);for(const k of ['insert','update','delete','eq','select'] as const)mocks[k].mockReturnValue(chain);mocks.single.mockResolvedValue({data:{id:mid},error:null});});
describe('Campaign member authorized mutations',()=>{
 it('binds exactly one target and leaves actor derivation to the database',async()=>{await addCampaignMember(client,cid,'contact',mid,'planned');expect(mocks.insert).toHaveBeenCalledWith({campaign_id:cid,member_type:'contact',lead_id:null,contact_id:mid,member_status:'planned'});expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('created_by_id');});
 it('checks feature authorization before writing',async()=>{mocks.rpc.mockResolvedValue({data:false,error:null});await expect(addCampaignMember(client,cid,'lead',mid,'sent')).rejects.toThrow('Permission denied');expect(mocks.from).not.toHaveBeenCalled();});
 it('limits status updates and removal to the displayed campaign and member',async()=>{await updateCampaignMember(client,cid,mid,'responded');expect(mocks.update).toHaveBeenCalledWith({member_status:'responded'});expect(mocks.eq).toHaveBeenCalledWith('id',mid);expect(mocks.eq).toHaveBeenCalledWith('campaign_id',cid);await removeCampaignMember(client,cid,mid);expect(mocks.delete).toHaveBeenCalledOnce();});
 it('preserves the source received-status identifier rather than accepting a renamed value',async()=>{await expect(addCampaignMember(client,cid,'lead',mid,'received')).rejects.toThrow();expect(mocks.from).not.toHaveBeenCalled();await addCampaignMember(client,cid,'lead',mid,'recieved');expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({member_status:'recieved'}));});
});

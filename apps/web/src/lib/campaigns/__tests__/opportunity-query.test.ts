import {beforeEach,describe,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({from:vi.fn(),select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),auth:{user:{id:'first'},profile:{is_active:true},permissions:['campaigns.view','opportunities.view'],roleIds:['ASM'],hasPermission:vi.fn(),isLoading:false}}));
vi.mock('@tanstack/react-query',()=>({useQuery:(o:unknown)=>o,useMutation:vi.fn(),useQueryClient:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({from:mock.from})}));
vi.mock('@/components/providers/auth-provider',()=>({useAuth:()=>mock.auth}));
import {useCampaignOpportunities} from '@/hooks/use-campaigns';
const query=()=>useCampaignOpportunities('campaign') as unknown as {queryKey:unknown[];enabled:boolean;queryFn:()=>Promise<unknown>};
beforeEach(()=>{vi.clearAllMocks();mock.auth.user.id='first';mock.auth.hasPermission.mockReturnValue(true);const chain={select:mock.select,eq:mock.eq,order:mock.order,limit:mock.limit};mock.from.mockReturnValue(chain);mock.select.mockReturnValue(chain);mock.eq.mockReturnValue(chain);mock.order.mockReturnValue(chain);mock.limit.mockResolvedValue({data:[{id:'opportunity'}],error:null});});
describe('Campaign Opportunity source query',()=>{
 it('uses the source-backed FK with bounded results',async()=>{await query().queryFn();expect(mock.eq).toHaveBeenCalledWith('primary_campaign_source_id','campaign');expect(mock.limit).toHaveBeenCalledWith(100);});
 it('partitions cache by actor and denies disabled module access',()=>{const first=query();mock.auth.user.id='second';expect(query().queryKey).not.toEqual(first.queryKey);mock.auth.hasPermission.mockReturnValue(false);expect(query().enabled).toBe(false);});
 it('surfaces query failure instead of returning a fake empty related list',async()=>{mock.limit.mockResolvedValue({data:null,error:new Error('Query failed')});await expect(query().queryFn()).rejects.toThrow('Query failed');});
});

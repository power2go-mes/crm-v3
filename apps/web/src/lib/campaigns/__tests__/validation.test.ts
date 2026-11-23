import {describe,it,expect} from 'vitest';
import {campaignInput} from '../validation';
const valid={campaign_name:'Source campaign',campaign_type:'email',status:'planned',parent_campaign_id:'',start_date:'',end_date:'',expected_revenue:'1234.50',budget_cost:'',actual_cost:'',expected_response:'25',number_sent:'0',description:''};
describe('v2 Campaign validation',()=>{
 it('preserves optional null values and source numeric bounds',()=>{const r=campaignInput.parse(valid);expect(r.expected_revenue).toBe(1234.5);expect(r.budget_cost).toBeNull();expect(r.expected_response).toBe(25);expect(r.parent_campaign_id).toBeNull();});
 it('rejects invalid types, negative costs and response percentages',()=>{for(const patch of [{campaign_type:'invented'},{budget_cost:'-1'},{expected_response:'101'},{number_sent:'1.5'}])expect(campaignInput.safeParse({...valid,...patch}).success).toBe(false);});
 it('does not accept browser-owned owner identifiers or derived counters',()=>{expect(campaignInput.safeParse({...valid,campaign_owner_id:'forged'}).success).toBe(false);expect(campaignInput.safeParse({...valid,responses_in_campaign:100}).success).toBe(false);});
});

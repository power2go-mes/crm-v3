import {describe,it,expect} from 'vitest';
import {defaultBlocks,sourceHomeBlocks,orderedBlocks,dashboardDateQuery,dashboardFilterUrl} from '../widget-order';
describe('v2 Dashboard widget layout',()=>{
 it('interleaves two charts then a table, retaining trailing tables',()=>{expect(defaultBlocks(['c1','c2','c3','c4','c5'],['t1','t2','t3','t4','t5','t6'])).toEqual(['c1','c2','t1','c3','c4','t2','c5','t3','t4','t5','t6']);});
 it('uses the screenshot and source module order without changing a saved layout',()=>{expect(sourceHomeBlocks([{id:'leads.lead_source'},{id:'opportunities.lead_source'},{id:'accounts.account_type'},{id:'leads.status'},{id:'campaigns.campaign_type'}],[{id:'won-leads'},{id:'open-leads'},{id:'accounts'},{id:'contacts'},{id:'campaigns'},{id:'won-opportunities'}]).map(x=>x.id)).toEqual(['accounts.account_type','leads.lead_source','accounts','leads.status','campaigns.campaign_type','contacts','opportunities.lead_source','won-leads','open-leads','campaigns','won-opportunities']);});
 it('restores saved order while retaining new widgets and ignoring unknown ids',()=>{expect(orderedBlocks([{id:'c'},{id:'t'},{id:'new'}],['gone','t','c']).map(x=>x.id)).toEqual(['t','c','new']);});
 it('cancel/reset can restore defaults without mutating saved widgets',()=>{const blocks=[{id:'c'},{id:'t'}];const draft=orderedBlocks(blocks,['t','c']);expect(draft.map(x=>x.id)).toEqual(['t','c']);expect(orderedBlocks(blocks,[])).toEqual(blocks);expect(blocks[0].id).toBe('c');});
});

describe('Dashboard filter URL state',()=>{
 it('restores custom dates from navigation state',()=>{expect(dashboardDateQuery('date_range=custom&date_from=2026-11-01&date_to=2026-11-16')).toEqual({range:'custom',from:'2026-11-01',to:'2026-11-16'});});
 it('uses source all-time default for missing or unsupported ranges',()=>{expect(dashboardDateQuery('').range).toBe('all');expect(dashboardDateQuery('date_range=999').range).toBe('all');});
 it('changes one filter while preserving unrelated selections',()=>{const p=new URLSearchParams(dashboardFilterUrl('date_range=custom&date_from=2026-11-01&view=mine','date_to','2026-11-16'));expect(p.get('view')).toBe('mine');expect(p.get('date_from')).toBe('2026-11-01');expect(p.get('date_to')).toBe('2026-11-16');});
});

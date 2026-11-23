export function defaultBlocks<C,T>(charts:readonly C[],tables:readonly T[]):(C|T)[]{const result:(C|T)[]=[];let c=0,t=0;while(c<charts.length||t<tables.length){for(let n=0;n<2&&c<charts.length;n++)result.push(charts[c++]);if(t<tables.length)result.push(tables[t++]);}return result;}
// The source home view interleaves two charts and one table. Its registered
// module order is different from the aggregate RPC's query order.
export const homeChartOrder=['accounts.account_type','leads.lead_source','leads.status','campaigns.campaign_type','opportunities.lead_source'];
export const homeTableOrder=['accounts','contacts','won-leads','open-leads','campaigns','won-opportunities'];
export function sourceHomeBlocks<T extends {id:string}>(charts:readonly T[],tables:readonly T[]):T[]{
 const rank=(order:readonly string[],id:string)=>{const index=order.indexOf(id);return index<0?order.length:index;};
 return defaultBlocks([...charts].sort((a,b)=>rank(homeChartOrder,a.id)-rank(homeChartOrder,b.id)),[...tables].sort((a,b)=>rank(homeTableOrder,a.id)-rank(homeTableOrder,b.id)));
}
export function orderedBlocks<T extends {id:string}>(blocks:readonly T[],saved:readonly string[]):T[]{const rank=new Map(saved.map((id,i)=>[id,i]));return [...blocks].sort((a,b)=>(rank.get(a.id)??999)-(rank.get(b.id)??999));}

export function dashboardDateQuery(query:string){const p=new URLSearchParams(query);const requested=p.get('date_range')??'all';return {range:['all','7','30','60','90','custom'].includes(requested)?requested:'all',from:p.get('date_from')??'',to:p.get('date_to')??''};}
export function dashboardFilterUrl(query:string,name:string,value:string){const p=new URLSearchParams(query);p.set(name,value);return p.toString();}

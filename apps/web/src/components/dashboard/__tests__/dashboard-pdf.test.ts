import {describe,it,expect} from 'vitest';
import * as echarts from 'echarts';
import sharp from 'sharp';
import {dashboardPdf} from '../dashboard-pdf';
const table={id:'contacts',title:'Contacts',kind:'table',status:'ready',data:[]};
const chart={id:'leads.status',title:'Leads by Stage',kind:'bar',status:'ready',data:[{label:'New',value:3}]};
describe('Dashboard PDF with rendered charts and current table records',()=>{
 it('embeds a real chart image and visible table text in widget order',async()=>{
 const instance=echarts.init(null,undefined,{renderer:'svg',ssr:true,width:900,height:400});
 instance.setOption({animation:false,xAxis:{type:'category',data:['New']},yAxis:{type:'value'},series:[{type:'bar',data:[3]}]});
 const png=await sharp(Buffer.from(instance.renderToSVGString())).png().toBuffer();instance.dispose();
 const doc=dashboardPdf('All Time',[{title:'Total Leads',value:3}],[table,chart],new Map([[chart.id,{getDataURL:()=> 'data:image/png;base64,'+png.toString('base64')}]]),new Map([[table.id,['First Name | Email','Synthetic Contact | fixture@example.invalid']]]));
 const bytes=Buffer.from(doc.output('arraybuffer'));expect(doc.getNumberOfPages()).toBe(3);expect(bytes.includes(Buffer.from('/Subtype /Image'))).toBe(true);expect(bytes.includes(Buffer.from('Synthetic Contact'))).toBe(true);
 const text=bytes.toString('latin1');expect(text.indexOf('(Contacts)')).toBeLessThan(text.indexOf('(Leads by Stage)'));
 });
 it('refuses export when a nonempty chart is not initialized',()=>{expect(()=>dashboardPdf('All Time',[],[chart],new Map(),new Map())).toThrow('Chart is not ready');});
 it('refuses an unloaded or refreshing table instead of exporting stale records',()=>{expect(()=>dashboardPdf('All Time',[],[table],new Map(),new Map())).toThrow('Table is not ready');});
});

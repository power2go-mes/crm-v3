import {jsPDF} from 'jspdf';
import type {ECharts} from 'echarts';
import type {ChartData} from './dashboard-chart';
export function dashboardPdf(title:string,kpis:readonly {title:string;value:number}[],widgets:readonly ChartData[],charts:ReadonlyMap<string,Pick<ECharts,'getDataURL'>>,tables:ReadonlyMap<string,readonly string[]>){
 const doc=new jsPDF({orientation:'landscape'});doc.text('Dashboard',12,15);doc.text(title,12,23);kpis.forEach((k,i)=>doc.text(k.title+': '+k.value,12,35+i*8));
 for(const widget of widgets){
 if(widget.kind==='table'){const lines=tables.get(widget.id);if(!lines)throw Error('Table is not ready');doc.addPage();doc.text(widget.title,12,15);let y=27;for(const line of lines){for(const part of doc.splitTextToSize(line,265)){if(y>190){doc.addPage();y=15;}doc.text(part,12,y);y+=7;}}continue;}
 const instance=charts.get(widget.id);if(widget.status==='ready'&&widget.data.length&&!instance)throw Error('Chart is not ready');doc.addPage();doc.text(widget.title,12,15);
 if(!instance){doc.text(widget.status==='ready'?'No data available.':'Chart data unavailable: required CRM fields are not migrated.',12,30);continue;}
 doc.addImage(instance.getDataURL({type:'png',pixelRatio:2,backgroundColor:'#fff'}),'PNG',12,25,270,155);
 }return doc;
}

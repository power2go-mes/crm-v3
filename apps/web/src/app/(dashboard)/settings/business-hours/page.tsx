'use client';
import {Suspense,useEffect,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/components/providers/auth-provider';
import {PermissionGate} from '@/components/auth/permission-gate';
import {PageContainer} from '@/components/shell/page-container';
import {PageHeader} from '@/components/shell/page-header';
import {BusinessHourHolidays} from '@/components/settings/business-hour-holidays';
import {ShiftHoursManager} from '@/components/settings/shift-hours-manager';
import {createClient} from '@/lib/supabase/client';
import {businessHoursInput,businessHourRows,dayLabels,initialBusinessHours,saveBusinessHours,weekDays,type BusinessHours} from '@/lib/settings/business-hours';

const types={'24_7':'24 Hours x 7 days','24_5':'24 Hours x 5 days',custom:'Custom Hours'};
export default function BusinessHoursPage(){
  return <Suspense fallback={<p role="status">Loading working hours…</p>}><BusinessHoursSession/></Suspense>;
}
function BusinessHoursSession(){
  const {user,permissions}=useAuth();
  const params=useSearchParams();
  return <WorkingHours key={`${user?.id}:${[...permissions].sort().join('|')}:${params.get('tab')}`} />;
}
function WorkingHours(){
  const params=useSearchParams();const router=useRouter();const shifts=params.get('tab')==='shifts';
  function tab(value:'business'|'shifts'){const next=new URLSearchParams(params.toString());if(value==='business')next.delete('tab');else next.set('tab',value);router.push(`/settings/business-hours${next.size?'?'+next.toString():''}`,{scroll:false});}
  const {user,profile,permissions,hasPermission,isLoading}=useAuth();
  const client=createClient();const cache=useQueryClient();const key=['crm',user?.id,'business-hours'];
  const [form,setForm]=useState<BusinessHours>(initialBusinessHours);
  const [open,setOpen]=useState(false);const [notice,setNotice]=useState('');
  const modal=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement|null>(null);
  const query=useQuery({queryKey:[...key,[...permissions].sort().join('|')],enabled:!shifts&&!isLoading&&!!user&&!!profile?.is_active&&hasPermission('business_hours.view'),queryFn:async()=>{
    const {data,error}=await client.from('business_hours').select('definition').eq('id',1).maybeSingle();
    if(error)throw new Error('Business hours could not be loaded.');
    return data?businessHoursInput.parse(data.definition):null;
  }});
  useEffect(()=>{if(open)modal.current?.showModal();else modal.current?.close();},[open]);
  function close(){setOpen(false);trigger.current?.focus();}
  const save=useMutation({mutationFn:()=>saveBusinessHours(client,form,!query.data),onSuccess:async()=>{await cache.invalidateQueries({queryKey:key});setNotice('Business hours saved successfully.');close();}});
  function edit(button:HTMLButtonElement){trigger.current=button;setForm(query.data?structuredClone(query.data):initialBusinessHours());save.reset();setOpen(true);}
  const current=query.data;
  function set<K extends keyof BusinessHours>(key:K,value:BusinessHours[K]){setForm(previous=>({...previous,[key]:value}));}
  const timezones=Intl.supportedValuesOf('timeZone');
  return <PageContainer><Link className="text-sm text-emerald-800" href="/settings">Settings</Link>
    <PageHeader title="Working hours" subtitle="Define the working hours your company operates on each day." actions={!shifts&&!query.isPending&&!query.isError&&!current&&hasPermission('business_hours.create')?<button className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={event=>edit(event.currentTarget)}>Add Business Hour</button>:undefined}/>
    <PermissionGate action="business_hours.view" showAccessDenied>
      <div role="tablist" aria-label="Business and shift hours" className="mb-4 flex gap-2 text-sm"><button role="tab" aria-selected={!shifts} className={`rounded px-3 py-2 ${!shifts?'bg-emerald-600 text-white':'border'}`} onClick={()=>tab('business')}>Business hours</button><button role="tab" aria-selected={shifts} className={`rounded px-3 py-2 ${shifts?'bg-emerald-600 text-white':'border'}`} onClick={()=>tab('shifts')}>Shift hours</button></div>
      {shifts?<ShiftHoursManager/>:<>
      {notice&&<p role="status" className="mb-3 text-green-800">{notice}</p>}
      {query.isLoading?<p role="status">Loading business hours…</p>:query.isError?<p role="alert">{query.error.message} <button onClick={()=>void query.refetch()}>Retry</button></p>:current?<section className="max-w-6xl rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{current.name}</h2><span className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{types[current.business_hour_type]}</span>{current.business_hour_type==='custom'&&<span className="text-xs">{current.timing_type==='same'?'Same Hour Every Day':'Different Hour Per Day'}</span>}</div>{hasPermission('business_hours.update')&&<button className="rounded border border-emerald-200 px-4 py-2 text-emerald-800" onClick={event=>edit(event.currentTarget)}>Edit</button>}</div>
        <dl className="grid gap-3 p-5 text-sm sm:grid-cols-[13rem_1fr]"><dt>Week starts on</dt><dd>{dayLabels[current.week_start_day]}</dd><dt>Time Zone</dt><dd>{current.time_zone}</dd><dt>Active</dt><dd>{current.is_active?'Yes':'No'}</dd><dt>Business hours</dt><dd><ul className="space-y-2">{businessHourRows(current).map(row=><li key={row.day} className="grid grid-cols-2 gap-4"><span>{row.day}</span><span>{row.hours}</span></li>)}</ul></dd></dl>
      </section>:<p>No business hours configured.</p>}
      {current&&<BusinessHourHolidays/>}
      </>}
    </PermissionGate>
    <dialog ref={modal} aria-labelledby="business-hour-form-title" onCancel={event=>{if(save.isPending)event.preventDefault();else close();}} className="max-h-[90vh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-xl p-6 backdrop:bg-black/20 backdrop:backdrop-blur-xs">
      <form onSubmit={event=>{event.preventDefault();save.mutate();}} className="space-y-4"><h2 id="business-hour-form-title" className="text-lg font-semibold">Business Hour Form</h2>
        <label className="block text-sm">Name *<input autoFocus required maxLength={255} className="mt-1 block w-full rounded border p-2" placeholder="e.g. US Business Hours" value={form.name} onChange={event=>set('name',event.target.value)}/></label>
        <label className="block text-sm">Time Zone *<input required list="business-timezones" className="mt-1 block w-full rounded border p-2" value={form.time_zone} onChange={event=>set('time_zone',event.target.value)}/><datalist id="business-timezones"><option value="UTC"/>{timezones.map(zone=><option key={zone} value={zone}/>)}</datalist></label>
        <label className="block text-sm">Week Start Day<select className="mt-1 block w-full rounded border p-2" value={form.week_start_day} onChange={event=>set('week_start_day',event.target.value as BusinessHours['week_start_day'])}>{weekDays.map(day=><option key={day} value={day}>{dayLabels[day]}</option>)}</select></label>
        <label className="block text-sm">Business Hour Type<select className="mt-1 block w-full rounded border p-2" value={form.business_hour_type} onChange={event=>{const value=event.target.value as BusinessHours['business_hour_type'];setForm(previous=>({...previous,business_hour_type:value,timing_type:value==='custom'?(previous.timing_type??'same'):null}));}}>{Object.entries(types).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        {form.business_hour_type==='custom'&&<label className="block text-sm">Timing Type<select className="mt-1 block w-full rounded border p-2" required value={form.timing_type??''} onChange={event=>set('timing_type',event.target.value as BusinessHours['timing_type'])}><option value="same">Same Hour Every Day</option><option value="different">Different Hour Per Day</option></select></label>}
        {(form.business_hour_type==='24_5'||form.business_hour_type==='custom'&&form.timing_type==='same')&&<fieldset><legend className="mb-2 text-sm">Week Days</legend><div className="flex flex-wrap gap-3">{weekDays.map(day=><label key={day} className="text-sm"><input type="checkbox" checked={form.week_days.includes(day)} onChange={event=>set('week_days',event.target.checked?[...form.week_days,day]:form.week_days.filter(value=>value!==day))}/> {dayLabels[day]}</label>)}</div></fieldset>}
        {form.business_hour_type==='custom'&&form.timing_type==='same'&&<div className="grid grid-cols-2 gap-4">{(['default_start_time','default_end_time'] as const).map(field=><label key={field} className="text-sm">{field==='default_start_time'?'Default Start Time':'Default End Time'}<input type="time" step="1" className="mt-1 block w-full rounded border p-2" value={form[field]??''} onChange={event=>set(field,event.target.value||null)}/></label>)}</div>}
        {form.business_hour_type==='custom'&&form.timing_type==='different'&&<div className="space-y-3">{weekDays.map(day=><fieldset key={day} className="rounded border p-3"><legend className="px-1 text-sm font-semibold">{dayLabels[day]}</legend><div className="grid grid-cols-2 gap-4">{(['start','end'] as const).map(field=><label key={field} className="text-sm">{field==='start'?'Start':'End'}<input type="time" step="1" className="mt-1 block w-full rounded border p-2" value={form.day_hours[day][field]??''} onChange={event=>setForm(previous=>({...previous,day_hours:{...previous.day_hours,[day]:{...previous.day_hours[day],[field]:event.target.value||null}}}))}/></label>)}</div></fieldset>)}</div>}
        <label className="block text-sm"><input type="checkbox" checked={form.is_active} onChange={event=>set('is_active',event.target.checked)}/> Active</label>
        {save.error&&<p role="alert" className="text-red-700">{save.error.message}</p>}
        <div className="flex justify-end gap-3 border-t pt-4"><button type="button" disabled={save.isPending} onClick={close}>Cancel</button><button type="submit" disabled={save.isPending||!form.name.trim()} className="rounded bg-emerald-600 px-4 py-2 text-white">{save.isPending?'Saving…':'Save'}</button></div>
      </form>
    </dialog>
  </PageContainer>;
}

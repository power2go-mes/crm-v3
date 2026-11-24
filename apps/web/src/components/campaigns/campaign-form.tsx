'use client';
import {useEffect,useRef,useState} from 'react';
import type {CampaignRecord} from '@finlonexa/database';
import {campaignTypes,campaignStatuses} from '@/lib/campaigns/validation';
import {saveCampaign} from '@/app/(dashboard)/campaigns/actions';
import {useAuth} from '@/components/providers/auth-provider';
export function CampaignForm({record,parents,onClose,onSaved}:{record?:CampaignRecord;parents:CampaignRecord[];onClose:()=>void;onSaved:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);const [pending,setPending]=useState(false);const [error,setError]=useState('');const {profile}=useAuth();
 useEffect(()=>{const d=dialog.current;d?.showModal();return()=>{d?.close();};},[]);
 const fields=[['start_date','Start Date','date'],['end_date','End Date','date'],['expected_revenue','Expected Revenue','number'],['budget_cost','Budget Cost','number'],['actual_cost','Actual Cost','number'],['expected_response','Expected Response (%)','number'],['number_sent','Number Sent in Campaign','number']] as const;
 return <dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!pending)onClose();}} className="w-full max-w-2xl rounded-xl p-6 backdrop:bg-black/20 backdrop-blur-xs">
 <header className="flex justify-between"><h2>{record?'Edit Campaign':'New Campaign'}</h2><button aria-label="Close" disabled={pending} onClick={onClose}>Ã—</button></header>
 <form onSubmit={async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));setPending(true);setError('');try{const r=await saveCampaign({...data,...(record?{id:record.id}:{})});if(r.error){setError(r.error);return;}await onSaved();onClose();}catch{setError('Save unavailable. Try again.');}finally{setPending(false);}}}>
 <fieldset disabled={pending} className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
 <label>Campaign Owner<input disabled value={record?.campaign_owner_id??profile?.email??''} className="block w-full border rounded p-2" /></label>
 <label>Campaign Name<input name="campaign_name" required maxLength={255} defaultValue={record?.campaign_name??''} className="block w-full border rounded p-2" /></label>
 <label>Parent Campaign<select name="parent_campaign_id" defaultValue={record?.parent_campaign_id??''} className="block w-full border rounded p-2"><option value="">None</option>{record?.parent_campaign_id&&!parents.some(p=>p.id===record.parent_campaign_id)&&<option value={record.parent_campaign_id}>Current Parent Campaign</option>}{parents.filter(p=>p.id!==record?.id).map(p=><option key={p.id} value={p.id}>{p.campaign_name}</option>)}</select></label>
 <label>Type<select name="campaign_type" required defaultValue={record?.campaign_type??''} className="block w-full border rounded p-2"><option value="">Select Type</option>{campaignTypes.map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label>
 <label>Status<select name="status" defaultValue={record?.status??'planned'} className="block w-full border rounded p-2">{campaignStatuses.map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label>
 {fields.map(([key,label,type])=><label key={key}>{label}<input name={key} type={type} min={type==='number'?0:undefined} max={key==='expected_response'?100:undefined} step={key==='number_sent'?1:'any'} defaultValue={record?.[key]??(key==='number_sent'?0:'')} className="block w-full border rounded p-2" /></label>)}
 <label className="sm:col-span-2">Description<textarea name="description" maxLength={32000} defaultValue={record?.description??''} className="block w-full border rounded p-2" /></label>
 </fieldset>{error&&<p role="alert">{error}</p>}<footer className="flex justify-end gap-3"><button type="button" disabled={pending} onClick={onClose}>Cancel</button><button disabled={pending} className="rounded bg-emerald-600 text-white px-4 py-2">{pending?'Saving...':'Save'}</button></footer></form></dialog>;
}

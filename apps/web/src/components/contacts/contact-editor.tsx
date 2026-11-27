'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { z } from 'zod';
import { saveContact } from '@/app/(dashboard)/contacts/actions';
type Fields = { parent_contact_id?: string | null; is_primary?: boolean; id?: string; title?: string | null; first_name?: string; last_name?: string; email?: string | null; contact_number?: string | null; secondary_contact_number?: string | null };
export function ContactEditor({ initial = {}, onCancel }: { initial?: Fields; onCancel: () => void }) {
  const { user, hasPermission } = useAuth();
  const options = useQuery({queryKey:['crm',user?.id,'contacts','edit-options',initial.id],enabled:!!user,queryFn:async()=>{
    const c=createClient(); const [accounts,parents,relationships]=await Promise.all([
      hasPermission('accounts.view') ? c.from('accounts').select('id,name').order('name').limit(50) : Promise.resolve({data:[],error:null}),
      c.from('contacts').select('id,first_name,last_name').order('first_name').limit(50),
      initial.id ? c.rpc('contact_accounts',{cid:initial.id}) : Promise.resolve({data:[],error:null})
    ]);
    if(accounts.error||parents.error||relationships.error)throw Error('Options unavailable');
    return {accounts:accounts.data??[],parents:parents.data??[],links:z.array(z.object({account_id:z.string(),name:z.string(),role_id:z.string().nullable(),legacy:z.boolean()})).parse(relationships.data)};
  }});
  const router = useRouter(); const cache = useQueryClient();
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  if(options.isPending)return <p role="status">Loading contact form...</p>;
  if(options.isError)return <p role="alert">Contact form options unavailable. <button onClick={()=>void options.refetch()}>Retry</button><button onClick={onCancel}>Cancel</button></p>;
  const accounts=[...options.data.accounts,...options.data.links.filter(link=>!options.data.accounts.some(a=>a.id===link.account_id)).map(link=>({id:link.account_id,name:link.name}))];
  return <form className="my-4 rounded border bg-white p-4 space-y-3" onSubmit={async event => {
    event.preventDefault(); setPending(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await saveContact({ ...(initial.id ? { id: initial.id } : {}), ...Object.fromEntries([...form.entries()].filter(([key])=>key!=='account_ids'&&key!=='is_primary')),is_primary:form.get('is_primary')==='on',relationships:form.getAll('account_ids').map(id=>({account_id:String(id),role_id:options.data.links.find(link=>link.account_id===id)?.role_id??null})) });
      if (result.error || !result.id) { setError(result.error ?? 'Save failed.'); return; }
      await cache.invalidateQueries({ queryKey: ['crm', user?.id, 'contacts'] });
      onCancel(); router.push('/contacts/' + result.id);
    } catch { setError('Save unavailable. Try again.'); } finally { setPending(false); }
  }}>
    <h2>{initial.id ? 'Edit Contact' : 'New Contact'}</h2>
    <fieldset disabled={pending} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {(['title','first_name','last_name','contact_number','email','secondary_contact_number'] as const).map(key => <label key={key}>
        {{ title: 'Title', first_name: 'First Name', last_name: 'Last Name', contact_number: 'Contact Number', email: 'Email', secondary_contact_number: 'Secondary Contact Number' }[key]}
        <input name={key} defaultValue={initial[key] ?? ''} required={key === 'first_name' || key === 'last_name'} type={key === 'email' ? 'email' : 'text'} maxLength={key.includes('number') ? 40 : key === 'first_name' || key === 'last_name' ? 80 : 100} className="block w-full rounded border p-2" />
      </label>)}
      <label>Parent Contact<select name="parent_contact_id" defaultValue={initial.parent_contact_id??''} className="block w-full border p-2"><option value="">None</option>{initial.parent_contact_id && !options.data.parents.some(c=>c.id===initial.parent_contact_id) && <option value={initial.parent_contact_id}>Current Parent Contact</option>}{options.data.parents.filter(c=>c.id!==initial.id).map(c=><option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</select></label>
      <label><input type="checkbox" name="is_primary" defaultChecked={initial.is_primary??false} /> Is Primary</label>
      <label>Related Accounts<select multiple name="account_ids" defaultValue={options.data.links.map(link=>link.account_id)} className="block w-full border p-2">{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={pending} onClick={onCancel} className="border rounded px-3 py-2 mr-2">Cancel</button>
    <button disabled={pending} className="rounded bg-[#4361ee] text-white px-3 py-2">{pending ? 'Saving...' : 'Save'}</button>
  </form>;
}

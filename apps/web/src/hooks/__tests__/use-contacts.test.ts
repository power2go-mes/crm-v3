import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({save:vi.fn(),invalidate:vi.fn()}));
vi.mock('@tanstack/react-query',()=>({useQuery:vi.fn(),useMutation:(options:unknown)=>options,useQueryClient:()=>({invalidateQueries:mocks.invalidate})}));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>{throw Error('Mutations must use the atomic server action');}}));
vi.mock('@/app/(dashboard)/contacts/actions',()=>({saveContact:mocks.save}));
import { useCreateContactMutation,useUpdateContactMutation } from '../use-contacts';
// The mocked hook returns its options, allowing execution of the actual mutation callbacks.
const create=()=>useCreateContactMutation() as unknown as {mutationFn:(p:unknown)=>Promise<unknown>;onSuccess:(p:unknown)=>void};
const update=()=>useUpdateContactMutation() as unknown as {mutationFn:(p:unknown)=>Promise<unknown>;onSuccess:(p:unknown)=>void};
beforeEach(()=>{vi.clearAllMocks();mocks.save.mockResolvedValue({id:'contact-id'});});
describe('Contacts atomic mutation integration',()=>{
 it('preserves multiple relationship roles, hierarchy and primary flag',async()=>{
 const relationships=[{account_id:'a',role_id:'r'},{account_id:'b',role_id:null}];
 await create().mutationFn({first_name:' First ',last_name:' Last ',email:' name@example.invalid ',relationships,parent_contact_id:'parent',is_primary:true});
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({first_name:'First',email:'name@example.invalid',relationships,parent_contact_id:'parent',is_primary:true}));
 });
 it('passes nullable email to server validation without a trim crash',async()=>{
 mocks.save.mockResolvedValue({error:'Check email'});
 await expect(create().mutationFn({first_name:'First',last_name:'Last',email:null})).rejects.toThrow('Check email');
 expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({email:'',relationships:[]}));
 });
 it('distinguishes omitted edit relationships from explicit removal',async()=>{
 await update().mutationFn({id:'contact-id',updates:{first_name:'First',last_name:'Last',email:null}});
 expect(mocks.save.mock.calls[0][0].relationships).toBeUndefined();
 await update().mutationFn({id:'contact-id',updates:{first_name:'First',last_name:'Last',email:'x@example.invalid',relationships:[]}});
 expect(mocks.save.mock.calls[1][0].relationships).toEqual([]);
 });
 it('retains query invalidation after atomic saves',()=>{
 update().onSuccess({id:'contact-id'});
 expect(mocks.invalidate).toHaveBeenCalledWith({queryKey:['contact','contact-id']});
 expect(mocks.invalidate).toHaveBeenCalledWith({queryKey:['crm']});
 });
});

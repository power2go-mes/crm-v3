import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { changeOwnPassword, passwordChangeInput, sendPasswordVerification } from '../password';
const id='c0de0000-0000-4000-8000-000000000901';
// Synthetic literals only; no local test-account credential files are read.
const input={current_password:'Synthetic-old-password',new_password:'Synthetic-new-password',confirm_password:'Synthetic-new-password'};
const getUser=vi.fn(),signIn=vi.fn(),update=vi.fn(),single=vi.fn(),reauth=vi.fn();
const client={auth:{getUser,signInWithPassword:signIn,updateUser:update,reauthenticate:reauth},from:()=>({select:()=>({eq:()=>({single})})})} as unknown as SupabaseClient<Database>;
beforeEach(()=>{vi.clearAllMocks();getUser.mockResolvedValue({data:{user:{id,email:'fixture@example.invalid'}},error:null});single.mockResolvedValue({data:{is_active:true},error:null});signIn.mockResolvedValue({data:{user:{id}},error:null});update.mockResolvedValue({data:{user:{id}},error:null});reauth.mockResolvedValue({error:null});});
describe('Source-compatible own password changes',()=>{
 it('rejects mismatched/reused values and forged target IDs before provider calls',async()=>{
  expect(passwordChangeInput.safeParse({...input,new_password:input.current_password,confirm_password:input.current_password}).success).toBe(false);
  expect((await changeOwnPassword(client,{...input,confirm_password:'Mismatch'})).success).toBe(false);
  expect((await changeOwnPassword(client,{...input,user_id:'another-user'})).success).toBe(false);expect(signIn).not.toHaveBeenCalled();
 });
 it('requires an authenticated active identity',async()=>{
  getUser.mockResolvedValueOnce({data:{user:null},error:null});expect((await changeOwnPassword(client,input)).success).toBe(false);
  single.mockResolvedValue({data:{is_active:false},error:null});expect((await changeOwnPassword(client,input)).success).toBe(false);expect(update).not.toHaveBeenCalled();
 });
 it('always verifies current password and never updates on a failed or different-user sign-in',async()=>{
  signIn.mockResolvedValueOnce({data:{user:null},error:{code:'invalid_credentials'}});
  expect((await changeOwnPassword(client,input)).error).toBe('Current password is incorrect.');
  signIn.mockResolvedValueOnce({data:{user:{id:'different'}},error:null});expect((await changeOwnPassword(client,input)).success).toBe(false);expect(update).not.toHaveBeenCalled();
 });
 it('uses standard provider update on the verified current identity',async()=>{
  expect(await changeOwnPassword(client,input)).toEqual({success:true});
  expect(signIn).toHaveBeenCalledWith({email:'fixture@example.invalid',password:input.current_password});
  expect(update).toHaveBeenCalledWith({password:input.new_password,current_password:input.current_password});
 });
 it('preserves provider reauthentication instead of bypassing it',async()=>{
  update.mockResolvedValue({error:{code:'reauthentication_needed'}});
  expect((await changeOwnPassword(client,input)).needsVerification).toBe(true);
  expect(await sendPasswordVerification(client)).toEqual({success:true});expect(reauth).toHaveBeenCalledOnce();
 });
 it('does not report success when provider policy rejects a password',async()=>{
  update.mockResolvedValue({error:{code:'weak_password',message:'Password policy rejected.'}});
  expect(await changeOwnPassword(client,input)).toEqual({success:false,error:'Password policy rejected.'});
 });
});

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';
import { catalogRoleInput, deleteCatalogRole, listCatalogRoles, saveCatalogRole } from '../relationship-roles';
const id='c0de0000-0000-4000-8000-000000001102';
describe('Relationship role catalogs', () => {
  it('keeps source name bounds, nullable description and strict identity', () => {
    expect(catalogRoleInput.parse({kind:'customer',id:null,name:' Buyer ',description:null}).name).toBe('Buyer');
    for(const patch of [{name:' '},{name:'x'.repeat(51)},{kind:'SUPER_ADMIN'},{created_by:'forged'}]) expect(catalogRoleInput.safeParse({kind:'team',id:null,name:'Role',description:'',...patch}).success).toBe(false);
  });
  it('saves existing Customer roles through the catalog boundary without a supplied actor', async () => {
    const rpc=vi.fn().mockResolvedValue({data:id,error:null});
    await expect(saveCatalogRole({rpc} as unknown as SupabaseClient<Database>,{kind:'customer',id,name:'Buyer',description:null})).resolves.toBe(id);
    expect(rpc).toHaveBeenCalledWith('save_settings_role',{p_kind:'customer',p_id:id,p_name:'Buyer',p_description:null});
  });
  it('keeps dependent deletion explicit and propagates denials', async () => {
    const rpc=vi.fn().mockResolvedValueOnce({error:{message:'Confirm removal'}}).mockResolvedValueOnce({error:null});const client={rpc} as unknown as SupabaseClient<Database>;
    await expect(deleteCatalogRole(client,'customer',id)).rejects.toThrow('Confirm');
    await deleteCatalogRole(client,'customer',id,true);
    expect(rpc).toHaveBeenLastCalledWith('delete_settings_role',{p_kind:'customer',p_id:id,p_confirm_relationships:true});
  });
  it('validates paging and response rather than accepting truncated/invalid data', async () => {
    const rpc=vi.fn().mockResolvedValue({data:{count:1,rows:[{id,name:'Buyer',description:null}]},error:null});const client={rpc} as unknown as SupabaseClient<Database>;
    expect((await listCatalogRoles(client,'customer','Buy',2,'description',false)).count).toBe(1);
    await expect(listCatalogRoles(client,'team','',0,'name',true)).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('surfaces read/write errors', async () => {
    const client={rpc:vi.fn().mockResolvedValue({data:null,error:{message:'Permission denied'}})} as unknown as SupabaseClient<Database>;
    await expect(listCatalogRoles(client,'team','',1,'name',true)).rejects.toThrow('Permission denied');
    await expect(saveCatalogRole(client,{kind:'partner',id:null,name:'Partner',description:null})).rejects.toThrow('Permission denied');
  });
});

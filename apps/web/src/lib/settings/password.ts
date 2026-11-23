import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@finlonexa/database';

export const passwordChangeInput = z.object({
  current_password: z.string().min(1).max(1024),
  new_password: z.string().min(1).max(1024),
  confirm_password: z.string().min(1).max(1024),
  nonce: z.string().max(100).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.new_password !== input.confirm_password) ctx.addIssue({ code: 'custom', path: ['confirm_password'], message: 'Confirm password and new password must be match' });
  if (input.new_password === input.current_password) ctx.addIssue({ code: 'custom', path: ['new_password'], message: 'New password must be different from current password.' });
});
async function ownActiveIdentity(client: SupabaseClient<Database>) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || !user.email) throw new Error('Authentication required.');
  const profile = await client.from('user_profiles').select('is_active').eq('id', user.id).single();
  if (profile.error || !profile.data?.is_active) throw new Error('Active account required.');
  return user;
}
export async function changeOwnPassword(client: SupabaseClient<Database>, raw: unknown): Promise<{ success: boolean; error?: string; needsVerification?: boolean }> {
  const parsed = passwordChangeInput.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check password fields.' };
  const input = parsed.data;
  try {
    const user = await ownActiveIdentity(client);
    // Source always verifies the old password. Do not depend on a provider configuration flag.
    const verified = await client.auth.signInWithPassword({ email: user.email!, password: input.current_password });
    if (verified.error) return { success: false, error: verified.error.code === 'invalid_credentials' ? 'Current password is incorrect.' : 'Password verification failed. Check your connection or try again later.' };
    if (verified.data.user?.id !== user.id) return { success: false, error: 'Password verification identity did not match.' };
    const changed = await client.auth.updateUser({ password: input.new_password, current_password: input.current_password, ...(input.nonce ? { nonce: input.nonce } : {}) });
    if (changed.error) {
      if (['reauthentication_needed','reauthentication_not_valid'].includes(changed.error.code ?? '')) return { success: false, error: 'Additional password verification is required.', needsVerification: true };
      return { success: false, error: changed.error.code === 'weak_password' ? changed.error.message : 'Password could not be changed. Check the password policy and retry.' };
    }
    if (changed.data.user?.id !== user.id) return { success: false, error: 'Password update identity could not be verified.' };
    return { success: true };
  } catch { return { success: false, error: 'Password could not be changed. Check your session and retry.' }; }
}
export async function sendPasswordVerification(client: SupabaseClient<Database>) {
  try {
    await ownActiveIdentity(client);
    const { error } = await client.auth.reauthenticate();
    return error ? { success: false, error: 'Verification could not be sent. Retry or sign in again.' } : { success: true };
  } catch { return { success: false, error: 'Authentication required.' }; }
}

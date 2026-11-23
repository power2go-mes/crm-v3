'use server';
import { createClient } from '@/lib/supabase/server';
import { changeOwnPassword, sendPasswordVerification } from '@/lib/settings/password';
export async function changePasswordAction(input: unknown) { return changeOwnPassword(await createClient(), input); }
export async function requestPasswordVerification() { return sendPasswordVerification(await createClient()); }

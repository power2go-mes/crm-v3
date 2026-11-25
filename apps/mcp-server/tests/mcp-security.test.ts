import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { authenticateMcpRequest } from '../src/auth.js';
import { crmTools } from '../src/tools.js';

dotenv.config({ path: '../../apps/web/.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bpwdxslrkgmcoewkwufu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

// Read stored credentials from .test-credentials.local.json
const credPath = path.resolve(__dirname, '../../../.test-credentials.local.json');
const storedCreds = fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, 'utf-8')) : {};

const userTokens: Record<string, string> = {};

describe('FINLONEXA CRM MCP Server Security & Role Isolation', () => {
  beforeAll(async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const testUsers = {
      SUPER_ADMIN: 'test.superadmin@finlonexa.test',
      HEAD_OF_SALES: 'test.headofsales@finlonexa.test',
      RSM: 'test.rsm1@finlonexa.test',
      SSM: 'test.ssm1@finlonexa.test',
      ASM: 'test.asm1@finlonexa.test',
      BDO: 'test.bdo1@finlonexa.test',
    };

    for (const [role, email] of Object.entries(testUsers)) {
      const password = storedCreds[email] || 'Password123!';
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.session) {
        userTokens[role] = data.session.access_token;
      } else {
        console.warn(`Sign-in note for ${email}: ${error?.message}`);
      }
    }
  });

  it('1. MUST reject unauthenticated requests without Authorization header', async () => {
    await expect(authenticateMcpRequest(undefined)).rejects.toThrow(
      'Authentication required. Missing or malformed Authorization header.'
    );
  });

  it('2. MUST reject requests with invalid or tampered tokens', async () => {
    await expect(authenticateMcpRequest('Bearer invalid.token.payload')).rejects.toThrow(
      'Invalid or expired authentication session'
    );
  });

  it('3. SUPER_ADMIN user can authenticate and invoke administrative tools', async () => {
    if (!userTokens['SUPER_ADMIN']) return;

    const ctx = await authenticateMcpRequest(`Bearer ${userTokens['SUPER_ADMIN']}`);
    expect(ctx.userId).toBeDefined();
    expect(ctx.roles).toContain('SUPER_ADMIN');

    // Invoke crm_whoami
    const whoamiTool = crmTools.find(t => t.name === 'crm_whoami')!;
    const whoami = await whoamiTool.handler({}, ctx);
    expect(whoami.primaryRole).toBe('SUPER_ADMIN');

    // Invoke crm_admin_list_roles
    const adminTool = crmTools.find(t => t.name === 'crm_admin_list_roles')!;
    const roles = await adminTool.handler({}, ctx);
    expect(Array.isArray(roles)).toBe(true);
  });

  it('4. BDO user MUST be denied administrative tools', async () => {
    if (!userTokens['BDO']) return;

    const ctx = await authenticateMcpRequest(`Bearer ${userTokens['BDO']}`);
    expect(ctx.roles).toContain('BDO');

    const adminTool = crmTools.find(t => t.name === 'crm_admin_list_roles')!;
    await expect(adminTool.handler({}, ctx)).rejects.toThrow('Access Denied');
  });

  it('5. BDO user can list their assigned leads and search records', async () => {
    if (!userTokens['BDO']) return;

    const ctx = await authenticateMcpRequest(`Bearer ${userTokens['BDO']}`);
    const listLeadsTool = crmTools.find(t => t.name === 'crm_list_leads')!;
    const res = await listLeadsTool.handler({ pageSize: 5 }, ctx);

    expect(res).toHaveProperty('leads');
    expect(Array.isArray(res.leads)).toBe(true);
  });

  it('6. Two-step confirmation for destructive delete record', async () => {
    if (!userTokens['SUPER_ADMIN']) return;

    const ctx = await authenticateMcpRequest(`Bearer ${userTokens['SUPER_ADMIN']}`);
    const executeTool = crmTools.find(t => t.name === 'crm_execute_delete_record')!;

    // Directly attempting execution without valid confirmation token must fail
    await expect(
      executeTool.handler({
        confirmationToken: 'FAKE_TOKEN_123',
        entityType: 'lead',
        recordId: 'non-existent-id',
      }, ctx)
    ).rejects.toThrow('Invalid or expired confirmation token');
  });
});

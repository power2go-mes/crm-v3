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

const credPath = path.resolve(__dirname, '../../../.test-credentials.local.json');
const storedCreds = fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, 'utf-8')) : {};

const roleTokens: Record<string, { token: string; userId: string }> = {};

describe('FINLONEXA CRM MCP Server Live Six-Role & Cross-Branch Acceptance', () => {
  beforeAll(async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const testAccounts = {
      SUPER_ADMIN: 'test.superadmin@finlonexa.test',
      HEAD_OF_SALES: 'test.headofsales@finlonexa.test',
      RSM_NORTH: 'test.rsm1@finlonexa.test',
      SSM_NORTH: 'test.ssm1@finlonexa.test',
      ASM_NORTH_1: 'test.asm1@finlonexa.test',
      BDO_NORTH_1: 'test.bdo1@finlonexa.test',
      BDO_NORTH_2: 'test.bdo2@finlonexa.test',
      ASM_NORTH_2: 'test.asm2@finlonexa.test',
      BDO_NORTH_3: 'test.bdo3@finlonexa.test',
      RSM_SOUTH: 'test.rsm2@finlonexa.test',
      ASM_SOUTH_3: 'test.asm3@finlonexa.test',
      BDO_SOUTH_5: 'test.bdo5@finlonexa.test',
    };

    for (const [key, email] of Object.entries(testAccounts)) {
      const password = storedCreds[email] || 'FinloPass#2026!';
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.session && data.user) {
        roleTokens[key] = {
          token: data.session.access_token,
          userId: data.user.id,
        };
      } else {
        throw new Error(`Failed to authenticate test role ${key} (${email}): ${error?.message}`);
      }
    }
  });

  it('1. SUPER_ADMIN: has full administrative discovery and access', async () => {
    const { token } = roleTokens['SUPER_ADMIN'];
    const ctx = await authenticateMcpRequest(`Bearer ${token}`);
    expect(ctx.primaryRole).toBe('SUPER_ADMIN');

    // crm_whoami
    const whoamiTool = crmTools.find(t => t.name === 'crm_whoami')!;
    const whoami = await whoamiTool.handler({}, ctx);
    expect(whoami.status).toBe('AUTHENTICATED_AND_ACTIVE');
    expect(whoami.primaryRole).toBe('SUPER_ADMIN');

    // crm_admin_list_roles succeeds for SUPER_ADMIN
    const adminTool = crmTools.find(t => t.name === 'crm_admin_list_roles')!;
    const roles = await adminTool.handler({}, ctx);
    expect(Array.isArray(roles)).toBe(true);
  });

  it('2. BDO_NORTH_1 (Branch A): cannot execute administrative actions', async () => {
    const { token } = roleTokens['BDO_NORTH_1'];
    const ctx = await authenticateMcpRequest(`Bearer ${token}`);
    expect(ctx.primaryRole).toBe('BDO');

    const adminTool = crmTools.find(t => t.name === 'crm_admin_list_roles')!;
    await expect(adminTool.handler({}, ctx)).rejects.toThrow('Access Denied');
  });

  it('3. BDO_NORTH_1 (Branch A): lists leads and accounts under RLS boundaries', async () => {
    const { token } = roleTokens['BDO_NORTH_1'];
    const ctx = await authenticateMcpRequest(`Bearer ${token}`);

    const listLeads = crmTools.find(t => t.name === 'crm_list_leads')!;
    const leadsRes = await listLeads.handler({ pageSize: 10 }, ctx);
    expect(leadsRes).toHaveProperty('leads');
    expect(Array.isArray(leadsRes.leads)).toBe(true);

    const listAccounts = crmTools.find(t => t.name === 'crm_list_accounts')!;
    const accountsRes = await listAccounts.handler({ limit: 10 }, ctx);
    expect(Array.isArray(accountsRes)).toBe(true);
  });

  it('4. Cross-Branch Isolation: BDO_NORTH_1 (Branch A) and BDO_SOUTH_5 (Branch B)', async () => {
    const ctxA = await authenticateMcpRequest(`Bearer ${roleTokens['BDO_NORTH_1'].token}`);
    const ctxB = await authenticateMcpRequest(`Bearer ${roleTokens['BDO_SOUTH_5'].token}`);

    expect(ctxA.userId).not.toBe(ctxB.userId);

    const listLeads = crmTools.find(t => t.name === 'crm_list_leads')!;
    const [leadsA, leadsB] = await Promise.all([
      listLeads.handler({ pageSize: 50 }, ctxA),
      listLeads.handler({ pageSize: 50 }, ctxB),
    ]);

    // Check that neither user leaks private leads to the other
    const idsA = new Set(leadsA.leads.map((l: any) => l.id));
    const idsB = new Set(leadsB.leads.map((l: any) => l.id));

    // If both have assigned leads, their privately assigned sets do not intersect
    const assignedA = leadsA.leads.filter((l: any) => l.assigned_to === ctxA.userId);
    const assignedB = leadsB.leads.filter((l: any) => l.assigned_to === ctxB.userId);

    for (const lA of assignedA) {
      expect(idsB.has(lA.id)).toBe(false);
    }
    for (const lB of assignedB) {
      expect(idsA.has(lB.id)).toBe(false);
    }
  });

  it('5. Field-Level Masking & Readable Views: Non-admin users receive masked or omitted fields', async () => {
    const ctxBdo = await authenticateMcpRequest(`Bearer ${roleTokens['BDO_NORTH_1'].token}`);
    const listAccounts = crmTools.find(t => t.name === 'crm_list_accounts')!;
    const accounts = await listAccounts.handler({ limit: 5 }, ctxBdo);

    for (const acc of accounts) {
      // Sensitive fields masked or sanitized
      if (acc.bank_account_number) {
        expect(acc.bank_account_number).toMatch(/^\*+\d{4}$/);
      }
      if (acc.tax_id) {
        expect(acc.tax_id).toMatch(/^\*\*\*-\*\*-\d{4}$/);
      }
    }
  });

  it('6. Scalable Dashboard Summary: returns aggregation without PostgREST row truncation', async () => {
    const ctxAsm = await authenticateMcpRequest(`Bearer ${roleTokens['ASM_NORTH_1'].token}`);
    const dashboardTool = crmTools.find(t => t.name === 'crm_get_dashboard_summary')!;
    const summary = await dashboardTool.handler({}, ctxAsm);

    expect(summary).toHaveProperty('totalLeadsInScope');
    expect(summary).toHaveProperty('activeOpportunities');
    expect(summary).toHaveProperty('totalPipelineValue');
    expect(typeof summary.totalLeadsInScope).toBe('number');
    expect(typeof summary.totalPipelineValue).toBe('number');
  });

  it('7. Multi-User Session Isolation: concurrent sessions preserve identity and boundaries', async () => {
    const [ctxAdmin, ctxBdo] = await Promise.all([
      authenticateMcpRequest(`Bearer ${roleTokens['SUPER_ADMIN'].token}`),
      authenticateMcpRequest(`Bearer ${roleTokens['BDO_NORTH_1'].token}`),
    ]);

    const whoamiTool = crmTools.find(t => t.name === 'crm_whoami')!;
    const [resAdmin, resBdo] = await Promise.all([
      whoamiTool.handler({}, ctxAdmin),
      whoamiTool.handler({}, ctxBdo),
    ]);

    expect(resAdmin.primaryRole).toBe('SUPER_ADMIN');
    expect(resBdo.primaryRole).toBe('BDO');
    expect(resAdmin.userId).toBe(roleTokens['SUPER_ADMIN'].userId);
    expect(resBdo.userId).toBe(roleTokens['BDO_NORTH_1'].userId);
  });
});

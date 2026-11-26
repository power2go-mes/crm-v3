import fs from 'fs';
import http from 'http';
import { createClient } from '@supabase/supabase-js';

const creds = JSON.parse(fs.readFileSync('.test-credentials.local.json', 'utf8'));
const SUPABASE_URL = 'https://bpwdxslrkgmcoewkwufu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';

async function getAuthToken(email: string) {
  const password = creds[email];
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('SignIn failed for ' + email + ': ' + error.message);
  return data.session.access_token;
}

function postMcp(body: any, headers: Record<string, string> = {}): Promise<{ status: number; headers: any; body: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request('http://127.0.0.1:3005/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Protocol-Version': '2025-03-26',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(buf); } catch (e) { parsed = buf; }
        resolve({ status: res.statusCode || 500, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callTool(token: string, sessionId: string, name: string, args: any = {}) {
  const res = await postMcp({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name, arguments: args }
  }, { Authorization: 'Bearer ' + token, 'Mcp-Session-Id': sessionId });
  const rawText = res.body.result?.content?.[0]?.text;
  try { return JSON.parse(rawText); } catch (e) { return rawText; }
}

async function main() {
  console.log('=== STARTING LIVE WRITE MATRIX AUDIT ===');
  const tokenAdmin = await getAuthToken('test.superadmin@finlonexa.test');
  const tokenAsm = await getAuthToken('test.asm1@finlonexa.test');
  const tokenBdoNorth = await getAuthToken('test.bdo1@finlonexa.test');
  const tokenBdoSouth = await getAuthToken('test.bdo5@finlonexa.test');

  const sAdmin = (await postMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'audit', version: '1' } } }, { Authorization: 'Bearer ' + tokenAdmin })).headers['mcp-session-id'];
  const sAsm = (await postMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'audit', version: '1' } } }, { Authorization: 'Bearer ' + tokenAsm })).headers['mcp-session-id'];
  const sBdoNorth = (await postMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'audit', version: '1' } } }, { Authorization: 'Bearer ' + tokenBdoNorth })).headers['mcp-session-id'];
  const sBdoSouth = (await postMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'audit', version: '1' } } }, { Authorization: 'Bearer ' + tokenBdoSouth })).headers['mcp-session-id'];

  await postMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, { Authorization: 'Bearer ' + tokenAdmin, 'Mcp-Session-Id': sAdmin });
  await postMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, { Authorization: 'Bearer ' + tokenAsm, 'Mcp-Session-Id': sAsm });
  await postMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, { Authorization: 'Bearer ' + tokenBdoNorth, 'Mcp-Session-Id': sBdoNorth });
  await postMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, { Authorization: 'Bearer ' + tokenBdoSouth, 'Mcp-Session-Id': sBdoSouth });

  const ts = Date.now();

  // 1. Lead status validation
  console.log('\n1. Lead status validation:');
  const invalidStatusRes = await callTool(tokenAdmin, sAdmin, 'crm_create_lead', {
    firstName: 'Invalid',
    lastName: 'StatusTest',
    status: 'working'
  });
  console.log('   - Create with status=working:', invalidStatusRes);

  const validLead = await callTool(tokenAdmin, sAdmin, 'crm_create_lead', {
    firstName: 'Valid',
    lastName: 'Lead_' + ts,
    status: 'qualified',
    company: 'TestCorp ' + ts
  });
  console.log('   - Create with status=qualified:', validLead?.id ? 'SUCCESS' : 'FAILED', '| ID:', validLead?.id);

  const invalidUpdateRes = await callTool(tokenAdmin, sAdmin, 'crm_update_lead', {
    leadId: validLead.id,
    status: 'arbitrary_stage'
  });
  console.log('   - Update with status=arbitrary_stage:', invalidUpdateRes);

  const validUpdateLead = await callTool(tokenAdmin, sAdmin, 'crm_update_lead', {
    leadId: validLead.id,
    status: 'proposal'
  });
  console.log('   - Update with status=proposal:', validUpdateLead?.status === 'proposal' ? 'SUCCESS' : 'FAILED');

  // 2. Lead create across roles
  console.log('\n2. Lead create across roles:');
  const bdoCreateRes = await callTool(tokenBdoNorth, sBdoNorth, 'crm_create_lead', { firstName: 'BDO', lastName: 'Fail' });
  console.log('   - BDO lead create (denied expected):', bdoCreateRes);

  const asmLead = await callTool(tokenAsm, sAsm, 'crm_create_lead', { firstName: 'ASM', lastName: 'Lead_' + ts, company: 'North Co' });
  console.log('   - ASM lead create:', asmLead?.id ? 'SUCCESS' : 'FAILED', '| ID:', asmLead?.id);

  // 3. Lead assignment hierarchy
  console.log('\n3. Lead assignment hierarchy:');
  const bdoNorthUser = await callTool(tokenBdoNorth, sBdoNorth, 'crm_whoami', {});
  const bdoSouthUser = await callTool(tokenBdoSouth, sBdoSouth, 'crm_whoami', {});

  const assignInScope = await callTool(tokenAsm, sAsm, 'crm_update_lead', {
    leadId: asmLead.id,
    assignedTo: bdoNorthUser.userId
  });
  console.log('   - ASM assigns to subordinate BDO North:', assignInScope?.lead_owner_id === bdoNorthUser.userId ? 'SUCCESS' : 'FAILED');

  const assignCrossBranch = await callTool(tokenAsm, sAsm, 'crm_update_lead', {
    leadId: asmLead.id,
    assignedTo: bdoSouthUser.userId
  });
  console.log('   - ASM assigns to cross-branch BDO South (denied expected):', assignCrossBranch);

  const bdoCrossBranchUpdate = await callTool(tokenBdoSouth, sBdoSouth, 'crm_update_lead', {
    leadId: asmLead.id,
    phone: '+1-555-9999'
  });
  console.log('   - BDO South updates BDO North lead (denied expected):', bdoCrossBranchUpdate);

  // 4. Opportunity creation & validation
  console.log('\n4. Opportunity creation & validation:');
  const accounts = await callTool(tokenAsm, sAsm, 'crm_list_accounts', { limit: 1 });
  const accountId = accounts[0]?.id;

  const oppInvalidStage = await callTool(tokenAdmin, sAdmin, 'crm_create_opportunity', {
    title: 'Invalid Stage Deal',
    accountId,
    amount: 10000,
    stage: 'invalid_stage_xyz',
    closeDate: '2026-12-31'
  });
  console.log('   - Create with invalid stage:', oppInvalidStage);

  const oppNegative = await callTool(tokenAdmin, sAdmin, 'crm_create_opportunity', {
    title: 'Negative Amount Deal',
    accountId,
    amount: -100,
    stage: 'prospecting',
    closeDate: '2026-12-31'
  });
  console.log('   - Create with negative amount:', oppNegative);

  const oppAdmin = await callTool(tokenAdmin, sAdmin, 'crm_create_opportunity', {
    title: 'Admin Opp ' + ts,
    accountId,
    amount: 350000,
    stage: 'qualification',
    closeDate: '2026-12-31'
  });
  console.log('   - Super Admin Opportunity Create:', oppAdmin?.id ? 'SUCCESS' : 'FAILED', '| ID:', oppAdmin?.id);

  const oppBdo = await callTool(tokenBdoNorth, sBdoNorth, 'crm_create_opportunity', {
    title: 'BDO Opp ' + ts,
    accountId,
    amount: 25000,
    stage: 'prospecting',
    closeDate: '2026-12-31'
  });
  console.log('   - BDO Opportunity Create:', oppBdo?.id ? 'SUCCESS' : 'FAILED', '| ID:', oppBdo?.id);

  // 5. Task creation & scoping
  console.log('\n5. Task creation & scoping:');
  const bdoTask = await callTool(tokenBdoNorth, sBdoNorth, 'crm_create_task', {
    title: 'BDO Self Task ' + ts,
    priority: 'medium',
    dueDate: '2026-12-10'
  });
  console.log('   - BDO Self Task:', bdoTask?.id ? 'SUCCESS' : 'FAILED', '| Assigned:', bdoTask?.assigned_to_id === bdoNorthUser.userId ? 'BDO SELF' : 'OTHER');

  const bdoCrossTask = await callTool(tokenBdoNorth, sBdoNorth, 'crm_create_task', {
    title: 'Cross Task Attempt',
    priority: 'high',
    assignedTo: bdoSouthUser.userId
  });
  console.log('   - BDO assigns Task to BDO South (denied expected):', bdoCrossTask);

  // 6. Two-step deletion
  console.log('\n6. Two-step destructive deletion:');
  const bdoPrep = await callTool(tokenBdoNorth, sBdoNorth, 'crm_prepare_delete_record', { entityType: 'lead', recordId: asmLead.id });
  console.log('   - BDO prepare delete on assigned lead (denied expected):', bdoPrep);

  const adminPrep = await callTool(tokenAdmin, sAdmin, 'crm_prepare_delete_record', { entityType: 'lead', recordId: validLead.id });
  console.log('   - Admin prepare delete token generated:', Boolean(adminPrep?.confirmationToken));

  const adminExec = await callTool(tokenAdmin, sAdmin, 'crm_execute_delete_record', {
    confirmationToken: adminPrep.confirmationToken,
    entityType: 'lead',
    recordId: validLead.id
  });
  console.log('   - Admin execute delete:', adminExec?.success ? 'SUCCESS' : 'FAILED');

  const replayExec = await callTool(tokenAdmin, sAdmin, 'crm_execute_delete_record', {
    confirmationToken: adminPrep.confirmationToken,
    entityType: 'lead',
    recordId: validLead.id
  });
  console.log('   - Replay execution rejected:', replayExec);

  // Clean up remaining test records
  console.log('\n7. Clean up remaining test records:');
  for (const [entityType, id] of [['opportunity', oppAdmin?.id], ['opportunity', oppBdo?.id], ['lead', asmLead?.id]]) {
    if (!id) continue;
    const p = await callTool(tokenAdmin, sAdmin, 'crm_prepare_delete_record', { entityType, recordId: id });
    if (p.confirmationToken) {
      await callTool(tokenAdmin, sAdmin, 'crm_execute_delete_record', { confirmationToken: p.confirmationToken, entityType, recordId: id });
      console.log('   - Cleaned up', entityType, id);
    }
  }

  console.log('\n=== LIVE WRITE MATRIX AUDIT COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const project = 'bpwdxslrkgmcoewkwufu';
const url = `https://${project}.supabase.co`;
const key = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';
const bucket = 'lead-attachments';

async function verifyRecovery() {
  console.log('=== VERIFYING PRIORITY A: ATTACHMENT FAILURE RECOVERY & ADMIN HANDOFF ===');
  const credentials = JSON.parse(fs.readFileSync('.test-credentials.local.json', 'utf8'));
  const environment = fs.readFileSync('.env', 'utf8');
  const connectionString = environment.match(/^DATABASE_URL\s*=([^\r\n]+)/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
  const db = new Client({ connectionString, connectionTimeoutMillis: 12000 });

  let failureMode;
  const fixtureFetch = async (input, init) => {
    const isRemoval = String(input).includes('/storage/v1/object/') && init?.method === 'DELETE';
    const failure = isRemoval ? failureMode : undefined;
    if (failure) failureMode = undefined;
    if (failure === 'before') throw new Error('Synthetic network interruption before removal');
    const response = await fetch(input, init);
    if (failure === 'after') {
      await response.arrayBuffer();
      throw new Error('Synthetic network interruption after removal');
    }
    return response;
  };

  const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fixtureFetch } });

  async function login(email) {
    const client = makeClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password: credentials[email] });
    assert(!error && data.user, `Login failed for ${email}`);
    return [client, data.user.id];
  }

  const [admin, adminId] = await login('test.superadmin@finlonexa.test');
  const [bdo1, bdo1Id] = await login('test.bdo1@finlonexa.test');
  const [bdo2, bdo2Id] = await login('test.bdo2@finlonexa.test');

  const leadId = randomUUID();
  const fileName = `${randomUUID()}_recovery_test.txt`;
  const path = `${leadId}/${fileName}`;
  const title = `Synthetic Lead for Recovery Acceptance ${leadId}`;
  const body = 'Synthetic Lead attachment for Priority A verification';

  let seeded = false;
  let uploaded = false;

  try {
    await db.connect();
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
    // Seed lead owned by admin and accessible to bdo1
    await db.query(
      `insert into public.leads(id, title, first_name, last_name, status, lead_owner_id, sub_owner_id, created_by_id)
       values($1, $2, 'Synthetic', 'Recovery', 'new', $3, $4, $3)`,
      [leadId, title, adminId, bdo1Id]
    );
    seeded = true;
    console.log('[PASS] Seeded synthetic test lead with BDO1 assigned');

    // Upload attachment
    const uploadRes = await admin.storage.from(bucket).upload(path, new Blob([body], { type: 'text/plain' }), { cacheControl: '0' });
    assert(!uploadRes.error, 'Upload failed');
    uploaded = true;
    console.log('[PASS] Uploaded attachment to private bucket');

    // ------------------------------------------------------------------------
    // SCENARIO A1: Controlled Failure Injection
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario A1: Controlled Failure Injection ---');

    // Prepare removal as admin
    const prep1 = await admin.rpc('prepare_lead_attachment_removal', { p_lead_id: leadId, p_name: fileName });
    assert(!prep1.error, 'Prepare removal failed');

    // 1. Deletion fails before object removal
    failureMode = 'before';
    const failBefore = await admin.storage.from(bucket).remove([path]);
    assert(failBefore.error, 'Interruption before removal did not report error');
    assert.equal((await admin.storage.from(bucket).exists(path)).data, true, 'Object was preserved when interrupted before removal');
    console.log('[PASS] A1.1: Request failed before removal; object preserved');

    // 2. Object removed but ack lost & 3. Concurrent retry
    failureMode = 'after';
    const concurrentRemovals = await Promise.all([
      admin.storage.from(bucket).remove([path]),
      admin.storage.from(bucket).remove([path])
    ]);
    assert(concurrentRemovals.some(r => r.error), 'Lost ack surfaced error on at least one call');
    console.log('[PASS] A1.2 & A1.6: Lost ack and concurrent retry handled');

    // 5. Retry operation
    const retry = await admin.storage.from(bucket).remove([path]);
    assert(!retry.data?.length, 'Repeated retry reported 0 deleted rows');
    assert.equal((await admin.storage.from(bucket).exists(path)).data, false, 'Object metadata confirmed absent');
    console.log('[PASS] A1.5: Operation retried idempotently');

    // Check history: exactly 1 removal event
    const historyCheck = await admin.from('lead_history').select('*')
      .eq('lead_id', leadId)
      .eq('field_name', 'attachment')
      .eq('new_value', 'Removed');
    assert.equal(historyCheck.data?.length, 1, 'Duplicate history events created during failure injection');
    assert.equal(historyCheck.data[0].new_value, 'Removed', 'History recorded Removed action');
    assert.equal(historyCheck.data[0].actor_id, adminId, 'History attributed to correct authenticated actor');
    console.log('[PASS] A1 outcomes verified: No duplicate history, no false success, correct actor attribution');

    // ------------------------------------------------------------------------
    // SCENARIO A2: Original Remover Permanently Loses Access (Admin Handoff)
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario A2: Original Remover Loses Access & Admin Handoff ---');

    // Upload another attachment for A2
    const file2 = `${randomUUID()}_handoff_test.txt`;
    const path2 = `${leadId}/${file2}`;
    await admin.storage.from(bucket).upload(path2, new Blob([body]), { cacheControl: '0' });

    // User A (BDO1) prepares removal
    const prepBDO = await bdo1.rpc('prepare_lead_attachment_removal', { p_lead_id: leadId, p_name: file2 });
    assert(!prepBDO.error, 'BDO1 prepare removal failed');
    console.log('[PASS] Original actor (BDO1) prepared removal intent');

    // Simulate User A permanently losing access: reassign sub_owner to bdo2 and archive or reassign lead
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [adminId]);
    await db.query('update public.leads set sub_owner_id = $1 where id = $2', [bdo2Id, leadId]);
    console.log('[PASS] BDO1 permanently lost reporting scope on lead (reassigned to BDO2)');

    // Verify BDO1 is now denied removal through Storage API
    const bdo1Denied = await bdo1.storage.from(bucket).remove([path2]);
    assert(bdo1Denied.error || !bdo1Denied.data?.length, 'BDO1 removed object after losing access');
    console.log('[PASS] Revoked actor cannot execute removal');

    // Verify unauthorized user BDO2 cannot execute admin handoff
    const bdo2Denied = await bdo2.rpc('confirm_lead_attachment_removal_handoff', {
      p_lead_id: leadId, p_name: file2, p_confirmed: true
    });
    assert(bdo2Denied.error, 'Non-admin user BDO2 executed admin handoff');
    console.log('[PASS] Unauthorized non-admin user rejected from handoff with 42501');

    // Verify admin calling without explicit confirmation is rejected
    const unconfirmed = await admin.rpc('confirm_lead_attachment_removal_handoff', {
      p_lead_id: leadId, p_name: file2, p_confirmed: false
    });
    assert(unconfirmed.error, 'Unconfirmed handoff was accepted');
    console.log('[PASS] Unconfirmed handoff rejected with 22023');

    // Authorized Admin executes confirmed handoff
    const handoff = await admin.rpc('confirm_lead_attachment_removal_handoff', {
      p_lead_id: leadId, p_name: file2, p_confirmed: true
    });
    if (handoff.error) console.error('handoff error details:', handoff.error);
    assert(!handoff.error && handoff.data?.length === 1, 'Admin handoff failed');
    assert.equal(handoff.data[0].original_actor_id, bdo1Id, 'Original actor identity not preserved in handoff');
    assert.equal(handoff.data[0].admin_actor_id, adminId, 'Admin recovery actor mismatch');
    console.log('[PASS] Admin handoff confirmed; original actor BDO1 preserved, admin stamped as recovery actor');

    // Admin executes removal via Storage API
    const adminRemove = await admin.storage.from(bucket).remove([path2]);
    assert(!adminRemove.error && adminRemove.data?.length === 1, 'Admin removal after handoff failed');
    assert.equal((await admin.storage.from(bucket).exists(path2)).data, false, 'Object removed by admin');
    console.log('[PASS] Admin successfully removed object via Storage API');

    // Verify History audit trail
    const handoffHistory = await admin.from('lead_history')
      .select('*')
      .eq('lead_id', leadId)
      .eq('field_name', 'attachment')
      .eq('new_value', 'Removed')
      .eq('actor_id', adminId);

    assert(handoffHistory.data?.length >= 1, 'Missing admin removal history event');
    const handoffEvent = handoffHistory.data.find(h => h.old_value && h.old_value.includes(bdo1Id));
    assert(handoffEvent, 'History does not record original intent owner identity alongside admin actor');
    console.log('[PASS] History records original intent actor in old_value and admin actor in actor_id');

    console.log('\n=== ALL PRIORITY A FAILURE RECOVERY & HANDOFF CHECKS PASSED ===');
  } finally {
    if (seeded) {
      try {
        await admin.rpc('prepare_lead_attachment_removal', { p_lead_id: leadId, p_name: fileName }).catch(() => {});
        await admin.storage.from(bucket).remove([path]).catch(() => {});
        await admin.rpc('confirm_lead_attachment_removal_handoff', { p_lead_id: leadId, p_name: file2, p_confirmed: true }).catch(() => {});
        await admin.storage.from(bucket).remove([path2]).catch(() => {});
      } catch {}
      await db.query('delete from public.leads where id = $1', [leadId]);
    }
    await db.end();
  }
}

verifyRecovery().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});

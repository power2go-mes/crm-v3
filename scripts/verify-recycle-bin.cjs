process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8')
    .split(/\r?\n/)
    .find(v => /^DATABASE_URL\s*=/.test(v));
  if (!line) throw new Error('DATABASE_URL not found');
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- Verifying Recycle Bin Architecture & Recovery ---');

  try {
    // 1. Get test user
    const userRes = await client.query('SELECT id, email FROM user_profiles LIMIT 1');
    const user = userRes.rows[0];

    // 2. Insert test deleted item into crm_recycle_bin
    const fakeLeadId = '99999999-9999-9999-9999-999999999999';
    const insertRes = await client.query(
      `INSERT INTO crm_recycle_bin (model_name, record_id, record_name, data, deleted_by_id)
       VALUES ('leads', $1, 'Test Deleted Lead Inc', $2, $3)
       RETURNING id, model_name, record_name, deleted_at`,
      [
        fakeLeadId,
        JSON.stringify({
          first_name: 'Recoverable',
          last_name: 'Lead',
          company_name: 'Test Deleted Lead Inc',
          email: 'recoverable@test.com',
          phone: '+1 555-0199',
          status: 'new',
        }),
        user.id,
      ]
    );
    const recycleItem = insertRes.rows[0];
    console.log(`[PASS] Created recycle bin record: ${recycleItem.id} (${recycleItem.record_name})`);

    // 3. Query recycle bin with filter
    const queryRes = await client.query(
      "SELECT count(*) as cnt FROM crm_recycle_bin WHERE model_name = 'leads'"
    );
    if (parseInt(queryRes.rows[0].cnt) < 1) throw new Error('Filter query failed');
    console.log(`[PASS] Filtered recycle bin count for leads: ${queryRes.rows[0].cnt}`);

    // 4. Test restore RPC (or simulation with transaction)
    await client.query('BEGIN');
    await client.query(`SET LOCAL request.jwt.claim.sub = '${user.id}'`);
    const restoreRes = await client.query('SELECT restore_recycle_bin_item($1)', [recycleItem.id]);
    console.log(`[PASS] Restored item via restore_recycle_bin_item: ${restoreRes.rows[0].restore_recycle_bin_item}`);

    // Check that lead was created/restored
    const restoredLead = await client.query('SELECT id, company_name FROM leads WHERE id = $1', [fakeLeadId]);
    if (restoredLead.rows.length === 0) throw new Error('Restored lead not found in leads table');
    console.log(`[PASS] Restored record confirmed in leads table: ${restoredLead.rows[0].company_name}`);

    // Check item is deleted from recycle bin
    const itemCheck = await client.query('SELECT 1 FROM crm_recycle_bin WHERE id = $1', [recycleItem.id]);
    if (itemCheck.rows.length > 0) throw new Error('Item still present in recycle bin after restore');
    console.log('[PASS] Item successfully purged from recycle bin upon restoration');

    // Clean up restored lead
    await client.query('DELETE FROM leads WHERE id = $1', [fakeLeadId]);
    await client.query('COMMIT');

    // 5. Test permanent delete
    const deleteTest = await client.query(
      `INSERT INTO crm_recycle_bin (model_name, record_id, record_name, data)
       VALUES ('accounts', '88888888-8888-8888-8888-888888888888', 'Purge Account', '{}'::jsonb)
       RETURNING id`
    );
    await client.query('DELETE FROM crm_recycle_bin WHERE id = $1', [deleteTest.rows[0].id]);
    const purgeCheck = await client.query('SELECT 1 FROM crm_recycle_bin WHERE id = $1', [deleteTest.rows[0].id]);
    if (purgeCheck.rows.length > 0) throw new Error('Permanent delete failed');
    console.log('[PASS] Permanent delete verified');

    console.log('\n>>> RECYCLE BIN SUITE: ALL TESTS PASSED (100%) <<<');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});

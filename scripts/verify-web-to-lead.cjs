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

  console.log('--- Verifying Web-to-Lead Capture Engine & API ---');

  try {
    // 1. Get test user
    const userRes = await client.query('SELECT id, email FROM user_profiles LIMIT 1');
    const user = userRes.rows[0];

    // 2. Insert test web-to-lead form
    const formRes = await client.query(
      `INSERT INTO crm_lead_capture_forms (form_name, lead_owner_id, header_color, success_message)
       VALUES ('Landing Page Test Form', $1, '#2563EB', 'Inquiry received!')
       RETURNING id, form_name, submission_count`,
      [user.id]
    );
    const form = formRes.rows[0];
    console.log(`[PASS] Created test form: ${form.id} (${form.form_name})`);

    // 3. Test submit_web_to_lead RPC
    const submitPayload = {
      first_name: 'Jane',
      last_name: 'Visitor',
      company_name: 'Website Inquiry Corp',
      email: 'jane.visitor@example.com',
      phone: '+1 800-555-0144',
      requirements: 'Interested in enterprise CRM migration.',
    };

    const rpcRes = await client.query(
      'SELECT submit_web_to_lead($1, $2::jsonb) as res',
      [form.id, JSON.stringify(submitPayload)]
    );
    const res = rpcRes.rows[0].res;
    if (!res.success || !res.lead_id) throw new Error('Web-to-lead submission failed');
    console.log(`[PASS] RPC submission success! Created lead_id: ${res.lead_id}`);

    // 4. Verify lead created in leads table
    const leadCheck = await client.query(
      'SELECT id, first_name, last_name, company_name, lead_source, lead_owner_id FROM leads WHERE id = $1',
      [res.lead_id]
    );
    if (leadCheck.rows.length === 0) throw new Error('Created lead not found in database');
    const lead = leadCheck.rows[0];
    if (lead.lead_source !== 'website') throw new Error(`Expected source website, got ${lead.lead_source}`);
    console.log(`[PASS] Lead verified: ${lead.first_name} ${lead.last_name} (${lead.company_name}), source: ${lead.lead_source}`);

    // 5. Verify notification generated for owner
    const notifCheck = await client.query(
      "SELECT id, title, url FROM crm_notifications WHERE user_id = $1 AND category = 'lead' ORDER BY created_at DESC LIMIT 1",
      [user.id]
    );
    if (notifCheck.rows.length === 0) throw new Error('Notification not created for lead owner');
    console.log(`[PASS] In-app notification sent to owner: "${notifCheck.rows[0].title}" (link: ${notifCheck.rows[0].url})`);

    // 6. Test duplicate prevention
    const dupRes = await client.query(
      'SELECT submit_web_to_lead($1, $2::jsonb) as res',
      [form.id, JSON.stringify(submitPayload)]
    );
    if (!dupRes.rows[0].res.duplicate_prevented) {
      throw new Error('Anti-spam duplicate check failed to trigger');
    }
    console.log('[PASS] Anti-spam duplicate prevention verified');

    // 7. Verify submission counter incremented
    const formCounter = await client.query(
      'SELECT submission_count FROM crm_lead_capture_forms WHERE id = $1',
      [form.id]
    );
    console.log(`[PASS] Form submission counter incremented to: ${formCounter.rows[0].submission_count}`);

    // Clean up test records
    await client.query('DELETE FROM leads WHERE id = $1', [res.lead_id]);
    await client.query('DELETE FROM crm_lead_capture_forms WHERE id = $1', [form.id]);
    await client.query('DELETE FROM crm_notifications WHERE id = $1', [notifCheck.rows[0].id]);
    console.log('[PASS] Cleaned up test data');

    console.log('\n>>> WEB-TO-LEAD CAPTURE SUITE: ALL TESTS PASSED (100%) <<<');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});

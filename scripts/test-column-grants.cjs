process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8').split(/\r?\n/).find(v => /^DATABASE_URL\s*=/.test(v));
  const conn = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await c.connect();

  await c.query('BEGIN');
  try {
    // Read the staged migration SQL
    const sql = fs.readFileSync('docs/staged-sql/202611170003_field_read_boundary.sql', 'utf8')
      .replace(/^begin;\s*$/m, '')
      .replace(/commit;\s*$/, '');
    await c.query(sql);

    // Now test calling dashboard_home_metrics as test.superadmin
    // Get test.superadmin id
    const userRes = await c.query("select id from public.user_profiles where email = 'test.superadmin@finlonexa.test'");
    const adminId = userRes.rows[0].id;

    await c.query('set local role authenticated');
    await c.query(`select set_config('request.jwt.claim.sub', '${adminId}', true)`);
    await c.query(`select set_config('request.jwt.claims', '{"sub":"${adminId}","role":"authenticated"}', true)`);

    try {
      const dashRes = await c.query('select public.dashboard_home_metrics()');
      console.log('dashboard_home_metrics SUCCEEDED under candidate column revocation!');
    } catch (err) {
      console.log('dashboard_home_metrics FAILED under candidate column revocation:', err.message);
    }

  } finally {
    await c.query('ROLLBACK');
    await c.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

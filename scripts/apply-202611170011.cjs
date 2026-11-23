process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8').split(/\r?\n/).find(v => /^DATABASE_URL\s*=/.test(v));
  if (!line) throw new Error('DATABASE_URL not found');
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL');

  const sql = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/supabase/migrations/202611170011_forecast_aggregation.sql', 'utf8');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ($1, $2, $3)',
      ['202611170011', 'forecast_aggregation', [sql]]
    );
    await client.query("NOTIFY pgrst, 'reload schema'");
    await client.query('COMMIT');
    console.log('Migration 202611170011 applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

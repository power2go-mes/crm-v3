process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Specify migration file');

  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8')
    .split(/\r?\n/)
    .find(v => /^DATABASE_URL\s*=/.test(v));
  if (!line) throw new Error('DATABASE_URL not found');
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to PostgreSQL');

  const sql = fs.readFileSync(file, 'utf8');
  const filename = file.split(/[\\/]/).pop();
  const match = filename.match(/^(\d+)_(.+)\.sql$/);
  const version = match ? match[1] : Date.now().toString();
  const name = match ? match[2] : filename;

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING',
      [version, name, [sql]]
    );
    await client.query("NOTIFY pgrst, 'reload schema'");
    await client.query('COMMIT');
    console.log(`Migration ${version}_${name} applied successfully.`);
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

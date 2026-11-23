process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const line = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/.env', 'utf8')
    .split(/\r?\n/)
    .find(v => /^DATABASE_URL\s*=/.test(v));
  const connectionString = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND column_name IN ('deleted_at', 'is_deleted')
      ORDER BY table_name
    `);
    console.log('Tables with soft deletion:');
    res.rows.forEach(r => console.log(`  ${r.table_name}: ${r.column_name}`));
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

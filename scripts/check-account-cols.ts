import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function checkCols() {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
  const line = envContent.split('\n').find((l) => l.startsWith('SUPABASE_DB_URL=') || l.startsWith('DATABASE_URL='));
  const connectionString = line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const aCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'");
  console.log('accounts cols:', aCols.rows.map((r) => r.column_name));

  const accs = await client.query('SELECT * FROM accounts LIMIT 1');
  console.log('Sample account:', accs.rows[0]);

  await client.end();
  process.exit(0);
}

checkCols().catch(console.error);

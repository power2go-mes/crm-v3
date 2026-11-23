import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function checkAccountOwnership() {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
  const line = envContent.split('\n').find((l) => l.startsWith('SUPABASE_DB_URL=') || l.startsWith('DATABASE_URL='));
  const connectionString = line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const accounts = await client.query(`
    SELECT a.id, a.name, a.account_owner_id, p.first_name, p.last_name
    FROM accounts a
    LEFT JOIN user_profiles p ON a.account_owner_id = p.id
    ORDER BY a.name ASC
  `);
  console.log('Total accounts:', accounts.rows.length);
  const byOwner: Record<string, number> = {};
  accounts.rows.forEach((a) => {
    const ownerName = `${a.first_name} ${a.last_name} (${a.account_owner_id})`;
    byOwner[ownerName] = (byOwner[ownerName] || 0) + 1;
  });
  console.log('Accounts by owner:', byOwner);

  const contacts = await client.query(`
    SELECT c.id, c.first_name, c.last_name, c.contact_owner_id, p.first_name as o_first, p.last_name as o_last
    FROM contacts c
    LEFT JOIN user_profiles p ON c.contact_owner_id = p.id
    ORDER BY c.first_name ASC
  `);
  console.log('\nTotal contacts:', contacts.rows.length);
  const cByOwner: Record<string, number> = {};
  contacts.rows.forEach((c) => {
    const ownerName = `${c.o_first} ${c.o_last} (${c.contact_owner_id})`;
    cByOwner[ownerName] = (cByOwner[ownerName] || 0) + 1;
  });
  console.log('Contacts by owner:', cByOwner);

  await client.end();
  process.exit(0);
}

checkAccountOwnership().catch(console.error);

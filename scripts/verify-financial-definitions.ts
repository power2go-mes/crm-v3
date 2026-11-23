import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function verifyFinancials() {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
  const line = envContent.split('\n').find((l) => l.startsWith('SUPABASE_DB_URL=') || l.startsWith('DATABASE_URL='));
  const connectionString = line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const opps = await client.query('SELECT id, name, stage, amount, close_date, owner_id FROM opportunities ORDER BY created_at ASC');
  console.log('Total Opportunities in DB:', opps.rows.length);

  const won = opps.rows.filter((o) => o.stage === 'closed_won' || o.stage === 'Closed Won');
  console.log('Won deals count:', won.length);
  won.forEach((w) => {
    const dStr = w.close_date instanceof Date ? w.close_date.toISOString().slice(0, 10) : String(w.close_date).slice(0, 10);
    console.log(`Won deal: ${w.name} | Amount: $${w.amount} | Close date: ${dStr} | Stage: ${w.stage}`);
  });

  const totalWonSum = won.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  console.log('Authoritative Won Total Sum: $' + totalWonSum.toLocaleString());

  const novWon = won.filter((w) => {
    const dStr = w.close_date instanceof Date ? w.close_date.toISOString().slice(0, 10) : String(w.close_date).slice(0, 10);
    return dStr.startsWith('2026-11');
  });
  const novSum = novWon.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  console.log('November 2026 (Monthly Filter) Won Sum: $' + novSum.toLocaleString());

  const q4Won = won.filter((w) => {
    const dStr = w.close_date instanceof Date ? w.close_date.toISOString().slice(0, 10) : String(w.close_date).slice(0, 10);
    return dStr.startsWith('2026-10') || dStr.startsWith('2026-11') || dStr.startsWith('2026-12');
  });
  const q4Sum = q4Won.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  console.log('Q4 2026 (Quarterly Filter) Won Sum: $' + q4Sum.toLocaleString());

  await client.end();
  process.exit(0);
}

verifyFinancials().catch((e) => {
  console.error(e);
  process.exit(1);
});

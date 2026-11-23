const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const cs = env
  .split(/\r?\n/)
  .find((v) => /^DATABASE_URL\s*=/.test(v))
  .split('=')[1]
  .trim()
  .replace(/^['"]|['"]$/g, '');

const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });

async function seed() {
  await client.connect();

  const user = await client.query('SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1');
  const userId = user.rows[0].id;

  const existing = await client.query('SELECT count(*) FROM public.crm_custom_reports');
  if (parseInt(existing.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO public.crm_custom_reports (
        name,
        description,
        primary_module,
        selected_columns,
        filters,
        sort_field,
        sort_direction,
        group_by_field,
        chart_type,
        is_shared,
        created_by_id
      ) VALUES
      (
        'High Value Opportunities by Stage',
        'Active pipeline deals over $10,000 categorized by current stage distribution.',
        'opportunities',
        $1::text[],
        $2::jsonb,
        'amount',
        'desc',
        'stage',
        'bar',
        true,
        $3
      ),
      (
        'Strategic Accounts by Industry',
        'Organizations and client accounts grouped by industry classification.',
        'accounts',
        $4::text[],
        '[]'::jsonb,
        'created_at',
        'desc',
        'industry',
        'donut',
        true,
        $3
      )
    `, [
      ['name', 'amount', 'stage', 'probability', 'close_date'],
      JSON.stringify([{ field: 'amount', operator: 'greater_than', value: '10000' }]),
      userId,
      ['name', 'account_type', 'industry', 'annual_revenue', 'website']
    ]);
    console.log('Seeded 2 default custom reports');
  } else {
    console.log('Custom reports already exist:', existing.rows[0].count);
  }

  await client.end();
}

seed().catch(console.error);

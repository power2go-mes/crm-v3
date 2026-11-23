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

async function seedTemplates() {
  await client.connect();

  const user = await client.query(`SELECT id FROM auth.users WHERE email = 'test.superadmin@finlonexa.test'`);
  const adminId = user.rows[0].id;

  const templates = [
    {
      name: 'Initial Sales Pitch & Discovery',
      category: 'sales_pitch',
      subject: 'Exploring Strategic Solutions for {{account.name}}',
      body: 'Dear {{recipient.name}},\n\nI hope this email finds you well. I am reaching out to discuss how FINLONEXA enterprise solutions can accelerate your operations at {{account.name}}.\n\nWould you have 15 minutes this week for a brief conversation?\n\nBest regards,\n{{sender.name}}',
    },
    {
      name: 'Formal Quotation & Commercial Proposal',
      category: 'quotation',
      subject: 'Formal Quotation for {{opportunity.name}} - {{account.name}}',
      body: 'Dear {{recipient.name}},\n\nThank you for reviewing our solution. Attached please find the formal quotation for {{opportunity.name}} totaling {{opportunity.amount}}.\n\nPlease let us know if you have any questions or require adjustments.\n\nWarm regards,\n{{sender.name}}',
    },
    {
      name: 'Pipeline Follow-Up & Action Items',
      category: 'follow_up',
      subject: 'Follow-up regarding {{opportunity.name}}',
      body: 'Dear {{recipient.name}},\n\nFollowing up on our recent discussion regarding {{opportunity.name}}. We are keen to help finalize next steps and ensure seamless onboarding.\n\nLooking forward to hearing from you,\n{{sender.name}}',
    },
  ];

  for (const t of templates) {
    await client.query(`
      INSERT INTO public.crm_email_templates (name, category, subject, body_html, is_shared, is_active, created_by_id)
      VALUES ($1, $2, $3, $4, true, true, $5)
      ON CONFLICT DO NOTHING
    `, [t.name, t.category, t.subject, t.body, adminId]);
  }

  console.log('Default email templates seeded successfully!');
  await client.end();
}

seedTemplates().catch(console.error);

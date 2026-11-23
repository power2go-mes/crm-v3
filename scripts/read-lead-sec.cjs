const fs = require('fs');
const content = fs.readFileSync('C:/Users/izhar/Desktop/crm-v3/supabase/migrations/202611160002_leads_security.sql', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('create or replace function public.validate_lead_sub_owner'));
console.log(lines.slice(idx, idx + 45).join('\n'));

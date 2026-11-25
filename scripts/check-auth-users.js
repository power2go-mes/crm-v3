const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('apps/web/.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) {
    console.error('List users error:', userErr);
  } else {
    console.log('Total auth.users:', users.users.length);
    console.log('Auth users list:');
    users.users.forEach(u => {
      console.log(`- ID: ${u.id} | Email: ${u.email} | Confirmed: ${u.email_confirmed_at ? 'YES' : 'NO'}`);
    });
  }

  const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email, first_name, last_name, role_id, is_active');
  if (profErr) {
    console.error('Profiles query error:', profErr);
  } else {
    console.log('\nProfiles table count:', profiles.length);
  }
}

inspect();

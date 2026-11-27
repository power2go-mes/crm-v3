const fs = require('fs');
const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const lines = env.split(/\r?\n/);
const parsed = {};
for (const line of lines) {
  const idx = line.indexOf('=');
  if (idx > -1) {
    parsed[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(parsed.NEXT_PUBLIC_SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) {
    console.error('List users error:', uErr);
    return;
  }
  for (const u of users.users) {
    console.log('USER:', u.id, u.email);
    const { data: profile, error: pErr } = await supabase.from('user_profiles').select('*').eq('id', u.id).single();
    console.log('  Profile:', profile ? `${profile.first_name} ${profile.last_name} active:${profile.is_active}` : 'none', pErr ? pErr.message : '');
    const { data: userRoles, error: urErr } = await supabase.from('user_roles').select('role_id').eq('user_id', u.id);
    console.log('  Roles assigned:', userRoles, urErr ? urErr.message : '');
  }
}
check();

const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/izhar/Desktop/crm-v3/supabase/migrations';
const files = fs.readdirSync(dir);
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  if (content.includes('validate_lead_sub_owner')) {
    console.log('Found in:', file);
  }
}

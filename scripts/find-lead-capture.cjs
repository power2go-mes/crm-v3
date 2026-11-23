const fs = require('fs');
const content = fs.readFileSync('C:/Users/izhar/Desktop/crm-v2/finlo_crm/leads/models.py', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('class LeadCaptureForm'));
console.log('Line number:', idx);
if (idx !== -1) {
  console.log(lines.slice(idx, idx + 60).join('\n'));
}

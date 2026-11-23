export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;

/** Bounded RFC4180-style CSV reader; preserves quoted newlines and escaped quotes. */
export function parseImportCsv(text: string): { headers: string[]; rows: string[][] } {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) throw new Error('CSV exceeds the current 2 MB import limit.');
  const input = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [], cell = '', quoted = false, closed = false;
  function finishCell() {
    if (cell.length > 4000) throw new Error('An import cell exceeds 4,000 characters.');
    record.push(cell); cell = ''; closed = false;
    if (record.length > 50) throw new Error('CSV supports at most 50 columns.');
  }
  function finishRecord() {
    finishCell();
    if (record.some(value => value.length > 0)) records.push(record);
    record = [];
    if (records.length > IMPORT_MAX_ROWS + 1) throw new Error('CSV exceeds the current 1,000-row import limit.');
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '\0') throw new Error('CSV contains a NUL character.');
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error('CSV contains an unexpected quote.');
      quoted = true;
    } else if (char === ',') finishCell();
    else if (char === '\r' || char === '\n') { if (char === '\r' && input[i + 1] === '\n') i++; finishRecord(); }
    else { if (closed) throw new Error('CSV contains text after a closing quote.'); cell += char; }
    if (cell.length > 4000) throw new Error('An import cell exceeds 4,000 characters.');
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (cell || record.length || closed) finishRecord();
  if (records.length < 2) throw new Error('CSV must contain headers and at least one data row.');
  const headers = records.shift()!.map(value => value.trim());
  if (headers.some(value => !value) || new Set(headers.map(value => value.toLowerCase())).size !== headers.length) throw new Error('CSV column names must be nonempty and unique.');
  if (records.some(row => row.length !== headers.length)) throw new Error('CSV rows must have the same number of columns as the header.');
  return { headers, rows: records };
}

export const leadImportFields = [
  ['title', 'Title'], ['first_name', 'First Name'], ['last_name', 'Last Name'], ['email', 'Email'],
  ['phone', 'Contact Number'], ['company_name', 'Company Name'], ['status', 'Lead Status'],
  ['lead_source', 'Lead Source'], ['industry', 'Industry'], ['no_of_employees', 'Number of Employees'],
  ['annual_revenue', 'Annual Revenue'], ['country', 'Country'], ['state', 'State'], ['city', 'City'],
  ['zip_code', 'Postal Code'], ['fax', 'Fax'], ['requirements', 'Requirements'],
] as const;
export const importMatchFields = ['email', 'phone', 'first_name', 'last_name', 'company_name'] as const;
export function suggestedMappings(headers: string[]) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mappings: Record<string, number> = {};
  for (const [key, label] of leadImportFields) {
    const index = headers.findIndex(header => normalize(header) === normalize(key) || normalize(header) === normalize(label));
    if (index >= 0) mappings[key] = index;
  }
  return mappings;
}

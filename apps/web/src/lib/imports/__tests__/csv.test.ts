import { describe, expect, it } from 'vitest';
import { parseImportCsv, suggestedMappings, IMPORT_MAX_BYTES } from '../csv';
describe('Bounded import CSV parsing', () => {
  it('parses quoted commas, escaped quotes, CRLF and quoted newlines', () => {
    expect(parseImportCsv('First,Notes\r\n"A,B","line1\nline2 ""quoted"""\r\n')).toEqual({ headers: ['First', 'Notes'], rows: [['A,B', 'line1\nline2 "quoted"']] });
  });
  it('accepts a UTF-8 BOM, final record without newline and empty cells', () => {
    expect(parseImportCsv('\uFEFFA,B\nx,').rows).toEqual([['x', '']]);
  });
  it.each(['A,a\nx,y', 'A,\nx,y', 'A,B\nx', 'A,B\n"x,y', 'A\n"x"z', 'A\nx"y', 'A\nx\0y'])('rejects malformed or ambiguous CSV: %s', text => {
    expect(() => parseImportCsv(text)).toThrow();
  });
  it('enforces byte, row, column and cell bounds without silent truncation', () => {
    expect(() => parseImportCsv('a\n' + 'x'.repeat(IMPORT_MAX_BYTES))).toThrow('2 MB');
    expect(() => parseImportCsv('a\n' + 'x\n'.repeat(1001))).toThrow('1,000');
    expect(() => parseImportCsv(Array.from({ length: 51 }, (_, i) => `h${i}`).join(',') + '\n' + 'a,'.repeat(50) + 'a')).toThrow('50 columns');
    expect(() => parseImportCsv('a\n' + 'x'.repeat(4001))).toThrow('4,000');
  });
  it('suggests source labels and storage keys, never owner fields', () => {
    expect(suggestedMappings(['First Name', 'last_name', 'Contact Number', 'lead_owner_id'])).toEqual({ first_name: 0, last_name: 1, phone: 2 });
  });
});

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { exportRecords, spreadsheetText, type ScopedExportSource } from '../src/exports';
const source: ScopedExportSource = {
  authorize: async () => [
    { key: 'name', label: 'Name', visible: true, exportable: true, kind: 'text' },
    { key: 'date', label: 'Time', visible: true, exportable: true, kind: 'datetime' },
    { key: 'secret', label: 'Secret', visible: false, exportable: true, kind: 'text' },
  ],
  fetchSelected: async () => [{ id: 'one', values: { name: '=SUM(1,2)', date: '2026-11-16T23:00:00Z' } }],
};
const request = { module: 'contacts', ids: ['one'], columns: ['name'], format: 'csv' };
describe('bounded authorized exports', () => {
  it.each(['=1+1', '+cmd', '-cmd', '@SUM(1)', '  =1+1', '\tdata', '\rdata'])('guards spreadsheet input %j', value => {
    expect(spreadsheetText(value).startsWith("'")).toBe(true);
  });
  it('quotes CSV, respects selected column order and timezone', async () => {
    const file = await exportRecords({ ...request, columns: ['date', 'name'], timeZone: 'Asia/Karachi' }, source);
    expect(file.bytes.toString()).toContain('"Time","Name"');
    expect(file.bytes.toString()).toContain('17/11/2026');
    expect(file.bytes.toString()).toContain('"\'=SUM(1,2)"');
    expect(file.rows).toBe(1);
  });
  it('rejects hidden columns before fetching and unscoped records', async () => {
    await expect(exportRecords({ ...request, columns: ['secret'] }, source)).rejects.toThrow('column unavailable');
    await expect(exportRecords({ ...request, ids: ['other'] }, source)).rejects.toThrow('selection unavailable');
  });
  it('rejects no selection, duplicates, excessive cells and invalid timezone', async () => {
    for (const input of [{ ids: [] }, { ids: ['one', 'one'] }, { columns: ['name', 'name'] },
      { ids: Array.from({ length: 5001 }, (_, i) => String(i)) }, { timeZone: 'bad/zone' }]) {
      await expect(exportRecords({ ...request, ...input }, source)).rejects.toThrow();
    }
  });
  it('opens real XLSX with an independent ZIP/XML reader', async () => {
    const file = await exportRecords({ ...request, format: 'xlsx' }, source);
    const script = "import sys,base64,zipfile,io,xml.etree.ElementTree as E\nraw=base64.b64decode(sys.stdin.read())\nz=zipfile.ZipFile(io.BytesIO(raw))\nassert z.testzip() is None\nr=E.fromstring(z.read('xl/worksheets/sheet1.xml'))\nassert len(list(r.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}f')))==0\nassert \"'=SUM(1,2)\" in [e.text for e in r.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]\n";
    const result = spawnSync('python', ['-c', script], { input: file.bytes.toString('base64'), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });
  it('generates a PDF with correct byte offsets, multipage content and escaped literals', async () => {
    const long: ScopedExportSource = { ...source,
      fetchSelected: async () => [{ id: 'one', values: { name: '(test)\\'.repeat(2000) } }] };
    const file = await exportRecords({ ...request, format: 'pdf' }, long);
    const pdf = file.bytes.toString();
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('\\(test\\)\\\\');
    const xref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(xref, xref + 4)).toBe('xref');
    expect(Number(/\/Count (\d+)/.exec(pdf)?.[1])).toBeGreaterThan(1);
    const entries = pdf.slice(xref).split('\n').slice(3);
    entries.filter(l => l.endsWith(' n ')).forEach((line, i) => {
      expect(pdf.slice(Number(line.slice(0, 10)))).toMatch(new RegExp('^' + (i + 1) + ' 0 obj'));
    });
  });
  it('fails explicitly for PDF Unicode rather than corrupting output', async () => {
    const unicode: ScopedExportSource = { ...source, fetchSelected: async () => [{ id: 'one', values: { name: 'اردو' } }] };
    await expect(exportRecords({ ...request, format: 'pdf' }, unicode)).rejects.toThrow('Unicode font');
    expect((await exportRecords({ ...request, format: 'xlsx' }, unicode)).bytes.length).toBeGreaterThan(0);
  });
});

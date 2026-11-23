import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createZipArchive, renderExportTable } from '../src/exports';
const columns = [{ key: 'name', label: 'Name', kind: 'text' as const, visible: true, exportable: true }];
describe('Central export encoding and multi-module archives', () => {
  it('writes an explicit header-only empty dataset rather than an invalid file', () => {
    const file = renderExportTable('accounts', columns, [], 'csv', 'UTC');
    expect(file.rows).toBe(0); expect(file.bytes.toString()).toContain('"Name"');
  });
  it('bundles real binary XLSX and PDF files without corrupting them', () => {
    const xlsx = renderExportTable('accounts', columns, [{ name: '=SAFE' }], 'xlsx', 'UTC');
    const pdf = renderExportTable('contacts', columns, [{ name: 'Contact fixture' }], 'pdf', 'UTC');
    const bytes = createZipArchive({ [xlsx.filename]: xlsx.bytes, [pdf.filename]: pdf.bytes });
    const script = "import sys,base64,zipfile,io,xml.etree.ElementTree as E\nz=zipfile.ZipFile(io.BytesIO(base64.b64decode(sys.stdin.read())))\nassert z.testzip() is None\nassert sorted(z.namelist())==['accounts-export.xlsx','contacts-export.pdf']\nx=zipfile.ZipFile(io.BytesIO(z.read('accounts-export.xlsx')))\nassert x.testzip() is None\nr=E.fromstring(x.read('xl/worksheets/sheet1.xml'))\nassert \"'=SAFE\" in [t.text for t in r.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]\nassert z.read('contacts-export.pdf').startswith(b'%PDF-1.4')\nassert b'Contact fixture' in z.read('contacts-export.pdf')\n";
    const result = spawnSync('python', ['-c', script], { input: bytes.toString('base64'), encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });
  it('rejects archive traversal and unsupported PDF content instead of fake downloads', () => {
    expect(() => createZipArchive({ '../escape.csv': 'data' })).toThrow('filename');
    expect(() => renderExportTable('contacts', columns, [{ name: 'علی' }], 'pdf', 'UTC')).toThrow('Unicode');
  });
});

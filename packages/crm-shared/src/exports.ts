import { z } from 'zod';
import { fieldKey, moduleKey } from './fields';
if (typeof window !== 'undefined') throw new Error('Exports are server-only');

export const exportRequest = z.object({
  module: moduleKey, ids: z.array(z.string().min(1).max(200)).min(1).max(5000),
  columns: z.array(fieldKey).min(1).max(50), format: z.enum(['csv', 'xlsx', 'pdf']),
  timeZone: z.string().default('UTC'),
}).strict().superRefine((r, ctx) => {
  if (new Set(r.ids).size !== r.ids.length || new Set(r.columns).size !== r.columns.length) {
    ctx.addIssue({ code: 'custom', message: 'Duplicate selection' });
  }
  if (r.ids.length * r.columns.length > 50000) {
    ctx.addIssue({ code: 'custom', message: 'Export exceeds synchronous cell limit' });
  }
});
export interface ExportColumn {
  key: string; label: string; visible: boolean; exportable: boolean;
  kind: 'text' | 'number' | 'date' | 'datetime';
}
export interface ScopedExportSource {
  /** Server implementation verifies active session + module.export and returns CURRENT field rules. */
  authorize(module: string): Promise<readonly ExportColumn[]>;
  /** Session-JWT SELECT through source RLS; bound fields/IDs only; no service role or raw SQL. */
  fetchSelected(module: string, ids: readonly string[], columns: readonly string[]):
    Promise<readonly { id: string; values: Readonly<Record<string, unknown>> }[]>;
}
export interface ExportFile { filename: string; contentType: string; bytes: Buffer; rows: number }
const xml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function spreadsheetText(v: string): string {
  return /^[\s\u0000-\u001f]*[=+\-@]/u.test(v) || /^[\t\r\n]/.test(v) ? "'" + v : v;
}
function text(value: unknown, column: ExportColumn, dateTimeFormatter: Intl.DateTimeFormat): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(v => String(v)).join(', ');
  if (typeof value === 'object') throw new Error('Unsupported export cell');
  const result = String(value);
  if (column.kind === 'datetime') {
    const date = new Date(result);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid export datetime');
    return dateTimeFormatter.format(date);
  }
  if (column.kind === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('Invalid export date');
  }
  if (column.kind === 'number' && !/^-?\d+(?:\.\d+)?$/.test(result)) throw new Error('Invalid export number');
  return result;
}
function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Minimal standards-based OPC ZIP: stored entries, CRC32, central directory. */
export function createZipArchive(files: Readonly<Record<string, string | Uint8Array>>): Buffer {
  if (!Object.keys(files).length || Object.keys(files).length > 100) throw new Error('Invalid archive selection');
  const locals: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    if (!name || name.startsWith('/') || name.includes('\\') || /^[A-Za-z]:/.test(name) || name.split('/').some(part => part === '..' || part === '.') || /[\x00-\x1f]/.test(name)) throw new Error('Invalid archive filename');
    const path = Buffer.from(name), data = Buffer.from(content), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(path.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(path.length, 28); entry.writeUInt32LE(offset, 42);
    locals.push(local, path, data); central.push(entry, path);
    offset += local.length + path.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
function xlsx(rows: readonly string[][]): Buffer {
  const cells = rows.map(row => '<row>' + row.map(value =>
    '<c t="inlineStr"><is><t xml:space="preserve">' + xml(spreadsheetText(value)) + '</t></is></c>').join('') + '</row>').join('');
  return createZipArchive({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + cells + '</sheetData></worksheet>',
  });
}
function pdf(rows: readonly string[][]): Buffer {
  // Explicit failure is preferable to corrupted Unicode. Font embedding is a documented extension boundary.
  if (rows.some(row => row.some(v => /[^\x20-\x7e\r\n\t]/.test(v)))) {
    throw new Error('PDF requires an embedded Unicode font for this selection; use CSV or XLSX');
  }
  const columns = rows[0].length;
  if (columns > 12) throw new Error('PDF supports at most 12 columns');
  const width = 770 / columns, chars = Math.max(8, Math.floor(width / 4.8));
  const wrap = (s: string) => s.replace(/[\t\r\n]/g, ' ').match(new RegExp('.{1,' + chars + '}', 'g')) ?? [''];
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const pages: string[][] = [[]];
  const header = rows[0].map(wrap);
  const headerHeight = Math.max(...header.map(v => v.length));
  if (headerHeight > 10) throw new Error('PDF header too large');
  let line = 0;
  const draw = (cells: string[][], start: number, count: number) => {
    for (let j = start; j < start + count; j++) {
      cells.forEach((parts, col) => {
        pages[pages.length - 1].push('BT /F1 8 Tf 1 0 0 1 ' + (36 + col * width).toFixed(2) + ' ' +
          (559 - line * 12) + ' Tm (' + escape(parts[j] ?? '') + ') Tj ET');
      });
      line++;
    }
  };
  const nextPage = () => { pages.push([]); line = 0; draw(header, 0, headerHeight); line++; };
  draw(header, 0, headerHeight); line++;
  for (const row of rows.slice(1)) {
    const cells = row.map(wrap), height = Math.max(...cells.map(c => c.length));
    for (let start = 0; start < height;) {
      if (line >= 43) nextPage();
      const count = Math.min(height - start, 43 - line);
      draw(cells, start, count); start += count;
    }
    line++;
  }
  const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids: string[] = [];
  for (const commands of pages) {
    const pageId = objects.length + 1, streamId = pageId + 1;
    kids.push(pageId + ' 0 R');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + streamId + ' 0 R >>');
    const stream = commands.join('\n');
    objects.push('<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream');
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + kids.join(' ') + '] >>';
  let content = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(content)); content += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = Buffer.byteLength(content);
  content += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n' +
    offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  content += 'trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(content);
}
export async function exportRecords(raw: unknown, source: ScopedExportSource): Promise<ExportFile> {
  const request = exportRequest.parse(raw);
  new Intl.DateTimeFormat('en-GB', { timeZone: request.timeZone }).format();
  const available = await source.authorize(request.module);
  const columns = request.columns.map(key => {
    const column = available.find(c => c.key === key && c.visible && c.exportable);
    if (!column) throw new Error('Export column unavailable');
    return column;
  });
  const records = await source.fetchSelected(request.module, request.ids, request.columns);
  const byId = new Map(records.map(r => [r.id, r]));
  if (records.length !== request.ids.length || byId.size !== records.length ||
    records.some(r => !request.ids.includes(r.id))) throw new Error('Record selection unavailable');
  return renderExportTable(request.module, columns, request.ids.map(id => byId.get(id)!.values), request.format, request.timeZone);
}

/** Render one bounded CSV page. Include the header and BOM only in the first part. */
export function renderExportCsvFragment(
  columns: readonly ExportColumn[],
  records: readonly Readonly<Record<string, unknown>>[],
  timeZone: string,
  includeHeader: boolean
): Buffer {
  if (!columns.length || columns.length > 50 || records.length > 250 ||
    columns.some(column => !column.visible || !column.exportable)) {
    throw new Error('Invalid export page');
  }
  const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'short', timeStyle: 'medium' });
  const rows = [
    ...(includeHeader ? [columns.map(column => column.label)] : []),
    ...records.map(record => columns.map(column => text(record[column.key], column, dateTimeFormatter))),
  ];
  let size = 0;
  for (const row of rows) for (const value of row) {
    if (value.length > 32000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
      throw new Error('Invalid export text');
    }
    size += Buffer.byteLength(value);
  }
  if (size > 8 * 1024 * 1024) throw new Error('Export page is too large');
  const csv = rows.map(row =>
    row.map(value => '"' + spreadsheetText(value).replace(/"/g, '""') + '"').join(',')
  ).join('\r\n');
  return Buffer.from((includeHeader ? '\ufeff' : '') + csv + (rows.length ? '\r\n' : ''), 'utf8');
}

/** Encoding only. Callers must authorize current fields and fetch records through RLS. */
export function renderExportTable(module: string, columns: readonly ExportColumn[], records: readonly Readonly<Record<string, unknown>>[], format: 'csv' | 'xlsx' | 'pdf', timeZone: string): ExportFile {
  moduleKey.parse(module);
  if (!columns.length || columns.length > 50 || records.length > 5000 || records.length * columns.length > 50000 || columns.some(column => !column.visible || !column.exportable)) throw new Error('Invalid export table');
  const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'short', timeStyle: 'medium' });
  const rows = [columns.map(c => c.label), ...records.map(record => columns.map(c => text(record[c.key], c, dateTimeFormatter)))];
  let size = 0;
  for (const row of rows) for (const value of row) {
    if (value.length > 32000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error('Invalid export text');
    size += Buffer.byteLength(value);
  }
  if (size > 8 * 1024 * 1024) throw new Error('Export requires background processing');
  const bytes = format === 'xlsx' ? xlsx(rows) : format === 'pdf' ? pdf(rows) :
    Buffer.from('\ufeff' + rows.map(row => row.map(v => '"' + spreadsheetText(v).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n');
  if (bytes.length > 16 * 1024 * 1024) throw new Error('Export output limit exceeded');
  return { bytes, rows: records.length, filename: module + '-export.' + format,
    contentType: format === 'csv' ? 'text/csv; charset=utf-8' : format === 'pdf' ? 'application/pdf' :
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

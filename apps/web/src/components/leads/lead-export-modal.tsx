'use client';
import { useEffect, useRef, useState } from 'react';
const columns = [
  ['title', 'Title'], ['first_name', 'First Name'], ['last_name', 'Last Name'], ['email', 'Email'],
  ['status', 'Lead Status'], ['lead_source', 'Lead Source'], ['industry', 'Industry'], ['annual_revenue', 'Annual Revenue'],
] as const;
export function LeadExportModal({ onClose, onExport }: {
  onClose: () => void;
  onExport: (format: 'csv' | 'xlsx' | 'pdf', columns: string[]) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>(columns.map(c => c[0]));
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>('xlsx');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }}
    className="w-full max-w-xl rounded-lg bg-white p-5 text-slate-900 backdrop:bg-black/20 backdrop:backdrop-blur-xs"
    aria-labelledby="lead-export-title">
    <form onSubmit={async event => {
      event.preventDefault(); setPending(true); setError('');
      try { await onExport(format, selected); onClose(); }
      catch { setError('Export unavailable. Check selection, permissions and field configuration.'); }
      finally { setPending(false); }
    }}>
      <header className="mb-4 flex items-center justify-between">
        <h2 id="lead-export-title" className="font-semibold">Select Columns to Export (Optional)</h2>
        <button type="button" aria-label="Close" disabled={pending} onClick={onClose}>×</button>
      </header>
      <label className="block text-sm">Export Format
        <select value={format} disabled={pending} onChange={e => setFormat(e.target.value as typeof format)}
          className="mt-1 block w-full rounded border p-2">
          <option value="xlsx">Excel</option><option value="csv">CSV</option><option value="pdf">PDF</option>
        </select>
      </label>
      <fieldset className="mt-4" disabled={pending}>
        <legend className="text-sm font-semibold">Available Columns</legend>
        <p className="mb-3 text-sm text-slate-600">Select which columns to export</p>
        <div className="grid grid-cols-2 gap-3">{columns.map(([key, label]) =>
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(key)} onChange={e =>
              setSelected(old => e.target.checked ? [...old, key] : old.filter(value => value !== key))} />{label}
          </label>)}</div>
      </fieldset>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <footer className="mt-5 flex justify-end">
        <button type="submit" disabled={pending || !selected.length}
          className="rounded bg-[#4361ee] px-4 py-2 text-sm text-white disabled:opacity-50">
          {pending ? 'Exporting…' : 'Export'}
        </button>
      </footer>
    </form>
  </dialog>;
}

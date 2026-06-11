'use client';

import { useCallback, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import { CURRENT_SEASON } from '@/lib/constants/league';

type BulkRow = {
  file: File;
  fileKey: string | null;
  title: string;
  season: number;
  week: number | '';
  episodeNumber: number;
  status: 'draft' | 'published';
  uploading: boolean;
  error: string | null;
};

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Newsletter Issue';
}

async function uploadFile(file: File): Promise<string> {
  const ct = file.type || 'application/octet-stream';
  const ext = file.name.split('.').pop() || 'bin';
  const res = await fetch('/api/media/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentType: ct,
      ext,
      key: `newsletters/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
    }),
  });
  if (!res.ok) throw new Error('Presign failed');
  const { key, putUrl } = await res.json();
  const up = await fetch(putUrl, { method: 'PUT', headers: { 'content-type': ct }, body: file });
  if (!up.ok) throw new Error('Upload failed');
  return key as string;
}

export default function BulkImportPanel({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [defaultSeason, setDefaultSeason] = useState(String(CURRENT_SEASON));
  const [defaultStatus, setDefaultStatus] = useState<'draft' | 'published'>('published');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const season = parseInt(defaultSeason, 10) || Number(CURRENT_SEASON);
    const newRows: BulkRow[] = Array.from(files).map((file, i) => ({
      file,
      fileKey: null,
      title: titleFromFilename(file.name),
      season,
      week: i + 1,
      episodeNumber: i + 1,
      status: defaultStatus,
      uploading: false,
      error: null,
    }));
    setRows((prev) => [...prev, ...newRows]);
  }, [defaultSeason, defaultStatus]);

  const updateRow = (idx: number, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const uploaded: BulkRow[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        updateRow(i, { uploading: true, error: null });
        try {
          const fileKey = row.fileKey || await uploadFile(row.file);
          uploaded.push({ ...row, fileKey, uploading: false });
          updateRow(i, { fileKey, uploading: false });
        } catch (e) {
          updateRow(i, { uploading: false, error: e instanceof Error ? e.message : 'Upload failed' });
          throw e;
        }
      }

      const res = await fetch('/api/newsletter/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: defaultStatus,
          items: uploaded.map((r) => ({
            fileKey: r.fileKey,
            title: r.title,
            season: r.season,
            week: r.week === '' ? null : r.week,
            episodeNumber: r.episodeNumber,
            status: r.status,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      const errCount = data.errors?.length ?? 0;
      setResult(`Imported ${data.count} issue(s)${errCount ? ` (${errCount} failed)` : ''}.`);
      onComplete();
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Upload multiple newsletter files (DOCX, HTML, or PDF) to backfill your archive. DOCX and HTML are converted to inline HTML; PDFs are embedded.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bulk-season">Default season</Label>
          <Input id="bulk-season" type="number" value={defaultSeason} onChange={(e) => setDefaultSeason(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bulk-status">Default status</Label>
          <select
            id="bulk-status"
            value={defaultStatus}
            onChange={(e) => setDefaultStatus(e.target.value as 'draft' | 'published')}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      <div
        className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--accent)] transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
      >
        <p className="text-[var(--muted)] mb-3">Drop files here or browse</p>
        <input
          type="file"
          multiple
          accept=".docx,.html,.htm,.pdf"
          className="text-sm"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {rows.length > 0 && (
        <div className="space-y-3 max-h-[360px] overflow-y-auto">
          {rows.map((row, idx) => (
            <div key={`${row.file.name}-${idx}`} className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
              <div className="sm:col-span-2">
                <Label className="text-xs">Title</Label>
                <Input value={row.title} onChange={(e) => updateRow(idx, { title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Season</Label>
                <Input type="number" value={row.season} onChange={(e) => updateRow(idx, { season: parseInt(e.target.value, 10) || row.season })} />
              </div>
              <div>
                <Label className="text-xs">Week</Label>
                <Input type="number" value={row.week} onChange={(e) => updateRow(idx, { week: e.target.value === '' ? '' : parseInt(e.target.value, 10) })} />
              </div>
              <div>
                <Label className="text-xs">Ep #</Label>
                <Input type="number" value={row.episodeNumber} onChange={(e) => updateRow(idx, { episodeNumber: parseInt(e.target.value, 10) || 1 })} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(idx)}>Remove</Button>
              </div>
              {row.uploading && <p className="sm:col-span-6 text-xs text-[var(--muted)]">Uploading…</p>}
              {row.error && <p className="sm:col-span-6 text-xs text-red-400">{row.error}</p>}
            </div>
          ))}
        </div>
      )}

      {result && <p className="text-sm text-[var(--muted)]">{result}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        <Button type="button" onClick={runImport} disabled={importing || rows.length === 0}>
          {importing ? 'Importing…' : `Import ${rows.length} file(s)`}
        </Button>
      </div>
    </div>
  );
}

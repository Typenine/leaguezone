'use client';



import { useState } from 'react';

import Button from '@/components/ui/Button';

import Input from '@/components/ui/Input';

import Label from '@/components/ui/Label';

import { CURRENT_SEASON } from '@/lib/constants/league';



type ImportMode = 'file' | 'url';



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



function titleFromUrl(url: string): string {

  try {

    const parsed = new URL(url.trim());

    const docsMatch = parsed.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);

    if (parsed.hostname === 'docs.google.com' && docsMatch) {

      return 'Google Doc Import';

    }

    const segment = parsed.pathname.split('/').filter(Boolean).pop() || '';

    return segment.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

  } catch {

    return '';

  }

}



export default function FileImportPanel({

  onClose,

  onComplete,

}: {

  onClose: () => void;

  onComplete: () => void;

}) {

  const [mode, setMode] = useState<ImportMode>('file');

  const [file, setFile] = useState<File | null>(null);

  const [sourceUrl, setSourceUrl] = useState('');

  const [title, setTitle] = useState('');

  const [season, setSeason] = useState(String(CURRENT_SEASON));

  const [week, setWeek] = useState('');

  const [status, setStatus] = useState<'draft' | 'published'>('published');

  const [importing, setImporting] = useState(false);

  const [error, setError] = useState<string | null>(null);



  const onFileChange = (f: File | null) => {

    setFile(f);

    if (f && !title) {

      setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim());

    }

  };



  const onUrlChange = (url: string) => {

    setSourceUrl(url);

    if (url.trim() && !title) {

      const derived = titleFromUrl(url);

      if (derived) setTitle(derived);

    }

  };



  const canImport = mode === 'file' ? Boolean(file) : sourceUrl.trim().length > 0;



  const runImport = async () => {

    if (!canImport) return;

    setImporting(true);

    setError(null);

    try {

      const payload: Record<string, unknown> = {

        title: title.trim() || undefined,

        season: parseInt(season, 10),

        week: week === '' ? null : parseInt(week, 10),

        status,

      };

      if (mode === 'file' && file) {

        payload.fileKey = await uploadFile(file);

      } else if (mode === 'url') {

        payload.sourceUrl = sourceUrl.trim();

      }



      const res = await fetch('/api/newsletter/import', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload),

      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Import failed');

      onComplete();

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Import failed');

    } finally {

      setImporting(false);

    }

  };



  return (

    <div className="space-y-4">

      <p className="text-sm text-[var(--muted)]">

        Upload a DOCX, HTML, or PDF file — or paste a public link to one. Google Docs share links work when the doc is

        published or set to &ldquo;Anyone with the link can view&rdquo; (we fetch the HTML export automatically).

      </p>



      <div className="flex gap-2">

        <button

          type="button"

          onClick={() => setMode('file')}

          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${

            mode === 'file'

              ? 'bg-[var(--accent)] text-[var(--on-brand)] border-[var(--accent)]'

              : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--accent)]'

          }`}

        >

          Upload file

        </button>

        <button

          type="button"

          onClick={() => setMode('url')}

          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${

            mode === 'url'

              ? 'bg-[var(--accent)] text-[var(--on-brand)] border-[var(--accent)]'

              : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--accent)]'

          }`}

        >

          From URL

        </button>

      </div>



      {mode === 'file' ? (

        <div>

          <Label htmlFor="import-file">File</Label>

          <Input

            id="import-file"

            type="file"

            accept=".docx,.html,.htm,.pdf"

            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}

          />

        </div>

      ) : (

        <div>

          <Label htmlFor="import-url">URL</Label>

          <Input

            id="import-url"

            type="url"

            value={sourceUrl}

            onChange={(e) => onUrlChange(e.target.value)}

            placeholder="https://docs.google.com/document/d/…/edit or https://example.com/newsletter.html"

          />

          <p className="text-xs text-[var(--muted)] mt-1.5">

            Direct links to .html, .docx, or .pdf files work best. Private or login-required pages cannot be imported.

          </p>

        </div>

      )}



      <div>

        <Label htmlFor="import-title">Title</Label>

        <Input id="import-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 3 Recap" />

      </div>

      <div className="grid grid-cols-2 gap-4">

        <div>

          <Label htmlFor="import-season">Season</Label>

          <Input id="import-season" type="number" value={season} onChange={(e) => setSeason(e.target.value)} />

        </div>

        <div>

          <Label htmlFor="import-week">Week</Label>

          <Input id="import-week" type="number" value={week} onChange={(e) => setWeek(e.target.value)} placeholder="Optional" />

        </div>

      </div>

      <div>

        <Label htmlFor="import-status">Status</Label>

        <select

          id="import-status"

          value={status}

          onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}

          className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"

        >

          <option value="published">Published</option>

          <option value="draft">Draft</option>

        </select>

      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2 justify-end">

        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>

        <Button type="button" onClick={runImport} disabled={importing || !canImport}>

          {importing ? 'Importing…' : 'Import Issue'}

        </Button>

      </div>

    </div>

  );

}



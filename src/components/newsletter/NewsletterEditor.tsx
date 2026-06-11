'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import { CURRENT_SEASON } from '@/lib/constants/league';

export type EpisodeFormData = {
  id?: string;
  title: string;
  season: number;
  week: number | '';
  episodeNumber: number;
  contentHtml: string;
  status: 'draft' | 'published';
  publishedAt: string;
  sourceType: string;
  sourceFileKey?: string | null;
};

async function uploadImage(file: File): Promise<string> {
  const ct = file.type || 'application/octet-stream';
  const ext = file.name.split('.').pop() || 'jpg';
  const res = await fetch('/api/media/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: ct, ext, key: `newsletters/images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}` }),
  });
  if (!res.ok) throw new Error('Presign failed');
  const { key, putUrl, getUrl } = await res.json();
  const up = await fetch(putUrl, { method: 'PUT', headers: { 'content-type': ct }, body: file });
  if (!up.ok) throw new Error('Upload failed');
  return getUrl || `/api/media/${encodeURIComponent(key)}`;
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm border transition-colors ${
        active
          ? 'bg-[var(--accent)] text-[var(--on-brand)] border-[var(--accent)]'
          : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--accent)]'
      }`}
    >
      {children}
    </button>
  );
}

export default function NewsletterEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<EpisodeFormData>;
  onSave: (data: EpisodeFormData) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [season, setSeason] = useState(String(initial?.season ?? CURRENT_SEASON));
  const [week, setWeek] = useState(initial?.week != null && initial.week !== '' ? String(initial.week) : '');
  const [episodeNumber, setEpisodeNumber] = useState(String(initial?.episodeNumber ?? 1));
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'draft');
  const [publishedAt, setPublishedAt] = useState(
    initial?.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      TiptapImage.configure({ HTMLAttributes: { class: 'newsletter-inline-image' } }),
    ],
    content: initial?.contentHtml || '<p></p>',
    editorProps: {
      attributes: {
        class: 'newsletter-editor-body min-h-[280px] px-4 py-3 focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && initial?.contentHtml && editor.getHTML() === '<p></p>') {
      editor.commands.setContent(initial.contentHtml);
    }
  }, [editor, initial?.contentHtml]);

  const addImage = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      alert('Image upload failed');
    }
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const contentHtml = editor.getHTML();
    await onSave({
      id: initial?.id,
      title: title.trim(),
      season: parseInt(season, 10),
      week: week === '' ? '' : parseInt(week, 10),
      episodeNumber: parseInt(episodeNumber, 10) || 1,
      contentHtml,
      status,
      publishedAt: new Date(publishedAt).toISOString(),
      sourceType: initial?.sourceType || 'editor',
      sourceFileKey: initial?.sourceFileKey,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="nl-title">Title</Label>
          <Input id="nl-title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Week 5 Recap" />
        </div>
        <div>
          <Label htmlFor="nl-season">Season</Label>
          <Input id="nl-season" type="number" value={season} onChange={(e) => setSeason(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="nl-week">Week (optional)</Label>
          <Input id="nl-week" type="number" value={week} onChange={(e) => setWeek(e.target.value)} placeholder="Off-season special" />
        </div>
        <div>
          <Label htmlFor="nl-ep">Episode #</Label>
          <Input id="nl-ep" type="number" value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} min={1} />
        </div>
        <div>
          <Label htmlFor="nl-status">Status</Label>
          <select
            id="nl-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div>
          <Label htmlFor="nl-date">Publish date</Label>
          <Input id="nl-date" type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Content</Label>
        {editor && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="flex flex-wrap gap-1 p-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-strong)_50%,transparent)]">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">B</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><em>I</em></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">H2</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Subheading">H3</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• List</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1. List</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">&ldquo;</ToolbarButton>
              <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">Link</ToolbarButton>
              <ToolbarButton onClick={addImage} title="Image">Image</ToolbarButton>
            </div>
            <EditorContent editor={editor} />
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageSelected} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : initial?.id ? 'Update Issue' : 'Save Issue'}
        </Button>
      </div>

      <style jsx global>{`
        .newsletter-editor-body h2 { font-size: 1.35rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .newsletter-editor-body h3 { font-size: 1.15rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
        .newsletter-editor-body p { margin-bottom: 0.75rem; line-height: 1.65; }
        .newsletter-editor-body ul, .newsletter-editor-body ol { margin: 0.5rem 0 1rem 1.5rem; }
        .newsletter-editor-body blockquote { border-left: 3px solid var(--accent); padding-left: 1rem; color: var(--muted); margin: 1rem 0; }
        .newsletter-editor-body img, .newsletter-inline-image { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }
        .newsletter-editor-body a { color: var(--accent); text-decoration: underline; }
      `}</style>
    </form>
  );
}

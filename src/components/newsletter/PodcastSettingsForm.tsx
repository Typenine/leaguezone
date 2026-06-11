'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import type { PodcastConfig } from './PodcastPanel';

export default function PodcastSettingsForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<PodcastConfig>({
    spotifyUrl: '',
    spotifyEmbedUrl: '',
    appleUrl: '',
    appleEmbedUrl: '',
    rssFeedUrl: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setStatus('loading');
    fetch('/api/settings/podcast')
      .then((r) => r.json())
      .then((d: { podcast?: PodcastConfig }) => {
        if (d.podcast) setForm(d.podcast);
        setStatus('idle');
      })
      .catch(() => setStatus('idle'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setMsg('');
    const res = await fetch('/api/settings/podcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setStatus('ok');
      setMsg('Podcast settings saved');
      onSaved?.();
    } else {
      const d = await res.json();
      setStatus('error');
      setMsg(d?.error || 'Save failed');
    }
  };

  const field = (key: keyof PodcastConfig, label: string, placeholder: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Connect your league podcast on Spotify and/or Apple Podcasts. Paste the show URL and embed iframe src from each platform.
      </p>
      {field('spotifyUrl', 'Spotify Show URL', 'https://open.spotify.com/show/...')}
      {field('spotifyEmbedUrl', 'Spotify Embed URL', 'https://open.spotify.com/embed/show/...')}
      {field('appleUrl', 'Apple Podcasts URL', 'https://podcasts.apple.com/...')}
      {field('appleEmbedUrl', 'Apple Embed URL', 'https://embed.podcasts.apple.com/...')}
      {field('rssFeedUrl', 'RSS Feed URL (optional)', 'https://anchor.fm/s/.../podcast/rss')}
      <p className="text-xs text-[var(--muted)]">
        RSS feed is optional and reserved for future transcription features. Spotify/Apple embeds cannot be transcribed directly.
      </p>
      {msg && (
        <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>
      )}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={status === 'saving' || status === 'loading'}>
          {status === 'saving' ? 'Saving…' : 'Save Podcast Settings'}
        </Button>
      </div>
    </form>
  );
}

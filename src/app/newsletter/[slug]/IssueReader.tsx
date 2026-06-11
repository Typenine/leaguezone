'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SectionHeader from '@/components/ui/SectionHeader';
import Button from '@/components/ui/Button';
import Card, { CardContent } from '@/components/ui/Card';
import { NewsletterProseStyles } from '@/components/newsletter/NewsletterProseStyles';

type EpisodeData = {
  id: string;
  slug: string;
  title: string;
  season: number;
  week: number | null;
  episodeNumber: number;
  summary: string | null;
  contentHtml: string | null;
  sourceType: string;
  sourceFileUrl: string | null;
  status: string;
  publishedAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function metaLabel(ep: EpisodeData): string {
  const parts = [`Season ${ep.season}`];
  if (ep.week != null) parts.push(`Week ${ep.week}`);
  else parts.push(`Issue ${ep.episodeNumber}`);
  return parts.join(' · ');
}

function PdfEmbed({ url }: { url: string }) {
  return (
    <div>
      <div className="rounded-xl overflow-hidden border border-[var(--border)]" style={{ height: '80vh' }}>
        <iframe src={url} className="w-full h-full" title="Newsletter PDF" />
      </div>
      <p className="mt-3 text-xs text-[var(--muted)] text-center">
        If the PDF does not load,{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">
          open it directly
        </a>.
      </p>
    </div>
  );
}

export default function IssueReader({ slug }: { slug: string }) {
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [prev, setPrev] = useState<{ slug: string; title: string } | null>(null);
  const [next, setNext] = useState<{ slug: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/newsletter/episodes/by-slug/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => {
        setEpisode(d.episode);
        setPrev(d.prev ?? null);
        setNext(d.next ?? null);
        setError(null);
      })
      .catch(() => setError('Issue not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="container mx-auto px-4 py-12 text-center text-[var(--muted)]">Loading…</div>;
  }

  if (error || !episode) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-[var(--muted)] mb-4">{error || 'Not found'}</p>
        <Link href="/newsletter">
          <Button variant="secondary">← Back to Newsletter</Button>
        </Link>
      </div>
    );
  }

  const showPdf = episode.sourceType === 'pdf' && !episode.contentHtml && episode.sourceFileUrl;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <NewsletterProseStyles />
      <Link href="/newsletter" className="text-sm text-[var(--accent)] hover:underline mb-6 inline-block">
        ← All newsletters
      </Link>

      <header className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          {metaLabel(episode)}
        </span>
        <SectionHeader title={episode.title} className="mt-2 mb-2 text-left max-w-none" />
        {episode.publishedAt && (
          <p className="text-sm text-[var(--muted)]">{formatDate(episode.publishedAt)}</p>
        )}
        {episode.summary && !showPdf && (
          <p className="text-[var(--muted)] mt-4 text-lg leading-relaxed">{episode.summary}</p>
        )}
      </header>

      {showPdf && episode.sourceFileUrl ? (
        <PdfEmbed url={episode.sourceFileUrl} />
      ) : episode.contentHtml ? (
        <Card>
          <CardContent className="p-6 md:p-10">
            <article
              className="newsletter-prose"
              dangerouslySetInnerHTML={{ __html: episode.contentHtml }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-10 text-center text-[var(--muted)]">
            This issue has no content yet.
          </CardContent>
        </Card>
      )}

      <nav className="mt-10 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row gap-4 justify-between">
        {prev ? (
          <Link href={`/newsletter/${prev.slug}`} className="group flex-1">
            <span className="text-xs text-[var(--muted)]">← Newer</span>
            <p className="text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)] line-clamp-1">{prev.title}</p>
          </Link>
        ) : <div className="flex-1" />}
        {next ? (
          <Link href={`/newsletter/${next.slug}`} className="group flex-1 text-right">
            <span className="text-xs text-[var(--muted)]">Older →</span>
            <p className="text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)] line-clamp-1">{next.title}</p>
          </Link>
        ) : <div className="flex-1" />}
      </nav>
    </div>
  );
}

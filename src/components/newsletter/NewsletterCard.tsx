'use client';

import Link from 'next/link';
import Card, { CardContent } from '@/components/ui/Card';

export type EpisodeSummary = {
  id: string;
  slug: string;
  title: string;
  season: number;
  week: number | null;
  episodeNumber: number;
  summary: string | null;
  status: 'draft' | 'published';
  publishedAt: string | null;
  sourceType: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function metaLabel(ep: EpisodeSummary): string {
  const parts = [`Season ${ep.season}`];
  if (ep.week != null) parts.push(`Week ${ep.week}`);
  else parts.push(`Issue ${ep.episodeNumber}`);
  return parts.join(' · ');
}

export default function NewsletterCard({
  episode,
  canManage,
  onEdit,
}: {
  episode: EpisodeSummary;
  canManage?: boolean;
  onEdit?: (id: string) => void;
}) {
  return (
    <Card className="hover-lift h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            {metaLabel(episode)}
          </span>
          {canManage && episode.status === 'draft' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Draft</span>
          )}
        </div>
        <h3 className="text-lg font-semibold text-[var(--text)] mb-2 line-clamp-2">
          <Link href={`/newsletter/${episode.slug}`} className="hover:text-[var(--accent)] transition-colors">
            {episode.title}
          </Link>
        </h3>
        {episode.publishedAt && (
          <p className="text-xs text-[var(--muted)] mb-3">{formatDate(episode.publishedAt)}</p>
        )}
        {episode.summary && (
          <p className="text-sm text-[var(--muted)] line-clamp-3 flex-1 mb-4">{episode.summary}</p>
        )}
        <div className="flex items-center gap-2 mt-auto pt-2">
          <Link
            href={`/newsletter/${episode.slug}`}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Read issue →
          </Link>
          {canManage && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(episode.id)}
              className="text-sm text-[var(--muted)] hover:text-[var(--text)] ml-auto"
            >
              Edit
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

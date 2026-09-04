import type { ShareCardKind } from '@/lib/branding/share-card';

export default function LeagueShareCardLink({
  leagueSlug,
  type,
  title,
  subtitle,
  left,
  right,
  footer,
  label = 'Share graphic',
  className = '',
}: {
  leagueSlug: string;
  type: ShareCardKind;
  title?: string;
  subtitle?: string;
  left?: string;
  right?: string;
  footer?: string;
  label?: string;
  className?: string;
}) {
  const params = new URLSearchParams({ type });
  if (title) params.set('title', title);
  if (subtitle) params.set('subtitle', subtitle);
  if (left) params.set('left', left);
  if (right) params.set('right', right);
  if (footer) params.set('footer', footer);
  return (
    <a
      href={`/api/share-card/${encodeURIComponent(leagueSlug)}?${params.toString()}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-black text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] ${className}`}
    >
      {label}
    </a>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SectionHeader from '@/components/ui/SectionHeader';
import Card, { CardContent } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import NewsletterCard, { type EpisodeSummary } from '@/components/newsletter/NewsletterCard';
import PodcastPanel, { type PodcastConfig } from '@/components/newsletter/PodcastPanel';
import PodcastSettingsForm from '@/components/newsletter/PodcastSettingsForm';
import NewsletterEditor, { type EpisodeFormData } from '@/components/newsletter/NewsletterEditor';
import BulkImportPanel from '@/components/newsletter/BulkImportPanel';
import FileImportPanel from '@/components/newsletter/FileImportPanel';

type ModalKind = 'editor' | 'bulk' | 'import' | 'podcast';

const MODAL_KINDS = new Set<string>(['editor', 'bulk', 'import', 'podcast']);

function buildNewsletterUrl(
  searchParams: URLSearchParams | null,
  updates: { modal?: string | null; id?: string | null; tab?: string | null },
) {
  const qs = new URLSearchParams(searchParams?.toString() ?? '');
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) qs.delete(key);
    else qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/newsletter?${query}` : '/newsletter';
}

type FullEpisode = EpisodeSummary & {
  contentHtml: string | null;
  sourceType: string;
  sourceFileKey: string | null;
  episodeNumber: number;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
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

export default function NewsletterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromQuery = searchParams?.get('tab') || 'issues';
  const activeTab = tabFromQuery === 'podcast' ? 'podcast' : 'issues';

  const [episodes, setEpisodes] = useState<FullEpisode[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>('all');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [podcast, setPodcast] = useState<PodcastConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const modalParam = searchParams?.get('modal') ?? '';
  const modal: ModalKind | null = MODAL_KINDS.has(modalParam) ? (modalParam as ModalKind) : null;
  const editingId = searchParams?.get('id');
  const editingEpisode = useMemo(
    () => (editingId ? episodes.find((e) => e.id === editingId) ?? null : null),
    [editingId, episodes],
  );

  const loadAuth = useCallback(async () => {
    try {
      const [meRes, adminRes] = await Promise.all([
        fetch('/api/auth/me', { cache: 'no-store' }),
        fetch('/api/admin-login', { cache: 'no-store' }),
      ]);
      const data = await meRes.json().catch(() => ({}));
      const adminData = adminRes.ok ? await adminRes.json().catch(() => ({})) : {};
      const manage = Boolean(data.isAdmin) || Boolean(adminData.isAdmin)
        || (Boolean(data.authenticated) && Boolean(data.activeTeam?.isCommissioner))
        || (Boolean(data.authenticated) && Array.isArray(data.leagues)
          && data.leagues.some((l: { isCommissioner?: boolean }) => l.isCommissioner));
      setCanManage(manage);
    } catch {
      setCanManage(false);
    }
  }, []);

  const loadEpisodes = useCallback(async () => {
    const qs = seasonFilter !== 'all' ? `?season=${seasonFilter}` : '';
    const res = await fetch(`/api/newsletter/episodes${qs}`);
    const data = await res.json();
    setEpisodes(data.episodes ?? []);
    setSeasons(data.seasons ?? []);
    if (data.canManage) setCanManage(true);
  }, [seasonFilter]);

  const loadPodcast = useCallback(async () => {
    const res = await fetch('/api/settings/podcast');
    const data = await res.json();
    setPodcast(data.podcast ?? null);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAuth(), loadEpisodes(), loadPodcast()])
      .finally(() => setLoading(false));
  }, [loadAuth, loadEpisodes, loadPodcast]);

  const publishedEpisodes = useMemo(
    () => episodes.filter((e) => e.status === 'published'),
    [episodes],
  );
  const featured = publishedEpisodes[0] ?? null;
  const listEpisodes = canManage ? episodes : publishedEpisodes;

  const setTab = (tab: string) => {
    router.replace(tab === 'podcast' ? '/newsletter?tab=podcast' : '/newsletter', { scroll: false });
  };

  const closeModal = useCallback(() => {
    router.replace(buildNewsletterUrl(searchParams, { modal: null, id: null }), { scroll: false });
  }, [router, searchParams]);

  const openEdit = (id: string) => {
    router.push(buildNewsletterUrl(searchParams, { modal: 'editor', id }), { scroll: false });
  };

  const handleSave = async (data: EpisodeFormData) => {
    setSaving(true);
    try {
      const payload = {
        title: data.title,
        season: data.season,
        week: data.week === '' ? null : data.week,
        episodeNumber: data.episodeNumber,
        contentHtml: data.contentHtml,
        status: data.status,
        publishedAt: data.publishedAt,
        sourceType: data.sourceType,
        sourceFileKey: data.sourceFileKey,
      };
      const res = data.id
        ? await fetch(`/api/newsletter/episodes/${data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/newsletter/episodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      closeModal();
      await loadEpisodes();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onImportComplete = async () => {
    closeModal();
    await loadEpisodes();
  };

  const modalTitle = modal === 'editor'
    ? (editingEpisode ? 'Edit Issue' : 'New Issue')
    : modal === 'bulk'
      ? 'Bulk Import'
      : modal === 'import'
        ? 'Upload Newsletter File'
        : modal === 'podcast'
          ? 'Podcast Settings'
          : undefined;

  const issuesContent = (
    <div className="space-y-6">
      {loading ? (
        <p className="text-[var(--muted)] text-center py-12">Loading newsletters…</p>
      ) : listEpisodes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-5xl mb-4">📰</div>
            <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Newsletters Yet</h2>
            <p className="text-[var(--muted)] mb-6 max-w-md mx-auto">
              League newsletters will appear here as the commish publishes weekly recaps and updates.
            </p>
            {canManage && (
              <div className="flex flex-wrap gap-2 justify-center">
                <Link
                  href={buildNewsletterUrl(searchParams, { modal: 'editor', id: null })}
                  scroll={false}
                  className="btn focus-visible:ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface)] gap-2 text-sm px-3 py-1.5 btn-primary"
                >
                  Create First Issue
                </Link>
                <Link
                  href={buildNewsletterUrl(searchParams, { modal: 'import', id: null })}
                  scroll={false}
                  className="btn focus-visible:ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface)] gap-2 text-sm px-3 py-1.5 btn-secondary"
                >
                  Upload File
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {featured && (
            <Card className="overflow-hidden border-[color-mix(in_srgb,var(--accent)_30%,var(--border))]">
              <CardContent className="p-6 md:p-8">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                  Latest Issue · {metaLabel(featured)}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-[var(--text)] mt-2 mb-2">{featured.title}</h2>
                {featured.publishedAt && (
                  <p className="text-sm text-[var(--muted)] mb-4">{formatDate(featured.publishedAt)}</p>
                )}
                {featured.summary && (
                  <p className="text-[var(--muted)] mb-6 max-w-2xl line-clamp-3">{featured.summary}</p>
                )}
                <Link
                  href={`/newsletter/${featured.slug}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[var(--accent)] text-[var(--on-brand)] hover:opacity-90 transition-opacity"
                >
                  Read latest issue →
                </Link>
              </CardContent>
            </Card>
          )}

          {seasons.length > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="season-filter" className="text-sm text-[var(--muted)]">Season</label>
              <select
                id="season-filter"
                value={seasonFilter === 'all' ? 'all' : String(seasonFilter)}
                onChange={(e) => setSeasonFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                className="px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
              >
                <option value="all">All seasons</option>
                {seasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listEpisodes.map((ep) => (
              <NewsletterCard
                key={ep.id}
                episode={ep}
                canManage={canManage}
                onEdit={openEdit}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <SectionHeader title="Newsletter" className="mx-auto max-w-fit sm:mx-0" />
          <p className="text-[var(--muted)] mt-2 max-w-xl">
            Weekly league recaps, power rankings, and storylines — plus the league podcast.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href={buildNewsletterUrl(searchParams, { modal: 'editor', id: null })}
              scroll={false}
              className="btn focus-visible:ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface)] gap-2 text-sm px-2.5 py-1 btn-primary"
            >
              + New Issue
            </Link>
            <Link
              href={buildNewsletterUrl(searchParams, { modal: 'import', id: null })}
              scroll={false}
              className="btn focus-visible:ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface)] gap-2 text-sm px-2.5 py-1 btn-secondary"
            >
              Upload File
            </Link>
            <Link
              href={buildNewsletterUrl(searchParams, { modal: 'bulk', id: null })}
              scroll={false}
              className="btn focus-visible:ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface)] gap-2 text-sm px-2.5 py-1 btn-secondary"
            >
              Bulk Import
            </Link>
            <Link
              href={buildNewsletterUrl(searchParams, { modal: 'podcast', id: null })}
              scroll={false}
              className="btn focus-visible:ring-2 ring-[var(--focus)] ring-offset-2 ring-offset-[var(--surface)] gap-2 text-sm px-2.5 py-1 pill pill-hover text-[var(--text)]"
            >
              Podcast Settings
            </Link>
          </div>
        )}
      </div>

      <Tabs
        activeId={activeTab}
        onChange={setTab}
        tabs={[
          { id: 'issues', label: 'Newsletters', content: issuesContent },
          {
            id: 'podcast',
            label: 'Podcast',
            content: podcast ? <PodcastPanel podcast={podcast} /> : <p className="text-[var(--muted)]">Loading podcast…</p>,
          },
        ]}
      />

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modalTitle}
        panelClassName="max-w-3xl max-h-[90vh] overflow-y-auto"
        autoFocusPanel={false}
      >
        {modal === 'editor' && (
          <NewsletterEditor
            initial={editingEpisode ? {
              id: editingEpisode.id,
              title: editingEpisode.title,
              season: editingEpisode.season,
              week: editingEpisode.week ?? '',
              episodeNumber: editingEpisode.episodeNumber,
              contentHtml: editingEpisode.contentHtml || '',
              status: editingEpisode.status,
              publishedAt: editingEpisode.publishedAt || new Date().toISOString(),
              sourceType: editingEpisode.sourceType,
              sourceFileKey: editingEpisode.sourceFileKey,
            } : undefined}
            onSave={handleSave}
            onCancel={closeModal}
            saving={saving}
          />
        )}
        {modal === 'bulk' && (
          <BulkImportPanel onClose={closeModal} onComplete={onImportComplete} />
        )}
        {modal === 'import' && (
          <FileImportPanel onClose={closeModal} onComplete={onImportComplete} />
        )}
        {modal === 'podcast' && (
          <PodcastSettingsForm
            onClose={closeModal}
            onSaved={() => { loadPodcast(); closeModal(); }}
          />
        )}
      </Modal>
    </div>
  );
}

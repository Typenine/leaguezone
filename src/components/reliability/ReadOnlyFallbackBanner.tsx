'use client';

import { useEffect, useState } from 'react';

type Detail = { cachedAt?: string | null };

export default function ReadOnlyFallbackBanner({ initialDegraded = false }: { initialDegraded?: boolean }) {
  const [degraded, setDegraded] = useState(initialDegraded);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    const onStale = (event: Event) => {
      const detail = (event as CustomEvent<Detail>).detail;
      setDegraded(true);
      setCachedAt(detail?.cachedAt || null);
    };
    const onLive = () => {
      if (!initialDegraded) {
        setDegraded(false);
        setCachedAt(null);
      }
    };
    window.addEventListener('leaguezone:data-stale', onStale);
    window.addEventListener('leaguezone:data-live', onLive);
    return () => {
      window.removeEventListener('leaguezone:data-stale', onStale);
      window.removeEventListener('leaguezone:data-live', onLive);
    };
  }, [initialDegraded]);

  if (!degraded) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-200">
      LeagueZone is temporarily in read-only fallback mode. You are seeing the most recent saved league data
      {cachedAt ? ` from ${new Date(cachedAt).toLocaleString()}` : ''}. Commissioner changes may be unavailable until the database recovers.
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { buildLeagueSwitchHref } from '@/lib/navigation/league-switch';

type UserLeagueSummary = {
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  teamName: string;
  isCommissioner: boolean;
};

type ActiveTeam = {
  leagueId: string;
  leagueName: string;
  teamName: string;
  isCommissioner: boolean;
};

type AuthResponse = {
  authenticated?: boolean;
  activeTeam?: ActiveTeam | null;
  leagues?: UserLeagueSummary[];
};

export default function GlobalLeagueSwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = useMemo(() => searchParams?.toString() || '', [searchParams]);
  const [leagues, setLeagues] = useState<UserLeagueSummary[]>([]);
  const [activeTeam, setActiveTeam] = useState<ActiveTeam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<AuthResponse>;
      })
      .then((data) => {
        if (!mounted || !data?.authenticated) return;
        setLeagues(Array.isArray(data.leagues) ? data.leagues : []);
        setActiveTeam(data.activeTeam || null);
      })
      .catch(() => {
        if (!mounted) return;
        setLeagues([]);
        setActiveTeam(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [pathname]);

  const activeLeague = useMemo(
    () => leagues.find((league) => league.leagueId === activeTeam?.leagueId) || null,
    [activeTeam?.leagueId, leagues],
  );

  if (loading || leagues.length === 0) return null;

  const openHref = activeLeague
    ? buildLeagueSwitchHref(activeLeague.leagueId, '/home', '', activeLeague)
    : '/app';

  return (
    <aside
      aria-label="League navigation"
      className="sticky top-20 z-40 border-b border-white/10"
      style={{ background: 'var(--brand-navy)' }}
    >
      <div className="container mx-auto flex min-h-12 items-center gap-2 px-4 py-2 sm:gap-3">
        <label
          htmlFor="global-league-switcher"
          className="hidden text-[10px] font-black uppercase tracking-[0.22em] text-white/45 sm:block"
        >
          League
        </label>
        <select
          id="global-league-switcher"
          value={activeLeague?.leagueId || ''}
          onChange={(event) => {
            const selected = leagues.find((league) => league.leagueId === event.target.value);
            if (!selected) return;
            window.location.assign(buildLeagueSwitchHref(selected.leagueId, pathname, search, selected));
          }}
          className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-[var(--brand-gold)] sm:max-w-md"
          aria-label="Switch active league"
        >
          {!activeLeague && <option value="">Choose a league</option>}
          {leagues.map((league) => (
            <option key={league.leagueId} value={league.leagueId}>
              {league.leagueName} — {league.teamName}{league.isCommissioner ? ' (Commissioner)' : ''}
            </option>
          ))}
        </select>
        <Link
          href={openHref}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-[var(--brand-gold)] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[var(--brand-ink)] transition hover:brightness-110"
        >
          Open
        </Link>
        <Link
          href="/app"
          className="shrink-0 text-xs font-bold uppercase tracking-wider text-white/60 transition hover:text-white"
        >
          <span className="sm:hidden">All</span>
          <span className="hidden sm:inline">All leagues</span>
        </Link>
      </div>
    </aside>
  );
}

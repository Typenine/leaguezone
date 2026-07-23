'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { buildLeagueSwitchHref } from '@/lib/navigation/league-switch';
import { getLeagueSlugFromPath, getNavigationSurface } from '@/lib/navigation/surfaces';

type UserLeagueSummary = {
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  teamName: string;
  isCommissioner: boolean;
};

type ActiveTeam = {
  leagueId: string;
  leagueSlug?: string;
  leagueName: string;
  teamName: string;
  isCommissioner: boolean;
};

type AuthResponse = {
  authenticated?: boolean;
  activeTeam?: ActiveTeam | null;
  leagues?: UserLeagueSummary[];
};

function selectHref(league: UserLeagueSummary, next: string): string {
  return `/api/league/select?id=${encodeURIComponent(league.leagueId)}&next=${encodeURIComponent(next)}`;
}

export default function GlobalLeagueSwitcher() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const search = useMemo(() => searchParams?.toString() || '', [searchParams]);
  const surface = getNavigationSurface(pathname);
  const routeSlug = getLeagueSlugFromPath(pathname);
  const [leagues, setLeagues] = useState<UserLeagueSummary[]>([]);
  const [activeTeam, setActiveTeam] = useState<ActiveTeam | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then(async (response) => response.ok ? response.json() as Promise<AuthResponse> : null)
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
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const routeLeague = useMemo(
    () => leagues.find((league) => league.leagueSlug === routeSlug) || null,
    [leagues, routeSlug],
  );
  const activeLeague = useMemo(
    () => routeLeague || leagues.find((league) => league.leagueId === activeTeam?.leagueId) || null,
    [activeTeam?.leagueId, leagues, routeLeague],
  );
  const isLeagueSite = surface === 'league-site';

  if (!isLeagueSite && (loading || leagues.length === 0)) return null;

  if (isLeagueSite && leagues.length === 0) {
    return (
      <aside aria-label="LeagueZone navigation" className="sticky top-0 z-50 border-b border-white/10" style={{ background: 'var(--brand-navy)' }}>
        <div className="container mx-auto flex min-h-11 items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="text-xs font-black uppercase tracking-wider text-white">LeagueZone Home</Link>
          <div className="flex items-center gap-3">
            <Link href="/demo" className="text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white">Browse Leagues</Link>
            {!loading && <Link href={`/login?next=${encodeURIComponent(pathname + (search ? `?${search}` : ''))}`} className="text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)] hover:brightness-110">Sign In</Link>}
          </div>
        </div>
      </aside>
    );
  }

  const siteHref = activeLeague ? selectHref(activeLeague, `/l/${activeLeague.leagueSlug}`) : null;
  const dashboardHref = activeLeague ? selectHref(activeLeague, '/home') : null;

  return (
    <aside aria-label="League navigation" className={`sticky z-40 border-b border-white/10 ${isLeagueSite ? 'top-0' : 'top-20'}`} style={{ background: 'var(--brand-navy)' }}>
      <div className="container mx-auto flex min-h-12 items-center gap-2 overflow-x-auto px-4 py-2 sm:gap-3">
        <label htmlFor="global-league-switcher" className="hidden text-[10px] font-black uppercase tracking-[0.22em] text-white/45 sm:block">League</label>
        <select
          id="global-league-switcher"
          value={activeLeague?.leagueId || ''}
          onChange={(event) => {
            const selected = leagues.find((league) => league.leagueId === event.target.value);
            if (!selected) return;
            window.location.assign(buildLeagueSwitchHref(selected.leagueId, pathname, search, selected));
          }}
          className="min-w-[12rem] flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white outline-none focus:border-[var(--brand-gold)] sm:max-w-md"
          aria-label="Switch active league"
        >
          {!activeLeague && <option value="">Choose a league</option>}
          {leagues.map((league) => <option key={league.leagueId} value={league.leagueId}>{league.leagueName} — {league.teamName}{league.isCommissioner ? ' (Commissioner)' : ''}</option>)}
        </select>
        {siteHref && <Link href={siteHref} className="shrink-0 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:text-white"><span className="sm:hidden">Site</span><span className="hidden sm:inline">League Site</span></Link>}
        {dashboardHref && <Link href={dashboardHref} className="shrink-0 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:text-white"><span className="sm:hidden">Dash</span><span className="hidden sm:inline">League Dashboard</span></Link>}
        <Link href="/" className="shrink-0 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:text-white"><span className="sm:hidden">HQ</span><span className="hidden sm:inline">LeagueZone Home</span></Link>
        <Link href="/app" className="shrink-0 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:text-white"><span className="sm:hidden">All</span><span className="hidden sm:inline">My Leagues</span></Link>
      </div>
    </aside>
  );
}

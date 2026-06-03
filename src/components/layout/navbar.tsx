'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LinkButton from '@/components/ui/LinkButton';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Label from '@/components/ui/Label';
import { USER_NAV_CONFIG, type UserNavItem } from '@/lib/constants/navigation';

// ── path helpers ──────────────────────────────────────────────────────────────

function matchesPath(pathname: string, targetPath: string): boolean {
  if (targetPath === '/') return pathname === '/';
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

function isHrefActive(pathname: string, searchParams: URLSearchParams, href?: string): boolean {
  if (!href) return false;
  const [targetPath, rawQuery = ''] = href.split('?');
  if (!matchesPath(pathname, targetPath)) return false;
  if (!rawQuery) return true;
  const targetParams = new URLSearchParams(rawQuery);
  for (const [key, value] of targetParams.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

function isNavItemActive(item: UserNavItem, pathname: string, searchParams: URLSearchParams): boolean {
  if (isHrefActive(pathname, searchParams, item.href)) return true;
  if (item.children && item.children.length > 0) {
    const pathLevelMatch = item.children.some((child) => {
      const childPath = child.href?.split('?')[0];
      return childPath ? matchesPath(pathname, childPath) : false;
    });
    if (pathLevelMatch) return true;
  }
  return (item.children || []).some((child) => isNavItemActive(child, pathname, searchParams));
}

function hrefSpecificity(href?: string): number {
  if (!href) return 0;
  const [path, query = ''] = href.split('?');
  return path.length + new URLSearchParams(query).size * 100;
}

function findBestActive(items: UserNavItem[], pathname: string, searchParams: URLSearchParams): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    if (item.href && isHrefActive(pathname, searchParams, item.href)) {
      const candidate = { id: item.id, score: hrefSpecificity(item.href) };
      if (!best || candidate.score > best.score) best = candidate;
    }
    if (item.children && item.children.length > 0) {
      const childBest = findBestActive(item.children, pathname, searchParams);
      if (childBest && (!best || childBest.score > best.score)) best = childBest;
    }
  }
  return best;
}

// ── user avatar (initials) ────────────────────────────────────────────────────

function UserAvatar({ displayName, size = 32 }: { displayName: string; size?: number }) {
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="rounded-full flex items-center justify-center font-semibold text-white select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.375,
        background: 'var(--accent)',
      }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

// ── types ─────────────────────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  displayName: string | null;
  email: string;
  emailVerified: boolean;
}

interface ActiveTeam {
  teamName: string;
  leagueId: string;
  leagueSlug?: string;
  leagueName: string;
  isCommissioner: boolean;
}

interface UserLeagueSummary {
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  teamName: string;
  isCommissioner: boolean;
}

// ── navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentQuery = useMemo(() => new URLSearchParams(searchParams?.toString() || ''), [searchParams]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});
  const [desktopMenuOpen, setDesktopMenuOpen] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  // Auth state
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [activeTeam, setActiveTeam] = useState<ActiveTeam | null>(null);
  const [userLeagues, setUserLeagues] = useState<UserLeagueSummary[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // League branding
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [leagueLogoUrl, setLeagueLogoUrl] = useState<string | null>(null);

  // Change password modal
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changePwMsg, setChangePwMsg] = useState<string | null>(null);
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [changePwError, setChangePwError] = useState(false);

  const toggleMobileSection = (id: string) => setMobileExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const closeMobile = () => setMobileMenuOpen(false);

  // ── fetch auth state on every route change ──────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setAuthLoading(true);
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!mounted) return;
        if (r.ok) {
          const j = await r.json();
          if (j?.authenticated && j?.user) {
            setSessionUser(j.user as SessionUser);
            setActiveTeam((j.activeTeam as ActiveTeam) || null);
            setUserLeagues(Array.isArray(j.leagues) ? (j.leagues as UserLeagueSummary[]) : []);
            setIsAdmin(Boolean(j.isAdmin));
            setIsSiteAdmin(Boolean(j.isSiteAdmin));
          } else if (j?.authenticated && j?.claims?.team) {
            // Legacy team session — treat team name as display name
            const team = j.claims.team as string;
            setSessionUser({ id: team, displayName: team, email: '', emailVerified: true });
            setUserLeagues([]);
            setIsAdmin(Boolean(j.isAdmin));
            setIsSiteAdmin(Boolean(j.isSiteAdmin));
          } else {
            setSessionUser(null);
            setActiveTeam(null);
            setUserLeagues([]);
            setIsAdmin(Boolean(j?.isAdmin));
            setIsSiteAdmin(Boolean(j?.isSiteAdmin));
          }
        } else {
          setSessionUser(null);
          setActiveTeam(null);
          setUserLeagues([]);
        }
      } catch {
        if (mounted) { setSessionUser(null); setActiveTeam(null); setUserLeagues([]); }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [pathname]);

  // ── league branding ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    fetch('/api/league/info', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!mounted) return;
        if (j?.name) setLeagueName(j.name);
        if (j?.logoUrl) setLeagueLogoUrl(j.logoUrl);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [pathname]);

  // ── close menus on outside click / Escape ───────────────────────────────────
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) setAccountMenuOpen(false);
      if (!desktopMenuRef.current?.contains(e.target as Node)) setDesktopMenuOpen(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDesktopMenuOpen(null); setAccountMenuOpen(false); }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // ── handlers ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setSessionUser(null);
    setActiveTeam(null);
    router.push('/login');
  };

  const handleSiteAdminLogout = async () => {
    try { await fetch('/api/super-admin-login', { method: 'DELETE' }); } catch {}
    setIsAdmin(false);
    setIsSiteAdmin(false);
    router.push('/');
  };

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwMsg(null);
    setChangePwError(false);
    if (newPw !== confirmPw) {
      setChangePwMsg('New passwords do not match');
      setChangePwError(true);
      return;
    }
    if (newPw.length < 8) {
      setChangePwMsg('Password must be at least 8 characters');
      setChangePwError(true);
      return;
    }
    setChangePwLoading(true);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Failed to change password');
      setChangePwMsg('Password updated!');
      setChangePwError(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setChangePwMsg(err instanceof Error ? err.message : 'Failed');
      setChangePwError(true);
    } finally {
      setChangePwLoading(false);
    }
  };

  const displayName = sessionUser?.displayName || sessionUser?.email || '';
  const isLoggedIn = Boolean(sessionUser) || isAdmin;
  const isMarketingHome = pathname === '/';
  const isLeagueHomepage = pathname.startsWith('/leagues/');
  const isPortalSurface = isMarketingHome || isLeagueHomepage;
  const portalMenuItems = [
    { href: '/', label: 'Home' },
    { href: '/#my-leagues', label: 'My Leagues' },
    { href: '/#available-leagues', label: 'Available Leagues' },
    activeTeam
      ? { href: `/api/league/select?id=${encodeURIComponent(activeTeam.leagueId)}&next=${encodeURIComponent('/home')}`, label: 'Dashboard' }
      : { href: '/login', label: 'Sign In' },
  ];
  const leagueMenuItems = [
    { href: '/home', label: 'Home' },
    { href: '/teams', label: 'Teams' },
    { href: '/standings', label: 'Standings' },
    { href: '/draft?view=next', label: 'Draft' },
    { href: '/trades', label: 'Trades' },
    { href: '/history', label: 'History' },
    { href: '/rules', label: 'Rules' },
    { href: '/suggestions', label: 'Suggestions' },
    { href: '/settings', label: 'Settings' },
  ];
  const menuBarItems = isPortalSurface ? portalMenuItems : leagueMenuItems;

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <>
    <nav
      className="league-surface border-b border-[var(--border)] sticky top-0 backdrop-blur-sm bg-[var(--surface)]/95 z-50"
      style={{ boxShadow: 'inset 0 -3px 0 var(--gold)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Left: logo + nav links */}
          <div className="flex items-center">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={isPortalSurface ? '/' : activeTeam?.leagueSlug ? `/leagues/${activeTeam.leagueSlug}` : '/'} aria-label="Website home" className="flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={isPortalSurface ? '/assets/teams/East v West Logos/EvW Clancy logo.png' : leagueLogoUrl || '/assets/teams/East v West Logos/EvW Clancy logo.png'}
                  alt={isPortalSurface ? 'Website logo' : 'League logo'}
                  className="h-9 w-9 rounded-lg object-contain"
                />
              </Link>
              <Link href={isPortalSurface ? '/' : '/home'} className="font-bold text-xl leading-none">
                {isPortalSurface ? 'League HQ' : leagueName ?? 'Fantasy League'}
              </Link>
            </div>
            {!isPortalSurface && <div className="hidden">
              <div className="ml-10 flex items-center gap-1" ref={desktopMenuRef}>
                {USER_NAV_CONFIG.map((item) => {
                  const itemActive = isNavItemActive(item, pathname, currentQuery);
                  const hasChildren = Boolean(item.children && item.children.length > 0);
                  const menuOpen = desktopMenuOpen === item.id;

                  if (!hasChildren && item.href) {
                    return (
                      <LinkButton
                        key={item.id}
                        href={item.href}
                        aria-current={isHrefActive(pathname, currentQuery, item.href) ? 'page' : undefined}
                        variant={itemActive ? 'secondary' : 'ghost'}
                        size="md"
                      >
                        {item.label}
                      </LinkButton>
                    );
                  }

                  return (
                    <div key={item.id} className="relative group">
                      <Button
                        type="button"
                        variant={itemActive ? 'secondary' : 'ghost'}
                        size="sm"
                        className="inline-flex items-center gap-1"
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-controls={`desktop-menu-${item.id}`}
                        onClick={() => setDesktopMenuOpen((open) => open === item.id ? null : item.id)}
                        onMouseEnter={() => setDesktopMenuOpen(item.id)}
                        onFocus={() => setDesktopMenuOpen(item.id)}
                      >
                        {item.label}
                        <span className="text-xs">▾</span>
                      </Button>

                      <div
                        id={`desktop-menu-${item.id}`}
                        className={`absolute left-0 top-full z-50 transition-opacity duration-150 ${menuOpen ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'}`}
                      >
                        <div className="min-w-[220px] league-surface border border-[var(--border)] rounded-md shadow-lg p-1">
                          {(() => {
                            const bestChild = findBestActive(item.children || [], pathname, currentQuery);
                            return (item.children || []).map((child) => {
                              const childIsDirectMatch = bestChild?.id === child.id;
                              const hasGrandChildren = Boolean(child.children && child.children.length > 0);
                              const childBranchActive = childIsDirectMatch || (child.children || []).some((g) => g.id === bestChild?.id);
                              const bestGrand = hasGrandChildren ? findBestActive(child.children || [], pathname, currentQuery) : null;

                              if (!hasGrandChildren) {
                                return (
                                  <Link
                                    key={child.id}
                                    href={child.href || '#'}
                                    className={`block rounded px-2 py-1.5 text-sm ${childBranchActive ? 'bg-[var(--surface-strong)] text-[var(--text)] font-medium' : 'hover:bg-[var(--surface-strong)] text-[var(--text)]'}`}
                                    onClick={() => setDesktopMenuOpen(null)}
                                  >
                                    {child.label}
                                  </Link>
                                );
                              }

                              return (
                                <div key={child.id} className="relative group/submenu">
                                  <Link
                                    href={child.href || '#'}
                                    className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${childBranchActive ? 'bg-[var(--surface-strong)] text-[var(--text)] font-medium' : 'hover:bg-[var(--surface-strong)] text-[var(--text)]'}`}
                                    onClick={() => setDesktopMenuOpen(null)}
                                  >
                                    <span>{child.label}</span>
                                    <span aria-hidden="true">▸</span>
                                  </Link>
                                  <div className="absolute left-full top-0 invisible opacity-0 pointer-events-none group-hover/submenu:visible group-hover/submenu:opacity-100 group-hover/submenu:pointer-events-auto transition-opacity duration-150">
                                    <div className="min-w-[220px] league-surface border border-[var(--border)] rounded-md shadow-lg p-1">
                                      {(child.children || []).map((grand) => {
                                        const grandActive = bestGrand?.id === grand.id;
                                        return (
                                          <Link
                                            key={grand.id}
                                            href={grand.href || '#'}
                                            className={`block rounded px-2 py-1.5 text-sm ${grandActive ? 'bg-[var(--surface-strong)] text-[var(--text)] font-medium' : 'hover:bg-[var(--surface-strong)] text-[var(--text)]'}`}
                                            onClick={() => setDesktopMenuOpen(null)}
                                          >
                                            {grand.label}
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>}
          </div>

          {/* Right: theme + account */}
          <div className="flex items-center gap-2">
            {isPortalSurface && activeTeam && (
              <LinkButton
                href={`/api/league/select?id=${encodeURIComponent(activeTeam.leagueId)}&next=${encodeURIComponent('/home')}`}
                variant="secondary"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Open Dashboard
              </LinkButton>
            )}
            <ThemeToggle />

            {/* Desktop account area */}
            <div className="hidden md:flex items-center gap-2">
              {isLoggedIn ? (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    aria-label="Account menu"
                    className="rounded-full overflow-hidden border-2 border-[var(--accent)]/40 hover:border-[var(--accent)] transition-colors"
                    style={isSiteAdmin ? { borderColor: '#f59e0b' } : undefined}
                    onClick={() => setAccountMenuOpen((v) => !v)}
                    title={displayName}
                    aria-expanded={accountMenuOpen}
                  >
                    {sessionUser ? (
                      <UserAvatar displayName={displayName} size={32} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/assets/teams/East v West Logos/EvW Clancy logo.png" alt="Admin" width={32} height={32} className="w-8 h-8 object-contain" />
                    )}
                  </button>
                  {/* Admin badge */}
                  {isSiteAdmin && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border border-[var(--surface)] text-[8px] flex items-center justify-center font-bold text-amber-900" title="Admin Mode">A</span>
                  )}

                  {accountMenuOpen && (
                    <div className="absolute right-0 mt-2 w-72 league-surface border border-[var(--border)] rounded shadow-lg p-1 z-50">

                      {/* User identity */}
                      {sessionUser && (
                        <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                          <div className="text-sm font-semibold text-[var(--text)] truncate">{displayName}</div>
                          {activeTeam && (
                            <div className="text-xs text-[var(--muted)] truncate mt-0.5">
                              {activeTeam.teamName}
                              {activeTeam.isCommissioner && (
                                <span className="ml-1.5 text-[var(--accent)] font-medium">· Commissioner</span>
                              )}
                            </div>
                          )}
                          {!sessionUser.emailVerified && (
                            <div className="text-xs text-amber-500 mt-0.5">⚠ Email not verified</div>
                          )}
                        </div>
                      )}

                      {userLeagues.length > 1 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Switch League</div>
                          {userLeagues.map((league) => {
                            const active = activeTeam?.leagueId === league.leagueId;
                            return (
                              <a
                                key={league.leagueId}
                                href={`/api/league/select?id=${encodeURIComponent(league.leagueId)}&next=${encodeURIComponent('/home')}`}
                                className={`block rounded px-2 py-1.5 text-sm hover:bg-[var(--surface-strong)] ${active ? 'bg-[var(--surface-strong)] text-[var(--text)] font-medium' : 'text-[var(--text)]'}`}
                                onClick={() => setAccountMenuOpen(false)}
                                aria-current={active ? 'page' : undefined}
                              >
                                <span className="block truncate">{league.leagueName}</span>
                                <span className="block truncate text-xs text-[var(--muted)]">{league.teamName}</span>
                              </a>
                            );
                          })}
                          <Link
                            href="/#my-leagues"
                            className="block rounded px-2 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--surface-strong)]"
                            onClick={() => setAccountMenuOpen(false)}
                          >
                            View all league homepages
                          </Link>
                          <div className="my-1 border-t border-[var(--border)]" />
                        </>
                      )}

                      {/* Site admin tools */}
                      {isSiteAdmin && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-amber-500 uppercase tracking-wide">Admin Mode</div>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); router.push('/super-admin'); }}
                          >
                            🌐 Admin Dashboard
                          </button>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm text-red-500"
                            onClick={() => { setAccountMenuOpen(false); handleSiteAdminLogout(); }}
                          >
                            Exit Admin Mode
                          </button>
                          <div className="my-1 border-t border-[var(--border)]" />
                        </>
                      )}

                      {/* Commissioner tools */}
                      {activeTeam?.isCommissioner && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Commissioner</div>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); router.push('/settings'); }}
                          >
                            League Settings
                          </button>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); router.push('/admin/suggestions'); }}
                          >
                            Suggestions
                          </button>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); router.push('/admin/newsletter'); }}
                          >
                            Newsletter
                          </button>
                          <div className="my-1 border-t border-[var(--border)]" />
                        </>
                      )}

                      {/* Account actions */}
                      {sessionUser && (
                        <>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); setChangePwOpen(true); }}
                          >
                            Change password
                          </button>
                          {!sessionUser.emailVerified && (
                            <button
                              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm text-amber-500"
                              onClick={async () => {
                                setAccountMenuOpen(false);
                                await fetch('/api/auth/resend-verification', { method: 'POST' });
                                alert('Verification email sent! Check your inbox.');
                              }}
                            >
                              Resend verification email
                            </button>
                          )}
                        </>
                      )}
                      <button
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm text-red-500"
                        onClick={() => { setAccountMenuOpen(false); handleLogout(); }}
                        disabled={authLoading}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Not logged in */
                <div className="relative" ref={accountMenuRef}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="inline-flex items-center gap-1"
                    onClick={() => setAccountMenuOpen((v) => !v)}
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="menu"
                  >
                    Sign in <span aria-hidden="true" className="text-xs">▾</span>
                  </Button>
                  {accountMenuOpen && (
                    <div className="absolute right-0 mt-2 w-44 league-surface border border-[var(--border)] rounded shadow-lg p-1 z-50">
                      <Link
                        href={`/login?next=${encodeURIComponent(pathname)}`}
                        className="block rounded px-3 py-2 text-sm hover:bg-[var(--surface-strong)] text-[var(--text)]"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/register"
                        className="block rounded px-3 py-2 text-sm hover:bg-[var(--surface-strong)] text-[var(--text)]"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        Create account
                      </Link>
                      <div className="my-1 border-t border-[var(--border)]" />
                      <Link
                        href="/super-admin/login"
                        className="block rounded px-3 py-2 text-sm hover:bg-[var(--surface-strong)] text-amber-500"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        🌐 Admin Mode
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden">
              <Button
                id="mobile-menu-button"
                type="button"
                variant="ghost"
                size="sm"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle main menu"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <svg className={`${mobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg className={`${mobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface-strong)_50%,transparent)]">
        <div className="container mx-auto px-4">
          <div className="flex min-h-10 items-center gap-2 overflow-x-auto py-1.5">
            {menuBarItems.map((item) => {
              const active = item.href === '/'
                ? pathname === '/'
                : item.href.startsWith('/#')
                  ? false
                  : isHrefActive(pathname, currentQuery, item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-[var(--surface-strong)] text-[var(--text)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:hidden relative z-40`} id="mobile-menu" aria-labelledby="mobile-menu-button">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {!isPortalSurface && USER_NAV_CONFIG.map((item) => {
            const itemActive = isNavItemActive(item, pathname, currentQuery);
            const hasChildren = Boolean(item.children && item.children.length > 0);

            if (!hasChildren && item.href) {
              return (
                <LinkButton key={item.id} href={item.href} aria-current={isHrefActive(pathname, currentQuery, item.href) ? 'page' : undefined} variant={itemActive ? 'secondary' : 'ghost'} size="lg" className="block text-left" onClick={closeMobile}>
                  {item.label}
                </LinkButton>
              );
            }

            const expanded = Boolean(mobileExpanded[item.id]);
            return (
              <div key={item.id} className="border border-[var(--border)] rounded-md">
                <button type="button" className={`w-full flex items-center justify-between px-3 py-2 text-left ${itemActive ? 'text-[var(--text)] font-medium' : 'text-[var(--muted)]'}`} onClick={() => toggleMobileSection(item.id)} aria-expanded={expanded}>
                  <span>{item.label}</span>
                  <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                </button>
                {expanded && (
                  <div className="px-2 pb-2 space-y-1">
                    {(() => {
                      const bestChild = findBestActive(item.children || [], pathname, currentQuery);
                      return (item.children || []).map((child) => {
                        const hasGrandChildren = Boolean(child.children && child.children.length > 0);
                        const childBranchActive = bestChild?.id === child.id || (child.children || []).some((g) => g.id === bestChild?.id);
                        if (!hasGrandChildren) {
                          return (
                            <Link key={child.id} href={child.href || '#'} onClick={closeMobile} className={`block rounded px-2 py-1.5 text-sm ${childBranchActive ? 'bg-[var(--surface-strong)] text-[var(--text)] font-medium' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}>
                              {child.label}
                            </Link>
                          );
                        }
                        const childExpanded = Boolean(mobileExpanded[child.id]);
                        const bestGrand = findBestActive(child.children || [], pathname, currentQuery);
                        return (
                          <div key={child.id} className="border border-[var(--border)] rounded-md">
                            <div className="w-full flex items-center justify-between px-2 py-1.5 text-sm">
                              <Link href={child.href || '#'} onClick={closeMobile} className={`${childBranchActive ? 'text-[var(--text)] font-medium' : 'text-[var(--text)]'} hover:underline`}>{child.label}</Link>
                              <button type="button" className={`${childBranchActive ? 'text-[var(--text)] font-medium' : 'text-[var(--muted)]'}`} onClick={() => toggleMobileSection(child.id)} aria-expanded={childExpanded} aria-label={`Toggle ${child.label} submenu`}>
                                <span aria-hidden="true">{childExpanded ? '▾' : '▸'}</span>
                              </button>
                            </div>
                            {childExpanded && (
                              <div className="px-2 pb-2 space-y-1">
                                {(child.children || []).map((grand) => {
                                  const grandActive = bestGrand?.id === grand.id;
                                  return (
                                    <Link key={grand.id} href={grand.href || '#'} onClick={closeMobile} className={`block rounded px-2 py-1.5 text-sm ${grandActive ? 'bg-[var(--surface-strong)] text-[var(--text)] font-medium' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}>
                                      {grand.label}
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {/* Mobile account area */}
          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
            {isLoggedIn ? (
              <div className="flex items-center gap-2 w-full">
                {sessionUser && <UserAvatar displayName={displayName} size={28} />}
                <span className="text-sm text-[var(--text)] truncate flex-1">{displayName}</span>
                {isSiteAdmin ? (
                  <Button size="sm" variant="ghost" onClick={() => { closeMobile(); handleSiteAdminLogout(); }}>Exit Admin</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => { closeMobile(); handleLogout(); }}>Sign out</Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2 w-full">
                <LinkButton href={`/login?next=${encodeURIComponent(pathname)}`} variant="ghost" size="sm" className="flex-1 text-center" onClick={closeMobile}>
                  Sign in
                </LinkButton>
                <LinkButton href="/register" variant="primary" size="sm" className="flex-1 text-center" onClick={closeMobile}>
                  Sign up
                </LinkButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>

    {/* Change Password Modal */}
    <Modal open={changePwOpen} onClose={() => { setChangePwOpen(false); setChangePwMsg(null); setChangePwError(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }} title="Change password" autoFocusPanel={false}>
      <form onSubmit={handleChangePw} noValidate className="space-y-4">
        <div>
          <Label htmlFor="cur-pw">Current password</Label>
          <input id="cur-pw" type="password" autoComplete="current-password" className="w-full league-surface border border-[var(--border)] rounded px-3 py-2 mt-1" placeholder="Current password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="new-pw">New password</Label>
          <input id="new-pw" type="password" autoComplete="new-password" className="w-full league-surface border border-[var(--border)] rounded px-3 py-2 mt-1" placeholder="At least 8 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm-pw">Confirm new password</Label>
          <input id="confirm-pw" type="password" autoComplete="new-password" className="w-full league-surface border border-[var(--border)] rounded px-3 py-2 mt-1" placeholder="Repeat new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
        {changePwMsg && (
          <div className={`text-sm ${changePwError ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`} role="status">{changePwMsg}</div>
        )}
        <div className="flex items-center gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => setChangePwOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={changePwLoading || !currentPw || !newPw || !confirmPw}>
            {changePwLoading ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </Modal>
    </>
  );
}

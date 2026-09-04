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
import { PLATFORM } from '@/lib/config/platform';

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

  // Beta feedback / account deletion request modal
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'Beta Feedback' | 'Account Deletion Request'>('Beta Feedback');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const toggleMobileSection = (id: string) => setMobileExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const closeMobile = () => setMobileMenuOpen(false);

  // ── fetch auth state on every route change ──────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setAuthLoading(true);
        const r = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
        const adminCheck = await fetch('/api/admin-login', { cache: 'no-store', credentials: 'include' }).catch(() => null);
        const adminJson = adminCheck?.ok ? await adminCheck.json().catch(() => ({})) : {};
        if (!mounted) return;
        if (r.ok) {
          const j = await r.json();
          const adminFlag = Boolean(j.isAdmin) || Boolean(adminJson.isAdmin);
          if (j?.authenticated && j?.user) {
            setSessionUser(j.user as SessionUser);
            setActiveTeam((j.activeTeam as ActiveTeam) || null);
            setUserLeagues(Array.isArray(j.leagues) ? (j.leagues as UserLeagueSummary[]) : []);
            setIsAdmin(adminFlag);
            setIsSiteAdmin(Boolean(j.isSiteAdmin));
          } else if (j?.authenticated && j?.claims?.team) {
            // Legacy team session — treat team name as display name
            const team = j.claims.team as string;
            setSessionUser({ id: team, displayName: team, email: '', emailVerified: true });
            setUserLeagues([]);
            setIsAdmin(adminFlag);
            setIsSiteAdmin(Boolean(j.isSiteAdmin));
          } else {
            setSessionUser(null);
            setActiveTeam(null);
            setUserLeagues([]);
            setIsAdmin(adminFlag);
            setIsSiteAdmin(Boolean(j?.isSiteAdmin));
          }
        } else {
          const j = await r.json().catch(() => ({}));
          setSessionUser(null);
          setActiveTeam(null);
          setUserLeagues([]);
          setIsAdmin(Boolean(j?.isAdmin) || Boolean(adminJson.isAdmin));
          setIsSiteAdmin(Boolean(j?.isSiteAdmin));
        }
      } catch {
        if (mounted) {
          setSessionUser(null);
          setActiveTeam(null);
          setUserLeagues([]);
          fetch('/api/admin-login', { cache: 'no-store', credentials: 'include' })
            .then((r) => r.json())
            .then((j) => { if (mounted) setIsAdmin(Boolean(j?.isAdmin)); })
            .catch(() => {});
        }
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

  const handleAdminLogout = async () => {
    try { await fetch('/api/admin-login', { method: 'DELETE' }); } catch {}
    if (isSiteAdmin) {
      try { await fetch('/api/super-admin-login', { method: 'DELETE' }); } catch {}
      setIsSiteAdmin(false);
    }
    setIsAdmin(false);
    setAccountMenuOpen(false);
    router.refresh();
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

  const openFeedback = (category: 'Beta Feedback' | 'Account Deletion Request') => {
    setFeedbackCategory(category);
    setFeedbackMessage('');
    setFeedbackMsg(null);
    setFeedbackError(false);
    setFeedbackOpen(true);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);
    setFeedbackError(false);
    if (feedbackMessage.trim().length < 3) {
      setFeedbackMsg('Please include a few more details.');
      setFeedbackError(true);
      return;
    }
    setFeedbackLoading(true);
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: feedbackMessage.trim(), category: feedbackCategory, pageUrl: pathname }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Failed to send. Please try again.');
      setFeedbackMsg(
        feedbackCategory === 'Account Deletion Request'
          ? "Request received — we'll follow up at your account email."
          : 'Thanks! Your feedback was sent.'
      );
      setFeedbackMessage('');
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Failed to send. Please try again.');
      setFeedbackError(true);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const displayName = sessionUser?.displayName || sessionUser?.email || '';
  const isLoggedIn = Boolean(sessionUser) || isAdmin;
  const accountButtonLabel = authLoading
    ? 'Loading…'
    : isAdmin && !sessionUser
      ? 'Signed in as Admin'
      : isAdmin && sessionUser
        ? `${displayName} (Admin)`
        : sessionUser
          ? displayName
          : 'Sign in';
  const isMarketingHome = pathname === '/';
  const isPlatformPage = ['/features', '/pricing', '/demo', '/login', '/register', '/setup', '/verify-email'].includes(pathname) || pathname === '/app' || pathname.startsWith('/app/');
  // League sites under /l/[slug] render their own league header + nav below
  // this bar, so the platform bar stays minimal there.
  const isLeagueSite = pathname.startsWith('/l/') || pathname.startsWith('/leagues/');
  const isPortalSurface = isMarketingHome || isPlatformPage || isLeagueSite;
  const portalMenuItems = [
    { href: '/', label: 'Home' },
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/demo', label: 'Demo' },
    sessionUser
      ? { href: '/app', label: 'Dashboard' }
      : { href: '/login', label: 'Sign In' },
  ];
  const leagueMenuItems = [
    { href: '/home', label: 'Home' },
    { href: '/teams', label: 'Teams' },
    { href: '/standings', label: 'Standings' },
    // Draft hidden until system complete: { href: '/draft?view=next', label: 'Draft' },
    { href: '/trades', label: 'Trades' },
    { href: '/history', label: 'History' },
    { href: '/rules', label: 'Rules' },
    { href: '/suggestions', label: 'Suggestions' },
    { href: '/newsletter', label: 'Newsletter' },
    { href: '/settings', label: 'Settings' },
  ];
  const menuBarItems = isLeagueSite ? [] : isPortalSurface ? portalMenuItems : leagueMenuItems;

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <>
    <nav
      className="sticky top-0 z-50"
      style={{ background: 'var(--brand-navy)', boxShadow: 'inset 0 -4px 0 var(--brand-blue)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">

          {/* Left: logo + inline nav links */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Link href={isPortalSurface ? '/' : activeTeam?.leagueSlug ? `/l/${activeTeam.leagueSlug}` : '/'} aria-label="Website home" className="flex-shrink-0">
                {!isPortalSurface && leagueLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leagueLogoUrl}
                    alt="League logo"
                    className="h-9 w-9 rounded-lg object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/assets/LeagueZone HQ Logo.png" alt="" className="h-14 w-14 rounded-xl object-contain" aria-hidden="true" />
                )}
              </Link>
              <Link href={isPortalSurface ? '/' : '/home'} className="font-black text-xl leading-none tracking-tight text-white">
                {isPortalSurface ? PLATFORM.name : leagueName ?? 'Fantasy League'}
              </Link>
            </div>

            {/* Desktop portal nav — inline in main bar */}
            {isPortalSurface && (
              <div className="hidden md:flex items-center gap-0.5">
                {portalMenuItems.map((item) => {
                  const active = item.href === '/' ? pathname === '/' : isHrefActive(pathname, currentQuery, item.href);
                  return (
                    <Link
                      key={`portal-${item.href}`}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                        active
                          ? 'text-white bg-white/20 font-bold'
                          : 'text-white/65 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Desktop league nav — inline in main bar */}
            {!isPortalSurface && !isLeagueSite && (
              <div className="hidden md:flex items-center gap-0.5" ref={desktopMenuRef}>
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
                        className={itemActive ? 'text-white bg-white/20 hover:bg-white/25' : 'text-white/65 hover:text-white hover:bg-white/10'}
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
                        className={`inline-flex items-center gap-1 ${itemActive ? 'text-white bg-white/20 hover:bg-white/25' : 'text-white/65 hover:text-white hover:bg-white/10'}`}
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
            )}
          </div>

          {/* Right: theme + account */}
          <div className="flex items-center gap-2">
            {isPortalSurface && activeTeam && (
              <LinkButton
                href={`/api/league/select?id=${encodeURIComponent(activeTeam.leagueId)}&next=${encodeURIComponent('/home')}`}
                variant="secondary"
                size="sm"
                className="hidden sm:inline-flex bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                Open Dashboard
              </LinkButton>
            )}
            <ThemeToggle />

            {/* Desktop account area */}
            <div className="hidden md:flex items-center gap-2">
              {authLoading ? (
                <span className="text-sm text-white/50 px-2">Loading…</span>
              ) : isLoggedIn ? (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className={`inline-flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10 ${
                      isAdmin ? 'text-amber-400' : 'text-white'
                    }`}
                    onClick={() => setAccountMenuOpen((v) => !v)}
                    title={accountButtonLabel}
                    aria-expanded={accountMenuOpen}
                  >
                    {sessionUser ? (
                      <UserAvatar displayName={displayName} size={28} />
                    ) : (
                      <UserAvatar displayName="Admin" size={28} />
                    )}
                    <span className="text-sm font-semibold max-w-[11rem] truncate hidden sm:inline">
                      {accountButtonLabel}
                    </span>
                    <span aria-hidden="true" className="text-xs opacity-70">▾</span>
                  </button>
                  {isAdmin && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 border border-[var(--surface)] text-[8px] flex items-center justify-center font-bold text-amber-900" title="League Admin">A</span>
                  )}

                  {accountMenuOpen && (
                    <div className="absolute right-0 mt-2 w-72 league-surface border border-[var(--border)] rounded shadow-lg p-1 z-50">

                      {/* Admin-only session (no user account) */}
                      {!sessionUser && isAdmin && (
                        <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                          <div className="text-sm font-semibold text-amber-500">Signed in as Admin</div>
                          <div className="text-xs text-[var(--muted)] mt-0.5">League admin mode is active</div>
                        </div>
                      )}

                      {/* User identity */}
                      {sessionUser && (
                        <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                          <div className="text-sm font-semibold text-[var(--text)] truncate">{displayName}</div>
                          {activeTeam ? (
                            <div className="text-xs text-[var(--muted)] truncate mt-0.5">
                              {activeTeam.teamName}
                              {activeTeam.isCommissioner && (
                                <span className="ml-1.5 text-[var(--accent)] font-medium">
                                  <span className="text-[var(--gold)]" aria-label="Commissioner">★</span> Commissioner
                                </span>
                              )}
                            </div>
                          ) : isAdmin ? (
                            <div className="text-xs text-amber-500 font-medium mt-0.5">League Admin</div>
                          ) : null}
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
                                <span className="block truncate text-xs text-[var(--muted)]">
                                  {league.teamName}
                                  {league.isCommissioner && <span className="ml-1 text-[var(--gold)]" aria-label="Commissioner">★</span>}
                                </span>
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

                      {/* Site admin tools (host-level) */}
                      {isSiteAdmin && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-amber-500 uppercase tracking-wide">Site Admin</div>
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
                            Exit Site Admin
                          </button>
                          <div className="my-1 border-t border-[var(--border)]" />
                        </>
                      )}

                      {/* League admin / commissioner tools */}
                      {(isAdmin || activeTeam?.isCommissioner) && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                            {activeTeam?.isCommissioner ? 'Commissioner' : 'League Admin'}
                          </div>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); router.push('/settings'); }}
                          >
                            League Settings
                          </button>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); router.push('/newsletter'); }}
                          >
                            Newsletter
                          </button>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); router.push('/admin/suggestions'); }}
                          >
                            Suggestions
                          </button>
                          {isAdmin && (
                            <button
                              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm text-red-500"
                              onClick={handleAdminLogout}
                            >
                              Exit Admin Mode
                            </button>
                          )}
                          <div className="my-1 border-t border-[var(--border)]" />
                        </>
                      )}

                      {/* Beta feedback — available to any authenticated tester */}
                      <button
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm font-medium text-[var(--accent)]"
                        onClick={() => { setAccountMenuOpen(false); openFeedback('Beta Feedback'); }}
                      >
                        💬 Send feedback / report a bug
                      </button>

                      {/* Account actions */}
                      {sessionUser && (
                        <>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm"
                            onClick={() => { setAccountMenuOpen(false); setChangePwOpen(true); }}
                          >
                            Change password
                          </button>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm text-[var(--muted)]"
                            onClick={() => { setAccountMenuOpen(false); openFeedback('Account Deletion Request'); }}
                          >
                            Request account deletion
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
                      {sessionUser ? (
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm text-red-500"
                          onClick={() => { setAccountMenuOpen(false); handleLogout(); }}
                          disabled={authLoading}
                        >
                          Sign out
                        </button>
                      ) : isAdmin ? (
                        <button
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--surface-strong)] text-sm text-red-500"
                          onClick={() => { setAccountMenuOpen(false); handleAdminLogout(); }}
                          disabled={authLoading}
                        >
                          Exit Admin Mode
                        </button>
                      ) : null}
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
                    className="inline-flex items-center gap-1 text-white/65 hover:text-white hover:bg-white/10"
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
                        href={`/super-admin/login?next=${encodeURIComponent(pathname)}`}
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
                className="text-white hover:bg-white/10"
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

      {/* League-site sub-nav (only for /l/[slug] pages which have their own nav) */}
      {isLeagueSite && menuBarItems.length > 0 && <div style={{ background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>}

      {/* Mobile menu — slide-in drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm md:hidden" onClick={closeMobile} aria-hidden="true" />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] z-50 md:hidden flex flex-col bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        id="mobile-menu"
        aria-labelledby="mobile-menu-button"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/LeagueZone HQ Logo.png" alt="" className="h-7 w-7 rounded object-contain" aria-hidden="true" />
            <span className="font-bold text-[var(--text)] text-sm">{isPortalSurface ? PLATFORM.name : leagueName ?? 'League'}</span>
          </div>
          <button
            type="button"
            onClick={closeMobile}
            className="p-2 rounded-lg hover:bg-[var(--surface-strong)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer nav links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {isPortalSurface && portalMenuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}
                onClick={closeMobile}
              >
                {item.label}
              </Link>
            );
          })}
          {!isPortalSurface && USER_NAV_CONFIG.map((item) => {
            const itemActive = isNavItemActive(item, pathname, currentQuery);
            const hasChildren = Boolean(item.children && item.children.length > 0);

            if (!hasChildren && item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isHrefActive(pathname, currentQuery, item.href) ? 'page' : undefined}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${itemActive ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}
                  onClick={closeMobile}
                >
                  {item.label}
                </Link>
              );
            }

            const expanded = Boolean(mobileExpanded[item.id]);
            return (
              <div key={item.id}>
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${itemActive ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}
                  onClick={() => toggleMobileSection(item.id)}
                  aria-expanded={expanded}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true" className={`text-xs transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>▸</span>
                </button>
                {expanded && (
                  <div className="ml-3 mt-0.5 pl-3 border-l border-[var(--border)] space-y-0.5">
                    {(() => {
                      const bestChild = findBestActive(item.children || [], pathname, currentQuery);
                      return (item.children || []).map((child) => {
                        const hasGrandChildren = Boolean(child.children && child.children.length > 0);
                        const childBranchActive = bestChild?.id === child.id || (child.children || []).some((g) => g.id === bestChild?.id);
                        if (!hasGrandChildren) {
                          return (
                            <Link key={child.id} href={child.href || '#'} onClick={closeMobile} className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${childBranchActive ? 'text-[var(--accent)] font-medium' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}>
                              {child.label}
                            </Link>
                          );
                        }
                        const childExpanded = Boolean(mobileExpanded[child.id]);
                        const bestGrand = findBestActive(child.children || [], pathname, currentQuery);
                        return (
                          <div key={child.id}>
                            <div className="flex items-center">
                              <Link href={child.href || '#'} onClick={closeMobile} className={`flex-1 px-3 py-2 rounded-l-lg text-sm ${childBranchActive ? 'text-[var(--accent)] font-medium' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}>
                                {child.label}
                              </Link>
                              <button type="button" className="p-2 text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => toggleMobileSection(child.id)} aria-expanded={childExpanded} aria-label={`Toggle ${child.label} submenu`}>
                                <span aria-hidden="true">{childExpanded ? '▾' : '▸'}</span>
                              </button>
                            </div>
                            {childExpanded && (
                              <div className="ml-3 pl-3 border-l border-[var(--border)] space-y-0.5">
                                {(child.children || []).map((grand) => {
                                  const grandActive = bestGrand?.id === grand.id;
                                  return (
                                    <Link key={grand.id} href={grand.href || '#'} onClick={closeMobile} className={`flex items-center px-3 py-2 rounded-lg text-sm ${grandActive ? 'text-[var(--accent)] font-medium' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}>
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
        </div>

        {/* Drawer footer — account */}
        <div className="border-t border-[var(--border)] px-3 py-4 flex-shrink-0 space-y-3">
          {isLoggedIn && (
            <button
              type="button"
              className="w-full text-center px-3 py-2 rounded-lg text-sm font-semibold text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)]/10 transition-colors"
              onClick={() => { closeMobile(); openFeedback('Beta Feedback'); }}
            >
              💬 Send feedback / report a bug
            </button>
          )}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isLoggedIn ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {sessionUser ? (
                  <UserAvatar displayName={displayName} size={28} />
                ) : (
                  <UserAvatar displayName="Admin" size={28} />
                )}
                <span className={`text-sm truncate flex-1 font-medium ${isAdmin ? 'text-amber-500' : 'text-[var(--text)]'}`}>
                  {accountButtonLabel}
                </span>
                {isAdmin && !sessionUser ? (
                  <Button size="sm" variant="ghost" onClick={() => { closeMobile(); handleAdminLogout(); }}>Exit</Button>
                ) : isSiteAdmin ? (
                  <Button size="sm" variant="ghost" onClick={() => { closeMobile(); handleSiteAdminLogout(); }}>Exit</Button>
                ) : sessionUser ? (
                  <Button size="sm" variant="ghost" onClick={() => { closeMobile(); handleLogout(); }}>Sign out</Button>
                ) : null}
              </div>
            ) : (
              <div className="flex gap-2 flex-1">
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

    {/* Beta Feedback / Account Deletion Request Modal */}
    <Modal
      open={feedbackOpen}
      onClose={() => { setFeedbackOpen(false); setFeedbackMsg(null); setFeedbackError(false); }}
      title={feedbackCategory === 'Account Deletion Request' ? 'Request account deletion' : 'Send feedback / report a bug'}
      autoFocusPanel={false}
    >
      <form onSubmit={handleSubmitFeedback} noValidate className="space-y-4">
        {feedbackCategory === 'Account Deletion Request' ? (
          <p className="text-sm text-[var(--muted)]">
            This sends a request to the team — we review deletions manually since league data (rosters,
            trades, suggestions) is often shared with other league members. Tell us what to remove.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Found a bug, confusing behavior, or incorrect league data? Let us know — we automatically
            include the current page{activeTeam?.leagueName ? ` and league (${activeTeam.leagueName})` : ''}
            {' '}for context, so you don&apos;t have to explain everything.
          </p>
        )}
        <div>
          <Label htmlFor="feedback-message">
            {feedbackCategory === 'Account Deletion Request' ? 'What would you like removed?' : 'What happened?'}
          </Label>
          <textarea
            id="feedback-message"
            rows={5}
            className="w-full league-surface border border-[var(--border)] rounded px-3 py-2 mt-1 text-sm"
            placeholder={feedbackCategory === 'Account Deletion Request'
              ? 'e.g. Please delete my account and personal data.'
              : 'Describe the bug or feedback in a sentence or two…'}
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            maxLength={3000}
          />
        </div>
        {feedbackCategory !== 'Account Deletion Request' && (
          <button
            type="button"
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] underline"
            onClick={() => openFeedback('Account Deletion Request')}
          >
            Want your account/data deleted instead?
          </button>
        )}
        {feedbackMsg && (
          <div className={`text-sm ${feedbackError ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`} role="status">{feedbackMsg}</div>
        )}
        <div className="flex items-center gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={feedbackLoading || feedbackMessage.trim().length < 3}>
            {feedbackLoading ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </Modal>
    </>
  );
}

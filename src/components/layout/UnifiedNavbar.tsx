'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Label from '@/components/ui/Label';
import { PLATFORM } from '@/lib/config/platform';
import { getLeagueSwitchDestination } from '@/lib/navigation/league-switch';
import { getNavigationSurface } from '@/lib/navigation/surfaces';

type SessionUser = {
  displayName: string | null;
  email: string;
  emailVerified: boolean;
  role?: string;
};

type UserLeague = {
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  teamName: string;
  isCommissioner: boolean;
};

type ActiveTeam = UserLeague;

type AuthPayload = {
  authenticated?: boolean;
  isAdmin?: boolean;
  isPlatformAdmin?: boolean;
  isSiteAdmin?: boolean;
  user?: SessionUser;
  activeTeam?: ActiveTeam | null;
  leagues?: UserLeague[];
};

function active(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function UnifiedNavbar() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams?.toString() || '';
  const surface = getNavigationSurface(pathname);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTeam, setActiveTeam] = useState<ActiveTeam | null>(null);
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then(async (authResponse) => {
        const auth = await authResponse.json().catch(() => ({})) as AuthPayload;
        if (!mounted) return;
        setUser(auth.authenticated && auth.user ? auth.user : null);
        setActiveTeam(auth.activeTeam || null);
        setLeagues(Array.isArray(auth.leagues) ? auth.leagues : []);
        setIsAdmin(Boolean(auth.isAdmin));
        setIsPlatformAdmin(Boolean(auth.isPlatformAdmin));
        setIsSiteAdmin(Boolean(auth.isSiteAdmin));
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setActiveTeam(null);
        setLeagues([]);
        setIsAdmin(false);
        setIsPlatformAdmin(false);
        setIsSiteAdmin(false);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setVerificationStatus(null);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (surface === 'league-site') return null;

  const platform = surface === 'platform';
  const signedIn = Boolean(user) || isAdmin;
  const displayName = user?.displayName || user?.email || (isAdmin ? 'Admin' : 'Account');
  const brandHref = platform ? '/' : activeTeam ? `/l/${activeTeam.leagueSlug}` : '/app';
  const brandLabel = platform ? PLATFORM.name : activeTeam?.leagueName || 'League Dashboard';

  const platformLinks = [
    { href: '/', label: 'Home' },
    { href: '/features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/demo', label: 'Demo' },
    ...(user ? [{ href: '/app', label: 'My Leagues' }] : []),
  ];

  const leagueLinks = activeTeam ? [
    { href: `/l/${activeTeam.leagueSlug}`, label: 'League Home' },
    { href: `/l/${activeTeam.leagueSlug}/teams`, label: 'Teams' },
    { href: `/l/${activeTeam.leagueSlug}/standings`, label: 'Standings' },
    { href: `/l/${activeTeam.leagueSlug}/rulebook`, label: 'Rulebook' },
    { href: `/l/${activeTeam.leagueSlug}/draft`, label: 'Draft' },
    { href: `/l/${activeTeam.leagueSlug}/trade-block`, label: 'Trade Block' },
    { href: `/l/${activeTeam.leagueSlug}/suggestions`, label: 'Suggestions' },
    { href: `/l/${activeTeam.leagueSlug}/history`, label: 'History' },
  ] : [];

  const dashboardHref = activeTeam
    ? `/api/league/select?id=${encodeURIComponent(activeTeam.leagueId)}&next=${encodeURIComponent('/home')}`
    : '/app';
  const teamSettingsHref = activeTeam
    ? `/api/league/select?id=${encodeURIComponent(activeTeam.leagueId)}&next=${encodeURIComponent('/settings')}`
    : '/settings';
  const commissionerHref = activeTeam
    ? `/api/league/select?id=${encodeURIComponent(activeTeam.leagueId)}&next=${encodeURIComponent(`/l/${activeTeam.leagueSlug}/admin`)}`
    : '/settings';

  const switchHref = (league: UserLeague): string => {
    const destination = getLeagueSwitchDestination(pathname, currentSearch, league);
    return `/api/league/select?id=${encodeURIComponent(league.leagueId)}&next=${encodeURIComponent(destination)}`;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
    setActiveTeam(null);
    setLeagues([]);
    setIsAdmin(false);
    setIsPlatformAdmin(false);
    router.push('/');
    router.refresh();
  };

  const exitAdmin = async () => {
    await fetch('/api/admin-login', { method: 'DELETE' }).catch(() => null);
    setIsAdmin(false);
    router.push('/');
    router.refresh();
  };

  const exitSiteAdmin = async () => {
    await fetch('/api/super-admin-login', { method: 'DELETE' }).catch(() => null);
    setIsSiteAdmin(false);
    setIsAdmin(false);
    router.push('/');
    router.refresh();
  };

  const resendVerification = async () => {
    setVerificationSending(true);
    setVerificationStatus(null);
    const response = await fetch('/api/auth/resend-verification', { method: 'POST' }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) as { error?: string; alreadyVerified?: boolean } : {};
    setVerificationSending(false);
    if (!response?.ok) {
      setVerificationStatus({ ok: false, message: body.error || 'Verification email could not be sent.' });
      return;
    }
    if (body.alreadyVerified) {
      setVerificationStatus({ ok: true, message: 'Your email is already verified.' });
      return;
    }
    setVerificationStatus({ ok: true, message: 'Verification email accepted for delivery. Check your inbox and spam folder.' });
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordStatus(null);
    if (newPassword.length < 8) {
      setPasswordError(true);
      setPasswordStatus('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      setPasswordStatus('New passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) as { error?: string } : {};
    setPasswordSaving(false);
    setPasswordError(!response?.ok);
    setPasswordStatus(response?.ok ? 'Password updated.' : body.error || 'Password update failed.');
    if (response?.ok) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const accountActions = (close?: () => void) => (
    <div className="divide-y divide-[var(--border)]">
      {user && (
        <div className="px-3 py-3">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{displayName}</p>
          {isPlatformAdmin && <p className="mt-0.5 text-xs font-semibold text-amber-500">Platform Admin</p>}
          {activeTeam && <p className="truncate text-xs text-[var(--muted)]">{activeTeam.teamName}{activeTeam.isCommissioner ? ' · Commissioner' : ''}</p>}
        </div>
      )}
      {leagues.length > 1 && (
        <div className="p-1">
          <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Switch League</p>
          {leagues.map((league) => (
            <a key={league.leagueId} href={switchHref(league)} onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">
              <span className="block truncate font-medium">{league.leagueName}</span>
              <span className="block truncate text-xs text-[var(--muted)]">{league.teamName}{league.isCommissioner ? ' · Commissioner' : ''}</span>
            </a>
          ))}
        </div>
      )}
      <div className="p-1">
        <Link href="/" onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">LeagueZone Home</Link>
        <Link href="/app" onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">My Leagues</Link>
        {activeTeam && <a href={`/l/${activeTeam.leagueSlug}`} onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">League Site</a>}
        {activeTeam && <a href={dashboardHref} onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">League Dashboard</a>}
        {user && <a href={teamSettingsHref} onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">Team & Account Settings</a>}
        {activeTeam && (activeTeam.isCommissioner || isAdmin) && <a href={commissionerHref} onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">Commissioner Settings</a>}
        {(activeTeam?.isCommissioner || isAdmin) && <Link href="/admin/suggestions" onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">Manage Suggestions</Link>}
      </div>
      {isPlatformAdmin && (
        <div className="p-1">
          <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-500">Platform Admin</p>
          <Link href="/admin" onClick={close} className="block rounded px-2 py-2 text-sm font-semibold text-amber-500 hover:bg-[var(--surface-strong)]">Admin Dashboard</Link>
          <Link href="/admin/tools" onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">QA & Testing Tools</Link>
          <Link href="/super-admin" onClick={close} className="block rounded px-2 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">League Management</Link>
        </div>
      )}
      {isSiteAdmin && !isPlatformAdmin && (
        <div className="p-1">
          <Link href="/super-admin" onClick={close} className="block rounded px-2 py-2 text-sm text-amber-500 hover:bg-[var(--surface-strong)]">Site Admin Dashboard</Link>
          <button type="button" onClick={() => { close?.(); exitSiteAdmin(); }} className="block w-full rounded px-2 py-2 text-left text-sm text-red-500 hover:bg-[var(--surface-strong)]">Exit Site Admin</button>
        </div>
      )}
      <div className="p-1">
        {user && <button type="button" onClick={() => { close?.(); setPasswordOpen(true); }} className="block w-full rounded px-2 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-strong)]">Change Password</button>}
        {user && !user.emailVerified && (
          <>
            <button type="button" disabled={verificationSending} onClick={resendVerification} className="block w-full rounded px-2 py-2 text-left text-sm text-amber-500 hover:bg-[var(--surface-strong)] disabled:opacity-50">
              {verificationSending ? 'Sending Verification Email…' : 'Resend Verification Email'}
            </button>
            {verificationStatus && <p className={`px-2 pb-2 text-xs leading-5 ${verificationStatus.ok ? 'text-emerald-500' : 'text-red-500'}`}>{verificationStatus.message}</p>}
          </>
        )}
        {user
          ? <button type="button" onClick={() => { close?.(); logout(); }} className="block w-full rounded px-2 py-2 text-left text-sm text-red-500 hover:bg-[var(--surface-strong)]">Sign Out</button>
          : isAdmin
            ? <button type="button" onClick={() => { close?.(); exitAdmin(); }} className="block w-full rounded px-2 py-2 text-left text-sm text-red-500 hover:bg-[var(--surface-strong)]">Exit Admin Mode</button>
            : null}
      </div>
    </div>
  );

  const visibleLinks = platform ? platformLinks : leagueLinks;

  return (
    <>
      <nav className="sticky top-0 z-50" style={{ background: 'var(--brand-navy)', boxShadow: 'inset 0 -4px 0 var(--brand-blue)' }}>
        <div className="container mx-auto flex h-20 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href={brandHref} className="flex min-w-0 items-center gap-2.5" aria-label={`${brandLabel} home`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/LeagueZone HQ Logo.png" alt="" aria-hidden="true" className="h-12 w-12 shrink-0 rounded-xl object-contain" />
              <span className="truncate text-lg font-black text-white sm:text-xl">{brandLabel}</span>
            </Link>
            <div className="hidden items-center gap-0.5 md:flex">
              {visibleLinks.map((item) => (
                <Link key={item.href} href={item.href} className={`rounded-md px-3 py-2 text-sm font-semibold ${active(pathname, item.href) ? 'bg-white/20 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {platform && activeTeam && <a href={dashboardHref} className="hidden rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 sm:inline-flex">League Dashboard</a>}
            <ThemeToggle />
            <div ref={accountRef} className="relative hidden md:block">
              {loading ? (
                <span className="px-2 text-sm text-white/45">Account</span>
              ) : signedIn ? (
                <>
                  <button type="button" onClick={() => setAccountOpen((value) => !value)} className={`rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10 ${isPlatformAdmin ? 'text-amber-400' : 'text-white'}`} aria-expanded={accountOpen}>{displayName} ▾</button>
                  {accountOpen && <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-xl">{accountActions(() => setAccountOpen(false))}</div>}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="text-sm font-semibold text-white/70 hover:text-white">Sign In</Link>
                  <Link href="/register" className="rounded-md bg-[var(--brand-gold)] px-3 py-2 text-xs font-black uppercase tracking-wider text-[var(--brand-ink)]">Sign Up</Link>
                </div>
              )}
            </div>
            <div className="md:hidden">
              <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">☰</Button>
            </div>
          </div>
        </div>
      </nav>

      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-black/55 md:hidden" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-80 max-w-[88vw] flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform md:hidden ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`} aria-label="Mobile navigation">
        <div className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4">
          <span className="truncate text-sm font-bold text-[var(--text)]">{brandLabel}</span>
          <button type="button" onClick={() => setMobileOpen(false)} className="rounded p-2 text-[var(--muted)]" aria-label="Close navigation menu">✕</button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleLinks.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${active(pathname, item.href) ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text)] hover:bg-[var(--surface-strong)]'}`}>{item.label}</Link>
          ))}
        </div>
        <div className="border-t border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <ThemeToggle />
            {!signedIn && <Link href={`/login?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)} className="text-sm font-bold text-[var(--accent)]">Sign In</Link>}
          </div>
          {signedIn && <div className="max-h-[48vh] overflow-y-auto">{accountActions(() => setMobileOpen(false))}</div>}
        </div>
      </aside>

      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Change password" autoFocusPanel={false}>
        <form onSubmit={changePassword} className="space-y-4">
          <div><Label htmlFor="current-password">Current password</Label><input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2" /></div>
          <div><Label htmlFor="new-password">New password</Label><input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2" /></div>
          <div><Label htmlFor="confirm-password">Confirm new password</Label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2" /></div>
          {passwordStatus && <p className={`text-sm ${passwordError ? 'text-red-500' : 'text-green-500'}`}>{passwordStatus}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPasswordOpen(false)}>Cancel</Button><Button type="submit" disabled={passwordSaving}>{passwordSaving ? 'Updating…' : 'Update Password'}</Button></div>
        </form>
      </Modal>
    </>
  );
}

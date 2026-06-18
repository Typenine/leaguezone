'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTeamLogoPath, getTeamColorStyle } from '@/lib/utils/team-utils';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface JoinContentProps {
  code: string;
  leagueId: string;
  leagueName: string | null;
  primaryColor: string | null;
}

interface AvailableRoster {
  id: string;
  teamName: string;
  rosterId: number | null;
}

type AuthState = 'loading' | 'guest' | 'authenticated';

export default function JoinContent({ code, leagueId, leagueName, primaryColor }: JoinContentProps) {
  const router = useRouter();
  const accent = primaryColor || 'var(--accent)';

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [rosters, setRosters] = useState<AvailableRoster[]>([]);
  const [rostersLoading, setRostersLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { setAuthState('guest'); return; }
        const data = await res.json();
        if (!data.authenticated || !data.user) { setAuthState('guest'); return; }
        // Check if already a member of this league
        const isMember = (data.leagues || []).some(
          (l: { leagueId: string }) => l.leagueId === leagueId
        );
        if (isMember) {
          setAlreadyMember(true);
          setAuthState('authenticated');
          return;
        }
        setAuthState('authenticated');
        // Load available rosters
        setRostersLoading(true);
        const rRes = await fetch(`/api/leagues/${leagueId}/available-rosters`);
        if (rRes.ok) {
          const rData = await rRes.json();
          setRosters(rData.rosters || []);
        }
        setRostersLoading(false);
      } catch {
        setAuthState('guest');
      }
    })();
  }, [leagueId]);

  const handleClaim = async () => {
    if (!selected) return;
    try {
      setClaiming(true);
      setClaimError(null);
      const res = await fetch(`/api/leagues/${leagueId}/claim-roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to claim roster');
      router.push('/home');
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Link href="/" aria-label="Website home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/LeagueZone HQ Logo.png"
            alt="LeagueZone HQ"
            className="w-20 h-20 object-contain"
          />
        </Link>
      </div>

      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="block w-6 h-px bg-[var(--brand-gold)]" />
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Join League</span>
        <span className="block w-6 h-px bg-[var(--brand-gold)]" />
      </div>
      {leagueName && (
        <p className="text-center text-xs text-[var(--brand-gold)] uppercase tracking-wider mb-1">{leagueName}</p>
      )}
      <h1 className="text-3xl font-black text-center text-white uppercase tracking-tight mb-8">
        Join the league
      </h1>

      <Card style={{ background: '#0d1422' }}>
        <CardContent className="pt-6">
          {authState === 'loading' && (
            <p className="text-center text-white/40 py-6 text-sm uppercase tracking-wider">Loading…</p>
          )}

          {authState === 'guest' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-white/50">
                You need an account to join. It only takes a moment.
              </p>
              <div className="flex flex-col gap-3">
                <Link href={`/register?invite=${code}`}>
                  <Button variant="primary" className="w-full">
                    Create account &amp; join
                  </Button>
                </Link>
                <Link href={`/login?next=/join/${code}`}>
                  <Button variant="secondary" className="w-full">
                    I already have an account
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {authState === 'authenticated' && alreadyMember && (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">✅</div>
              <p className="font-black text-white uppercase tracking-wide text-sm">You&apos;re already in this league!</p>
              <Link href="/home">
                <Button variant="primary">Go to League Home</Button>
              </Link>
            </div>
          )}

          {authState === 'authenticated' && !alreadyMember && (
            <div className="space-y-5">
              <p className="text-sm text-white/50">
                Pick your team from the available rosters below.
              </p>

              {rostersLoading ? (
                <p className="text-center text-white/40 py-4 text-sm">Loading rosters…</p>
              ) : rosters.length === 0 ? (
                <p className="text-center text-white/40 py-4 text-sm">
                  All rosters have been claimed. Contact your commissioner.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {rosters.map((r) => {
                    const isSelected = selected === r.id;
                    const logoStyle = getTeamColorStyle(r.teamName, 'secondary');
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelected(r.id)}
                        className={`border-2 p-3 flex flex-col items-center gap-2 transition-all focus:outline-none ${
                          isSelected
                            ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/10'
                            : 'border-[var(--border)] hover:border-[var(--brand-gold)]/40'
                        }`}
                        style={isSelected ? { borderColor: accent } : undefined}
                        aria-pressed={isSelected}
                      >
                        <div
                          className="w-12 h-12 overflow-hidden flex items-center justify-center"
                          style={logoStyle}
                        >
                          <Image
                            src={getTeamLogoPath(r.teamName)}
                            alt={r.teamName}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                        </div>
                        <span className="text-xs font-black text-center text-white uppercase tracking-wide leading-tight">
                          {r.teamName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {claimError && (
                <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">{claimError}</div>
              )}

              <Button
                onClick={handleClaim}
                disabled={!selected || claiming || rosters.length === 0}
                variant="primary"
                className="w-full"
              >
                {claiming ? 'Joining…' : 'This is my team — join league'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

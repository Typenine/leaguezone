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
    <div className="container mx-auto px-4 py-10 max-w-lg">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Link href="/" aria-label="Website home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/LeagueZone HQ Logo.png"
            alt="LeagueZone HQ"
            className="w-32 h-32 object-contain rounded-2xl"
          />
        </Link>
      </div>

      {leagueName && (
        <p className="text-center text-sm text-[var(--muted)] mb-2">{leagueName}</p>
      )}
      <h1 className="text-2xl font-bold text-center text-[var(--text)] mb-8">
        Join the league
      </h1>

      <Card>
        <CardContent className="pt-6">
          {/* Loading auth check */}
          {authState === 'loading' && (
            <p className="text-center text-[var(--muted)] py-6">Loading…</p>
          )}

          {/* Not logged in — prompt to register or sign in */}
          {authState === 'guest' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[var(--muted)]">
                You need an account to join. It only takes a moment.
              </p>
              <div className="flex flex-col gap-3">
                <Link href={`/register?invite=${code}`}>
                  <Button variant="primary" className="w-full">
                    Create account &amp; join
                  </Button>
                </Link>
                <Link href={`/login?next=/join/${code}`}>
                  <Button variant="ghost" className="w-full">
                    I already have an account
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Already a member */}
          {authState === 'authenticated' && alreadyMember && (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">✅</div>
              <p className="font-medium text-[var(--text)]">You&apos;re already in this league!</p>
              <Link href="/home">
                <Button variant="primary">Go to League Home</Button>
              </Link>
            </div>
          )}

          {/* Authenticated — pick a team */}
          {authState === 'authenticated' && !alreadyMember && (
            <div className="space-y-5">
              <p className="text-sm text-[var(--muted)]">
                Pick your team from the available rosters below.
              </p>

              {rostersLoading ? (
                <p className="text-center text-[var(--muted)] py-4">Loading rosters…</p>
              ) : rosters.length === 0 ? (
                <p className="text-center text-[var(--muted)] py-4">
                  All rosters have been claimed. Contact your commissioner.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rosters.map((r) => {
                    const isSelected = selected === r.id;
                    const logoStyle = getTeamColorStyle(r.teamName, 'secondary');
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelected(r.id)}
                        className={`rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] ${
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                            : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                        }`}
                        style={isSelected ? { borderColor: accent } : undefined}
                        aria-pressed={isSelected}
                      >
                        <div
                          className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center"
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
                        <span className="text-xs font-medium text-center text-[var(--text)] leading-tight">
                          {r.teamName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {claimError && (
                <div className="text-sm text-red-500" role="alert">{claimError}</div>
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
  );
}

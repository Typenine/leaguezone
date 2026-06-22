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
  inviteId: string;
  leagueId: string;
  teamName: string | null;
  rosterId: number | null;
  claimedBy: string | null;
  leagueName: string | null;
  primaryColor: string | null;
}

type AuthState = 'loading' | 'guest' | 'authenticated';

export default function JoinContent({
  code,
  inviteId,
  leagueId,
  teamName,
  claimedBy,
  leagueName,
  primaryColor,
}: JoinContentProps) {
  const router = useRouter();
  const accent = primaryColor || 'var(--accent)';

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  const alreadyClaimed = !!claimedBy;

  // Check auth status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { setAuthState('guest'); return; }
        const data = await res.json();
        if (!data.authenticated || !data.user) { setAuthState('guest'); return; }
        const isMember = (data.leagues || []).some(
          (l: { leagueId: string }) => l.leagueId === leagueId
        );
        setAlreadyMember(isMember);
        setAuthState('authenticated');
      } catch {
        setAuthState('guest');
      }
    })();
  }, [leagueId]);

  const handleClaim = async () => {
    try {
      setClaiming(true);
      setClaimError(null);
      const res = await fetch(`/api/leagues/${leagueId}/claim-roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to claim roster');
      setClaimSuccess(true);
      // Give the cookie a moment to settle, then navigate
      setTimeout(() => router.push('/home'), 600);
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="Website home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/LeagueZone HQ Logo.png" alt="LeagueZone HQ" className="w-20 h-20 object-contain" />
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
            {alreadyClaimed && (
              <div className="text-center space-y-3 py-4">
                <div className="text-4xl">🔒</div>
                <p className="font-black text-white uppercase tracking-wide text-sm">This invite has already been claimed.</p>
                <p className="text-sm text-white/50">Contact your commissioner for a new invite link.</p>
                <Link href="/"><Button variant="secondary">Return home</Button></Link>
              </div>
            )}

            {!alreadyClaimed && authState === 'loading' && (
              <p className="text-center text-white/40 py-6 text-sm uppercase tracking-wider">Loading…</p>
            )}

            {!alreadyClaimed && authState === 'guest' && (
              <div className="space-y-4">
                {teamName && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-16 h-16 overflow-hidden flex items-center justify-center" style={getTeamColorStyle(teamName, 'secondary')}>
                      <Image src={getTeamLogoPath(teamName)} alt={teamName} width={52} height={52} className="object-contain" />
                    </div>
                    <p className="text-sm text-white/70 text-center">
                      You&apos;ve been invited to manage <span className="font-black text-white">{teamName}</span>
                      {leagueName ? ` in ${leagueName}` : ''}.
                    </p>
                  </div>
                )}
                <p className="text-sm text-white/50 text-center">Create an account or log in to claim your team.</p>
                <div className="flex flex-col gap-3">
                  <Link href={`/register?invite=${code}`}>
                    <Button variant="primary" className="w-full">Create account &amp; claim team</Button>
                  </Link>
                  <Link href={`/login?next=/join/${code}`}>
                    <Button variant="secondary" className="w-full">I already have an account</Button>
                  </Link>
                </div>
              </div>
            )}

            {!alreadyClaimed && authState === 'authenticated' && alreadyMember && (
              <div className="text-center space-y-4 py-4">
                <div className="text-4xl">✅</div>
                <p className="font-black text-white uppercase tracking-wide text-sm">You&apos;re already in this league!</p>
                <Link href="/home"><Button variant="primary">Go to League Home</Button></Link>
              </div>
            )}

            {!alreadyClaimed && authState === 'authenticated' && !alreadyMember && (
              <div className="space-y-5">
                {teamName && (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-16 h-16 overflow-hidden flex items-center justify-center" style={getTeamColorStyle(teamName, 'secondary')}>
                      <Image src={getTeamLogoPath(teamName)} alt={teamName} width={52} height={52} className="object-contain" />
                    </div>
                    <p className="text-sm text-white/70 text-center">
                      Claim <span className="font-black text-white" style={{ color: accent }}>{teamName}</span>
                      {leagueName ? ` in ${leagueName}` : ''}.
                    </p>
                  </div>
                )}

                {claimSuccess && (
                  <div className="text-center text-green-400 font-black text-sm uppercase tracking-wide py-2">
                    ✅ Team claimed! Redirecting…
                  </div>
                )}

                {claimError && (
                  <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">{claimError}</div>
                )}

                {!claimSuccess && (
                  <Button onClick={handleClaim} disabled={claiming} variant="primary" className="w-full">
                    {claiming ? 'Claiming…' : `Claim ${teamName || 'this team'} — join league`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getFantasyTeamsClient } from '@/lib/fantasy/client';
import type { FantasyProviderId, FantasyTeamData } from '@/lib/providers/types';
import { getTeamColorStyle } from '@/lib/utils/team-utils';
import { TeamLogo } from '@/components/ui/TeamLogo';
import LoadingState from '@/components/ui/loading-state';
import ErrorState from '@/components/ui/error-state';
import { Card, CardContent } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';

export default function TeamsDirectory({ leagueSlug }: { leagueSlug?: string }) {
  const [teams, setTeams] = useState<FantasyTeamData[]>([]);
  const [provider, setProvider] = useState<FantasyProviderId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTimeByOwner, setAllTimeByOwner] = useState<Record<string, { wins: number; losses: number; ties: number }>>({});

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFantasyTeamsClient();
      setTeams(data.teams);
      setProvider(data.provider);
      setAllTimeByOwner(data.allTimeByOwner);
      setError(null);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError(err instanceof Error ? err.message : 'Failed to load teams. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTeams(); }, [fetchTeams]);

  if (loading) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Teams" /><LoadingState message="Loading teams..." /></div>;
  if (error) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Teams" /><ErrorState message={error} retry={fetchTeams} homeLink /></div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionHeader title="Teams" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {teams.map((team) => {
          const href = leagueSlug ? `/l/${encodeURIComponent(leagueSlug)}/teams/${team.rosterId}` : `/teams/${team.rosterId}`;
          const record = allTimeByOwner[team.ownerId] || { wins: team.wins, losses: team.losses, ties: team.ties };
          const card = (
            <Card className="overflow-hidden" style={{ borderTop: `4px solid ${getTeamColorStyle(team.teamName).backgroundColor as string}` }}>
              <div className="relative flex h-32 items-center justify-center" style={getTeamColorStyle(team.teamName)}>
                <TeamLogo teamName={team.teamName} size={100} className="object-contain p-2" />
              </div>
              <CardContent>
                <h3 className="text-center text-lg font-bold">{team.teamName}</h3>
                <div className="mt-2 text-center text-sm text-[var(--muted)]">{record.wins}-{record.losses}{record.ties > 0 ? `-${record.ties}` : ''}</div>
              </CardContent>
            </Card>
          );
          return provider === 'sleeper'
            ? <Link href={href} key={team.rosterId} className="block transition-transform duration-200 hover:opacity-90">{card}</Link>
            : <div key={team.rosterId}>{card}</div>;
        })}
      </div>
    </div>
  );
}

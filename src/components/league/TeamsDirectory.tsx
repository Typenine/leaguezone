'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getTeamsData, getTeamAllTimeStatsByOwner, TeamData } from '@/lib/utils/sleeper-api';
import { LEAGUE_IDS } from '@/lib/constants/league';
import { getTeamColorStyle } from '@/lib/utils/team-utils';
import { TeamLogo } from '@/components/ui/TeamLogo';
import LoadingState from '@/components/ui/loading-state';
import ErrorState from '@/components/ui/error-state';
import { Card, CardContent } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';

export default function TeamsDirectory({ leagueSlug }: { leagueSlug?: string }) {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTimeByOwner, setAllTimeByOwner] = useState<Record<string, { wins: number; losses: number; ties: number }>>({});

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const teamsData = await getTeamsData(LEAGUE_IDS.CURRENT);
      setTeams(teamsData);
      const uniqueOwners = Array.from(new Set(teamsData.map((team) => team.ownerId)));
      const pairs = await Promise.all(uniqueOwners.map(async (ownerId) => {
        const stats = await getTeamAllTimeStatsByOwner(ownerId);
        return [ownerId, { wins: stats.wins, losses: stats.losses, ties: stats.ties }] as const;
      }));
      const map: Record<string, { wins: number; losses: number; ties: number }> = {};
      for (const [ownerId, record] of pairs) map[ownerId] = record;
      setAllTimeByOwner(map);
      setError(null);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Failed to load teams. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  if (loading) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Teams" /><LoadingState message="Loading teams..." /></div>;
  if (error) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Teams" /><ErrorState message={error} retry={fetchTeams} homeLink /></div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionHeader title="Teams" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {teams.map((team) => {
          const href = leagueSlug ? `/l/${encodeURIComponent(leagueSlug)}/teams/${team.rosterId}` : `/teams/${team.rosterId}`;
          return (
            <Link href={href} key={team.rosterId} className="block transition-transform duration-200 hover:opacity-90">
              <Card className="overflow-hidden" style={{ borderTop: `4px solid ${getTeamColorStyle(team.teamName).backgroundColor as string}` }}>
                <div className="relative flex h-32 items-center justify-center" style={getTeamColorStyle(team.teamName)}>
                  <TeamLogo teamName={team.teamName} size={100} className="object-contain p-2" />
                </div>
                <CardContent>
                  <h3 className="text-center text-lg font-bold">{team.teamName}</h3>
                  <div className="mt-2 text-center text-sm text-[var(--muted)]">
                    {(allTimeByOwner[team.ownerId]?.wins ?? 0)}-{(allTimeByOwner[team.ownerId]?.losses ?? 0)}
                    {((allTimeByOwner[team.ownerId]?.ties ?? 0) > 0) ? `-${allTimeByOwner[team.ownerId]!.ties}` : ''}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

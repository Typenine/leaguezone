'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTeamsData, TeamData, getCurrentStreaksForLeague } from '@/lib/utils/sleeper-api';
import { CURRENT_SEASON, getAvailableSeasonYears, getLeagueIdForSeason } from '@/lib/constants/league';
import { getTeamColorStyle } from '@/lib/utils/team-utils';
import { TeamLogo } from '@/components/ui/TeamLogo';
import LoadingState from '@/components/ui/loading-state';
import ErrorState from '@/components/ui/error-state';
import { Card, CardContent } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import Label from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

type SortKey = 'wins' | 'losses' | 'ties' | 'fpts' | 'fptsAgainst';
type SortDirection = 'asc' | 'desc';

function SeasonPicker({
  years,
  selectedYear,
  onChange,
}: {
  years: string[];
  selectedYear: string;
  onChange: (year: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="year-select">Season</Label>
      <Select
        id="year-select"
        size="sm"
        value={selectedYear}
        onChange={(event) => onChange(event.target.value)}
        fullWidth={false}
      >
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </Select>
    </div>
  );
}

export default function StandingsPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([CURRENT_SEASON]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_SEASON);
  const [streaks, setStreaks] = useState<Record<number, { type: 'W' | 'L' | 'T' | null; length: number }>>({});
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'wins',
    direction: 'desc',
  });

  const refreshAvailableYears = useCallback(() => {
    const years = getAvailableSeasonYears();
    const nextYears = years.length > 0 ? years : [CURRENT_SEASON];
    setAvailableYears(nextYears);
    setSelectedYear((current) => nextYears.includes(current) ? current : nextYears[0]);
  }, []);

  useEffect(() => {
    refreshAvailableYears();
    window.addEventListener('leaguezone:league-changed', refreshAvailableYears);
    return () => window.removeEventListener('leaguezone:league-changed', refreshAvailableYears);
  }, [refreshAvailableYears]);

  const fetchStandings = useCallback(async () => {
    try {
      setLoading(true);
      const leagueId = getLeagueIdForSeason(selectedYear);
      if (!leagueId) {
        throw new Error(`No Sleeper league is configured for the ${selectedYear} season.`);
      }

      const [teamsData, streakMap] = await Promise.all([
        getTeamsData(leagueId),
        getCurrentStreaksForLeague(leagueId),
      ]);
      setTeams(teamsData);
      setStreaks(streakMap);
      setError(null);
    } catch (err) {
      console.error('Error fetching standings:', err);
      setTeams([]);
      setStreaks({});
      setError(err instanceof Error ? err.message : 'Failed to load standings. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTeams = [...teams].sort((a, b) => {
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }

    if (sortConfig.key !== 'fpts') {
      if (a.fpts > b.fpts) return -1;
      if (a.fpts < b.fpts) return 1;
    }
    return 0;
  });

  const teamsWithSeeds = sortedTeams.map((team, index) => ({
    ...team,
    seed: index + 1,
  }));

  const seasonPicker = (
    <SeasonPicker
      years={availableYears}
      selectedYear={selectedYear}
      onChange={setSelectedYear}
    />
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <SectionHeader title="Standings" actions={seasonPicker} />
        <LoadingState message={`Loading ${selectedYear} standings...`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <SectionHeader title="Standings" actions={seasonPicker} />
        <ErrorState message={error} retry={fetchStandings} homeLink />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionHeader title="Standings" actions={seasonPicker} />

      {teamsWithSeeds.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <h2 className="text-lg font-black text-[var(--text)]">No standings data available</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Sleeper returned no rosters for the {selectedYear} league. Confirm that this season&apos;s
              Sleeper league ID is connected in commissioner settings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <CardContent className="p-0">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6">
                    Seed
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6">
                    Team
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6"
                    aria-sort={sortConfig.key === 'wins' ? (sortConfig.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-1"
                      onClick={() => handleSort('wins')}
                      aria-label={`Sort by record ${sortConfig.key === 'wins' && sortConfig.direction === 'desc' ? 'ascending' : 'descending'}`}
                    >
                      Record
                      {sortConfig.key === 'wins' && (
                        <span className="ml-1" aria-hidden="true">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
                      )}
                    </Button>
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6"
                    aria-sort={sortConfig.key === 'fpts' ? (sortConfig.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
                  >
                    <Button variant="ghost" size="sm" className="px-1" onClick={() => handleSort('fpts')}>
                      PF
                      {sortConfig.key === 'fpts' && (
                        <span className="ml-1" aria-hidden="true">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
                      )}
                    </Button>
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6"
                    aria-sort={sortConfig.key === 'fptsAgainst' ? (sortConfig.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
                  >
                    <Button variant="ghost" size="sm" className="px-1" onClick={() => handleSort('fptsAgainst')}>
                      PA
                      {sortConfig.key === 'fptsAgainst' && (
                        <span className="ml-1" aria-hidden="true">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
                      )}
                    </Button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6">
                    Streak
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-transparent">
                {teamsWithSeeds.map((team) => (
                  <tr
                    key={team.rosterId}
                    className="cursor-pointer"
                    role="link"
                    tabIndex={0}
                    onClick={() => (window.location.href = `/teams/${team.rosterId}?year=${selectedYear}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        window.location.href = `/teams/${team.rosterId}?year=${selectedYear}`;
                      }
                    }}
                    style={{ borderLeft: `4px solid ${getTeamColorStyle(team.teamName).backgroundColor}` }}
                  >
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <div className="text-sm text-[var(--text)]">{team.seed}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <div className="flex items-center">
                        <div
                          className="mr-3 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full"
                          style={getTeamColorStyle(team.teamName)}
                        >
                          <TeamLogo teamName={team.teamName} size={24} className="object-contain" />
                        </div>
                        <div
                          className="text-sm font-medium"
                          style={{ color: (team.teamName === 'Double Trouble' || team.teamName === 'BeerNeverBrokeMyHeart') ? getTeamColorStyle(team.teamName, 'tertiary').backgroundColor : getTeamColorStyle(team.teamName).backgroundColor }}
                        >
                          {team.teamName}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <div className="text-sm text-[var(--text)]">
                        {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <div className="text-sm text-[var(--text)]">{team.fpts.toFixed(2)}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <div className="text-sm text-[var(--text)]">{team.fptsAgainst.toFixed(2)}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <div className="text-sm text-[var(--text)]">
                        {(() => {
                          const streak = streaks[team.rosterId];
                          return streak && streak.type && streak.length > 0 ? `${streak.type}${streak.length}` : '-';
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CURRENT_SEASON } from '@/lib/constants/league';
import { getFantasySeasonsClient, getFantasyStandingsClient } from '@/lib/fantasy/client';
import type { FantasyTeamData, FantasyStreak } from '@/lib/providers/types';
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

function SeasonPicker({ years, selectedYear, onChange }: { years: string[]; selectedYear: string; onChange: (year: string) => void }) {
  return <div className="flex items-center gap-2"><Label htmlFor="year-select">Season</Label><Select id="year-select" size="sm" value={selectedYear} onChange={(event) => onChange(event.target.value)} fullWidth={false}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</Select></div>;
}

export default function StandingsPage({ teamBasePath = '/teams' }: { teamBasePath?: string }) {
  const router = useRouter();
  const [teams, setTeams] = useState<FantasyTeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([CURRENT_SEASON]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_SEASON);
  const [streaks, setStreaks] = useState<Record<number, FantasyStreak>>({});
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'wins', direction: 'desc' });

  const refreshAvailableYears = useCallback(async () => {
    try {
      const data = await getFantasySeasonsClient();
      const years = data.seasons.map((item) => item.season);
      const nextYears = years.length > 0 ? years : [CURRENT_SEASON];
      setAvailableYears(nextYears);
      setSelectedYear((current) => nextYears.includes(current) ? current : (data.currentSeason || nextYears[0]));
    } catch { setAvailableYears([CURRENT_SEASON]); }
  }, []);

  useEffect(() => {
    void refreshAvailableYears();
    const handleLeagueChanged = () => void refreshAvailableYears();
    window.addEventListener('leaguezone:league-changed', handleLeagueChanged);
    return () => window.removeEventListener('leaguezone:league-changed', handleLeagueChanged);
  }, [refreshAvailableYears]);

  const fetchStandings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFantasyStandingsClient(selectedYear);
      setTeams(data.teams);
      setStreaks(data.streaks);
      setError(null);
    } catch (err) {
      console.error('Error fetching standings:', err);
      setTeams([]); setStreaks({});
      setError(err instanceof Error ? err.message : 'Failed to load standings. Please try again later.');
    } finally { setLoading(false); }
  }, [selectedYear]);

  useEffect(() => { void fetchStandings(); }, [fetchStandings]);
  const handleSort = (key: SortKey) => setSortConfig((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  const sortedTeams = [...teams].sort((a, b) => {
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (sortConfig.key !== 'fpts') return b.fpts - a.fpts;
    return 0;
  });
  const teamsWithSeeds = sortedTeams.map((team, index) => ({ ...team, seed: index + 1 }));
  const seasonPicker = <SeasonPicker years={availableYears} selectedYear={selectedYear} onChange={setSelectedYear} />;
  const teamHref = (rosterId: number) => `${teamBasePath}/${rosterId}?year=${encodeURIComponent(selectedYear)}`;

  if (loading) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Standings" actions={seasonPicker} /><LoadingState message={`Loading ${selectedYear} standings...`} /></div>;
  if (error) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Standings" actions={seasonPicker} /><ErrorState message={error} retry={fetchStandings} homeLink /></div>;

  return <div className="container mx-auto px-4 py-8"><SectionHeader title="Standings" actions={seasonPicker} />{teamsWithSeeds.length === 0 ? <Card><CardContent className="py-10 text-center"><h2 className="text-lg font-black text-[var(--text)]">No standings data available</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">No standings were returned for the {selectedYear} season. Confirm that this season is connected in commissioner settings.</p></CardContent></Card> : <Card className="overflow-x-auto"><CardContent className="p-0"><table className="min-w-full divide-y divide-[var(--border)]"><thead className="bg-[var(--surface)]"><tr><th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6">Seed</th><th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6">Team</th><th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6"><Button variant="ghost" size="sm" className="px-1" onClick={() => handleSort('wins')}>Record{sortConfig.key === 'wins' && <span className="ml-1">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>}</Button></th><th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6"><Button variant="ghost" size="sm" className="px-1" onClick={() => handleSort('fpts')}>PF{sortConfig.key === 'fpts' && <span className="ml-1">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>}</Button></th><th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6"><Button variant="ghost" size="sm" className="px-1" onClick={() => handleSort('fptsAgainst')}>PA{sortConfig.key === 'fptsAgainst' && <span className="ml-1">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>}</Button></th><th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)] sm:px-6">Streak</th></tr></thead><tbody className="divide-y divide-[var(--border)] bg-transparent">{teamsWithSeeds.map((team) => <tr key={team.rosterId} className="cursor-pointer" role="link" tabIndex={0} onClick={() => router.push(teamHref(team.rosterId))} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); router.push(teamHref(team.rosterId)); } }} style={{ borderLeft: `4px solid ${getTeamColorStyle(team.teamName).backgroundColor}` }}><td className="whitespace-nowrap px-4 py-4 sm:px-6"><div className="text-sm text-[var(--text)]">{team.seed}</div></td><td className="whitespace-nowrap px-4 py-4 sm:px-6"><div className="flex items-center"><div className="mr-3 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full" style={getTeamColorStyle(team.teamName)}><TeamLogo teamName={team.teamName} size={24} className="object-contain" /></div><div className="text-sm font-medium">{team.teamName}</div></div></td><td className="whitespace-nowrap px-4 py-4 sm:px-6"><div className="text-sm text-[var(--text)]">{team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}</div></td><td className="whitespace-nowrap px-4 py-4 sm:px-6"><div className="text-sm text-[var(--text)]">{team.fpts.toFixed(2)}</div></td><td className="whitespace-nowrap px-4 py-4 sm:px-6"><div className="text-sm text-[var(--text)]">{team.fptsAgainst.toFixed(2)}</div></td><td className="whitespace-nowrap px-4 py-4 sm:px-6"><div className="text-sm text-[var(--text)]">{streaks[team.rosterId]?.type && streaks[team.rosterId]?.length > 0 ? `${streaks[team.rosterId].type}${streaks[team.rosterId].length}` : '-'}</div></td></tr>)}</tbody></table></CardContent></Card>}</div>;
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SectionHeader from '@/components/ui/SectionHeader';
import LoadingState from '@/components/ui/loading-state';
import ErrorState from '@/components/ui/error-state';
import { getTeamLogoPath, getTeamColors } from '@/lib/utils/team-utils';
import { getTeamsData, getTeamAllTimeStatsByOwner } from '@/lib/utils/sleeper-api';
import { LEAGUE_IDS, CHAMPIONS } from '@/lib/constants/league';
import Image from 'next/image';

type RecordCategory = 'team' | 'game' | 'season' | 'player';

interface RecordEntry {
  title: string;
  holder: string;
  value: string;
  year: string;
}

export default function RecordsPage() {
  const [category, setCategory] = useState<RecordCategory>('team');
  const [teamRecords, setTeamRecords] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Team Records are computed from this league's real Sleeper data across all
  // configured seasons (see getTeamAllTimeStatsByOwner) — they used to be
  // hardcoded to the East v. West demo league's team names, which meant every
  // league on the platform saw the same fabricated stats. Game/season/player
  // records (single-game and single-player highs) require deeper per-week,
  // per-player aggregation that isn't computed anywhere yet, so — rather than
  // inventing numbers — those tabs show an honest "not enough data yet" state
  // until that aggregation is built.
  const loadTeamRecords = useCallback(async () => {
    try {
      setLoading(true);
      const teams = await getTeamsData(LEAGUE_IDS.CURRENT);
      if (teams.length === 0) {
        setTeamRecords([]);
        setError(null);
        return;
      }
      const uniqueOwners = Array.from(new Set(teams.map((t) => t.ownerId)));
      const statsByOwner = new Map<string, Awaited<ReturnType<typeof getTeamAllTimeStatsByOwner>>>();
      await Promise.all(
        uniqueOwners.map(async (ownerId) => {
          const stats = await getTeamAllTimeStatsByOwner(ownerId).catch(() => null);
          if (stats) statsByOwner.set(ownerId, stats);
        })
      );

      const teamNameByOwner = new Map(teams.map((t) => [t.ownerId, t.teamName]));

      let mostWins: { owner: string; wins: number } | null = null;
      let bestWinPct: { owner: string; pct: number } | null = null;
      let mostPoints: { owner: string; pts: number } | null = null;
      let highestSingleGame: { owner: string; pts: number } | null = null;

      for (const [ownerId, stats] of statsByOwner) {
        const games = stats.wins + stats.losses + stats.ties;
        if (games === 0) continue;
        if (!mostWins || stats.wins > mostWins.wins) mostWins = { owner: ownerId, wins: stats.wins };
        const pct = (stats.wins + stats.ties * 0.5) / games;
        if (!bestWinPct || pct > bestWinPct.pct) bestWinPct = { owner: ownerId, pct };
        if (!mostPoints || stats.totalPF > mostPoints.pts) mostPoints = { owner: ownerId, pts: stats.totalPF };
        if (!highestSingleGame || stats.highestScore > highestSingleGame.pts) {
          highestSingleGame = { owner: ownerId, pts: stats.highestScore };
        }
      }

      const records: RecordEntry[] = [];
      const seasonSpan = (() => {
        const years = Object.keys(LEAGUE_IDS.PREVIOUS || {});
        if (years.length === 0) return '';
        const sorted = years.sort();
        return `${sorted[0]}-present`;
      })();

      // Championships come from the CHAMPIONS config (populated per league/season
      // in @/lib/constants/league) rather than being hardcoded here.
      const championCounts = new Map<string, number>();
      for (const season of Object.values(CHAMPIONS)) {
        championCounts.set(season.champion, (championCounts.get(season.champion) || 0) + 1);
      }
      if (championCounts.size > 0) {
        const [topChampion, count] = Array.from(championCounts.entries()).sort((a, b) => b[1] - a[1])[0];
        records.push({ title: 'Most Championships', holder: topChampion, value: String(count), year: seasonSpan });
      }

      if (mostWins) {
        records.push({
          title: 'Most Regular Season Wins',
          holder: teamNameByOwner.get(mostWins.owner) || 'Unknown',
          value: String(mostWins.wins),
          year: seasonSpan,
        });
      }
      if (bestWinPct) {
        records.push({
          title: 'Best Win Percentage',
          holder: teamNameByOwner.get(bestWinPct.owner) || 'Unknown',
          value: `${(bestWinPct.pct * 100).toFixed(1)}%`,
          year: seasonSpan,
        });
      }
      if (mostPoints) {
        records.push({
          title: 'Most Points All-Time',
          holder: teamNameByOwner.get(mostPoints.owner) || 'Unknown',
          value: mostPoints.pts.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
          year: seasonSpan,
        });
      }
      if (highestSingleGame && highestSingleGame.pts > 0) {
        records.push({
          title: 'Highest Scoring Game (by a team)',
          holder: teamNameByOwner.get(highestSingleGame.owner) || 'Unknown',
          value: `${highestSingleGame.pts.toFixed(1)} pts`,
          year: seasonSpan,
        });
      }

      setTeamRecords(records);
      setError(null);
    } catch (err) {
      console.error('Error loading team records:', err);
      setError('Failed to load records. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (category === 'team') loadTeamRecords();
  }, [category, loadTeamRecords]);
  
  // Extract up to two team names from a holder string (single team, vs., or player team in parentheses)
  const extractTeamNames = (holder: string): string[] => {
    if (!holder) return [];
    if (/league average/i.test(holder)) return [];
    
    const parts = holder.split(/\s+vs\.?\s+/i);
    const teams: string[] = [];
    
    for (const part of parts) {
      // If it looks like "Player (Team)", prefer the team inside parentheses when it's not a score
      const m = part.match(/(.+?)\s*\(([^)]+)\)/);
      if (m) {
        const inside = m[2].trim();
        if (!/\d/.test(inside)) {
          teams.push(inside);
          continue;
        }
      }
      // Otherwise, strip any parenthetical score fragments
      const cleaned = part.replace(/\([^)]*\)/g, '').trim();
      if (cleaned && !/league average/i.test(cleaned)) {
        teams.push(cleaned);
      }
    }
    // Return unique, at most two
    return Array.from(new Set(teams)).slice(0, 2);
  };

  // Inline holder and split color strip use extractTeamNames()

  const renderHolderInline = (holder: string) => {
    const teams = extractTeamNames(holder);
    if (teams.length === 0) {
      return <p className="text-lg font-medium">{holder}</p>;
    }
    if (teams.length === 1) {
      const logo = getTeamLogoPath(teams[0]);
      return (
        <div className="mt-2 flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full league-surface border border-[var(--border)] overflow-hidden flex items-center justify-center shrink-0">
            <Image src={logo} alt={`${teams[0]} logo`} width={48} height={48} className="w-12 h-12 object-contain" />
          </div>
          <p className="text-lg font-medium">{holder}</p>
        </div>
      );
    }
    const [t1, t2] = teams;
    const l1 = getTeamLogoPath(t1);
    const l2 = getTeamLogoPath(t2);
    return (
      <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
        <div className="w-12 h-12 rounded-full league-surface border border-[var(--border)] overflow-hidden flex items-center justify-center shrink-0">
          <Image src={l1} alt={`${t1} logo`} width={48} height={48} className="w-12 h-12 object-contain" />
        </div>
        <p className="text-lg font-medium text-center">
          {holder}
        </p>
        <div className="w-12 h-12 rounded-full league-surface border border-[var(--border)] overflow-hidden flex items-center justify-center shrink-0">
          <Image src={l2} alt={`${t2} logo`} width={48} height={48} className="w-12 h-12 object-contain" />
        </div>
      </div>
    );
  };

  const renderTeamSplitStrip = (holder: string) => {
    const teams = extractTeamNames(holder);
    if (teams.length === 0) return null;
    if (teams.length === 1) {
      const c = getTeamColors(teams[0]).primary;
      return <div className="mt-3 h-1 w-full rounded" style={{ backgroundColor: c }} />;
    }
    const c1 = getTeamColors(teams[0]).primary;
    const c2 = getTeamColors(teams[1]).primary;
    return (
      <div className="mt-3 h-1 w-full rounded overflow-hidden flex">
        <div className="h-full w-1/2" style={{ backgroundColor: c1 }} />
        <div className="h-full w-1/2" style={{ backgroundColor: c2 }} />
      </div>
    );
  };
  
  // Game/season/player records require per-week, per-player historical
  // aggregation that isn't computed anywhere in the codebase yet. Rather than
  // showing fabricated numbers, these tabs are marked as not-yet-available.
  const getRecords = (): RecordEntry[] => {
    if (category === 'team') return teamRecords;
    return [];
  };
  const notYetAvailableMessage = 'Not enough historical data has been computed for this category yet — check back after more seasons are recorded.';
  
  return (
    <div className="container mx-auto px-4 py-8">
      <SectionHeader title="League Records" />
      
      {/* Category Tabs */}
      <div className="flex flex-wrap justify-center mb-8 gap-2">
        <button
          onClick={() => setCategory('team')}
          className={`px-4 py-2 rounded-md pill ${
            category === 'team'
              ? 'pill-active'
              : 'league-surface border border-[var(--border)] text-[var(--text)] pill-hover'
          }`}
        >
          Team Records
        </button>
        <button
          onClick={() => setCategory('game')}
          className={`px-4 py-2 rounded-md pill ${
            category === 'game'
              ? 'pill-active'
              : 'league-surface border border-[var(--border)] text-[var(--text)] pill-hover'
          }`}
        >
          Game Records
        </button>
        <button
          onClick={() => setCategory('season')}
          className={`px-4 py-2 rounded-md pill ${
            category === 'season'
              ? 'pill-active'
              : 'league-surface border border-[var(--border)] text-[var(--text)] pill-hover'
          }`}
        >
          Season Records
        </button>
        <button
          onClick={() => setCategory('player')}
          className={`px-4 py-2 rounded-md pill ${
            category === 'player'
              ? 'pill-active'
              : 'league-surface border border-[var(--border)] text-[var(--text)] pill-hover'
          }`}
        >
          Player Records
        </button>
      </div>
      
      {/* Records Grid */}
      {category === 'team' && loading ? (
        <LoadingState message="Loading records..." />
      ) : category === 'team' && error ? (
        <ErrorState message={error} retry={loadTeamRecords} homeLink />
      ) : getRecords().length === 0 ? (
        <p className="text-center text-[var(--muted)] py-12">{notYetAvailableMessage}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getRecords().map((record, index) => (
            <div key={index} className="league-surface rounded-lg shadow-md overflow-hidden">
              <div className="brand-fill text-on-brand px-4 py-2">
                <h3 className="text-lg font-bold">{record.title}</h3>
              </div>
              <div className="p-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent mb-2">{record.value}</p>
                  {renderHolderInline(record.holder)}
                  {renderTeamSplitStrip(record.holder)}
                  <p className="text-sm text-[var(--muted)] mt-1">{record.year}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-8 text-center">
        <Link 
          href="/history" 
          className="btn btn-primary"
        >
          Back to History
        </Link>
      </div>
    </div>
  );
}

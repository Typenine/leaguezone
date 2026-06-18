'use client';

import Link from 'next/link';
import { getTeamColorStyle } from '@/lib/utils/team-utils';
import { TeamLogo } from '@/components/ui/TeamLogo';
import { Card, CardContent } from '@/components/ui/Card';

interface MatchupCardProps {
  homeTeam: string;
  awayTeam: string;
  homeRosterId: number;
  awayRosterId: number;
  homeScore?: number;
  awayScore?: number;
  kickoffTime?: string;
  week: number;
  matchupId?: number;
  className?: string;
}

export default function MatchupCard({
  homeTeam,
  awayTeam,
  homeRosterId,
  awayRosterId,
  homeScore,
  awayScore,
  kickoffTime,
  week,
  matchupId,
  className = ''
}: MatchupCardProps) {
  const hasScores = homeScore !== undefined && awayScore !== undefined;
  const awayStyle = getTeamColorStyle(awayTeam);
  const homeStyle = getTeamColorStyle(homeTeam);
  const awayBg = (awayStyle.backgroundColor as string) || 'transparent';
  const homeBg = (homeStyle.backgroundColor as string) || 'transparent';
  
  return (
    <Card
      className={className}
      style={{ borderTop: `4px solid ${homeBg}`, borderBottom: `4px solid ${awayBg}` }}
    >
      <CardContent className="p-4">
        <div className="text-xs text-[var(--muted)] mb-2">Week {week}</div>
        
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mr-3 overflow-hidden"
              style={awayStyle}
            >
              <TeamLogo teamName={awayTeam} size={24} className="object-contain" />
            </div>
            <Link
              href={`/teams/${awayRosterId}`}
              aria-label={`View ${awayTeam} team page`}
              className="font-medium text-[var(--text)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] rounded-sm"
            >
              {awayTeam}
            </Link>
          </div>
          {hasScores ? (
            <div className="font-bold text-[var(--text)]">{Number(awayScore).toFixed(2)}</div>
          ) : null}
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mr-3 overflow-hidden"
              style={homeStyle}
            >
              <TeamLogo teamName={homeTeam} size={24} className="object-contain" />
            </div>
            <Link
              href={`/teams/${homeRosterId}`}
              aria-label={`View ${homeTeam} team page`}
              className="font-medium text-[var(--text)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] rounded-sm"
            >
              {homeTeam}
            </Link>
          </div>
          {hasScores ? (
            <div className="font-bold text-[var(--text)]">{Number(homeScore).toFixed(2)}</div>
          ) : null}
        </div>
        
        {!hasScores && kickoffTime && (
          <div className="mt-2 text-center text-sm text-[var(--muted)]">
            Kickoff: {kickoffTime}
          </div>
        )}

        {typeof matchupId === 'number' && (
          <div className="mt-3 flex justify-end">
            <Link
              href={`/matchups/${week}/${matchupId}`}
              className="text-[var(--accent)] text-sm font-medium hover:underline"
              aria-label={`View matchup details for Week ${week}`}
            >
              View matchup →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



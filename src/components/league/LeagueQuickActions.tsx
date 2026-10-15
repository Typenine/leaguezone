import Link from 'next/link';
import { ArrowLeftRight, CalendarDays, ClipboardList, Handshake, Search, Trophy, Users, type LucideIcon } from 'lucide-react';
import type { LeagueFeatureKey } from '@/lib/config/platform';
import { leagueUrl } from '@/lib/config/platform';

type Action = { id: string; title: string; description: string; href: string; icon: LucideIcon };
type Props = {
  slug: string;
  features: Record<LeagueFeatureKey, boolean>;
  rosterId?: number | null;
  full?: boolean;
};

export function getLeagueActions({ slug, features, rosterId }: Omit<Props, 'full'>): Action[] {
  const url = (segment: string) => leagueUrl(slug, segment);
  return [
    ...(features.teams && rosterId != null
      ? [{ id: 'my-team', title: 'My team', description: 'See your roster, players and team outlook.', href: url(`teams/${rosterId}`), icon: Users }]
      : []),
    ...(features.rosters
      ? [{ id: 'opportunities', title: rosterId != null ? 'My weekly decisions' : 'Find roster moves',
        description: rosterId != null ? 'Start/bench advice and waiver options for your team.' : 'Explore trade, waiver and lineup opportunities.',
        href: url('opportunities'), icon: Search }]
      : []),
    { id: 'trade-analyzer', title: 'Analyze a trade', description: 'Compare players and draft picks before a deal.', href: url('trades/analyzer'), icon: ArrowLeftRight },
    ...(features.tradeBlock
      ? [{ id: 'trade-block', title: 'Trade block', description: 'See who is available and what managers want.', href: url('trade-block'), icon: Handshake }]
      : []),
    ...(features.draft
      ? [{ id: 'draft', title: 'Draft center', description: 'View the draft, previous picks and prospect board.', href: url('draft'), icon: ClipboardList }]
      : []),
    { id: 'playoffs', title: 'Playoff picture', description: 'Check the standings and explore playoff scenarios.', href: url('standings/playoff-lab'), icon: Trophy },
    ...(features.matchups
      ? [{ id: 'schedule', title: 'Games & schedule', description: 'Follow weekly matchups and league results.', href: url('matchups'), icon: CalendarDays }]
      : []),
  ];
}

export default function LeagueQuickActions({ slug, features, rosterId = null, full = false }: Props) {
  const actions = getLeagueActions({ slug, features, rosterId });
  const featured = full ? actions : actions.slice(0, 4);

  return (
    <section aria-labelledby={full ? 'all-league-tools' : 'league-quick-tools'} className="mb-8 sm:mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={full ? 'all-league-tools' : 'league-quick-tools'} className="text-xl font-black tracking-tight text-[var(--text)] sm:text-2xl">
            {full ? 'League tools' : 'What do you want to do?'}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {full ? 'Every available tool for this league, in one place.' : 'Jump straight into a tool. The deeper numbers are below.'}
          </p>
        </div>
        {!full && <Link href={leagueUrl(slug, 'tools')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]">All tools</Link>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {featured.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              href={action.href}
              className="group flex min-h-36 flex-col items-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:p-5"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="text-sm font-black leading-snug sm:text-base">{action.title}</span>
              <span className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">{action.description}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

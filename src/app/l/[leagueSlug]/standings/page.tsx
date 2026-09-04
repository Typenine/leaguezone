import StandingsPage from '@/app/standings/page';
import Link from 'next/link';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';

export const dynamic = 'force-dynamic';

export default async function LeagueStandingsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <><div className="container mx-auto flex flex-wrap justify-end gap-2 px-4 pt-6"><LeagueShareCardLink leagueSlug={leagueSlug} type="standings" title="League Standings" /><Link href={`/l/${leagueSlug}/standings/playoff-lab`} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-black text-[var(--on-accent,#fff)]">Open Playoff Scenario Lab</Link></div><StandingsPage /></>;
}

import StandingsPage from '@/app/standings/page';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LeagueStandingsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <><div className="container mx-auto flex justify-end px-4 pt-6"><Link href={`/l/${leagueSlug}/standings/playoff-lab`} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-black text-white">Open Playoff Scenario Lab</Link></div><StandingsPage /></>;
}

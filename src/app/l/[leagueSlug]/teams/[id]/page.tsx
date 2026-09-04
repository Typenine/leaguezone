import TeamPage from '@/app/teams/[id]/page';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LeagueTeamPage({ params }: { params: Promise<{ leagueSlug: string; id: string }> }) {
  const { leagueSlug, id } = await params;
  return <><div className="container mx-auto flex justify-end px-4 pt-6"><Link href={`/l/${leagueSlug}/teams/${id}/health`} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-black text-[var(--on-accent,#fff)]">Team Health Center</Link></div><TeamPage /></>;
}

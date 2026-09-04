import HallOfFameClient from '@/components/hall-of-fame/HallOfFameClient';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';

export const dynamic = 'force-dynamic';

export default async function LeagueHallOfFamePage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <><div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={leagueSlug} type="hall-of-fame" title="Hall of Fame" /></div><HallOfFameClient /></>;
}

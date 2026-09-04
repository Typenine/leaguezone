import DraftPage from '@/app/draft/page';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';

export const dynamic = 'force-dynamic';

export default async function LeagueDraftPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <><div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={leagueSlug} type="draft" title="Draft Update" /></div><DraftPage /></>;
}

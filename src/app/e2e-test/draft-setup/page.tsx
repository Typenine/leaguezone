import { notFound } from 'next/navigation';
import LeagueDraftSetupPanel from '@/components/admin/LeagueDraftSetupPanel';

export const dynamic = 'force-dynamic';

export default function DraftSetupE2EPage() {
  if (process.env.E2E_TEST_MODE !== 'true') notFound();
  return <LeagueDraftSetupPanel leagueSlug="e2e-draft-league" />;
}

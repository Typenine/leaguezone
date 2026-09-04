import { notFound } from 'next/navigation';
import LeagueDraftCommissionerConsole from '@/components/admin/LeagueDraftCommissionerConsole';

export const dynamic = 'force-dynamic';

export default function DraftConsoleE2EPage() {
  if (process.env.E2E_TEST_MODE !== 'true') notFound();
  return <LeagueDraftCommissionerConsole leagueSlug="e2e-draft-league" />;
}

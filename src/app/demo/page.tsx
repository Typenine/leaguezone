import { redirect } from 'next/navigation';
import { DEFAULT_LEAGUE_SLUG, leagueUrl } from '@/lib/config/platform';

export default function DemoPage() {
  redirect(leagueUrl(DEFAULT_LEAGUE_SLUG));
}

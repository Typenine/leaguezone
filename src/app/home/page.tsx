import { redirect } from 'next/navigation';

/**
 * Legacy compatibility route.
 *
 * Middleware sends /home directly to the active league's canonical dashboard
 * when an active league slug is available. If someone reaches this page
 * without league context, return them to My Leagues instead of reviving the
 * old parallel dashboard.
 */
export default function LegacyHomePage() {
  redirect('/app');
}

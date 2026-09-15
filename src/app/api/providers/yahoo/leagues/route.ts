import { NextResponse } from 'next/server';
import { getYahooLeagues, isYahooAvailable } from '@/lib/providers/yahoo';
import { getFreshYahooAccessToken } from '@/lib/server/provider-accounts';
import { requireUser } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!isYahooAvailable()) {
    return NextResponse.json({ error: 'Yahoo Fantasy integration is not enabled.' }, { status: 503 });
  }

  try {
    const token = await getFreshYahooAccessToken(session.userId);
    const leagues = await getYahooLeagues(token);
    return NextResponse.json({ leagues });
  } catch (error) {
    console.error('[yahoo/leagues] Failed to load leagues:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json(
      { error: 'Could not load Yahoo leagues. Reconnect Yahoo and try again.' },
      { status: 502 },
    );
  }
}
